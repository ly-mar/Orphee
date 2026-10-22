// services/musicApi.js
import axios from 'axios';
import debounce from 'lodash.debounce';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const searchCache = new Map();

export function getHighResImage(imageUrl, size = '400x400') {
    if (!imageUrl || typeof imageUrl !== 'string') {
        return 'https://via.placeholder.com/400';
    }
    return imageUrl.replace('100x100', size);
}

export function normalizeTrack(raw = {}) {
    const trackId = Number(raw.trackId || raw.id || Date.now());
    const trackName = String(raw.trackName || raw.title || 'Unknown Track').trim();
    const artistName = String(raw.artistName || raw.artist || 'Unknown Artist').trim();
    const artistId = Number(raw.artistId || 0);
    const collectionName = String(
        raw.collectionName || raw.album || 'Single / Album'
    ).trim();
    const artworkUrl100 =
        typeof raw.artworkUrl100 === 'string' && raw.artworkUrl100.startsWith('http')
            ? raw.artworkUrl100
            : typeof raw.imageUrl === 'string' && raw.imageUrl.startsWith('http')
                ? raw.imageUrl
                : 'https://via.placeholder.com/150';
    const previewUrl =
        typeof raw.previewUrl === 'string' && raw.previewUrl.startsWith('http')
            ? raw.previewUrl
            : '';
    const primaryGenreName = String(
        raw.primaryGenreName || raw.genre || 'Music'
    ).trim();
    const releaseDate = raw.releaseDate || new Date().toISOString();

    return {
        // 8-Property CanonicalTrack contract
        trackId,
        trackName,
        artistName,
        collectionName,
        artworkUrl100,
        previewUrl,
        primaryGenreName,
        releaseDate,
        // Auxiliary compatibility fields
        artistId,
        id: trackId,
        title: trackName,
        artist: artistName,
        genre: primaryGenreName,
        imageUrl: artworkUrl100,
    };
}

export async function searchMusic(query, options = {}) {
    const trimmed = String(query || '').trim();
    if (trimmed.length < 2) return [];

    const { limit = 25, country = 'US', entity = 'song' } = options;
    const cacheKey = `${trimmed.toLowerCase()}_${country.toLowerCase()}_${limit}`;

    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.results;
    }

    const response = await axios.get('https://itunes.apple.com/search', {
        params: {
            term: trimmed,
            media: 'music',
            entity,
            country,
            limit,
        },
        timeout: 8000,
    });

    const rawResults = Array.isArray(response.data?.results)
        ? response.data.results
        : [];
    const normalizedResults = rawResults
        .filter((item) => item && (item.trackId || item.trackName))
        .map(normalizeTrack);

    searchCache.set(cacheKey, {
        timestamp: Date.now(),
        results: normalizedResults,
    });

    return normalizedResults;
}

export function createDebouncedSearch(callback, waitMs = 380) {
    return debounce(async (query, options = {}) => {
        try {
            const results = await searchMusic(query, options);
            callback(results, null);
        } catch (error) {
            callback([], error);
        }
    }, waitMs);
}

export function clearMusicSearchCache() {
    searchCache.clear();
}