import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text, Alert, Platform, ActivityIndicator } from 'react-native';
import { loginUser, resetPassword } from './auth-api';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const fillTestCredentials = () => {
    setEmail('hihicad881@chainds.com');
    setPassword('hihicad881@chainds.com');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    const result = await loginUser(email, password);
    setLoading(false);

    if (result.error) {
      Alert.alert('Error', result.error);
    } else {
      navigation.navigate('Home');
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email to reset the password.');
      return;
    }

    const result = await resetPassword(email);
    if (result.error) {
      Alert.alert('Error', result.error);
    } else {
      Alert.alert('Success', 'Password reset email has been sent. Please check your inbox.');
    }
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
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to shape your music community</Text>

        {/* 1-Tap Quick-Fill for testing */}
        <TouchableOpacity onPress={fillTestCredentials} style={styles.quickFillBanner}>
          <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FF8C00" />
          <Text style={styles.quickFillText}>Auto-Fill Test Account (hihicad881)</Text>
        </TouchableOpacity>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="hihicad881@chainds.com"
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
            placeholder="••••••••••••"
            onChangeText={setPassword}
            value={password}
            secureTextEntry
            placeholderTextColor="#64748B"
          />
        </View>

        <TouchableOpacity onPress={handlePasswordReset} style={styles.forgotPassword}>
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogin} style={styles.loginButton} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.loginButtonText}>LOG IN</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={styles.signUpLink}>
          <Text style={styles.signUpLinkText}>
            Don't have an account? <Text style={styles.signUpLinkAccent}>Sign up</Text>
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
  quickFillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1810',
    borderWidth: 1,
    borderColor: '#3D2817',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 6,
  },
  quickFillText: {
    color: '#FF8C00',
    fontSize: 12,
    fontWeight: '600',
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#FF8C00',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  loginButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  signUpLink: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  signUpLinkText: {
    color: '#64748B',
    fontSize: 13,
  },
  signUpLinkAccent: {
    color: '#FF8C00',
    fontWeight: '600',
  },
  backgroundAnimation: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
});

export default LoginScreen;
