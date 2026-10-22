// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

function jaccard(setA = [], setB = []) {
    const a = [...new Set(setA.filter(Boolean))];
    const b = new Set(setB.filter(Boolean));
    if (a.length === 0 && b.size === 0) return 0;
    const intersection = a.filter((x) => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : intersection / union;
}

function cosine(vecA = {}, vecB = {}) {
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (const k of Object.keys(vecA)) {
        dot += (vecA[k] || 0) * (vecB[k] || 0);
        magA += (vecA[k] || 0) ** 2;
    }
    for (const k of Object.keys(vecB)) {
        magB += (vecB[k] || 0) ** 2;
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}

function extractPlaylistFeatures(uid, songs = []) {
    const valid = (Array.isArray(songs) ? songs : Object.values(songs || {})).filter(
        (s) => s && s.trackId
    );
    return {
        uid,
        uname: uid,
        trackIds: valid.map((s) => Number(s.trackId)),
        artistIds: valid.map((s) => Number(s.artistId || 0)),
        primaryGenres: valid.map((s) => String(s.primaryGenreName || 'Music').toLowerCase()),
        releaseYears: valid
            .map((s) => new Date(s.releaseDate).getFullYear())
            .filter((y) => Number.isFinite(y)),
    };
}

function scorePair(a, b, weights = [0.5, 0.35, 0.075, 0.075]) {
    const jTrack = jaccard(a.trackIds, b.trackIds);
    const jArtist = jaccard(a.artistIds, b.artistIds);

    const gA = a.primaryGenres.reduce((acc, g) => ({ ...acc, [g]: (acc[g] || 0) + 1 }), {});
    const gB = b.primaryGenres.reduce((acc, g) => ({ ...acc, [g]: (acc[g] || 0) + 1 }), {});
    const cGenre = cosine(gA, gB);

    const avgYearA =
        a.releaseYears.length > 0
            ? a.releaseYears.reduce((s, y) => s + y, 0) / a.releaseYears.length
            : 2010;
    const avgYearB =
        b.releaseYears.length > 0
            ? b.releaseYears.reduce((s, y) => s + y, 0) / b.releaseYears.length
            : 2010;
    const rEra = Math.max(0, 1 - Math.abs(avgYearA - avgYearB) / 40);

    const [w1, w2, w3, w4] = weights;
    return Number(
        Math.min(1, Math.max(0, w1 * jTrack + w2 * jArtist + w3 * cGenre + w4 * rEra)).toFixed(6)
    );
}

exports.computeUserAffinityOnPlaylistWrite = functions.firestore
    .document('playlists/{userId}')
    .onWrite(async (change, context) => {
        const { userId } = context.params;
        if (!change.after.exists) return null;

        const targetData = change.after.data();
        const targetFeatures = extractPlaylistFeatures(userId, targetData.songs);
        if (targetFeatures.trackIds.length === 0) return null;

        const snapshot = await db.collection('playlists').limit(250).get();
        const rankings = [];

        snapshot.forEach((docSnap) => {
            const peerId = docSnap.id;
            const peerFeatures = extractPlaylistFeatures(peerId, docSnap.data().songs);
            if (peerFeatures.trackIds.length === 0) return;

            const totalScore =
                peerId === userId ? 1 : scorePair(targetFeatures, peerFeatures);

            rankings.push({
                uid: peerId,
                uname: peerId,
                totalScore,
            });
        });

        rankings.sort((a, b) => b.totalScore - a.totalScore);
        const top50 = rankings.slice(0, 50);

        await db.collection('ranking').doc(userId).set(
            {
                rankings: top50,
                playlistUpdatedAt: targetData.updatedAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            { merge: true }
        );

        return null;
    });