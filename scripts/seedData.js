const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const {
    getFirestore,
    doc,
    setDoc,
    Timestamp,
} = require('firebase/firestore');

const firebaseConfig = {
    apiKey: 'AIzaSyA1Cp9xJpMSuuIoe8fqT5o9F5uXbgktB2k',
    authDomain: 'tunehub-86837.firebaseapp.com',
    databaseURL: 'https://tunehub-86837-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'tunehub-86837',
    storageBucket: 'tunehub-86837.appspot.com',
    messagingSenderId: '1060288602509',
    appId: '1:1060288602509:web:9f501f03c6d2bc9295ddc4',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const MOCK_USERS = [
    {
        uid: 'mock_alice',
        username: 'Alice_RnB',
        bio: '90s R&B & Neo-Soul purist',
        profileImageUrl:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
        genre: 'R&B/Soul',
        baseYear: 1998,
        artists: [
            { id: 1001, name: 'Erykah Badu' },
            { id: 1002, name: 'Lauryn Hill' },
            { id: 1003, name: "D'Angelo" },
            { id: 1004, name: 'SZA' },
            { id: 1005, name: 'Frank Ocean' },
        ],
    },
    {
        uid: 'mock_bob',
        username: 'Bob_Rock',
        bio: '80s Classic Rock & Post-Punk',
        profileImageUrl:
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
        genre: 'Rock',
        baseYear: 1984,
        artists: [
            { id: 2001, name: 'The Cure' },
            { id: 2002, name: 'Fleetwood Mac' },
            { id: 2003, name: 'David Bowie' },
            { id: 2004, name: 'New Order' },
            { id: 2005, name: 'Dire Straits' },
        ],
    },
    {
        uid: 'mock_charlie',
        username: 'Charlie_HipHop',
        bio: 'Golden Age Hip Hop & Boom Bap',
        profileImageUrl:
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
        genre: 'Hip-Hop/Rap',
        baseYear: 1995,
        artists: [
            { id: 3001, name: 'Nas' },
            { id: 3002, name: 'A Tribe Called Quest' },
            { id: 3003, name: 'Kendrick Lamar' },
            { id: 3004, name: 'OutKast' },
            { id: 3005, name: 'Wu-Tang Clan' },
        ],
    },
    {
        uid: 'mock_diana',
        username: 'Diana_Indie',
        bio: 'Dream Pop & Indie Folk explorer',
        profileImageUrl:
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
        genre: 'Alternative',
        baseYear: 2016,
        artists: [
            { id: 4001, name: 'Beach House' },
            { id: 4002, name: 'Phoebe Bridgers' },
            { id: 4003, name: 'Bon Iver' },
            { id: 4004, name: 'Tame Impala' },
            { id: 4005, name: 'Japanese Breakfast' },
        ],
    },
    {
        uid: 'mock_evan',
        username: 'Evan_Afrobeats',
        bio: 'Afrobeats, Amapiano & Tropical grooves',
        profileImageUrl:
            'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
        genre: 'Afrobeats',
        baseYear: 2022,
        artists: [
            { id: 5001, name: 'Burna Boy' },
            { id: 5002, name: 'Wizkid' },
            { id: 5003, name: 'Tems' },
            { id: 5004, name: 'Rema' },
            { id: 5005, name: 'Asake' },
        ],
    },
];

function build13TracksForUser(user, userIdx) {
    const trackTitles = [
        'Midnight Resonance',
        'Golden Hour Groove',
        'Velvet Horizon',
        'Neon Echoes',
        'Electric Pulse',
        'City Lights Serenade',
        'Shadow Dancer',
        'Starlight Odyssey',
        'Afterhours Rhythm',
        'Oceanic Drift',
        'Vinyl Memories',
        'Soul Reflection',
        'Encore Finale',
    ];

    return trackTitles.map((titleSuffix, idx) => {
        // Share track #1 and #2 between adjacent users to create rich multi-tier affinity scores
        const isSharedTrack = idx === 0 && userIdx % 2 === 0;
        const artistObj = user.artists[idx % user.artists.length];
        const trackId = isSharedTrack
            ? 1440857781
            : (userIdx + 1) * 100000 + (idx + 1);
        const trackName = isSharedTrack
            ? 'Blinding Lights'
            : `${titleSuffix} (${user.genre.split('/')[0]} Mix)`;
        const artistName = isSharedTrack ? 'The Weeknd' : artistObj.name;
        const releaseYear = user.baseYear + (idx % 6);

        return {
            trackId,
            id: trackId,
            trackName,
            title: trackName,
            artistName,
            artist: artistName,
            artistId: isSharedTrack ? 479756766 : artistObj.id,
            collectionName: `${artistName} Essentials`,
            artworkUrl100:
                'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/70/c3/6f70c3f6-2548-f8c5-d74b-80388b9c6e1b/20UMGIM11048.rgb.jpg/100x100bb.jpg',
            imageUrl:
                'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/70/c3/6f70c3f6-2548-f8c5-d74b-80388b9c6e1b/20UMGIM11048.rgb.jpg/100x100bb.jpg',
            previewUrl:
                'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/85/55/45/85554595-404c-6475-30d8-8f9e9d0e8974/mzaf_11484210064310668098.plus.aac.p.m4a',
            primaryGenreName: user.genre,
            genre: user.genre,
            releaseDate: `${releaseYear}-06-15T08:00:00Z`,
        };
    });
}

function getRecentDateStrings(daysCount = 4) {
    const dates = [];
    const now = new Date();
    for (let i = 0; i < daysCount; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
}

const COLLECTIVE_THEMES = [
    { id: 'child_of_the_80s', name: 'Child of the 80s' },
    { id: 'funny_rap', name: 'Funny Rap' },
    { id: 'airplane_mode', name: 'Airplane Mode' },
    { id: 'criminally_overlooked', name: 'Criminally Overlooked' },
    { id: 'ex_girlfriends_club', name: "Ex-Girlfriend's Club" },
];

async function seedDatabase() {
    console.log('Starting TuneHub Firestore Seeding Engine...');
    console.log('Authenticating with test developer credentials (hihicad881@chainds.com)...');
    try {
        await signInWithEmailAndPassword(auth, 'hihicad881@chainds.com', 'hihicad881@chainds.com');
        console.log('Authenticated successfully. Commencing Firestore seeding...');
    } catch (authErr) {
        console.error('Failed to authenticate:', authErr.message);
        process.exit(1);
    }
    const recentDates = getRecentDateStrings(4);

    for (let uIdx = 0; uIdx < MOCK_USERS.length; uIdx++) {
        const user = MOCK_USERS[uIdx];
        const tracks = build13TracksForUser(user, uIdx);

        // 1. Seed users/{userId}
        await setDoc(
            doc(db, 'users', user.uid),
            {
                uid: user.uid,
                username: user.username,
                bio: user.bio,
                profileImageUrl: user.profileImageUrl,
                createdAt: new Date().toISOString(),
            },
            { merge: true }
        );

        // 2. Seed playlists/{userId}
        await setDoc(
            doc(db, 'playlists', user.uid),
            {
                songs: tracks,
                updatedAt: new Date().toISOString(),
            },
            { merge: true }
        );

        // 3. Seed 4 recent daily songs in daily/{userId}_{YYYY-MM-DD}
        for (let dIdx = 0; dIdx < recentDates.length; dIdx++) {
            const dateStr = recentDates[dIdx];
            const dailyTrack = tracks[dIdx % tracks.length];
            await setDoc(
                doc(db, 'daily', `${user.uid}_${dateStr}`),
                {
                    userId: user.uid,
                    username: user.username,
                    date: dateStr,
                    music: dailyTrack,
                    likesCount: (uIdx + dIdx) % 4,
                    likedBy: [],
                    updatedAt: new Date().toISOString(),
                },
                { merge: true }
            );
        }

        console.log(`Seeded user @${user.username} (${user.uid}) with 13 tracks & 4 daily logs.`);
    }

    // 4. Seed The Collective themes & shelf songs in both 'collective' and 'theCollective'
    for (let tIdx = 0; tIdx < COLLECTIVE_THEMES.length; tIdx++) {
        const theme = COLLECTIVE_THEMES[tIdx];
        const sampleUser = MOCK_USERS[tIdx % MOCK_USERS.length];
        const sampleTracks = build13TracksForUser(sampleUser, tIdx).slice(0, 4);

        for (const collName of ['collective', 'theCollective']) {
            await setDoc(
                doc(db, collName, theme.id),
                {
                    id: theme.id,
                    name: theme.name,
                    updatedAt: Timestamp.now(),
                },
                { merge: true }
            );

            for (let sIdx = 0; sIdx < sampleTracks.length; sIdx++) {
                const song = sampleTracks[sIdx];
                const safeSongId = `track_${song.trackId}`;
                await setDoc(
                    doc(db, collName, theme.id, 'songs', safeSongId),
                    {
                        ...song,
                        score: 5 - sIdx,
                        createdAt: Timestamp.now(),
                    },
                    { merge: true }
                );
            }
        }
    }

    console.log('Seeded The Collective shelves successfully.');
    process.exit(0);
}

seedDatabase().catch((err) => {
    console.error('Seed script failed:', err);
    process.exit(1);
});