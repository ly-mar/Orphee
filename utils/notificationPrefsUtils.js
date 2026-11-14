// utils/notificationPrefsUtils.js
// Coerces missing or non-boolean notification preferences safely [BUG-018, WS-04]

export const NOTIF_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'social', label: 'Co-Signs & Social' },
];

export function filterNotifications(notifications, activeFilter = 'all') {
  if (!Array.isArray(notifications)) return [];
  if (activeFilter === 'social') {
    return notifications.filter((item) => {
      const type = String(item?.type || '').toLowerCase();
      return (
        type === 'cosign' ||
        type === 'friend_request' ||
        type === 'chat' ||
        type === 'vibe_match' ||
        item?.isPendingRequest === true
      );
    });
  }
  return [...notifications];
}

export function sanitizeNotificationPrefs(raw = {}) {
  const safeObj = raw && typeof raw === 'object' ? raw : {};
  return {
    friendRequests: safeObj.friendRequests !== undefined ? Boolean(safeObj.friendRequests) : true,
    chatMessages: safeObj.chatMessages !== undefined ? Boolean(safeObj.chatMessages) : true,
    dailyMemoirReminder: safeObj.dailyMemoirReminder !== undefined ? Boolean(safeObj.dailyMemoirReminder) : true,
    collectiveUpdates: safeObj.collectiveUpdates !== undefined ? Boolean(safeObj.collectiveUpdates) : true,
  };
}

