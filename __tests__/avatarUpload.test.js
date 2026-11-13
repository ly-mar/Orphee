// __tests__/avatarUpload.test.js
import {
  uploadAvatarWithFallback,
  MAX_FIRESTORE_DATA_URL_BYTES,
  validateAndNormalizeProfileUpdate,
  normalizeAndSortMediaList,
  isGenericStockAvatar,
  getAvatarColor,
  getInitials,
} from '../utils/avatarUtils';

describe('Avatar Upload Quota Fallback [BUG-005]', () => {
  test('falls back to compressed base64 dataUrl when Firebase Storage throws storage/quota-exceeded', async () => {
    const quotaErr = Object.assign(new Error('Quota exceeded'), { code: 'storage/quota-exceeded' });
    const uploadToStorage = jest.fn().mockRejectedValue(quotaErr);
    const saveProfileUrl = jest.fn().mockResolvedValue(true);

    const smallBase64 = 'a'.repeat(1024);
    const result = await uploadAvatarWithFallback({
      uri: 'file:///avatar.jpg',
      base64: smallBase64,
      mimeType: 'image/jpeg',
      uploadToStorage,
      saveProfileUrl,
    });

    expect(result.usedFallback).toBe(true);
    expect(saveProfileUrl).toHaveBeenCalledWith(`data:image/jpeg;base64,${smallBase64}`);
  });

  test('rejects fallback base64 payloads that exceed safe Firestore document limits', async () => {
    const quotaErr = Object.assign(new Error('Quota exceeded'), { code: 'storage/quota-exceeded' });
    const uploadToStorage = jest.fn().mockRejectedValue(quotaErr);
    const saveProfileUrl = jest.fn();

    const oversizedBase64 = 'a'.repeat(MAX_FIRESTORE_DATA_URL_BYTES + 100);
    await expect(
      uploadAvatarWithFallback({
        uri: 'file:///huge.jpg',
        base64: oversizedBase64,
        uploadToStorage,
        saveProfileUrl,
      })
    ).rejects.toThrow(/image is too large/i);
    expect(saveProfileUrl).not.toHaveBeenCalled();
  });

  test('returns storage download URL when storage upload succeeds', async () => {
    const mockUrl = 'https://firebasestorage.googleapis.com/v0/b/app/avatar.jpg';
    const uploadToStorage = jest.fn().mockResolvedValue(mockUrl);
    const saveProfileUrl = jest.fn().mockResolvedValue(true);

    const result = await uploadAvatarWithFallback({
      uri: 'file:///avatar.jpg',
      base64: 'abc',
      uploadToStorage,
      saveProfileUrl,
    });

    expect(result.usedFallback).toBe(false);
    expect(result.url).toBe(mockUrl);
    expect(saveProfileUrl).toHaveBeenCalledWith(mockUrl);
  });
});

describe('UpdateProfileScreen Validation & Media Sorting [VR-002]', () => {
  test('normalizes valid profile updates and rejects invalid or too-short usernames', () => {
    const valid = validateAndNormalizeProfileUpdate({
      displayName: '  Marly J  ',
      username: '  @marly_beats ',
      bio: '  Sonic explorer  ',
    });
    expect(valid.ok).toBe(true);
    expect(valid.data).toEqual({
      displayName: 'Marly J',
      username: 'marly_beats',
      bio: 'Sonic explorer',
    });

    expect(validateAndNormalizeProfileUpdate({ username: 'a' }).ok).toBe(false);
    expect(validateAndNormalizeProfileUpdate({ username: 'bad name!' }).ok).toBe(false);
  });

  test('normalizes imageUrl/downloadURL and sorts media newest-first across createdAt and uploadedAt', () => {
    const media = normalizeAndSortMediaList([
      null,
      { id: '1', downloadURL: 'https://cdn/old.jpg', uploadedAt: '2025-01-01T00:00:00Z' },
      { id: '2', imageUrl: 'https://cdn/new.jpg', createdAt: '2026-06-01T00:00:00Z' },
      { id: '3', otherField: 'no-url' },
    ]);
    expect(media).toHaveLength(2);
    expect(media[0].id).toBe('2');
    expect(media[0].resolvedUrl).toBe('https://cdn/new.jpg');
    expect(media[1].resolvedUrl).toBe('https://cdn/old.jpg');
  });
});

describe('Avatar Initials and Stock Avatar Detection [VR-009]', () => {
  test('correctly identifies generic stock avatars or invalid URLs', () => {
    expect(isGenericStockAvatar(null)).toBe(true);
    expect(isGenericStockAvatar('')).toBe(true);
    expect(isGenericStockAvatar('https://i.pravatar.cc/150?img=3')).toBe(true);
    expect(isGenericStockAvatar('https://images.unsplash.com/photo-123')).toBe(true);
    expect(isGenericStockAvatar('https://firebasestorage.googleapis.com/v0/b/app/avatar.jpg')).toBe(false);
    expect(isGenericStockAvatar('data:image/jpeg;base64,abc')).toBe(false);
  });

  test('extracts single or two-letter initials correctly from various name formats', () => {
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('@john_doe')).toBe('J');
    expect(getInitials('Listener')).toBe('L');
    expect(getInitials('A B C')).toBe('AB');
    expect(getInitials('')).toBe('?');
    expect(getInitials(null)).toBe('?');
  });

  test('generates deterministic color from name seed', () => {
    const c1 = getAvatarColor('Marly');
    const c2 = getAvatarColor('Marly');
    const c3 = getAvatarColor('Alex');
    expect(c1).toBe(c2);
    expect(typeof c1).toBe('string');
    expect(c1.startsWith('#')).toBe(true);
  });
});
