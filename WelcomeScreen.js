// WelcomeScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { loginUser } from './auth-api';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import {
  PRIVACY_POLICY_TEXT,
  TERMS_OF_SERVICE_TEXT,
} from './SettingsScreen';

const WelcomeScreen = () => {
  const navigation = useNavigation();
  const [fastLoading, setFastLoading] = useState(false);
  const [legalModalType, setLegalModalType] = useState(null); // 'terms' | 'privacy' | null

  const handleSignUp = () => {
    navigation.navigate('Registration', { screen: 'SignUp' });
  };

  const handleLogin = () => {
    navigation.navigate('Registration', { screen: 'Login' });
  };

  const handleFastTestLogin = async () => {
    setFastLoading(true);
    try {
      const res = await loginUser(
        'hihicad881@chainds.com',
        'hihicad881@chainds.com'
      );
      if (res.user) {
        navigation.navigate('Home');
      }
    } catch (e) {
      console.error('Fast login error:', e);
    } finally {
      setFastLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentCard}>
        {/* Logo & Branding */}
        <View style={styles.logoWrapper}>
          <Image source={require('./assets/logo.png')} style={styles.logo} />
        </View>

        <Text style={styles.brandTitle}>TuneHub</Text>
        <Text style={styles.tagline}>
          Shape Your Very Own Community with Music
        </Text>
        <Text style={styles.subtext}>
          The social platform designed for music lovers & party regulars
        </Text>

        {/* Action Buttons */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity onPress={handleSignUp} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLogin} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Log In</Text>
          </TouchableOpacity>

          {/* Quick Test Login Button for Fast Verification */}
          <TouchableOpacity
            onPress={handleFastTestLogin}
            style={styles.testAccountButton}
            disabled={fastLoading}
          >
            {fastLoading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="lightning-bolt"
                  size={18}
                  color="#000"
                />
                <Text style={styles.testAccountButtonText}>
                  1-Tap Test Login (hihicad881)
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Legal Consent Footer */}
        <Text style={styles.legalConsentText}>
          By continuing, you agree to TuneHub&apos;s{' '}
          <Text
            style={styles.legalLink}
            onPress={() => setLegalModalType('terms')}
          >
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text
            style={styles.legalLink}
            onPress={() => setLegalModalType('privacy')}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </View>

      {/* Legal Modal */}
      <Modal
        visible={!!legalModalType}
        transparent
        animationType="fade"
        onRequestClose={() => setLegalModalType(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {legalModalType === 'privacy'
                  ? 'Privacy Policy'
                  : 'Terms of Service'}
              </Text>
              <TouchableOpacity onPress={() => setLegalModalType(null)}>
                <FontAwesome5 name="times" size={16} color="#CBD5E1" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalBodyText}>
                {legalModalType === 'privacy'
                  ? PRIVACY_POLICY_TEXT
                  : TERMS_OF_SERVICE_TEXT}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setLegalModalType(null)}
            >
              <Text style={styles.modalDoneText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0C10',
    padding: 24,
  },
  contentCard: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#161922',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#252B3B',
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF8C00',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtext: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 16,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#FF8C00',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  secondaryButton: {
    backgroundColor: '#161A24',
    borderWidth: 1,
    borderColor: '#293042',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  testAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 6,
    gap: 6,
  },
  testAccountButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  legalConsentText: {
    marginTop: 22,
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 10,
  },
  legalLink: {
    color: '#FF8C00',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    backgroundColor: '#141822',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A3142',
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222836',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  modalScroll: {
    marginBottom: 14,
  },
  modalBodyText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 20,
  },
  modalDoneBtn: {
    backgroundColor: '#FF8C00',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalDoneText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default WelcomeScreen;