// utils/chatMessageUtils.js
// Validates and bounds outgoing chat message payloads [BUG-019]

export const MAX_CHAT_MESSAGE_LENGTH = 2000;

export function validateOutgoingChatMessage({ text = '', senderId = null, chatId = null } = {}) {
  const cleanChatId = String(chatId ?? '').trim();
  const cleanSenderId = String(senderId ?? '').trim();
  const cleanText = String(text ?? '').trim();

  if (!cleanChatId || !cleanSenderId) {
    return { ok: false, error: 'Chat session is not ready.', payload: null };
  }
  if (!cleanText) {
    return { ok: false, error: 'Message cannot be empty.', payload: null };
  }

  return {
    ok: true,
    error: null,
    payload: {
      text: cleanText.slice(0, MAX_CHAT_MESSAGE_LENGTH),
      senderId: cleanSenderId,
      chatId: cleanChatId,
    },
  };
}

