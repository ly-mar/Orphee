import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  StyleSheet,
  Text,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Divider } from 'react-native-paper';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { createAsyncActionLock } from './utils/actionLockUtils';
import { sanitizeNotificationPrefs } from './utils/notificationPrefsUtils';

const NotificationSettings = ({ navigation }) => {
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [prefs, setPrefs] = useState(() => sanitizeNotificationPrefs({}));
  const [savingAll, setSavingAll] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const isMountedRef = useRef(true);
  const toggleLockRef = useRef(createAsyncActionLock());

  useEffect(() => {
    isMountedRef.current = true;
    const uid = auth.currentUser?.uid;
    if (!uid) return () => { isMountedRef.current = false; };

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (!isMountedRef.current) return;
        if (snap.exists()) {
          const data = snap.data() || {};
          const clean = sanitizeNotificationPrefs(data.notificationPrefs || data);
          setPrefs(clean);
          if (data.emailNotifications !== undefined) {
            setEmailNotifications(Boolean(data.emailNotifications));
          }
          if (data.pushNotifications !== undefined) {
            setPushNotifications(Boolean(data.pushNotifications));
          }
        }
      } catch (err) {
        if (err?.code !== 'permission-denied') {
          console.warn('NotificationSettings load error:', err);
        }
      }
    })();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const persistNotificationUpdate = (patch) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    return toggleLockRef.current(async () => {
      try {
        await setDoc(doc(db, 'users', uid), patch, { merge: true });
      } catch (err) {
        if (err?.code !== 'permission-denied') {
          console.warn('NotificationSettings save error:', err);
        }
      }
    });
  };

  const handleToggleTopLevel = (field, nextVal) => {
    const boolVal = Boolean(nextVal);
    setSavedNotice(false);
    if (field === 'emailNotifications') setEmailNotifications(boolVal);
    if (field === 'pushNotifications') setPushNotifications(boolVal);
    persistNotificationUpdate({ [field]: boolVal });
  };

  const handleTogglePref = (key) => {
    setSavedNotice(false);
    const nextPrefs = sanitizeNotificationPrefs({
      ...prefs,
      [key]: !prefs[key],
    });
    setPrefs(nextPrefs);
    persistNotificationUpdate({ notificationPrefs: nextPrefs });
  };

  const handleSavePreferences = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Sign In Required', 'Please sign in to save your notification preferences.');
      return;
    }
    return toggleLockRef.current(async () => {
      try {
        setSavingAll(true);
        await setDoc(
          doc(db, 'users', uid),
          {
            emailNotifications: Boolean(emailNotifications),
            pushNotifications: Boolean(pushNotifications),
            notificationPrefs: sanitizeNotificationPrefs(prefs),
          },
          { merge: true }
        );
        if (isMountedRef.current) {
          setSavedNotice(true);
        }
      } catch (err) {
        Alert.alert('Save Failed', 'Unable to update notification preferences right now.');
      } finally {
        if (isMountedRef.current) {
          setSavingAll(false);
        }
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionLabel}>DELIVERY CHANNELS</Text>
        <View style={styles.card}>
          <View style={styles.item}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemText}>Email Notifications</Text>
              <Text style={styles.itemSubtext}>Weekly taste recaps & important account alerts</Text>
            </View>
            <Switch
              value={emailNotifications}
              onValueChange={(val) => handleToggleTopLevel('emailNotifications', val)}
              trackColor={{ false: '#2D3446', true: 'rgba(255, 140, 0, 0.45)' }}
              thumbColor={emailNotifications ? '#FF8C00' : '#94A3B8'}
            />
          </View>
          <Divider style={styles.divider} />
          <View style={styles.item}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemText}>Push Notifications</Text>
              <Text style={styles.itemSubtext}>Instant mobile & browser activity alerts</Text>
            </View>
            <Switch
              value={pushNotifications}
              onValueChange={(val) => handleToggleTopLevel('pushNotifications', val)}
              trackColor={{ false: '#2D3446', true: 'rgba(255, 140, 0, 0.45)' }}
              thumbColor={pushNotifications ? '#FF8C00' : '#94A3B8'}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>ACTIVITY ALERTS</Text>
        <View style={styles.card}>
          <View style={styles.item}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemText}>Friend Requests</Text>
              <Text style={styles.itemSubtext}>When a kindred listener sends you a connection invite</Text>
            </View>
            <Switch
              value={prefs.friendRequests}
              onValueChange={() => handleTogglePref('friendRequests')}
              trackColor={{ false: '#2D3446', true: 'rgba(255, 140, 0, 0.45)' }}
              thumbColor={prefs.friendRequests ? '#FF8C00' : '#94A3B8'}
            />
          </View>
          <Divider style={styles.divider} />
          <View style={styles.item}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemText}>Messages & Replies</Text>
              <Text style={styles.itemSubtext}>Direct chat messages and memoir activity</Text>
            </View>
            <Switch
              value={prefs.chatMessages}
              onValueChange={() => handleTogglePref('chatMessages')}
              trackColor={{ false: '#2D3446', true: 'rgba(255, 140, 0, 0.45)' }}
              thumbColor={prefs.chatMessages ? '#FF8C00' : '#94A3B8'}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, savingAll && { opacity: 0.7 }]}
          onPress={handleSavePreferences}
          disabled={savingAll}
        >
          <Text style={styles.saveButtonText}>
            {savingAll ? 'Saving Preferences...' : savedNotice ? 'Preferences Saved ✓' : 'Save Preferences'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0C10',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    backgroundColor: '#151821',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    color: '#FF8C00',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#151821',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  itemSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
    lineHeight: 17,
  },
  divider: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  saveButton: {
    backgroundColor: '#FF8C00',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#0A0C10',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default NotificationSettings;
