// UserModerationModal.js — Shared cross-platform Report / Block action modal [VR-011]
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { createAsyncActionLock } from './utils/actionLockUtils';
import { buildModerationReportPayload } from './utils/userAndFeedbackUtils';

export default function UserModerationModal({
  visible,
  onClose,
  targetUid,
  targetUsername = 'User',
  onBlockedSuccess,
}) {
  const [submitting, setSubmitting] = useState(false);
  const lockRef = useRef(createAsyncActionLock());

  const handleAction = (reason, alsoBlock = false) => {
    const reporterUid = auth.currentUser?.uid;
    const built = buildModerationReportPayload({
      reporterUid,
      targetUid,
      targetUsername,
      reason,
      alsoBlock,
    });

    if (!built.ok) {
      Alert.alert('Unavailable', built.error);
      onClose?.();
      return;
    }

    return lockRef.current(async () => {
      try {
        setSubmitting(true);
        await addDoc(collection(db, 'reports'), built.report);

        if (alsoBlock) {
          await setDoc(
            doc(db, 'users', reporterUid),
            { [`blockedUsers.${targetUid}`]: true },
            { merge: true }
          );
        }

        onClose?.();
        Alert.alert(
          alsoBlock ? 'User Blocked & Reported' : 'Report Submitted',
          alsoBlock
            ? `@${targetUsername} has been blocked and reported to our moderation team.`
            : 'Thank you. Our moderation team will review this report within 24 hours.'
        );

        if (alsoBlock) {
          onBlockedSuccess?.();
        }
      } catch (err) {
        console.error('Moderation action error:', err);
        Alert.alert('Error', 'Unable to submit report right now. Please try again.');
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Modal
      visible={Boolean(visible)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Feather name="shield" size={18} color="#FF8C00" />
            <Text style={styles.title} numberOfLines={1}>
              Safety & Moderation
            </Text>
          </View>

          <Text style={styles.subtitle}>
            Choose how to handle @{targetUsername || 'User'}
          </Text>

          {submitting ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#FF8C00" />
              <Text style={styles.loadingText}>Submitting...</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleAction('Inappropriate Content / Spam', false)}
              >
                <Feather name="flag" size={15} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Report Inappropriate Content</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleAction('Harassment / Abusive Behavior', false)}
              >
                <Feather name="alert-triangle" size={15} color="#FBBF24" />
                <Text style={styles.actionBtnText}>Report Harassment or Spam</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.dangerBtn]}
                onPress={() => handleAction('Harassment / Blocked by User', true)}
              >
                <Feather name="slash" size={15} color="#F87171" />
                <Text style={styles.dangerBtnText}>Block & Report User</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '92%',
    maxWidth: 372,
    backgroundColor: '#151821',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#262D3D',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 14,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    color: '#CBD5E1',
    fontSize: 14,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1D2230',
    borderWidth: 1,
    borderColor: '#2A3142',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 10,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  dangerBtnText: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelBtn: {
    marginTop: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
});

