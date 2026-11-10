// utils/algorithmUtils.js
export function jaccardSimilarity(setA = [], setB = []) {
    if (!Array.isArray(setA) || !Array.isArray(setB)) return 0;
    const cleanA = [...new Set(setA.filter((v) => v !== null && v !== undefined && v !== ''))];
    const cleanB = [...new Set(setB.filter((v) => v !== null && v !== undefined && v !== ''))];
    if (cleanA.length === 0 && cleanB.length === 0) return 0;

    const bSet = new Set(cleanB);
    const intersection = cleanA.filter((item) => bSet.has(item)).length;
    const union = new Set([...cleanA, ...cleanB]).size;
    return union === 0 ? 0 : intersection / union;
}

export function cosineSimilarity(vecA = {}, vecB = {}) {
    if (!vecA || !vecB || typeof vecA !== 'object' || typeof vecB !== 'object') {
        return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (const key of Object.keys(vecA)) {
        const valA = Number(vecA[key]) || 0;
        const valB = Object.prototype.hasOwnProperty.call(vecB, key)
            ? Number(vecB[key]) || 0
            : 0;
        dotProduct += valA * valB;
        magnitudeA += valA * valA;
    }

    for (const key of Object.keys(vecB)) {
        const valB = Number(vecB[key]) || 0;
        magnitudeB += valB * valB;
    }

    const denom = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    return denom === 0 ? 0 : Math.min(1, Math.max(0, dotProduct / denom));
}

export function levenshteinDistance(strA = '', strB = '') {
    const a = String(strA || '');
    const b = String(strB || '');
    if (a.length === 0 && b.length === 0) return 0;
    if (a === b) return 1;

    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 0;

    const matrix = Array.from({ length: b.length + 1 }, () =>
        new Array(a.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + cost
            );
        }
    }

    const distance = matrix[b.length][a.length];
    return Math.min(1, Math.max(0, 1 - distance / maxLength));
}

export function calculateGenreDistributionSimilarity(genresA = [], genresB = []) {
    if (!Array.isArray(genresA) || !Array.isArray(genresB)) return 0;
    const freqA = {};
    const freqB = {};

    for (const g of genresA) {
        if (g && typeof g === 'string') {
            const key = g.trim().toLowerCase();
            if (key) freqA[key] = (freqA[key] || 0) + 1;
        }
    }

    for (const g of genresB) {
        if (g && typeof g === 'string') {
            const key = g.trim().toLowerCase();
            if (key) freqB[key] = (freqB[key] || 0) + 1;
        }
    }

    return cosineSimilarity(freqA, freqB);
}

export function calculateReleaseYearAffinity(datesA = [], datesB = []) {
    if (!Array.isArray(datesA) || !Array.isArray(datesB)) return 0;

    const parseYears = (dates) =>
        dates
            .map((d) => {
                if (!d) return null;
                const yearMatch = String(d).match(/\b(19\d{2}|20\d{2})\b/);
                if (yearMatch) return Number(yearMatch[1]);
                const parsed = new Date(d).getFullYear();
                return Number.isFinite(parsed) ? parsed : null;
            })
            .filter((y) => y !== null)
            .sort((a, b) => a - b);

    const yearsA = parseYears(datesA);
    const yearsB = parseYears(datesB);

    if (yearsA.length === 0 || yearsB.length === 0) return 0;

    const avgA = yearsA.reduce((s, v) => s + v, 0) / yearsA.length;
    const avgB = yearsB.reduce((s, v) => s + v, 0) / yearsB.length;
    const yearGapScore = Math.max(0, 1 - Math.abs(avgA - avgB) / 40);

    const strSimilarity = levenshteinDistance(yearsA.join(''), yearsB.join(''));
    return Math.min(1, Math.max(0, 0.5 * yearGapScore + 0.5 * strSimilarity));
}

export function computePairwiseAffinity(
    userA = {},
    userB = {},
    weights = [0.5, 0.35, 0.075, 0.075]
) {
    if (!userA || !userB) return 0;

    const tracksA = Array.isArray(userA.trackIds) ? userA.trackIds : [];
    const tracksB = Array.isArray(userB.trackIds) ? userB.trackIds : [];
    const artistsA = Array.isArray(userA.artistIds) ? userA.artistIds : [];
    const artistsB = Array.isArray(userB.artistIds) ? userB.artistIds : [];
    const genresA = Array.isArray(userA.primaryGenres) ? userA.primaryGenres : [];
    const genresB = Array.isArray(userB.primaryGenres) ? userB.primaryGenres : [];
    const datesA = Array.isArray(userA.releaseDates) ? userA.releaseDates : [];
    const datesB = Array.isArray(userB.releaseDates) ? userB.releaseDates : [];

    const isEmptyA =
        tracksA.length === 0 &&
        artistsA.length === 0 &&
        genresA.length === 0 &&
        datesA.length === 0;
    const isEmptyB =
        tracksB.length === 0 &&
        artistsB.length === 0 &&
        genresB.length === 0 &&
        datesB.length === 0;

    if (isEmptyA || isEmptyB) return 0;

    const jTrack = jaccardSimilarity(tracksA, tracksB);
    const jArtist = jaccardSimilarity(artistsA, artistsB);
    const cGenre = calculateGenreDistributionSimilarity(genresA, genresB);
    const rEra = calculateReleaseYearAffinity(datesA, datesB);

    const [w1 = 0.5, w2 = 0.35, w3 = 0.075, w4 = 0.075] = Array.isArray(weights)
        ? weights
        : [0.5, 0.35, 0.075, 0.075];

    const total = w1 * jTrack + w2 * jArtist + w3 * cGenre + w4 * rEra;
    if (!Number.isFinite(total)) return 0;
    return Number(Math.min(1, Math.max(0, total)).toFixed(6));
}

export function computeSimilarityMatrix(
    users = [],
    weights = [0.5, 0.35, 0.075, 0.075]
) {
    if (!Array.isArray(users) || users.length === 0) return [];

    return users.map((userA, i) =>
        users.map((userB, j) => {
            if (i === j) return 1;
            return computePairwiseAffinity(userA, userB, weights);
        })
    );
}

// Guard compatibility scores and percentage formatting against NaN on empty playlists [BUG-010]
export function sanitizeCompatibilityScore(rawScore) {
    const num = Number(rawScore);
    if (!Number.isFinite(num) || num < 0) return 0;
    return Math.min(100, Math.round(num * 10) / 10);
}

export function clampProgressValue(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(1, num));
}
