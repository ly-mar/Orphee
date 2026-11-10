// future_features/similarityEngine.js
import catalogArtifact from './ml_service/artifacts/catalog_embeddings.json';

export const ML_SERVICE_URL = 'http://localhost:8000';
export const EXPECTED_AUDIO_DIM = 68;
export const EXPECTED_LYRIC_DIM = 384;

const DEFAULT_WEIGHTS = {
    audio: 0.45,
    lyric: 0.30,
    meta: 0.25,
};

const META_SUBWEIGHTS = {
    genre: 0.35,
    artist: 0.25,
    year: 0.20,
    language: 0.20,
};

const GENRE_TAXONOMY = {
    'r&b/soul': ['r&b', 'soul', 'neo-soul', 'funk', 'motown', 'contemporary r&b'],
    'hip-hop/rap': ['hip-hop', 'rap', 'boom bap', 'trap', 'conscious', 'drill'],
    'pop': ['pop', 'synth-pop', 'dance', 'disco', 'electropop', 'new wave'],
    'rock': ['rock', 'post-punk', 'classic rock', 'alternative', 'indie rock', 'punk'],
    'alternative': ['alternative', 'indie', 'dream pop', 'shoegaze', 'folk'],
    'afrobeats': ['afrobeats', 'afro', 'amapiano', 'afro-fusion', 'world', 'dancehall'],
    'latin': ['latin', 'reggaeton', 'urbano', 'salsa', 'bachata'],
    'electronic': ['electronic', 'house', 'techno', 'ambient', 'idm', 'dance'],
};

const LANG_TRIGRAM_PROFILES = {
    fr: ['les', 'des', 'une', 'que', 'dans', 'pour', 'pas', 'sur', 'plus', 'mon', 'ton', 'cette', 'aux', 'est'],
    es: ['los', 'las', 'una', 'que', 'por', 'con', 'para', 'como', 'más', 'pero', 'sus', 'del', 'está', 'todo'],
    pt: ['que', 'não', 'uma', 'com', 'para', 'por', 'mais', 'dos', 'como', 'mas', 'foi', 'seu', 'sua', 'meu'],
    en: ['the', 'and', 'tha', 'ent', 'ing', 'ion', 'tio', 'for', 'you', 'hat', 'thi', 'all', 'wit', 'have'],
};

export function l2Normalize(vec = []) {
    if (!Array.isArray(vec) && !(vec instanceof Float32Array)) return [];
    const len = vec.length;
    if (len === 0) return [];

    let sumSq = 0;
    for (let i = 0; i < len; i++) {
        const v = Number(vec[i]) || 0;
        sumSq += v * v;
    }
    const norm = Math.sqrt(sumSq);
    if (norm < 1e-9) return Array.from({ length: len }, () => 0);

    const out = new Array(len);
    for (let i = 0; i < len; i++) {
        out[i] = Number(((Number(vec[i]) || 0) / norm).toFixed(5));
    }
    return out;
}

/**
 * Computes inner-product cosine similarity on L2-normalized 68-D or 384-D vectors.
 * Matches the exact scoring curve used by FAISS IndexFlatIP in ml_service/server.py.
 */
export function denseCosineSimilarity(vecA = [], vecB = []) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
        return null;
    }
    if (vecA.length !== vecB.length) {
        return null;
    }

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < vecA.length; i++) {
        const a = Number(vecA[i]) || 0;
        const b = Number(vecB[i]) || 0;
        dot += a * b;
        magA += a * a;
        magB += b * b;
    }

    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    if (denom < 1e-9) return null;

    const cosTheta = Math.min(1, Math.max(-1, dot / denom));
    return Math.min(1, Math.max(0, (cosTheta + 0.25) / 1.25));
}

export function extractReleaseYear(song = {}) {
    if (typeof song.releaseYear === 'number' && Number.isFinite(song.releaseYear)) {
        return song.releaseYear;
    }
    if (song.releaseDate) {
        const match = String(song.releaseDate).match(/\b(19\d{2}|20\d{2})\b/);
        if (match) return Number(match[1]);
    }
    return null;
}

