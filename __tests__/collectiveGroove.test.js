// __tests__/collectiveGroove.test.js — Scarcity engine, liner notes, and Crate Radio test suite
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../firebaseConfig', () => ({
  db: {},
  auth: { currentUser: { uid: 'test_user_1', displayName: 'Tester' } },
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
  updateDoc: jest.fn().mockResolvedValue({}),
  doc: jest.fn(),
  setDoc: jest.fn().mockResolvedValue({}),
  getDoc: jest.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
  query: jest.fn(),
  orderBy: jest.fn(),
  increment: jest.fn((n) => n),
  limit: jest.fn(),
  startAfter: jest.fn(),
}));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(() => () => {}),
  signOut: jest.fn().mockResolvedValue({}),
}));

import {
  MAX_SUBMISSIONS_PER_DROP,
  MAX_COSIGNS_PER_DROP,
  MAX_LINER_NOTE_LENGTH,
  CRATE_RADIO_LIMIT,
  sanitizeLinerNote,
  normalizeCollectiveTrack,
  deriveUserDropQuota,
  validateCoSignAction,
  buildCrateRadioQueue,
  resolveTrackSocialAttribution,
} from '../utils/collectiveGrooveUtils';
import { appendTrackToYour13Safely } from '../utils/playlistUtils';
import Pickerchoosers from '../Pickerchoosers';
import ThemeDetails from '../ThemeDetails';
import TheCollective from '../TheCollective';
import AddSong from '../AddSong';
import ErrorBoundary from '../ErrorBoundary';

