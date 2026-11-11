import React, { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text, Alert, Platform, ActivityIndicator } from 'react-native';
import { signUpUser } from './auth-api';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createAsyncActionLock } from './utils/actionLockUtils';
import { sanitizeAuthCredentials } from './utils/authUtils';

const SignUpScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const actionLockRef = useRef(createAsyncActionLock());

  const handleSignUp = () => {
    const creds = sanitizeAuthCredentials({ email, password, username });
    if (!creds.email || !creds.password || !creds.username || !confirmPassword) {
      Alert.alert('Error', 'Please enter all fields.');
      return;
    }

    if (creds.password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    return actionLockRef.current(async () => {
      setLoading(true);
      const result = await signUpUser(creds.email, creds.password, creds.username);
      setLoading(false);

      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        navigation.navigate('Home');
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {Platform.OS !== 'web' && (
        <LottieView
          source={require('./assets/animations/fluid.json')}
          autoPlay
          loop
          style={styles.backgroundAnimation}
        />
      )}

      <View style={styles.card}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join TuneHub to connect through music</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>USERNAME</Text>
          <TextInput
            style={styles.input}
            placeholder="musiclover"
            onChangeText={setUsername}
            value={username}
            autoCapitalize="none"
            placeholderTextColor="#64748B"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="name@example.com"
            onChangeText={setEmail}
            value={email}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#64748B"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 6 characters"
            onChangeText={setPassword}
            value={password}
            secureTextEntry
            placeholderTextColor="#64748B"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Repeat password"
            onChangeText={setConfirmPassword}
            value={confirmPassword}
            secureTextEntry
            placeholderTextColor="#64748B"
          />
        </View>

        <TouchableOpacity onPress={handleSignUp} style={styles.signUpButton} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.signUpButtonText}>CREATE ACCOUNT</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>
            Already have an account? <Text style={styles.loginLinkAccent}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#0A0C10',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#12151C',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#1F2430',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#262D3D',
    borderRadius: 10,
    backgroundColor: '#181C26',
    color: '#FFFFFF',
    fontSize: 14,
  },
  signUpButton: {
    backgroundColor: '#FF8C00',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  signUpButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loginLink: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  loginLinkText: {
    color: '#64748B',
    fontSize: 13,
  },
  loginLinkAccent: {
    color: '#FF8C00',
    fontWeight: '600',
  },
  backgroundAnimation: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
});

export default SignUpScreen;
