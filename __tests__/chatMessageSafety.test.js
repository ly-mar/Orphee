// __tests__/chatMessageSafety.test.js
import {
  validateOutgoingChatMessage,
  MAX_CHAT_MESSAGE_LENGTH,
  buildDeterministicChatId,
  openOrCreateDirectChat,
} from '../utils/chatMessageUtils';

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

describe('Direct Chat Canonical Opener [VR-007]', () => {
  test('buildDeterministicChatId sorts distinct UIDs and rejects self-chat or empty IDs', () => {
    expect(buildDeterministicChatId('u_b', 'u_a')).toEqual({
      chatId: 'u_a_u_b',
      participants: ['u_a', 'u_b'],
    });
    expect(buildDeterministicChatId('u1', 'u1')).toBeNull();
    expect(buildDeterministicChatId('', 'u2')).toBeNull();
  });

  test('openOrCreateDirectChat reuses existing deterministic doc without querying other chats', async () => {
    const getDocFn = jest.fn().mockResolvedValue({ exists: () => true, id: 'u_a_u_b' });
    const setDocFn = jest.fn();
    const getDocsFn = jest.fn();

    const res = await openOrCreateDirectChat({
      currentUserId: 'u_b',
      targetUid: 'u_a',
      targetUsername: 'Alpha',
      docFn: (_db, col, id) => `${col}/${id}`,
      getDocFn,
      setDocFn,
      collectionFn: jest.fn(),
      queryFn: jest.fn(),
      whereFn: jest.fn(),
      getDocsFn,
      db: {},
    });

    expect(res.chatId).toBe('u_a_u_b');
    expect(res.otherUserId).toBe('u_a');
    expect(res.username).toBe('Alpha');
    expect(setDocFn).not.toHaveBeenCalled();
    expect(getDocsFn).not.toHaveBeenCalled();
  });

  test('openOrCreateDirectChat creates deterministic chat doc via setDoc when missing', async () => {
    const getDocFn = jest.fn().mockResolvedValue({ exists: () => false });
    const getDocsFn = jest.fn().mockResolvedValue({ docs: [] });
    const setDocFn = jest.fn().mockResolvedValue();

    const res = await openOrCreateDirectChat({
      currentUserId: 'u2',
      targetUid: 'u1',
      targetUsername: 'Peer',
      docFn: (_db, col, id) => `${col}/${id}`,
      getDocFn,
      setDocFn,
      collectionFn: jest.fn(),
      queryFn: jest.fn(),
      whereFn: jest.fn(),
      getDocsFn,
      db: {},
    });

    expect(res.chatId).toBe('u1_u2');
    expect(setDocFn).toHaveBeenCalledWith(
      'chats/u1_u2',
      expect.objectContaining({
        chatId: 'u1_u2',
        participants: ['u1', 'u2'],
      }),
      { merge: true }
    );
  });
});