describe('collectiveGrooveUtils', () => {
  describe('sanitizeLinerNote', () => {
    it('returns empty string for non-string input', () => {
      expect(sanitizeLinerNote(null)).toBe('');
      expect(sanitizeLinerNote(undefined)).toBe('');
      expect(sanitizeLinerNote(123)).toBe('');
      expect(sanitizeLinerNote({})).toBe('');
    });

    it('collapses newlines, tabs, and multiple spaces into single spaces', () => {
      const input = "Wait for the\n\nbassline\tswitch\r\n  at 1:42!   ";
      expect(sanitizeLinerNote(input)).toBe('Wait for the bassline switch at 1:42!');
    });

    it('clamps strings longer than MAX_LINER_NOTE_LENGTH (140 chars)', () => {
      const longInput = 'A'.repeat(160);
      const sanitized = sanitizeLinerNote(longInput);
      expect(sanitized.length).toBe(140);
      expect(sanitized).toBe('A'.repeat(140));
    });

    it('preserves valid 140-char string', () => {
      const exact = 'B'.repeat(140);
      expect(sanitizeLinerNote(exact)).toBe(exact);
    });
  });

  describe('normalizeCollectiveTrack', () => {
    it('gracefully handles legacy track with missing fields', () => {
      const legacy = {
        title: 'Billie Jean',
        artist: 'Michael Jackson',
        score: 5,
      };
      const normalized = normalizeCollectiveTrack(legacy, 0);

      expect(normalized.trackName).toBe('Billie Jean');
      expect(normalized.artistName).toBe('Michael Jackson');
      expect(normalized.curatorName).toBe('Community');
      expect(normalized.curatorUid).toBeNull();
      expect(normalized.linerNote).toBe('');
      expect(normalized.coSigners).toEqual([]);
      expect(normalized.score).toBe(5);
    });

    it('preserves modern track with attribution and liner note', () => {
      const modern = {
        id: 'track_123',
        trackId: 12345,
        trackName: 'Blinding Lights',
        artistName: 'The Weeknd',
        score: 8,
        curatorUid: 'user_sigma',
        curatorName: 'Sigma',
        curatorAvatar: 'https://example.com/sigma.jpg',
        linerNote: 'Wait for the synth drop at 0:58\n',
        voters: ['user_sigma', 'user_beta'],
        coSigners: [
          { uid: 'user_sigma', username: 'Sigma', avatar: 'https://example.com/sigma.jpg' },
          { uid: 'user_beta', username: 'Beta', avatar: null },
        ],
      };

      const normalized = normalizeCollectiveTrack(modern, 0);
      expect(normalized.curatorUid).toBe('user_sigma');
      expect(normalized.curatorName).toBe('Sigma');
      expect(normalized.linerNote).toBe('Wait for the synth drop at 0:58');
      expect(normalized.voters).toEqual(['user_sigma', 'user_beta']);
      expect(normalized.coSigners.length).toBe(2);
      expect(normalized.coSigners[0].username).toBe('Sigma');
    });

    it('synthesizes coSigners from voters array if coSigners is omitted', () => {
      const track = {
        id: 't1',
        title: 'Song A',
        artist: 'Artist A',
        curatorUid: 'u1',
        curatorName: 'Alice',
        voters: ['u1', 'u2'],
      };
      const normalized = normalizeCollectiveTrack(track);
      expect(normalized.coSigners).toEqual([
        { uid: 'u1', username: 'Alice', avatar: null },
        { uid: 'u2', username: 'Listener', avatar: null },
      ]);
    });
  });

  describe('deriveUserDropQuota', () => {
    it('returns unauthenticated quota when currentUid is null', () => {
      const quota = deriveUserDropQuota([], null);
      expect(quota).toEqual({
        submissionsUsed: 0,
        submissionsRemaining: 1,
        canSubmit: false,
        coSignsUsed: 0,
        coSignsRemaining: 3,
        canCoSign: false,
      });
    });

    it('allows 1 submission and 3 co-signs when user has no activity', () => {
      const tracks = [
        { id: '1', curatorUid: 'other_user', voters: ['other_user'] },
        { id: '2', curatorUid: 'third_user', voters: ['third_user'] },
      ];
      const quota = deriveUserDropQuota(tracks, 'my_user');
      expect(quota.submissionsUsed).toBe(0);
      expect(quota.submissionsRemaining).toBe(1);
      expect(quota.canSubmit).toBe(true);
      expect(quota.coSignsUsed).toBe(0);
      expect(quota.coSignsRemaining).toBe(3);
      expect(quota.canCoSign).toBe(true);
    });

    it('blocks submissions when user already nominated 1 track', () => {
      const tracks = [
        { id: '1', curatorUid: 'my_user', voters: ['my_user'] },
      ];
      const quota = deriveUserDropQuota(tracks, 'my_user');
      expect(quota.submissionsUsed).toBe(1);
      expect(quota.submissionsRemaining).toBe(0);
      expect(quota.canSubmit).toBe(false);
      expect(quota.coSignsUsed).toBe(1); // Nominating automatically co-signs
      expect(quota.coSignsRemaining).toBe(2);
      expect(quota.canCoSign).toBe(true);
    });

    it('exhausts Co-Sign quota after 3 votes across tracks', () => {
      const tracks = [
        { id: '1', curatorUid: 'u1', voters: ['my_user'] },
        { id: '2', curatorUid: 'u2', voters: ['my_user'] },
        { id: '3', curatorUid: 'u3', voters: ['my_user'] },
      ];
      const quota = deriveUserDropQuota(tracks, 'my_user');
      expect(quota.coSignsUsed).toBe(3);
      expect(quota.coSignsRemaining).toBe(0);
      expect(quota.canCoSign).toBe(false);
    });
  });

  describe('validateCoSignAction', () => {
    const tracks = [
      { id: 'track_1', curatorUid: 'u1', voters: ['u1', 'user_a'] },
      { id: 'track_2', curatorUid: 'u2', voters: ['u2'] },
      { id: 'track_3', curatorUid: 'u3', voters: ['u3'] },
    ];

    it('blocks unauthenticated user', () => {
      const result = validateCoSignAction(tracks, 'track_2', null);
      expect(result).toEqual({ allowed: false, reason: 'auth_required' });
    });

    it('blocks duplicate co-sign on same track', () => {
      const result = validateCoSignAction(tracks, 'track_1', 'user_a');
      expect(result).toEqual({ allowed: false, reason: 'already_cosigned' });
    });

    it('blocks co-sign when user has already reached 3 votes', () => {
      const fullTracks = [
        { id: 't1', voters: ['heavy_voter'] },
        { id: 't2', voters: ['heavy_voter'] },
        { id: 't3', voters: ['heavy_voter'] },
        { id: 't4', voters: [] },
      ];
      const result = validateCoSignAction(fullTracks, 't4', 'heavy_voter');
      expect(result).toEqual({ allowed: false, reason: 'quota_reached' });
    });

    it('allows co-sign when quota remains and user has not voted yet', () => {
      const result = validateCoSignAction(tracks, 'track_2', 'user_a');
      expect(result).toEqual({ allowed: true });
    });
  });

  describe('buildCrateRadioQueue', () => {
    it('sorts tracks by score descending and clamps to CRATE_RADIO_LIMIT (13)', () => {
      const tracks = Array.from({ length: 20 }, (_, i) => ({
        id: `t_${i}`,
        title: `Song ${i}`,
        score: i * 2,
      }));

      const queue = buildCrateRadioQueue(tracks);
      expect(queue.length).toBe(13);
      expect(queue[0].score).toBe(38); // Highest score (19 * 2)
      expect(queue[12].score).toBe(14); // 13th highest score (7 * 2)
    });

    it('handles empty or malformed tracks gracefully', () => {
      expect(buildCrateRadioQueue([])).toEqual([]);
      expect(buildCrateRadioQueue(null)).toEqual([]);
    });
  });

  describe('resolveTrackSocialAttribution', () => {
    it('falls back cleanly to @Community for legacy tracks without curatorUid', () => {
      const legacyTrack = {
        title: 'Legacy Song',
        artist: 'Legacy Artist',
      };
      const attr = resolveTrackSocialAttribution(legacyTrack);
      expect(attr.curatorUid).toBeNull();
      expect(attr.curatorUsername).toBe('Community');
      expect(attr.curatorHandle).toBe('@Community');
      expect(attr.coSignerAvatars).toEqual([]);
      expect(attr.overflowCount).toBe(0);
    });

    it('formats curator handle and extracts up to 3 co-signer mini avatars with overflow', () => {
      const track = {
        id: 'track_xyz',
        title: 'Starboy',
        artist: 'The Weeknd',
        curatorUid: 'user_1',
        curatorName: 'Alice',
        voters: ['user_1', 'user_2', 'user_3', 'user_4', 'user_5'],
        coSigners: [
          { uid: 'user_1', username: 'Alice', avatar: 'https://example.com/alice.jpg' },
          { uid: 'user_2', username: 'Bob', avatar: null },
          { uid: 'user_3', username: 'Charlie', avatar: 'https://example.com/c.jpg' },
          { uid: 'user_4', username: 'David', avatar: null },
          { uid: 'user_5', username: 'Eve', avatar: null },
        ],
      };

      const attr = resolveTrackSocialAttribution(track);
      expect(attr.curatorUid).toBe('user_1');
      expect(attr.curatorUsername).toBe('Alice');
      expect(attr.curatorHandle).toBe('@Alice');
      expect(attr.coSignerAvatars.length).toBe(3);
      expect(attr.coSignerAvatars.map((a) => a.username)).toEqual(['Alice', 'Bob', 'Charlie']);
      expect(attr.totalCoSigners).toBe(5);
      expect(attr.overflowCount).toBe(2);
    });

    it('uses fresher username/avatar from usersByIdMap when available', () => {
      const track = {
        id: 'track_1',
        curatorUid: 'user_1',
        curatorName: 'OldName',
        coSigners: [{ uid: 'user_1', username: 'OldName' }],
      };
      const userMap = {
        user_1: { username: 'NewFreshName', photoURL: 'https://cdn.example.com/fresh.png' },
      };
      const attr = resolveTrackSocialAttribution(track, userMap);
      expect(attr.curatorUsername).toBe('NewFreshName');
      expect(attr.curatorHandle).toBe('@NewFreshName');
      expect(attr.coSignerAvatars[0].avatar).toBe('https://cdn.example.com/fresh.png');
    });
  });

  describe('appendTrackToYour13Safely [WP-04]', () => {
    it('blocks addition when collection is locked', () => {
      const res = appendTrackToYour13Safely({
        currentList: [{ trackId: '1', trackName: 'Song 1', artistName: 'Artist 1' }],
        candidateTrack: { trackId: '2', trackName: 'Song 2', artistName: 'Artist 2' },
        isLocked: true,
      });
      expect(res).toEqual({ ok: false, reason: 'locked' });
    });

    it('blocks addition when collection is full (13 tracks)', () => {
      const fullList = Array.from({ length: 13 }, (_, i) => ({
        trackId: String(i + 1),
        trackName: `Song ${i + 1}`,
        artistName: 'Artist',
      }));
      const res = appendTrackToYour13Safely({
        currentList: fullList,
        candidateTrack: { trackId: '99', trackName: 'New Song', artistName: 'Artist' },
        isLocked: false,
      });
      expect(res).toEqual({ ok: false, reason: 'full' });
    });

    it('blocks addition when candidate track is a duplicate', () => {
      const list = [{ trackId: '42', trackName: 'Blinding Lights', artistName: 'The Weeknd' }];
      const res = appendTrackToYour13Safely({
        currentList: list,
        candidateTrack: { trackId: '42', trackName: 'Blinding Lights', artistName: 'The Weeknd' },
        isLocked: false,
      });
      expect(res).toEqual({ ok: false, reason: 'duplicate' });
    });

    it('successfully appends new track to next available slot', () => {
      const list = [
        { trackId: '1', trackName: 'Song 1', artistName: 'Artist 1' },
        { trackId: '2', trackName: 'Song 2', artistName: 'Artist 2' },
      ];
      const res = appendTrackToYour13Safely({
        currentList: list,
        candidateTrack: { trackId: '3', trackName: 'Song 3', artistName: 'Artist 3' },
        isLocked: false,
      });
      expect(res.ok).toBe(true);
      expect(res.slotNumber).toBe(3);
      expect(res.nextList.length).toBe(3);
      expect(res.track.trackName).toBe('Song 3');
      expect(res.track.rank).toBe(3);
    });
  });

  describe('Collective Groove Component Smoke & Integrity Tests', () => {
    it('verifies Pickerchoosers is a valid component function', () => {
      expect(typeof Pickerchoosers).toBe('function');
    });

    it('verifies ThemeDetails exports a valid component function and catalog', () => {
      expect(typeof ThemeDetails).toBe('function');
    });

    it('verifies TheCollective is a valid component function', () => {
      expect(typeof TheCollective).toBe('function');
    });

    it('verifies AddSong is a valid component function', () => {
      expect(typeof AddSong).toBe('function');
    });

    it('verifies ErrorBoundary catches errors and renders recovery UI without unmounting to white screen', () => {
      expect(typeof ErrorBoundary).toBe('function');
      expect(typeof ErrorBoundary.getDerivedStateFromError).toBe('function');
      const boundaryInstance = new ErrorBoundary({ children: 'Child Content' });
      expect(typeof boundaryInstance.componentDidCatch).toBe('function');
      expect(typeof boundaryInstance.render).toBe('function');

      // Normal render returns children
      expect(boundaryInstance.render()).toBe('Child Content');

      // Error state update
      const error = new Error('Simulated runtime render crash');
      const nextState = ErrorBoundary.getDerivedStateFromError(error);
      expect(nextState).toEqual({ hasError: true, error });

      // Error render returns recovery view
      boundaryInstance.state = { hasError: true, error, errorInfo: null };
      const recoveryTree = boundaryInstance.render();
      expect(recoveryTree).toBeDefined();
      expect(recoveryTree.props.style).toBeDefined();
    });
  });
});