export function inferLanguage(song = {}) {
    if (song.language && typeof song.language === 'string' && song.language.length <= 5) {
        return song.language.toLowerCase().trim();
    }

    const text = ` ${song.trackName || ''} ${song.collectionName || ''} ${(song.culturalThemes || []).join(' ')} `.toLowerCase();

    if (/[ñ¿¡]/.test(text)) return 'es';
    if (/[ãõç]/.test(text) && !/[œ]/.test(text)) return 'pt';
    if (/[œæéèêëàùûîï]/.test(text)) return 'fr';

    const scores = { en: 0, fr: 0, es: 0, pt: 0 };
    for (const [lang, trigrams] of Object.entries(LANG_TRIGRAM_PROFILES)) {
        for (const tri of trigrams) {
            if (text.includes(tri)) scores[lang] += 1;
        }
    }

    let bestLang = 'en';
    let maxHits = scores.en;
    for (const [lang, hits] of Object.entries(scores)) {
        if (hits > maxHits + 1) {
            maxHits = hits;
            bestLang = lang;
        }
    }
    return bestLang;
}

export function stringBigramSimilarity(strA = '', strB = '') {
    const a = String(strA).toLowerCase().trim();
    const b = String(strB).toLowerCase().trim();
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const bigramsA = new Map();
    for (let i = 0; i < a.length - 1; i++) {
        const bg = a.slice(i, i + 2);
        bigramsA.set(bg, (bigramsA.get(bg) || 0) + 1);
    }

    let intersection = 0;
    for (let i = 0; i < b.length - 1; i++) {
        const bg = b.slice(i, i + 2);
        const count = bigramsA.get(bg) || 0;
        if (count > 0) {
            bigramsA.set(bg, count - 1);
            intersection += 1;
        }
    }

    return (2.0 * intersection) / (a.length - 1 + (b.length - 1));
}

export function computeGenreSimilarity(songA = {}, songB = {}) {
    const rawTagsA =
        Array.isArray(songA.genreTags) && songA.genreTags.length > 0
            ? songA.genreTags
            : [songA.primaryGenreName || songA.genre].filter(Boolean);
    const rawTagsB =
        Array.isArray(songB.genreTags) && songB.genreTags.length > 0
            ? songB.genreTags
            : [songB.primaryGenreName || songB.genre].filter(Boolean);

    const tagsA = rawTagsA.map((t) => String(t).toLowerCase().trim()).filter(Boolean);
    const tagsB = rawTagsB.map((t) => String(t).toLowerCase().trim()).filter(Boolean);
    if (tagsA.length === 0 || tagsB.length === 0) return 0;

    const setA = new Set(tagsA);
    const setB = new Set(tagsB);
    let exactMatches = 0;
    setA.forEach((t) => {
        if (setB.has(t)) exactMatches += 1;
    });

    const union = new Set([...setA, ...setB]).size;
    const jaccard = union > 0 ? exactMatches / union : 0;

    if (tagsA[0] === tagsB[0]) {
        return Math.min(1, 0.8 + 0.2 * jaccard);
    }

    for (const family of Object.values(GENRE_TAXONOMY)) {
        const aInFamily = tagsA.some((t) => family.some((f) => t.includes(f)));
        const bInFamily = tagsB.some((t) => family.some((f) => t.includes(f)));
        if (aInFamily && bInFamily) {
            return Math.max(jaccard, 0.55);
        }
    }

    return jaccard;
}

export function computeArtistSimilarity(songA = {}, songB = {}) {
    if (songA.artistId && songB.artistId && Number(songA.artistId) === Number(songB.artistId)) {
        return 1.0;
    }

    const artistA = String(songA.artistName || songA.artist || '').toLowerCase().trim();
    const artistB = String(songB.artistName || songB.artist || '').toLowerCase().trim();
    if (!artistA || !artistB) return 0;
    if (artistA === artistB) return 1.0;

    const splitRegex = /[,&/]|feat\.?|ft\.?|with/i;
    const tokensA = artistA.split(splitRegex).map((s) => s.trim()).filter(Boolean);
    const tokensB = artistB.split(splitRegex).map((s) => s.trim()).filter(Boolean);

    for (const tA of tokensA) {
        for (const tB of tokensB) {
            if (tA === tB || stringBigramSimilarity(tA, tB) > 0.88) {
                return 0.85;
            }
        }
    }

    return 0;
}

export function computeYearSimilarity(songA = {}, songB = {}) {
    const yearA = extractReleaseYear(songA);
    const yearB = extractReleaseYear(songB);
    if (!yearA || !yearB) return 0.5;
    const diff = Math.abs(yearA - yearB);
    return Number(Math.exp(-diff / 12).toFixed(4));
}

export function computeLanguageSimilarity(songA = {}, songB = {}) {
    const langA = inferLanguage(songA);
    const langB = inferLanguage(songB);
    if (langA === langB) return 1.0;

    const romance = new Set(['fr', 'es', 'pt', 'it']);
    if (romance.has(langA) && romance.has(langB)) return 0.35;

    return 0.0;
}

