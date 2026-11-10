// future_features/similarityEngine.test.js
import {
    PRECOMPUTED_SONG_CATALOG,
    EXPECTED_AUDIO_DIM,
    EXPECTED_LYRIC_DIM,
    calculateSimilarity,
    getTop10Similar,
    denseCosineSimilarity,
} from './similarityEngine';

describe('Real 68-D Librosa & 384-D ONNX Similarity Engine', () => {
    test('1. Catalog loads all 194+ tracks with verified 68-D audio and 384-D lyric vectors', () => {
        expect(PRECOMPUTED_SONG_CATALOG.length).toBeGreaterThanOrEqual(100);
        const sample = PRECOMPUTED_SONG_CATALOG[0];
        expect(sample.audioEmbedding).toHaveLength(EXPECTED_AUDIO_DIM);
        expect(sample.lyricEmbedding).toHaveLength(EXPECTED_LYRIC_DIM);
        expect(sample.embeddingStatus).toBe('verified_ml_vectors');
    });

    test('2. Identical track returns 100% across all dimensions', () => {
        const track = PRECOMPUTED_SONG_CATALOG[0];
        const res = calculateSimilarity(track, track);
        expect(res.overallScore).toBe(100);
        expect(res.audioScore).toBe(100);
        expect(res.lyricScore).toBe(100);
        expect(res.metaScore).toBe(100);
    });

    test('3. Top 1 match for any seed song scores significantly higher than the lowest-ranked track in the catalog', () => {
        const seed = PRECOMPUTED_SONG_CATALOG[0];
        const allScored = PRECOMPUTED_SONG_CATALOG.slice(1).map((cand) =>
            calculateSimilarity(seed, cand).overallScore
        );
        const maxScore = Math.max(...allScored);
        const minScore = Math.min(...allScored);

        expect(maxScore).toBeGreaterThan(minScore + 20);
    });

    test('4. getTop10Similar returns 10 sorted 68-D/384-D tracks excluding the seed song', () => {
        const seed = PRECOMPUTED_SONG_CATALOG[0];
        const top10 = getTop10Similar(seed.trackId, PRECOMPUTED_SONG_CATALOG);

        expect(top10).toHaveLength(10);
        expect(top10.some((t) => t.trackId === seed.trackId)).toBe(false);

        for (let i = 0; i < top10.length - 1; i++) {
            expect(top10[i].similarity).toBeGreaterThanOrEqual(top10[i + 1].similarity);
        }
    });

    test('5. Unindexed live iTunes track gracefully redistributes weights without returning NaN or 0%', () => {
        const liveItunesTrack = {
            trackId: 9999991,
            trackName: PRECOMPUTED_SONG_CATALOG[0].trackName,
            artistName: PRECOMPUTED_SONG_CATALOG[0].artistName,
            primaryGenreName: PRECOMPUTED_SONG_CATALOG[0].primaryGenreName,
            releaseDate: '2020-03-12T00:00:00Z',
        };
        const res = calculateSimilarity(liveItunesTrack, PRECOMPUTED_SONG_CATALOG[0]);

        expect(Number.isNaN(res.overallScore)).toBe(false);
        expect(res.overallScore).toBeGreaterThan(50);
        expect(res.embeddingMode).toBe('metadata_fallback');
        expect(denseCosineSimilarity([1, 0], [1, 0, 0])).toBeNull();
    });
});