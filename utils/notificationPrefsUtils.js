// utils/notificationPrefsUtils.js
// Coerces missing or non-boolean notification preferences safely [BUG-018]

export function sanitizeNotificationPrefs(raw = {}) {
  const safeObj = raw && typeof raw === 'object' ? raw : {};
  return {
    friendRequests: safeObj.friendRequests !== undefined ? Boolean(safeObj.friendRequests) : true,
    chatMessages: safeObj.chatMessages !== undefined ? Boolean(safeObj.chatMessages) : true,
    dailyMemoirReminder: safeObj.dailyMemoirReminder !== undefined ? Boolean(safeObj.dailyMemoirReminder) : true,
    collectiveUpdates: safeObj.collectiveUpdates !== undefined ? Boolean(safeObj.collectiveUpdates) : true,
  };
}