export function hydrateTrackForSimilarity(rawSong = {}) {
    const releaseYear = extractReleaseYear(rawSong) || 2020;
    const language = inferLanguage(rawSong);
    const primaryGenreName = rawSong.primaryGenreName || rawSong.genre || 'Music';

    // Accept only valid 68-D audio and 384-D lyric vectors
    const audioEmbedding =
        Array.isArray(rawSong.audioEmbedding) && rawSong.audioEmbedding.length === EXPECTED_AUDIO_DIM
            ? rawSong.audioEmbedding
            : [];
    const lyricEmbedding =
        Array.isArray(rawSong.lyricEmbedding) && rawSong.lyricEmbedding.length === EXPECTED_LYRIC_DIM
            ? rawSong.lyricEmbedding
            : [];

    return {
        ...rawSong,
        trackId: Number(rawSong.trackId || rawSong.id || 0),
        trackName: rawSong.trackName || rawSong.title || 'Unknown Track',
        artistName: rawSong.artistName || rawSong.artist || 'Unknown Artist',
        collectionName: rawSong.collectionName || rawSong.album || 'Single',
        artworkUrl100:
            rawSong.artworkUrl100 || rawSong.imageUrl || 'https://via.placeholder.com/400',
        previewUrl: rawSong.previewUrl || '',
        primaryGenreName,
        releaseYear,
        language,
        genreTags:
            Array.isArray(rawSong.genreTags) && rawSong.genreTags.length > 0
                ? rawSong.genreTags
                : [primaryGenreName, `${Math.floor(releaseYear / 10) * 10}s`],
        culturalThemes: Array.isArray(rawSong.culturalThemes)
            ? rawSong.culturalThemes
            : [primaryGenreName, `${Math.floor(releaseYear / 10) * 10}s`],
        audioEmbedding,
        lyricEmbedding,
        embeddingStatus:
            audioEmbedding.length === EXPECTED_AUDIO_DIM &&
                lyricEmbedding.length === EXPECTED_LYRIC_DIM
                ? 'verified_ml_vectors'
                : 'metadata_only',
    };
}

/**
 * Loads the full 194+ track ML catalog from FastAPI (http://localhost:8000/catalog),
 * falling back to the bundled ml_service/artifacts/catalog_embeddings.json.
 */
export async function fetchMLCatalog() {
    try {
        const response = await fetch(`${ML_SERVICE_URL}/catalog`);
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data?.tracks) && data.tracks.length > 0) {
                return {
                    tracks: data.tracks.map(hydrateTrackForSimilarity),
                    source: 'live_fastapi_faiss',
                };
            }
        }
    } catch (_) {
        // Fallback to bundled 194-track artifact
    }

    return {
        tracks: PRECOMPUTED_SONG_CATALOG,
        source: 'bundled_ml_artifact',
    };
}

/**
 * Extracts real 68-D Librosa + 384-D ONNX embeddings for any live iTunes track via POST /embed.
 */
