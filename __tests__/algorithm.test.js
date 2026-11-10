// __tests__/algorithm.test.js
import {
    jaccardSimilarity,
    cosineSimilarity,
    levenshteinDistance,
    computePairwiseAffinity,
    computeSimilarityMatrix,
    sanitizeCompatibilityScore,
} from '../utils/algorithmUtils';
import { clampProgressValue } from '../CustomProgressBar';

describe('TuneHub Sonic Compatibility Engine (algorithmUtils)', () => {
    const baseUser13 = {
        username: 'user_alpha',
        trackIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        artistIds: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113],
        primaryGenres: Array(13).fill('R&B/Soul'),
        releaseDates: Array(13).fill('1998-05-10T00:00:00Z'),
    };

    test('1. Identical Playlists: 2 users with identical 13 tracks yield 1.0 (100%)', () => {
        const cloneUser = { ...baseUser13, username: 'user_beta' };
        const score = computePairwiseAffinity(baseUser13, cloneUser);
        expect(score).toBeCloseTo(1.0, 5);
    });

    test('2. Disjoint Playlists: completely different tracks, artists, genres, and decades yield ~0.0', () => {
        const disjointUser = {
            username: 'user_metal_2025',
            trackIds: [901, 902, 903, 904, 905, 906, 907, 908, 909, 910, 911, 912, 913],
            artistIds: [801, 802, 803, 804, 805, 806, 807, 808, 809, 810, 811, 812, 813],
            primaryGenres: Array(13).fill('Death Metal'),
            releaseDates: Array(13).fill('2025-11-20T00:00:00Z'),
        };

        const score = computePairwiseAffinity(baseUser13, disjointUser);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThan(0.05);
    });

    test('3. Shared Genre & Partial Artist Overlap / Different Tracks yields partial affinity (0.10 to 0.40)', () => {
        const partialUser = {
            username: 'user_rnb_peer',
            trackIds: [201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213],
            // Share 4 out of 13 artists + same genre & era
            artistIds: [101, 102, 103, 104, 305, 306, 307, 308, 309, 310, 311, 312, 313],
            primaryGenres: Array(13).fill('R&B/Soul'),
            releaseDates: Array(13).fill('1999-03-15T00:00:00Z'),
        };

        const score = computePairwiseAffinity(baseUser13, partialUser);
        expect(score).toBeGreaterThanOrEqual(0.1);
        expect(score).toBeLessThanOrEqual(0.4);
    });

    test('4. Edge Cases: empty arrays, 1-song playlists, missing release dates, and undefined genres never return NaN', () => {
        const emptyUser = {
            username: 'empty_user',
            trackIds: [],
            artistIds: [],
            primaryGenres: [],
            releaseDates: [],
        };

        const oneSongMalformedUser = {
            username: 'single_song_user',
            trackIds: [1],
            artistIds: [undefined, null],
            primaryGenres: [undefined, ''],
            releaseDates: [null, 'invalid-date'],
        };

        const scoreEmpty = computePairwiseAffinity(emptyUser, baseUser13);
        expect(Number.isNaN(scoreEmpty)).toBe(false);
        expect(scoreEmpty).toBe(0);

        const scoreMalformed = computePairwiseAffinity(oneSongMalformedUser, baseUser13);
        expect(Number.isNaN(scoreMalformed)).toBe(false);
        expect(scoreMalformed).toBeGreaterThanOrEqual(0);
        expect(scoreMalformed).toBeLessThanOrEqual(1);

        const matrix = computeSimilarityMatrix([emptyUser, oneSongMalformedUser, baseUser13]);
        expect(matrix).toHaveLength(3);
        expect(matrix[0][0]).toBe(1);
        expect(matrix[2][2]).toBe(1);
    });

    test('5. Helper functions guard against division by zero', () => {
        expect(jaccardSimilarity([], [])).toBe(0);
        expect(cosineSimilarity({}, {})).toBe(0);
        expect(levenshteinDistance('', '')).toBe(0);
    });
});

describe('Sonic Twins Compatibility & Progress Bar NaN Guard [BUG-010]', () => {
    test('clampProgressValue normalizes NaN, Infinity, negative, and >1 values into [0, 1]', () => {
        expect(clampProgressValue(NaN)).toBe(0);
        expect(clampProgressValue(undefined)).toBe(0);
        expect(clampProgressValue(-0.5)).toBe(0);
        expect(clampProgressValue(Infinity)).toBe(0);
        expect(clampProgressValue(1.5)).toBe(1);
        expect(clampProgressValue(0.75)).toBe(0.75);
    });

    test('sanitizeCompatibilityScore normalizes invalid and out-of-bound scores', () => {
        expect(sanitizeCompatibilityScore(NaN)).toBe(0);
        expect(sanitizeCompatibilityScore(undefined)).toBe(0);
        expect(sanitizeCompatibilityScore(-10)).toBe(0);
        expect(sanitizeCompatibilityScore(150)).toBe(100);
        expect(sanitizeCompatibilityScore(85.46)).toBe(85.5);
    });
});
