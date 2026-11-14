// utils/avatarUtils.js
import React from 'react';
import { View, Image, Text } from 'react-native';

export const MAX_FIRESTORE_DATA_URL_BYTES = 700 * 1024; // 700 KB safe ceiling under Firestore 1 MiB limit
export const MAX_BIO_LENGTH = 200;
export const MAX_DISPLAY_NAME_LENGTH = 40;
export const MAX_USERNAME_LENGTH = 30;

export function isGenericStockAvatar(url) {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase();
  return (
    lower.includes('photo-1535713875002-d1d0cf377fde') ||
    lower.includes('photo-1534528741775-53994a69daeb') ||
    lower.includes('photo-1507003211169-0a1dd7228f2d') ||
    lower.includes('photo-1500648767791-00dcc994a43e') ||
    lower.includes('photo-1517841905240-472988babdf9') ||
    lower.includes('photo-1506794778202-cad84cf45f1d') ||
    lower.includes('photo-1511671782779-c97d3d27a1d4') ||
    lower.includes('pravatar.cc') ||
    lower.includes('unsplash.com') ||
    lower.includes('placeholder.com') ||
    lower.includes('example.com')
  );
}

const AVATAR_PALETTE = [
  '#FF8C00', // Orange
  '#3B82F6', // Blue
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
];

export function getAvatarColor(identifier = '') {
  const str = String(identifier || 'TuneHub').toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

export function getInitials(name = '') {
  const clean = String(name || '').replace(/^@+/, '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean[0].toUpperCase();
}

export function UserAvatar({
  imageUrl,
  name,
  size = 44,
  style,
  borderRadius = size / 2,
}) {
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [imageUrl]);

  const isCustomImage =
    !imageError &&
    typeof imageUrl === 'string' &&
    (imageUrl.startsWith('http://') ||
      imageUrl.startsWith('https://') ||
      imageUrl.startsWith('data:image/')) &&
    !isGenericStockAvatar(imageUrl);

  if (isCustomImage) {
    return (
      <Image
        source={{ uri: imageUrl }}
        onError={() => setImageError(true)}
        style={[
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: '#1E2430',
          },
          style,
        ]}
      />
    );
  }

  const initials = getInitials(name);
  const bgColor = getAvatarColor(name);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: Math.max(11, Math.floor(size * 0.4)),
          fontWeight: '700',
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

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

