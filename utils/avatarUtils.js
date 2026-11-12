// utils/avatarUtils.js
export const MAX_FIRESTORE_DATA_URL_BYTES = 700 * 1024; // 700 KB safe ceiling under Firestore 1 MiB limit
export const MAX_BIO_LENGTH = 200;
export const MAX_DISPLAY_NAME_LENGTH = 40;
export const MAX_USERNAME_LENGTH = 30;

export function validateAndNormalizeProfileUpdate({
  displayName = '',
  username = '',
  bio = '',
} = {}) {
  const cleanDisplayName = String(displayName ?? '').trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  const cleanUsername = String(username ?? '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, '_')
    .slice(0, MAX_USERNAME_LENGTH);
  const cleanBio = String(bio ?? '').trim().slice(0, MAX_BIO_LENGTH);

  if (!cleanUsername || cleanUsername.length < 2) {
    return {
      ok: false,
      error: 'Please enter a username with at least 2 characters.',
      data: null,
    };
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
    return {
      ok: false,
      error: 'Username can only contain letters, numbers, dots, underscores, or hyphens.',
      data: null,
    };
  }

  return {
    ok: true,
    error: null,
    data: {
      displayName: cleanDisplayName || cleanUsername,
      username: cleanUsername,
      bio: cleanBio,
    },
  };
}

export function normalizeAndSortMediaList(rawItems = []) {
  if (!Array.isArray(rawItems)) return [];
  const getMillis = (item) => {
    const rawDate = item?.createdAt || item?.uploadedAt || item?.updatedAt;
    if (!rawDate) return 0;
    if (typeof rawDate?.toMillis === 'function') return rawDate.toMillis();
    if (rawDate?.seconds != null) return rawDate.seconds * 1000;
    const ms = new Date(rawDate).getTime();
    return Number.isFinite(ms) ? ms : 0;
  };

  return rawItems
    .filter((item) => item && (item.imageUrl || item.downloadURL))
    .map((item) => ({
      ...item,
      resolvedUrl: item.imageUrl || item.downloadURL,
    }))
    .sort((a, b) => getMillis(b) - getMillis(a));
}

export async function uploadAvatarWithFallback({
  uri,
  base64,
  mimeType = 'image/jpeg',
  uploadToStorage,
  saveProfileUrl,
}) {
  try {
    const downloadUrl = await uploadToStorage(uri);
    await saveProfileUrl(downloadUrl);
    return { url: downloadUrl, usedFallback: false };
  } catch (err) {
    const isQuotaOrStorageError =
      err?.code === 'storage/quota-exceeded' ||
      err?.code === 'storage/retry-limit-exceeded' ||
      err?.code === 'storage/unauthorized';

    if (!isQuotaOrStorageError || !base64) {
      throw err;
    }

    const safeMime = /^image\/(jpeg|png|webp)$/i.test(mimeType) ? mimeType : 'image/jpeg';
    const dataUrl = base64.startsWith('data:') ? base64 : `data:${safeMime};base64,${base64}`;

    if (dataUrl.length > MAX_FIRESTORE_DATA_URL_BYTES) {
      throw new Error('Selected image is too large for fallback storage. Please choose a smaller photo.');
    }

    await saveProfileUrl(dataUrl);
    return { url: dataUrl, usedFallback: true };
  }
}

