// SecuritySettings.js
import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Button, List, RadioButton } from 'react-native-paper';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
} from 'firebase/auth';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';
import { ref, listAll, deleteObject } from 'firebase/storage';
import { auth, db, storage } from './firebaseConfig';

const SecuritySettings = ({ navigation }) => {
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [profileVisibility, setProfileVisibility] = useState('Public');
  const [postVisibility, setPostVisibility] = useState('Public');

  const handleVisibilityChange = async (field, value) => {
    if (field === 'profileVisibility') setProfileVisibility(value);
    if (field === 'postVisibility') setPostVisibility(value);

    const uid = auth.currentUser?.uid;
    if (uid) {
      try {
        await setDoc(doc(db, 'users', uid), { [field]: value }, { merge: true });
      } catch (_) { }
    }
  };

  const handlePasswordChange = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      Alert.alert('Error', 'No authenticated user session found.');
      return;
    }
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing Fields', 'Please fill out all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Weak Password', 'New password must be at least 6 characters.');
      return;
    }

    try {
      setUpdatingPassword(true);
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setPasswordModalVisible(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Your password has been updated.');
    } catch (error) {
      Alert.alert('Password Update Failed', error.message || 'Check your current password.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account Permanently',
      'This will permanently delete your profile, 13 songs, memoirs, and messages. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: executeAccountDeletion,
        },
      ]
    );
  };

  const executeAccountDeletion = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const uid = user.uid;

    try {
      setDeletingAccount(true);

      // 1. Delete user documents across Firestore collections
      await Promise.allSettled([
        deleteDoc(doc(db, 'users', uid)),
        deleteDoc(doc(db, 'playlists', uid)),
        deleteDoc(doc(db, 'memoirs', uid)),
        deleteDoc(doc(db, 'ranking', uid)),
        deleteDoc(doc(db, 'requests', uid)),
      ]);

      // 2. Delete profile images folder in Firebase Storage
      try {
        const folderRef = ref(storage, `profileImages/${uid}`);
        const fileList = await listAll(folderRef);
        await Promise.allSettled(
          fileList.items.map((itemRef) => deleteObject(itemRef))
        );
      } catch (_) { }

      // 3. Delete Firebase Auth user record
      await deleteUser(user);

      setDeletingAccount(false);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
    } catch (error) {
      setDeletingAccount(false);
      Alert.alert(
        'Re-Authentication Required',
        'For security, please sign out and sign back in right before deleting your account.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security & Privacy</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <List.Section title="Profile Visibility" titleStyle={styles.sectionTitle}>
          <RadioButton.Group
            onValueChange={(value) => handleVisibilityChange('profileVisibility', value)}
            value={profileVisibility}
          >
            <RadioButton.Item label="Public" value="Public" labelStyle={styles.radioLabel} color="#FF8C00" />
            <RadioButton.Item label="Friends" value="Friends" labelStyle={styles.radioLabel} color="#FF8C00" />
            <RadioButton.Item label="Private" value="Private" labelStyle={styles.radioLabel} color="#FF8C00" />
          </RadioButton.Group>
        </List.Section>

        <List.Section title="Post Visibility" titleStyle={styles.sectionTitle}>
          <RadioButton.Group
            onValueChange={(value) => handleVisibilityChange('postVisibility', value)}
            value={postVisibility}
          >
            <RadioButton.Item label="Public" value="Public" labelStyle={styles.radioLabel} color="#FF8C00" />
            <RadioButton.Item label="Friends" value="Friends" labelStyle={styles.radioLabel} color="#FF8C00" />
            <RadioButton.Item label="Private" value="Private" labelStyle={styles.radioLabel} color="#FF8C00" />
          </RadioButton.Group>
        </List.Section>

        <TouchableOpacity
          onPress={() => setPasswordModalVisible(true)}
          style={styles.changePasswordContainer}
        >
          <Text style={styles.changePasswordText}>Change Password</Text>
        </TouchableOpacity>

        {/* Apple Guideline 5.1.1(v) Mandatory Account Deletion */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
          <Text style={styles.dangerZoneSub}>
            Permanently erase your TuneHub account, Your13 playlist, memoirs, and personal data.
          </Text>
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={confirmDeleteAccount}
            disabled={deletingAccount}
          >
            {deletingAccount ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.deleteAccountBtnText}>Delete Account</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={isPasswordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <Button onPress={() => setPasswordModalVisible(false)} textColor="#FF8C00">
                Cancel
              </Button>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Current Password"
              placeholderTextColor="#999"
              value={oldPassword}
              onChangeText={setOldPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="New Password"
              placeholderTextColor="#999"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm New Password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <Button
              mode="contained"
              buttonColor="#FF8C00"
              textColor="#000000"
              onPress={handlePasswordChange}
              loading={updatingPassword}
              disabled={updatingPassword}
              style={styles.submitButton}
            >
              Update Password
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E12',
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
    backgroundColor: '#1A1E29',
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
  sectionTitle: {
    color: '#FF8C00',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  radioLabel: {
    color: '#FFFFFF',
  },
  changePasswordContainer: {
    backgroundColor: '#161922',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#242936',
    marginTop: 10,
  },
  changePasswordText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF8C00',
  },
  dangerZone: {
    margin: 20,
    marginTop: 32,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  dangerZoneTitle: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  dangerZoneSub: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  deleteAccountBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteAccountBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalView: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: '#161922',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A3142',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  input: {
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#2D3446',
    borderRadius: 8,
    color: '#FFFFFF',
    backgroundColor: '#0D1017',
  },
  submitButton: {
    marginTop: 16,
  },
});

export default SecuritySettings;