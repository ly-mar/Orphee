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

export function buildDeterministicChatId(uidA, uidB) {
  const a = String(uidA ?? '').trim();
  const b = String(uidB ?? '').trim();
  if (!a || !b || a === b) return null;
  const participants = [a, b].sort();
  return {
    chatId: `${participants[0]}_${participants[1]}`,
    participants,
  };
}

/**
 * Shared direct-chat opener conforming to firestore.rules:
 * reads deterministic `chats/{sortedUidA_sortedUidB}` first (`resource == null || uid in resource.data.participants`),
 * scans `where('participants', 'array-contains', currentUid)` for legacy docs if needed,
 * and creates `chats/{chatId}` via `setDoc(..., { merge: true })` when absent.
 */
export async function openOrCreateDirectChat({
  currentUserId,
  targetUid,
  targetUsername = 'User',
  docFn,
  getDocFn,
  setDocFn,
  collectionFn,
  queryFn,
  whereFn,
  getDocsFn,
  db,
}) {
  const identity = buildDeterministicChatId(currentUserId, targetUid);
  if (!identity) {
    throw new Error('Cannot start a chat without two distinct authenticated users.');
  }

  const { chatId: deterministicChatId, participants } = identity;

  // 1. Deterministic document lookup (allowed by firestore.rules when resource == null or uid in participants)
  const deterministicRef = docFn(db, 'chats', deterministicChatId);
  try {
    const existingSnap = await getDocFn(deterministicRef);
    if (existingSnap?.exists?.()) {
      return {
        chatId: existingSnap.id || deterministicChatId,
        participants,
        otherUserId: targetUid,
        username: targetUsername,
      };
    }
  } catch (err) {
    if (err?.code !== 'permission-denied') {
      throw err;
    }
  }

  // 2. Check legacy random-ID 1:1 chats where caller is already listed in participants
  try {
    const legacyQ = queryFn(
      collectionFn(db, 'chats'),
      whereFn('participants', 'array-contains', currentUserId)
    );
    const snap = await getDocsFn(legacyQ);
    const matchedDoc = snap?.docs?.find((d) => {
      const p = d.data()?.participants;
      return Array.isArray(p) && p.includes(currentUserId) && p.includes(targetUid);
    });
    if (matchedDoc) {
      return {
        chatId: matchedDoc.id,
        participants,
        otherUserId: targetUid,
        username: targetUsername,
      };
    }
  } catch (_) {
    // Proceed to deterministic creation below if query is empty or unavailable
  }

  // 3. Create canonical 1:1 chat document
  await setDocFn(
    deterministicRef,
    {
      chatId: deterministicChatId,
      participants,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  return {
    chatId: deterministicChatId,
    participants,
    otherUserId: targetUid,
    username: targetUsername,
  };
}

