import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, ScrollView, View, StyleSheet, Text, Switch, TouchableOpacity } from 'react-native';
import { List, Divider } from 'react-native-paper';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { createAsyncActionLock } from './utils/actionLockUtils';
import { sanitizeNotificationPrefs } from './utils/notificationPrefsUtils';

const NotificationSettings = ({ navigation }) => {
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [prefs, setPrefs] = useState(() => sanitizeNotificationPrefs({}));
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
    if (field === 'emailNotifications') setEmailNotifications(boolVal);
    if (field === 'pushNotifications') setPushNotifications(boolVal);
    persistNotificationUpdate({ [field]: boolVal });
  };

  const handleTogglePref = (key) => {
    const nextPrefs = sanitizeNotificationPrefs({
      ...prefs,
      [key]: !prefs[key],
    });
    setPrefs(nextPrefs);
    persistNotificationUpdate({ notificationPrefs: nextPrefs });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView>
        {/* Email Notifications */}
        <List.Section title="Email Notifications" style={styles.section}>
          <View style={styles.item}>
            <Text style={styles.itemText}>Email Notifications</Text>
            <Switch
              value={emailNotifications}
              onValueChange={(val) => handleToggleTopLevel('emailNotifications', val)}
              trackColor={{ false: "#767577", true: "#007AFF" }}
              thumbColor={emailNotifications ? "#007AFF" : "#f4f3f4"}
            />
          </View>
        </List.Section>
        <Divider style={styles.divider} />

        {/* Push Notifications */}
        <List.Section title="Push Notifications" style={styles.section}>
          <View style={styles.item}>
            <Text style={styles.itemText}>Push Notifications</Text>
            <Switch
              value={pushNotifications}
              onValueChange={(val) => handleToggleTopLevel('pushNotifications', val)}
              trackColor={{ false: "#767577", true: "#007AFF" }}
              thumbColor={pushNotifications ? "#007AFF" : "#f4f3f4"}
            />
          </View>
        </List.Section>
        <Divider style={styles.divider} />

        {/* Friend Requests Notifications */}
        <List.Section title="Friend Requests Notifications" style={styles.section}>
          <View style={styles.item}>
            <Text style={styles.itemText}>Friend Requests Notifications</Text>
            <Switch
              value={prefs.friendRequests}
              onValueChange={() => handleTogglePref('friendRequests')}
              trackColor={{ false: "#767577", true: "#007AFF" }}
              thumbColor={prefs.friendRequests ? "#007AFF" : "#f4f3f4"}
            />
          </View>
        </List.Section>
        <Divider style={styles.divider} />

        {/* Mentions and Comments Notifications */}
        <List.Section title="Mentions and Comments Notifications" style={styles.section}>
          <View style={styles.item}>
            <Text style={styles.itemText}>Mentions & Comments Notifications</Text>
            <Switch
              value={prefs.chatMessages}
              onValueChange={() => handleTogglePref('chatMessages')}
              trackColor={{ false: "#767577", true: "#007AFF" }}
              thumbColor={prefs.chatMessages ? "#007AFF" : "#f4f3f4"}
            />
          </View>
        </List.Section>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    backgroundColor: '#242424',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: 20,
    color: '#ffffff',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
  },
  itemText: {
    fontSize: 16,
    color: '#ffffff',
  },
  divider: {
    backgroundColor: '#444',
  },
});

export default NotificationSettings;
