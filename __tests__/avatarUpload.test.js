// __tests__/avatarUpload.test.js
import { uploadAvatarWithFallback, MAX_FIRESTORE_DATA_URL_BYTES } from '../utils/avatarUtils';

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
