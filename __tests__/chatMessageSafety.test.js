// __tests__/chatMessageSafety.test.js
import { validateOutgoingChatMessage, MAX_CHAT_MESSAGE_LENGTH } from '../utils/chatMessageUtils';

describe('ChatScreen Outgoing Message Validation & Bounds [BUG-019]', () => {
  test('rejects empty or whitespace-only chat messages and missing sender/chatId', () => {
    expect(validateOutgoingChatMessage({ text: '   ', senderId: 'u1', chatId: 'c1' }).ok).toBe(false);
    expect(validateOutgoingChatMessage({ text: 'Hello', senderId: null, chatId: 'c1' }).ok).toBe(false);
    expect(validateOutgoingChatMessage({ text: 'Hello', senderId: 'u1', chatId: '' }).ok).toBe(false);
  });

  test('trims valid messages and truncates payloads exceeding MAX_CHAT_MESSAGE_LENGTH', () => {
    const longText = 'a'.repeat(MAX_CHAT_MESSAGE_LENGTH + 500);
    const res = validateOutgoingChatMessage({ text: `  ${longText}  `, senderId: 'u1', chatId: 'c1' });
    expect(res.ok).toBe(true);
    expect(res.payload.text).toHaveLength(MAX_CHAT_MESSAGE_LENGTH);
    expect(res.payload.senderId).toBe('u1');
  });
});

