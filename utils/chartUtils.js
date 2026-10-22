// utils/chartUtils.js
import { normalizeTrack } from '../services/musicApi';

/**
 * Aggregates community charts from each user's chosen 13 songs.
 * 
 * @param {Array<{username?: string, id?: string, songs?: Array<any>}>} playlists 
 * @returns {{
 *   rankedSongs: Array<any>,
 *   rankedArtists: Array<{name: string, count: number, topSong: string, artworkUrl100?: string, curators: string[]}>,
 *   rankedGenres: Array<{name: string, count: number, sampleArtwork?: string}>,
 *   totalCurators: number,
 *   totalPicks: number
 * }}
 */
export function aggregateCommunity13Charts(playlists = []) {
  if (!Array.isArray(playlists)) {
    return {
      rankedSongs: [],
      rankedArtists: [],
      rankedGenres: [],
      totalCurators: 0,
      totalPicks: 0,
    };
  }

  const songsMap = {};
  const artistsMap = {};
  const genresMap = {};
  let totalPicks = 0;
  let validCuratorsCount = 0;

  playlists.forEach((playlist) => {
    if (!playlist) return;
    const curatorId = playlist.username || playlist.id || playlist.uid || 'Curator';
    const rawSongs = Array.isArray(playlist.songs)
      ? playlist.songs
      : typeof playlist.songs === 'object' && playlist.songs !== null
        ? Object.values(playlist.songs)
        : [];

    // Strictly cap to each user's 13 songs
    const user13 = rawSongs
      .filter((s) => s && (s.trackName || s.title) && (s.artistName || s.artist))
      .slice(0, 13);

    // Track keys seen in this specific user's 13 to avoid multiple votes from the same user for the same song
    const seenInUser13 = new Set();
    let hasContributedTrack = false;

    user13.forEach((song) => {
      const normalized = normalizeTrack(song);
      const trackTitle = (normalized.trackName || normalized.title || '').trim();
      const artist = (normalized.artistName || normalized.artist || '').trim();
      const genre = (normalized.primaryGenreName || normalized.genre || 'Music').trim();

      if (!trackTitle || trackTitle === 'Unknown Track' || !artist) return;

      const songKey = normalized.trackId
        ? `id_${normalized.trackId}`
        : `${trackTitle.toLowerCase()}::${artist.toLowerCase()}`;

      if (!seenInUser13.has(songKey)) {
        seenInUser13.add(songKey);
        totalPicks += 1;
        hasContributedTrack = true;

        if (songsMap[songKey]) {
          songsMap[songKey].count += 1;
          if (!songsMap[songKey].curators.includes(curatorId)) {
            songsMap[songKey].curators.push(curatorId);
          }
          if (!songsMap[songKey].previewUrl && normalized.previewUrl) {
            songsMap[songKey].previewUrl = normalized.previewUrl;
          }
        } else {
          songsMap[songKey] = {
            ...normalized,
            count: 1,
            curators: [curatorId],
          };
        }

        // Artist ranking
        if (artistsMap[artist]) {
          artistsMap[artist].count += 1;
          if (!artistsMap[artist].curators.includes(curatorId)) {
            artistsMap[artist].curators.push(curatorId);
          }
        } else {
          artistsMap[artist] = {
            name: artist,
            count: 1,
            topSong: trackTitle,
            artworkUrl100: normalized.artworkUrl100,
            curators: [curatorId],
          };
        }

        // Genre ranking
        if (genresMap[genre]) {
          genresMap[genre].count += 1;
        } else {
          genresMap[genre] = {
            name: genre,
            count: 1,
            sampleArtwork: normalized.artworkUrl100,
          };
        }
      }
    });

    if (hasContributedTrack) {
      validCuratorsCount += 1;
    }
  });

  const rankedSongs = Object.values(songsMap).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.trackName.localeCompare(b.trackName);
  });

  const rankedArtists = Object.values(artistsMap).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });

  const rankedGenres = Object.values(genresMap).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });

  return {
    rankedSongs,
    rankedArtists,
    rankedGenres,
    totalCurators: validCuratorsCount,
    totalPicks,
  };
}