export async function embedTrackViaMLService(rawSong) {
    const hydrated = hydrateTrackForSimilarity(rawSong);
    if (hydrated.embeddingStatus === 'verified_ml_vectors') {
        return hydrated;
    }

    try {
        const response = await fetch(`${ML_SERVICE_URL}/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                trackId: hydrated.trackId,
                trackName: hydrated.trackName,
                artistName: hydrated.artistName,
                artistId: hydrated.artistId || 0,
                collectionName: hydrated.collectionName,
                primaryGenreName: hydrated.primaryGenreName,
                releaseDate: hydrated.releaseDate || `${hydrated.releaseYear}-01-01`,
                releaseYear: hydrated.releaseYear,
                previewUrl: hydrated.previewUrl,
                artworkUrl100: hydrated.artworkUrl100,
            }),
        });

        if (response.ok) {
            const enriched = await response.json();
            return hydrateTrackForSimilarity(enriched);
        }
    } catch (_) {
        // Retain metadata_only mode if FastAPI server is unreachable
    }

    return hydrated;
}

/**
 * Queries the FastAPI FAISS endpoint (POST /top10) for sub-millisecond retrieval,
 * falling back to local 68-D/384-D calculation if the server is offline.
 */
export async function fetchFAISSTop10(seedSong, library = PRECOMPUTED_SONG_CATALOG, weights = DEFAULT_WEIGHTS) {
    const hydratedSeed = hydrateTrackForSimilarity(seedSong);

    try {
        const response = await fetch(`${ML_SERVICE_URL}/top10`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seedTrack: hydratedSeed,
                weights,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data?.results) && data.results.length > 0) {
                return data.results;
            }
        }
    } catch (_) {
        // Fallback to local calculation on the 194-track 68-D/384-D catalog
    }

    return getTop10Similar(hydratedSeed, library, weights);
}

export function calculateSimilarity(songA, songB, customWeights = DEFAULT_WEIGHTS) {
    if (!songA || !songB) {
        return {
            overallScore: 0,
            audioScore: 0,
            lyricScore: 0,
            metaScore: 0,
            embeddingMode: 'none',
            details: { genreScore: 0, artistScore: 0, yearScore: 0, languageScore: 0 },
        };
    }

    const normA = hydrateTrackForSimilarity(songA);
    const normB = hydrateTrackForSimilarity(songB);

    if (
        normA.trackId &&
        normB.trackId &&
        normA.trackId === normB.trackId &&
        normA.trackName === normB.trackName
    ) {
        return {
            overallScore: 100,
            audioScore: 100,
            lyricScore: 100,
            metaScore: 100,
            embeddingMode: normA.embeddingStatus,
            details: { genreScore: 100, artistScore: 100, yearScore: 100, languageScore: 100 },
        };
    }

    const rawAudio = denseCosineSimilarity(normA.audioEmbedding, normB.audioEmbedding);
    const rawLyric = denseCosineSimilarity(normA.lyricEmbedding, normB.lyricEmbedding);

    const rawGenre = computeGenreSimilarity(normA, normB);
    const rawArtist = computeArtistSimilarity(normA, normB);
    const rawYear = computeYearSimilarity(normA, normB);
    const rawLanguage = computeLanguageSimilarity(normA, normB);

    const rawMeta =
        META_SUBWEIGHTS.genre * rawGenre +
        META_SUBWEIGHTS.artist * rawArtist +
        META_SUBWEIGHTS.year * rawYear +
        META_SUBWEIGHTS.language * rawLanguage;

    let activeWeightSum = customWeights.meta ?? DEFAULT_WEIGHTS.meta;
    let weightedTotal = activeWeightSum * rawMeta;

    if (rawAudio !== null) {
        const wA = customWeights.audio ?? DEFAULT_WEIGHTS.audio;
        weightedTotal += wA * rawAudio;
        activeWeightSum += wA;
    }
    if (rawLyric !== null) {
        const wL = customWeights.lyric ?? DEFAULT_WEIGHTS.lyric;
        weightedTotal += wL * rawLyric;
        activeWeightSum += wL;
    }

    const finalScore = activeWeightSum > 0 ? weightedTotal / activeWeightSum : 0;

    return {
        overallScore: Math.round(Math.min(1, Math.max(0, finalScore)) * 100),
        audioScore: rawAudio !== null ? Math.round(rawAudio * 100) : Math.round(rawMeta * 100),
        lyricScore: rawLyric !== null ? Math.round(rawLyric * 100) : Math.round(rawMeta * 100),
        metaScore: Math.round(rawMeta * 100),
        embeddingMode:
            rawAudio !== null && rawLyric !== null ? 'verified_ml_vectors' : 'metadata_fallback',
        details: {
            genreScore: Math.round(rawGenre * 100),
            artistScore: Math.round(rawArtist * 100),
            yearScore: Math.round(rawYear * 100),
            languageScore: Math.round(rawLanguage * 100),
        },
    };
}

export function getTop10Similar(
    seedSongOrId,
    library = PRECOMPUTED_SONG_CATALOG,
    customWeights = DEFAULT_WEIGHTS
) {
    if (!Array.isArray(library) || library.length === 0) return [];

    const seedSong =
        typeof seedSongOrId === 'object' && seedSongOrId !== null
            ? hydrateTrackForSimilarity(seedSongOrId)
            : library.find((item) => String(item.trackId) === String(seedSongOrId));

    if (!seedSong) return [];

    return library
        .filter(
            (item) =>
                String(item.trackId) !== String(seedSong.trackId) ||
                item.trackName !== seedSong.trackName
        )
        .map((candidate) => {
            const hydratedCandidate = hydrateTrackForSimilarity(candidate);
            const breakdown = calculateSimilarity(seedSong, hydratedCandidate, customWeights);
            return {
                ...hydratedCandidate,
                similarity: breakdown.overallScore,
                breakdown,
            };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10);
}

// Export the 194-track 68-D / 384-D catalog directly from the generated ML artifact
export const PRECOMPUTED_SONG_CATALOG = Array.isArray(catalogArtifact?.tracks)
    ? catalogArtifact.tracks.map(hydrateTrackForSimilarity)
    : [];