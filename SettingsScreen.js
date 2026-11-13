// SettingsScreen.js
import React, { useState, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import { List, Divider, Button } from 'react-native-paper';
import { signOut } from 'firebase/auth';
import { auth } from './firebaseConfig';
import { FontAwesome5 } from '@expo/vector-icons';
import { createAsyncActionLock } from './utils/actionLockUtils';
import { mapFirebaseAuthError } from './utils/authUtils';
import { confirm, toast } from './crossPlatformAlert';

import {
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
  SECURITY_ROW_LABEL,
  PRIVACY_POLICY_TEXT,
  TERMS_OF_SERVICE_TEXT,
} from './utils/legalUtils';

export {
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
  SECURITY_ROW_LABEL,
  PRIVACY_POLICY_TEXT,
  TERMS_OF_SERVICE_TEXT,
};

const SettingsScreen = ({ route, navigation }) => {
  const userId = route?.params?.userId ?? auth.currentUser?.uid;
  const [legalModalType, setLegalModalType] = useState(null); // 'privacy' | 'terms' | null
  const actionLockRef = useRef(createAsyncActionLock());

  const handleLogout = () => {
    confirm({
      title: 'Log Out',
      message: 'Are you sure you want to log out of your TuneHub account?',
      confirmLabel: 'Log Out',
      cancelLabel: 'Cancel',
      destructive: false,
      onConfirm: () => {
        actionLockRef.current(async () => {
          try {
            await signOut(auth);
            navigation.reset({
              index: 0,
              routes: [{ name: 'Welcome' }],
            });
          } catch (error) {
            toast.show({ kind: 'error', message: mapFirebaseAuthError(error) });
          }
        });
      },
    });
  };

  const openExternalLegalLink = async (type) => {
    const targetUrl = type === 'privacy' ? PRIVACY_POLICY_URL : TERMS_OF_SERVICE_URL;
    try {
      await Linking.openURL(targetUrl);
    } catch (_) {
      Alert.alert('Info', `Hosted URL: ${targetUrl}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back">
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Account Settings */}
        <List.Section title="ACCOUNT SETTINGS" titleStyle={styles.sectionHeader} style={styles.section}>
          <List.Item
            title="Edit Profile"
            titleStyle={styles.listItemText}
            left={() => <List.Icon icon="account-circle" color="#FF8C00" />}
            right={() => <List.Icon icon="chevron-right" color="#64748B" />}
            onPress={() => navigation.navigate('UpdateProfileScreen', { userId })}
          />
          <Divider style={styles.divider} />

          <List.Item
            title="Notifications"
            titleStyle={styles.listItemText}
            left={() => <List.Icon icon="bell" color="#FF453A" />}
            right={() => <List.Icon icon="chevron-right" color="#64748B" />}
            onPress={() => navigation.navigate('NotificationSettings')}
          />
          <Divider style={styles.divider} />

          <List.Item
            title={SECURITY_ROW_LABEL}
            titleStyle={styles.listItemText}
            left={() => <List.Icon icon="security" color="#FF9F0A" />}
            right={() => <List.Icon icon="chevron-right" color="#64748B" />}
            onPress={() => navigation.navigate('SecuritySettings')}
          />
          <Divider style={styles.divider} />
        </List.Section>

        {/* Feedback Section */}
        <List.Section title="FEEDBACK" titleStyle={styles.sectionHeader} style={styles.section}>
          <List.Item
            title="Feedback"
            titleStyle={styles.listItemText}
            left={() => <List.Icon icon="email" color="#34C759" />}
            right={() => <List.Icon icon="chevron-right" color="#64748B" />}
            onPress={() => navigation.navigate('Feedback')}
          />
          <Divider style={styles.divider} />

          <List.Item
            title="Rate Us"
            titleStyle={styles.listItemText}
            left={() => <List.Icon icon="star" color="#FF8C00" />}
            right={() => <List.Icon icon="chevron-right" color="#64748B" />}
            onPress={() => navigation.navigate('Rate')}
          />
          <Divider style={styles.divider} />

          <List.Item
            title="Bug Report"
            titleStyle={styles.listItemText}
            left={() => <List.Icon icon="bug" color="#FF453A" />}
            onPress={() => navigation.navigate('Bug')}
          />
          <Divider style={styles.divider} />
        </List.Section>

        {/* Legal & About Section */}
        <List.Section title="LEGAL & ABOUT" titleStyle={styles.sectionHeader} style={styles.section}>
          <List.Item
            title="Privacy Policy"
            description="How we protect your musical identity & data"
            titleStyle={styles.listItemText}
            descriptionStyle={styles.listItemSubtext}
            left={() => <List.Icon icon="shield-lock-outline" color="#FF8C00" />}
            right={() => <List.Icon icon="chevron-right" color="#64748B" />}
            onPress={() => setLegalModalType('privacy')}
          />
          <Divider style={styles.divider} />

          <List.Item
            title="Terms of Service"
            description="Community rules, UGC policy & iTunes preview terms"
            titleStyle={styles.listItemText}
            descriptionStyle={styles.listItemSubtext}
            left={() => <List.Icon icon="file-document-outline" color="#10B981" />}
            right={() => <List.Icon icon="chevron-right" color="#64748B" />}
            onPress={() => setLegalModalType('terms')}
          />
          <Divider style={styles.divider} />

          <List.Item
            title="App Version"
            description="v1.0.0 (Build 1) • com.tunehub.chorus"
            titleStyle={styles.listItemText}
            descriptionStyle={styles.listItemSubtext}
            left={() => <List.Icon icon="information-outline" color="#94A3B8" />}
          />
        </List.Section>

        <View style={styles.logoutContainer}>
          <Button
            icon="logout"
            mode="outlined"
            onPress={handleLogout}
            textColor="#FFFFFF"
            style={styles.logoutButton}
          >
            Logout
          </Button>
        </View>
      </ScrollView>

      {/* Styled Dark Legal Document Modal */}
      <Modal
        visible={!!legalModalType}
        transparent
        animationType="slide"
        onRequestClose={() => setLegalModalType(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {legalModalType === 'privacy'
                  ? 'TuneHub Privacy Policy'
                  : 'TuneHub Terms of Service'}
              </Text>
              <TouchableOpacity
                onPress={() => setLegalModalType(null)}
                style={styles.modalCloseBtn}
              >
                <FontAwesome5 name="times" size={16} color="#CBD5E1" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator>
              <Text style={styles.modalLegalText}>
                {legalModalType === 'privacy'
                  ? PRIVACY_POLICY_TEXT
                  : TERMS_OF_SERVICE_TEXT}
              </Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.externalLinkBtn}
                onPress={() => openExternalLegalLink(legalModalType)}
              >
                <FontAwesome5 name="external-link-alt" size={12} color="#FF8C00" />
                <Text style={styles.externalLinkText}>Open Web Version</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.acceptCloseBtn}
                onPress={() => setLegalModalType(null)}
              >
                <Text style={styles.acceptCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    borderBottomColor: '#1F2430',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1E29',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
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
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    color: '#FF8C00',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  listItemText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  listItemSubtext: {
    color: '#94A3B8',
    fontSize: 12,
  },
  divider: {
    backgroundColor: '#222836',
  },
  logoutContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 30,
  },
  logoutButton: {
    width: '90%',
    borderRadius: 12,
    backgroundColor: '#151821',
    borderColor: '#242936',
    borderWidth: 1,
    paddingVertical: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  modalCard: {
    width: '92%',
    maxWidth: 368,
    maxHeight: '85%',
    backgroundColor: '#151821',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A3142',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222836',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
    paddingRight: 10,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  modalLegalText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222836',
    backgroundColor: '#0D1017',
  },
  externalLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  externalLinkText: {
    color: '#FF8C00',
    fontSize: 13,
    fontWeight: '700',
  },
  acceptCloseBtn: {
    backgroundColor: '#FF8C00',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  acceptCloseText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
});

export default SettingsScreen;