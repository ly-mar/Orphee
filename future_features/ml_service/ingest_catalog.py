# ml_service/ingest_catalog.py
import io
import json
import os
import tempfile
import urllib.parse
import numpy as np
import requests
import librosa
import faiss
from fastembed import TextEmbedding
from langdetect import detect, DetectorFactory

DetectorFactory.seed = 42

# Load INT8 quantized Multilingual MiniLM via ONNX Runtime (~240MB RAM, no PyTorch required)
print("Loading ONNX INT8 Multilingual-MiniLM-L12-v2 model...")
lyric_model = TextEmbedding(
    model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)

SEED_QUERIES = [
    ("90s r&b neo soul", "US", 25),
    ("boom bap hip hop classic", "US", 25),
    ("80s synthpop new wave", "US", 25),
    ("indie dream pop shoegaze", "US", 25),
    ("afrobeats amapiano", "NG", 25),
    ("rap francais", "FR", 25),
    ("reggaeton urbano latino", "ES", 25),
    ("70s classic rock", "US", 25),
]


def l2_normalize(vec: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vec)
    if norm < 1e-9:
        return np.zeros_like(vec, dtype=np.float32)
    return (vec / norm).astype(np.float32)


def extract_68d_audio_features(preview_url: str) -> np.ndarray:
    """
    Downloads the real 30-second iTunes .m4a stream and extracts a 68-D acoustic vector:
    - 20 MFCC means + 20 MFCC stds (40) : Timbre & vocal envelope
    - 12 Chroma CQT means (12)          : Pitch class / harmonic key profile
    - 6 Tonnetz means (6)               : Tonal centroid / chord intervals
    - 7 Spectral Contrast means (7)     : Peak-to-valley harmonic texture
    - 1 Spectral Centroid mean (1)      : Brightness
    - 1 Zero-Crossing Rate mean (1)     : Percussiveness / noisiness
    - 1 Normalized Tempo BPM (1)        : Rhythm pace
    """
    if not preview_url:
        return np.zeros(68, dtype=np.float32)

    resp = requests.get(preview_url, timeout=10)
    resp.raise_for_status()

    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=True) as tmp:
        tmp.write(resp.content)
        tmp.flush()
        # Load 15 seconds from the middle of the preview at 22.05 kHz mono to keep RAM low
        y, sr = librosa.load(tmp.name, sr=22050, mono=True, offset=5.0, duration=15.0)

    if len(y) < sr:
        return np.zeros(68, dtype=np.float32)

    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    mfcc_mean = np.mean(mfcc, axis=1)
    mfcc_std = np.std(mfcc, axis=1)

    y_harmonic, y_percussive = librosa.effects.hpss(y)
    chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)

    tonnetz = librosa.feature.tonnetz(y=y_harmonic, sr=sr)
    tonnetz_mean = np.mean(tonnetz, axis=1)

    contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
    contrast_mean = np.mean(contrast, axis=1)

    centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)) / (sr / 2.0)
    zcr = np.mean(librosa.feature.zero_crossing_rate(y=y))
    tempo, _ = librosa.beat.beat_track(y=y_percussive, sr=sr)
    tempo_val = float(np.ndim(tempo) and tempo[0] or tempo) / 200.0

    raw_vec = np.concatenate([
        mfcc_mean,
        mfcc_std,
        chroma_mean,
        tonnetz_mean,
        contrast_mean,
        [centroid, zcr, tempo_val],
    ]).astype(np.float32)

    return raw_vec


def fetch_lyrics_and_detect_lang(track_name: str, artist_name: str, collection_name: str, genre: str, country: str):
    """
    Queries LRCLIB for real track lyrics (never stored in repo to respect copyright),
    detects ISO language code, and returns text for transformer embedding.
    """
    lyrics_text = ""
    try:
        q = urllib.parse.urlencode({"track_name": track_name, "artist_name": artist_name})
        r = requests.get(f"https://lrclib.net/api/get?{q}", timeout=4)
        if r.status_code == 200:
            data = r.json()
            lyrics_text = data.get("plainLyrics") or ""
    except Exception:
        pass

    sample_for_lang = lyrics_text[:500] if len(lyrics_text) > 40 else f"{track_name} {collection_name}"
    try:
        lang = detect(sample_for_lang)
    except Exception:
        lang = "fr" if country == "FR" else ("es" if country == "ES" else "en")

    # Build semantic document for the multilingual sentence transformer
    semantic_doc = (
        f"Track: {track_name} by {artist_name}. Album: {collection_name}. "
        f"Genre: {genre}. Language: {lang}. "
        f"Themes & Lyrics: {lyrics_text[:1200]}"
    )
    return semantic_doc, lang, bool(lyrics_text)


