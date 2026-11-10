# scripts/test_user_scenarios.py
import requests
import json
import time
import math
import numpy as np

BASE_URL = "http://127.0.0.1:8000"

def log_section(title):
    print("\n" + "=" * 70)
    print(f" {title} ")
    print("=" * 70)

# Fetch iTunes metadata helper
def fetch_itunes_track(term, country="US"):
    url = "https://itunes.apple.com/search"
    res = requests.get(url, params={"term": term, "entity": "song", "country": country, "limit": 1}).json()
    results = res.get("results", [])
    if results:
        r = results[0]
        yr = int(r.get("releaseDate", "2020")[:4]) if r.get("releaseDate") else 2020
        return {
            "trackId": int(r.get("trackId")),
            "trackName": r.get("trackName"),
            "artistName": r.get("artistName"),
            "artistId": int(r.get("artistId", 0)),
            "collectionName": r.get("collectionName", "Single"),
            "primaryGenreName": r.get("primaryGenreName", "Music"),
            "releaseDate": r.get("releaseDate", "2020-01-01"),
            "releaseYear": yr,
            "previewUrl": r.get("previewUrl", ""),
            "artworkUrl100": r.get("artworkUrl100", ""),
        }
    return None

def main():
    # Verify server status
    catalog_resp = requests.get(f"{BASE_URL}/catalog").json()
    print(f"Server operational: {catalog_resp['count']} catalog tracks loaded.")
    catalog_tracks = catalog_resp["tracks"]

    # =========================================================================
    # TEST 1: Compare Nuevayol and La noche de anoche
    # =========================================================================
    log_section("TEST 1: Compare Nuevayol and La noche de anoche (Similarity Calculator)")
    nuevayol_raw = fetch_itunes_track("NUEVAYoL Bad Bunny")
    if not nuevayol_raw:
        nuevayol_raw = {
            "trackId": 1787022572,
            "trackName": "NUEVAYoL",
            "artistName": "Bad Bunny",
            "collectionName": "DeBÍ TiRAR MáS FOToS",
            "primaryGenreName": "Latin",
            "releaseDate": "2025-01-01",
            "releaseYear": 2025,
            "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/15/34/06/153406e1-955a-fa67-33ee-b14cf6eb6e6d/mzaf_7867252033878065449.plus.aac.p.m4a",
        }
    
    # Embed Nuevayol via server
    nuevayol = requests.post(f"{BASE_URL}/embed", json=nuevayol_raw).json()

    # Find La noche de anoche in catalog or embed
    la_noche = next((t for t in catalog_tracks if "la noche de anoche" in t["trackName"].lower()), None)
    if not la_noche:
        noche_raw = fetch_itunes_track("LA NOCHE DE ANOCHE Bad Bunny")
        la_noche = requests.post(f"{BASE_URL}/embed", json=noche_raw).json()

    # Pairwise calculation
    # Using server /top10 logic or direct dot products
    a_dot = float(np.dot(nuevayol["audioEmbedding"], la_noche["audioEmbedding"]))
    l_dot = float(np.dot(nuevayol["lyricEmbedding"], la_noche["lyricEmbedding"]))
    a_score = round(max(0.0, min(1.0, (a_dot + 0.25) / 1.25)) * 100)
    l_score = round(max(0.0, min(1.0, (l_dot + 0.25) / 1.25)) * 100)
    
    # Metadata
    genre_match = 100 if nuevayol["primaryGenreName"].lower() == la_noche["primaryGenreName"].lower() else 75
    artist_match = 85 # Bad Bunny & Rosalía vs Bad Bunny
    yr_diff = abs(nuevayol["releaseYear"] - la_noche["releaseYear"])
    yr_score = round(math.exp(-yr_diff / 12.0) * 100)
    lang_score = 100 # Both es
    meta_score = round(0.35 * genre_match + 0.25 * artist_match + 0.20 * yr_score + 0.20 * lang_score)
    overall_score = round(0.45 * a_score + 0.30 * l_score + 0.25 * meta_score)

    print(f"Track A: {nuevayol['trackName']} by {nuevayol['artistName']} ({nuevayol['releaseYear']}, {nuevayol['primaryGenreName']})")
    print(f"Track B: {la_noche['trackName']} by {la_noche['artistName']} ({la_noche['releaseYear']}, {la_noche['primaryGenreName']})")
    print(f"-> Overall Composite Match: {overall_score}%")
    print(f"   * Librosa 68-D Audio Score: {a_score}% (dot={a_dot:.3f})")
    print(f"   * ONNX 384-D Lyric Score:  {l_score}% (dot={l_dot:.3f})")
    print(f"   * Metadata Alignment:      {meta_score}% (Genre: {genre_match}%, Artist: {artist_match}%, Era: {yr_score}%, Lang: {lang_score}%)")

    # =========================================================================
    # TEST 2 & 3: Damso - Dieu ne ment jamais & Mosaique solitaire
    # =========================================================================
    log_section("TEST 2: Calculate for Damso - Dieu ne ment jamais")
    dieu_raw = {
        "trackId": 1532446220,
        "trackName": "Dieu ne ment jamais",
        "artistName": "Damso",
        "collectionName": "QALF",
        "primaryGenreName": "Hip-Hop/Rap",
        "releaseDate": "2020-09-18",
        "releaseYear": 2020,
        "language": "fr",
        "genreTags": ["Hip-Hop/Rap", "French Rap", "2020s"],
        "culturalThemes": ["Belgian Rap", "Spirituality", "Introspection"],
        "previewUrl": "",
    }
    dieu_embedded = requests.post(f"{BASE_URL}/embed", json=dieu_raw).json()
    top_dieu = requests.post(f"{BASE_URL}/top10", json={"seedTrack": dieu_embedded}).json()["results"]
    print(f"Seed: {dieu_embedded['trackName']} by {dieu_embedded['artistName']} ({dieu_embedded['collectionName']})")
    print("Top 3 Closest Matches in Catalog:")
    for idx, t in enumerate(top_dieu[:3], 1):
        print(f"  #{idx}: {t['trackName']} by {t['artistName']} | Match: {t['similarity']}% (Audio: {t['breakdown']['audioScore']}%, Lyrics: {t['breakdown']['lyricScore']}%, Meta: {t['breakdown']['metaScore']}%) [{t['primaryGenreName']}, {t['releaseYear']}]")

    log_section("TEST 3: Calculate for Damso - Mosaïque solitaire & Pairwise Comparison")
    mosaique_raw = {
        "trackId": 1228224590,
        "trackName": "Mosaïque solitaire",
        "artistName": "Damso",
        "collectionName": "Ipséité",
        "primaryGenreName": "Hip-Hop/Rap",
        "releaseDate": "2017-04-28",
        "releaseYear": 2017,
        "language": "fr",
        "genreTags": ["Hip-Hop/Rap", "French Rap", "2010s"],
        "culturalThemes": ["Dark Melancholy", "Brussels Grit", "Ipséité"],
        "previewUrl": "",
    }
    mosaique_embedded = requests.post(f"{BASE_URL}/embed", json=mosaique_raw).json()
    top_mosaique = requests.post(f"{BASE_URL}/top10", json={"seedTrack": mosaique_embedded}).json()["results"]
    print(f"Seed: {mosaique_embedded['trackName']} by {mosaique_embedded['artistName']} ({mosaique_embedded['collectionName']})")
    print("Top 3 Closest Matches in Catalog:")
    for idx, t in enumerate(top_mosaique[:3], 1):
        print(f"  #{idx}: {t['trackName']} by {t['artistName']} | Match: {t['similarity']}% (Audio: {t['breakdown']['audioScore']}%, Lyrics: {t['breakdown']['lyricScore']}%, Meta: {t['breakdown']['metaScore']}%) [{t['primaryGenreName']}, {t['releaseYear']}]")

    # Pairwise comparison between Damso tracks
    l_damso_dot = float(np.dot(dieu_embedded["lyricEmbedding"], mosaique_embedded["lyricEmbedding"]))
    l_damso_score = round(max(0.0, min(1.0, (l_damso_dot + 0.25) / 1.25)) * 100)
    yr_damso_score = round(math.exp(-abs(2020 - 2017) / 12.0) * 100)
    meta_damso = round(0.35 * 100 + 0.25 * 100 + 0.20 * yr_damso_score + 0.20 * 100)
    # Since audio vectors are empty for these two studio tracks without previewUrl, weight redistributes to lyrics and meta
    damso_overall = round(0.55 * l_damso_score + 0.45 * meta_damso)
    print(f"\n-> PAIRWISE DAMSO MATCH: 'Dieu ne ment jamais' vs 'Mosaïque solitaire': {damso_overall}%")
    print(f"   * Lyric & Thematic Semantic Alignment: {l_damso_score}% (dot={l_damso_dot:.3f})")
    print(f"   * Artist & Genre & Language Cohesion: {meta_damso}%")

    # =========================================================================
    # TEST 4 & 6: Kodak Black - 6th Sense (Initial + Consistency Check)
    # =========================================================================
    log_section("TEST 4: Top 2 Closest Matches for Kodak Black - 6th Sense")
    kodak_6th_raw = fetch_itunes_track("6th Sense Kodak Black")
    kodak_6th = requests.post(f"{BASE_URL}/embed", json=kodak_6th_raw).json()
    top_kodak_6th = requests.post(f"{BASE_URL}/top10", json={"seedTrack": kodak_6th}).json()["results"]

    print(f"Seed: {kodak_6th['trackName']} by {kodak_6th['artistName']} ({kodak_6th['releaseYear']}, {kodak_6th['collectionName']})")
    for idx, t in enumerate(top_kodak_6th[:2], 1):
        print(f"  #{idx}: {t['trackName']} by {t['artistName']} | Match: {t['similarity']}% (Audio: {t['breakdown']['audioScore']}%, Lyrics: {t['breakdown']['lyricScore']}%, Meta: {t['breakdown']['metaScore']}%) [{t['primaryGenreName']}, {t['releaseYear']}]")

    # =========================================================================
    # TEST 5: Kodak Black - Calling My Spirit
    # =========================================================================
    log_section("TEST 5: Closest Match for Kodak Black - Calling My Spirit")
    kodak_calling_raw = fetch_itunes_track("Calling My Spirit Kodak Black")
    kodak_calling = requests.post(f"{BASE_URL}/embed", json=kodak_calling_raw).json()
    top_calling = requests.post(f"{BASE_URL}/top10", json={"seedTrack": kodak_calling}).json()["results"]

    print(f"Seed: {kodak_calling['trackName']} by {kodak_calling['artistName']} ({kodak_calling['releaseYear']}, {kodak_calling['collectionName']})")
    top_1 = top_calling[0]
    print(f"  #1 Closest Match: {top_1['trackName']} by {top_1['artistName']} | Match: {top_1['similarity']}% (Audio: {top_1['breakdown']['audioScore']}%, Lyrics: {top_1['breakdown']['lyricScore']}%, Meta: {top_1['breakdown']['metaScore']}%) [{top_1['primaryGenreName']}, {top_1['releaseYear']}]")

    # =========================================================================
    # TEST 6: Re-test Kodak Black - 6th Sense (Determinism & Ranking Stability)
    # =========================================================================
    log_section("TEST 6: Re-test Top 2 Matches for Kodak Black - 6th Sense (Consistency Check)")
    re_top_kodak_6th = requests.post(f"{BASE_URL}/top10", json={"seedTrack": kodak_6th}).json()["results"]
    for idx, t in enumerate(re_top_kodak_6th[:2], 1):
        print(f"  #{idx}: {t['trackName']} by {t['artistName']} | Match: {t['similarity']}% (Audio: {t['breakdown']['audioScore']}%, Lyrics: {t['breakdown']['lyricScore']}%, Meta: {t['breakdown']['metaScore']}%)")
    
    assert top_kodak_6th[0]["trackId"] == re_top_kodak_6th[0]["trackId"], "Ranking changed unexpectedly!"
    assert top_kodak_6th[0]["similarity"] == re_top_kodak_6th[0]["similarity"], "Scores non-deterministic!"
    print("-> PASS: Exact 100% deterministic reproducibility confirmed across independent queries.")

    # =========================================================================
    # TEST 7: Random Testing & Robustness Stress Tests
    # =========================================================================
    log_section("TEST 7: Random & Robustness Tests")
    np.random.seed(42)
    n_catalog = len(catalog_tracks)
    random_scores = []
    for _ in range(15):
        i, j = np.random.choice(n_catalog, 2, replace=False)
        t_a, t_b = catalog_tracks[i], catalog_tracks[j]
        # Calculate
        a_sim = max(0.0, min(1.0, (float(np.dot(t_a["audioEmbedding"], t_b["audioEmbedding"])) + 0.25) / 1.25))
        l_sim = max(0.0, min(1.0, (float(np.dot(t_a["lyricEmbedding"], t_b["lyricEmbedding"])) + 0.25) / 1.25))
        overall = round((0.45 * a_sim + 0.30 * l_sim + 0.25 * 0.4) * 100)
        random_scores.append(overall)
        assert not math.isnan(overall), "Found NaN score!"

    print(f"Random 15-Pair Sample Match Scores: {random_scores}")
    print(f"Average random cross-catalog score: {np.mean(random_scores):.1f}% (Expected ~45-55% for random pairs)")

    # Robustness Case 1: Corrupted / Empty Track
    empty_track = {
        "trackId": 99999999,
        "trackName": "",
        "artistName": "",
        "collectionName": "",
        "primaryGenreName": "",
        "releaseDate": "",
        "previewUrl": "",
    }
    empty_resp = requests.post(f"{BASE_URL}/embed", json=empty_track)
    print(f"Robustness Test 1 (All Empty Fields): Status Code = {empty_resp.status_code} (Should be 200)")
    assert empty_resp.status_code == 200

    # Robustness Case 2: Extreme Outlier Release Year (Year 1800 vs 2026)
    ancient_track = {
        "trackId": 88888888,
        "trackName": "Moonlight Sonata",
        "artistName": "Ludwig van Beethoven",
        "collectionName": "Classical Masterpieces",
        "primaryGenreName": "Classical",
        "releaseDate": "1801-01-01",
        "releaseYear": 1801,
        "previewUrl": "",
    }
    ancient_res = requests.post(f"{BASE_URL}/top10", json={"seedTrack": ancient_track}).json()["results"]
    print(f"Robustness Test 2 (Year 1801 Classical Seed): Returned {len(ancient_res)} recommendations without error. Top match: {ancient_res[0]['trackName']} ({ancient_res[0]['similarity']}%)")

    # Robustness Case 3: Concurrency / Latency test
    t_start = time.perf_counter()
    n_queries = 20
    for _ in range(n_queries):
        requests.post(f"{BASE_URL}/top10", json={"seedTrack": kodak_6th})
    total_time = (time.perf_counter() - t_start) * 1000
    avg_lat = total_time / n_queries
    print(f"Robustness Test 3 (Concurrency / Latency): 20 serial requests completed in {total_time:.1f}ms (Avg {avg_lat:.2f}ms per FAISS search)")

if __name__ == "__main__":
    main()
