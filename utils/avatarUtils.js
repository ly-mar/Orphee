// utils/avatarUtils.js
export const MAX_FIRESTORE_DATA_URL_BYTES = 700 * 1024; // 700 KB safe ceiling under Firestore 1 MiB limit

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

