# ml_service/server.py
import json
import os
import re
import math
from typing import List, Optional
import numpy as np
import faiss
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ml_service.ingest_catalog import (
    extract_68d_audio_features,
    fetch_lyrics_and_detect_lang,
    l2_normalize,
    lyric_model,
)

app = FastAPI(title="TuneHub ML Similarity & FAISS Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
SCALER_PATH = os.path.join(ARTIFACTS_DIR, "scaler.npz")
CATALOG_PATH = os.path.join(ARTIFACTS_DIR, "catalog_embeddings.json")
AUDIO_INDEX_PATH = os.path.join(ARTIFACTS_DIR, "audio.index")
LYRIC_INDEX_PATH = os.path.join(ARTIFACTS_DIR, "lyric.index")

# 1. Load Z-score scaler parameters
scaler = np.load(SCALER_PATH)
AUDIO_MEAN = scaler["audio_mean"]
AUDIO_STD = scaler["audio_std"]

# 2. Load 194-track catalog with 68-D and 384-D embeddings
with open(CATALOG_PATH, "r", encoding="utf-8") as f:
    CATALOG_DATA = json.load(f)

CATALOG_TRACKS: List[dict] = CATALOG_DATA.get("tracks", [])
TRACK_INDEX_BY_ID = {int(t["trackId"]): idx for idx, t in enumerate(CATALOG_TRACKS)}

# 3. Load FAISS 68-D Audio & 384-D Lyric Indexes
if os.path.exists(AUDIO_INDEX_PATH) and os.path.exists(LYRIC_INDEX_PATH):
    audio_index = faiss.read_index(AUDIO_INDEX_PATH)
    lyric_index = faiss.read_index(LYRIC_INDEX_PATH)
else:
    audio_index = faiss.IndexFlatIP(68)
    lyric_index = faiss.IndexFlatIP(384)
    if CATALOG_TRACKS:
        audio_mat = np.array([t["audioEmbedding"] for t in CATALOG_TRACKS], dtype=np.float32)
        lyric_mat = np.array([t["lyricEmbedding"] for t in CATALOG_TRACKS], dtype=np.float32)
        audio_index.add(audio_mat)
        lyric_index.add(lyric_mat)

print(
    f"FAISS Service Ready: {len(CATALOG_TRACKS)} tracks | "
    f"audio.index={audio_index.ntotal} (68-D) | lyric.index={lyric_index.ntotal} (384-D)"
)


class TrackInput(BaseModel):
    trackId: int
    trackName: str
    artistName: str
    artistId: Optional[int] = 0
    collectionName: str = "Single"
    primaryGenreName: str = "Music"
    releaseDate: str = "2020-01-01"
    releaseYear: Optional[int] = None
    language: Optional[str] = None
    previewUrl: str = ""
    artworkUrl100: str = ""
    genreTags: Optional[List[str]] = None
    culturalThemes: Optional[List[str]] = None
    audioEmbedding: Optional[List[float]] = None
    lyricEmbedding: Optional[List[float]] = None


class Top10Request(BaseModel):
    seedTrack: TrackInput
    weights: Optional[dict] = None


def ip_to_unit_score(ip_val: float) -> float:
    """Maps inner product [-1, 1] of L2-normalized vectors to [0, 1]."""
    clamped = max(-1.0, min(1.0, float(ip_val)))
    return max(0.0, min(1.0, (clamped + 0.25) / 1.25))


def compute_metadata_breakdown(seed: dict, cand: dict) -> dict:
    # Genre score
    g_a = str(seed.get("primaryGenreName", "music")).lower().strip()
    g_b = str(cand.get("primaryGenreName", "music")).lower().strip()
    tags_a = set(str(x).lower() for x in (seed.get("genreTags") or [g_a]))
    tags_b = set(str(x).lower() for x in (cand.get("genreTags") or [g_b]))
    union_len = len(tags_a | tags_b)
    j_genre = len(tags_a & tags_b) / union_len if union_len else 0.0
    genre_sim = min(1.0, 0.8 + 0.2 * j_genre) if g_a == g_b else j_genre

    # Artist score
    art_a = str(seed.get("artistName", "")).lower().strip()
    art_b = str(cand.get("artistName", "")).lower().strip()
    if art_a and art_a == art_b:
        artist_sim = 1.0
    else:
        tokens_a = set(re.split(r"[,&/]|feat\.?|ft\.?|with", art_a))
        tokens_b = set(re.split(r"[,&/]|feat\.?|ft\.?|with", art_b))
        tokens_a = {t.strip() for t in tokens_a if t.strip()}
        tokens_b = {t.strip() for t in tokens_b if t.strip()}
        artist_sim = 0.85 if (tokens_a & tokens_b) else 0.0

    # Release Year score
    yr_a = int(seed.get("releaseYear") or 2020)
    yr_b = int(cand.get("releaseYear") or 2020)
    year_sim = math.exp(-abs(yr_a - yr_b) / 12.0)

    # Language score
    lang_a = str(seed.get("language") or "en").lower()[:2]
    lang_b = str(cand.get("language") or "en").lower()[:2]
    romance = {"fr", "es", "pt", "it"}
    if lang_a == lang_b:
        lang_sim = 1.0
    elif lang_a in romance and lang_b in romance:
        lang_sim = 0.35
    else:
        lang_sim = 0.0

    meta_raw = 0.35 * genre_sim + 0.25 * artist_sim + 0.20 * year_sim + 0.20 * lang_sim
    return {
        "metaRaw": meta_raw,
        "genreScore": round(genre_sim * 100),
        "artistScore": round(artist_sim * 100),
        "yearScore": round(year_sim * 100),
        "languageScore": round(lang_sim * 100),
    }


@app.get("/catalog")
def get_catalog():
    return {
        "count": len(CATALOG_TRACKS),
        "audioDim": 68,
        "lyricDim": 384,
        "tracks": CATALOG_TRACKS,
    }


@app.post("/embed")
def embed_live_track(track: TrackInput):
    # Return immediately if already indexed in our 194-track catalog
    if track.trackId in TRACK_INDEX_BY_ID:
        return CATALOG_TRACKS[TRACK_INDEX_BY_ID[track.trackId]]

    raw_audio = extract_68d_audio_features(track.previewUrl)
    if np.linalg.norm(raw_audio) > 0:
        std_audio = (raw_audio - AUDIO_MEAN) / AUDIO_STD
        norm_audio = l2_normalize(std_audio)
    else:
        norm_audio = np.zeros(68, dtype=np.float32)

    semantic_doc, lang, has_lyrics = fetch_lyrics_and_detect_lang(
        track.trackName,
        track.artistName,
        track.collectionName,
        track.primaryGenreName,
        "US",
    )
    raw_lyric = list(lyric_model.embed([semantic_doc]))[0]
    norm_lyric = l2_normalize(raw_lyric)

    release_year = (
        track.releaseYear
        if track.releaseYear
        else (int(track.releaseDate[:4]) if track.releaseDate[:4].isdigit() else 2020)
    )

    enriched_record = {
        **track.dict(),
        "releaseYear": release_year,
        "language": lang,
        "hasLyrics": has_lyrics,
        "genreTags": track.genreTags or [track.primaryGenreName, f"{release_year // 10 * 10}s"],
        "culturalThemes": track.culturalThemes or [track.primaryGenreName, f"{release_year}s"],
        "audioEmbedding": [round(float(x), 4) for x in norm_audio.tolist()],
        "lyricEmbedding": [round(float(x), 4) for x in norm_lyric.tolist()],
        "embeddingStatus": "verified_ml_vectors",
    }

    # Dynamically append to in-memory FAISS indexes & catalog
    if np.linalg.norm(norm_audio) > 0 and np.linalg.norm(norm_lyric) > 0:
        TRACK_INDEX_BY_ID[int(track.trackId)] = len(CATALOG_TRACKS)
        CATALOG_TRACKS.append(enriched_record)
        audio_index.add(np.array([norm_audio], dtype=np.float32))
        lyric_index.add(np.array([norm_lyric], dtype=np.float32))

    return enriched_record


@app.post("/top10")
def get_faiss_top10(payload: Top10Request):
    seed = payload.seedTrack.dict()
    seed_id = int(seed["trackId"])

    # Resolve or compute 68-D and 384-D vectors for the seed track
    if seed_id in TRACK_INDEX_BY_ID:
        seed_record = CATALOG_TRACKS[TRACK_INDEX_BY_ID[seed_id]]
    elif (
        seed.get("audioEmbedding")
        and len(seed["audioEmbedding"]) == 68
        and seed.get("lyricEmbedding")
        and len(seed["lyricEmbedding"]) == 384
    ):
        seed_record = seed
    else:
        seed_record = embed_live_track(payload.seedTrack)

    q_audio = np.array([seed_record["audioEmbedding"]], dtype=np.float32)
    q_lyric = np.array([seed_record["lyricEmbedding"]], dtype=np.float32)

    ntotal = audio_index.ntotal
    if ntotal == 0:
        raise HTTPException(status_code=404, detail="FAISS index is empty")

    # Query FAISS indexes across the catalog
    audio_ips, audio_idxs = audio_index.search(q_audio, ntotal)
    lyric_ips, lyric_idxs = lyric_index.search(q_lyric, ntotal)

    audio_score_map = {
        int(idx): ip_to_unit_score(ip)
        for ip, idx in zip(audio_ips[0], audio_idxs[0])
        if idx >= 0
    }
    lyric_score_map = {
        int(idx): ip_to_unit_score(ip)
        for ip, idx in zip(lyric_ips[0], lyric_idxs[0])
        if idx >= 0
    }

    weights = payload.weights or {"audio": 0.45, "lyric": 0.30, "meta": 0.25}
    w_a = weights.get("audio", 0.45)
    w_l = weights.get("lyric", 0.30)
    w_m = weights.get("meta", 0.25)

    results = []
    for idx, cand in enumerate(CATALOG_TRACKS):
        if int(cand["trackId"]) == seed_id and cand["trackName"] == seed_record["trackName"]:
            continue

        a_sim = audio_score_map.get(idx, 0.0)
        l_sim = lyric_score_map.get(idx, 0.0)
        meta_info = compute_metadata_breakdown(seed_record, cand)
        m_sim = meta_info["metaRaw"]

        overall = round(min(1.0, max(0.0, w_a * a_sim + w_l * l_sim + w_m * m_sim)) * 100)
        breakdown = {
            "overallScore": overall,
            "audioScore": round(a_sim * 100),
            "lyricScore": round(l_sim * 100),
            "metaScore": round(m_sim * 100),
            "embeddingMode": "faiss_68d_384d",
            "details": {
                "genreScore": meta_info["genreScore"],
                "artistScore": meta_info["artistScore"],
                "yearScore": meta_info["yearScore"],
                "languageScore": meta_info["languageScore"],
            },
        }
        results.append({
            **cand,
            "similarity": overall,
            "breakdown": breakdown,
        })

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return {"seedTrackId": seed_id, "results": results[:10]}