def build_catalog():
    raw_tracks = {}
    for term, country, limit in SEED_QUERIES:
        url = "https://itunes.apple.com/search"
        params = {"term": term, "media": "music", "entity": "song", "country": country, "limit": limit}
        try:
            res = requests.get(url, params=params, timeout=8).json()
            for item in res.get("results", []):
                tid = item.get("trackId")
                if tid and item.get("previewUrl") and tid not in raw_tracks:
                    item["_seed_country"] = country
                    raw_tracks[tid] = item
        except Exception as e:
            print(f"Search warning ({term}): {e}")

    print(f"Collected {len(raw_tracks)} unique tracks with audio streams. Extracting features...")

    catalog_records = []
    audio_matrix = []
    semantic_docs = []

    for idx, (tid, item) in enumerate(raw_tracks.items()):
        title = item.get("trackName", "Unknown")
        artist = item.get("artistName", "Unknown")
        album = item.get("collectionName", "Single")
        genre = item.get("primaryGenreName", "Music")
        release_date = item.get("releaseDate", "2020-01-01T00:00:00Z")
        release_year = int(release_date[:4]) if release_date and release_date[:4].isdigit() else 2020
        preview_url = item.get("previewUrl", "")
        country = item.get("_seed_country", "US")

        try:
            audio_vec = extract_68d_audio_features(preview_url)
        except Exception as e:
            print(f"Skipping audio for {title}: {e}")
            continue

        semantic_doc, lang, has_lyrics = fetch_lyrics_and_detect_lang(
            title, artist, album, genre, country
        )

        audio_matrix.append(audio_vec)
        semantic_docs.append(semantic_doc)
        catalog_records.append({
            "trackId": int(tid),
            "trackName": title,
            "artistName": artist,
            "artistId": int(item.get("artistId", 0)),
            "collectionName": album,
            "artworkUrl100": item.get("artworkUrl100", ""),
            "previewUrl": preview_url,
            "primaryGenreName": genre,
            "releaseDate": release_date,
            "releaseYear": release_year,
            "language": lang,
            "hasLyrics": has_lyrics,
            "genreTags": [genre, f"{release_year // 10 * 10}s"],
        })

        if (idx + 1) % 10 == 0:
            print(f"Processed {idx + 1}/{len(raw_tracks)} tracks...")

    # 1. Corpus-wide Z-score standardization on the 68-D audio features + L2 normalization
    audio_np = np.vstack(audio_matrix)
    audio_mean = np.mean(audio_np, axis=0)
    audio_std = np.std(audio_np, axis=0) + 1e-6
    audio_standardized = (audio_np - audio_mean) / audio_std
    audio_normalized = np.array([l2_normalize(v) for v in audio_standardized], dtype=np.float32)

    # 2. Batch-compute 384-D multilingual transformer embeddings via ONNX Runtime
    print("Computing 384-D Multilingual-MiniLM embeddings via ONNX...")
    lyric_embeddings = list(lyric_model.embed(semantic_docs))
    lyric_normalized = np.array([l2_normalize(v) for v in lyric_embeddings], dtype=np.float32)

    # 3. Build FAISS Inner-Product indexes
    audio_index = faiss.IndexFlatIP(68)
    audio_index.add(audio_normalized)

    lyric_index = faiss.IndexFlatIP(384)
    lyric_index.add(lyric_normalized)

    os.makedirs("ml_service/artifacts", exist_ok=True)
    faiss.write_index(audio_index, "ml_service/artifacts/audio.index")
    faiss.write_index(lyric_index, "ml_service/artifacts/lyric.index")
    np.savez(
        "ml_service/artifacts/scaler.npz",
        audio_mean=audio_mean,
        audio_std=audio_std,
    )

    # 4. Export compact JSON index for React Native / Expo & FastAPI
    for i, rec in enumerate(catalog_records):
        rec["audioEmbedding"] = [round(float(x), 4) for x in audio_normalized[i]]
        rec["lyricEmbedding"] = [round(float(x), 4) for x in lyric_normalized[i]]

    with open("ml_service/artifacts/catalog_embeddings.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "audioMean": [round(float(x), 5) for x in audio_mean],
                "audioStd": [round(float(x), 5) for x in audio_std],
                "tracks": catalog_records,
            },
            f,
        )

    print(f"Successfully indexed {len(catalog_records)} tracks into FAISS and catalog_embeddings.json!")


if __name__ == "__main__":
    build_catalog()