// App.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { installWebAlertPolyfill } from './crossPlatformAlert';

// Install cross-platform Web Alert polyfill at app initialization [BUG-006]
installWebAlertPolyfill();
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { AppNavigationTheme } from './GlobalStyles';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import Constants from 'expo-constants';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

import WebTestingWrapper from './WebTestingWrapper';
import Your13 from './Your13';
import WelcomeScreen from './WelcomeScreen';
import HomeScreen from './HomeScreen';
import MusicOfTheDayScreen from './future_features/MusicOfTheDayScreen';
import RegistrationStack from './RegistrationStack';
import ProfileScreen from './ProfileScreen';
import RankedUsers from './RankedUsers';
import UserGraph from './UserGraph';
import FriendsScreen from './FriendsScreen';
import ViewChoicesScreen from './ViewChoicesScreen';
import RankedMusicList from './RankedMusicList';
import SongDetailsScreen from './SongDetailsScreen';
import UserSearchScreen from './UserSearchScreen';
import UserProfileScreen from './UserProfileScreen';
import NotifPage from './NotifPage';
import SettingsScreen from './SettingsScreen';
import UpdateProfileScreen from './UpdateProfileScreen';
import SecuritySettings from './SecuritySettings';
import NotificationSettings from './NotificationSettings';
import Algo from './Algo';
import MemoirSearchPage from './Memoir';
import MemoirHistoryScreen from './MemoirHistoryScreen';
import UploadProfilePicture from './UploadProfilePicture';
import { LockProvider } from './LockContext';
import ChatScreen from './ChatScreen';
import MainChatScreen from './MainChatScreen';
import TheCollective from './TheCollective';
import Pickerchoosers from './Pickerchoosers';
import AddSong from './AddSong';
import { FeedbackForm, RateUsScreen, BugReportForm } from './Feedback';
// import SimilarityFinderWidget from './future_features/SimilarityFinderWidget'; // Shelved into future_features

const Stack = createStackNavigator();
const navigationRef = createNavigationContainerRef();

export async function registerForPushNotificationsAsync(userId) {
  if (Platform.OS === 'web' || Constants.appOwnership === 'expo') {
    return null;
  }

  try {
    const Notifications = require('expo-notifications');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenResponse?.data;

    if (pushToken && userId) {
      await setDoc(
        doc(db, 'users', userId),
        { pushToken, pushTokenUpdatedAt: new Date().toISOString() },
        { merge: true }
      );
    }
    return pushToken;
  } catch (err) {
    console.warn('Push notification registration skipped:', err.message);
    return null;
  }
}

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: Never leave user stuck on splash screen for more than 1.5s
    const splashTimeout = setTimeout(() => {
      if (isMounted) {
        setInitializing(false);
      }
    }, 1500);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      clearTimeout(splashTimeout);
      setCurrentUser(user || null);
      setInitializing(false);

      if (user?.uid) {
        registerForPushNotificationsAsync(user.uid);
        if (navigationRef.isReady()) {
          const currentRoute = navigationRef.getCurrentRoute()?.name;
          if (currentRoute === 'Welcome' || currentRoute === 'Registration') {
            navigationRef.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          }
        }
      } else if (navigationRef.isReady()) {
        const currentRoute = navigationRef.getCurrentRoute()?.name;
        if (currentRoute && currentRoute !== 'Welcome' && currentRoute !== 'Registration') {
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
          });
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(splashTimeout);
      unsubscribe();
    };
  }, []);

  if (initializing) {
    return (
      <View style={styles.splashContainer}>
        <Text style={styles.splashBrand}>TuneHub</Text>
        <Text style={styles.splashSub}>Restoring your musical universe...</Text>
        <ActivityIndicator size="large" color="#FF8C00" style={{ marginTop: 18 }} />
      </View>
    );
  }

  return (
    <WebTestingWrapper navigationRef={navigationRef}>
      <LockProvider>
        <PaperProvider>
          <NavigationContainer ref={navigationRef} theme={AppNavigationTheme}>
            <Stack.Navigator
              initialRouteName={currentUser ? 'Home' : 'Welcome'}
              detachInactiveScreens={false}
              screenOptions={{
                headerShown: false,
                detachPreviousScreen: false,
                cardStyle: { backgroundColor: '#0A0C10' },
                contentStyle: { backgroundColor: '#0A0C10' },
              }}
            >
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Your13" component={Your13} />
              <Stack.Screen name="MusicOfTheDay" component={MusicOfTheDayScreen} />
              <Stack.Screen name="Registration" component={RegistrationStack} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
              <Stack.Screen name="RankedUsers" component={RankedUsers} />
              <Stack.Screen name="UserGraph" component={UserGraph} />
              <Stack.Screen name="FriendsScreen" component={FriendsScreen} />
              <Stack.Screen name="ViewChoicesScreen" component={ViewChoicesScreen} />
              <Stack.Screen name="RankedMusicList" component={RankedMusicList} />
              <Stack.Screen name="SongDetails" component={SongDetailsScreen} />
              <Stack.Screen name="UserSearchScreen" component={UserSearchScreen} />
              <Stack.Screen name="UserProfile" component={UserProfileScreen} />
              <Stack.Screen name="NotifPage" component={NotifPage} />
              <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
              <Stack.Screen name="UpdateProfileScreen" component={UpdateProfileScreen} />
              <Stack.Screen name="SecuritySettings" component={SecuritySettings} />
              <Stack.Screen name="NotificationSettings" component={NotificationSettings} />
              <Stack.Screen name="Algo" component={Algo} />
              <Stack.Screen name="Memoir" component={MemoirSearchPage} />
              <Stack.Screen name="MemoirSearchPage" component={MemoirSearchPage} />
              <Stack.Screen name="MemoirHistoryScreen" component={MemoirHistoryScreen} />
              <Stack.Screen name="UploadProfilePicture" component={UploadProfilePicture} />
              <Stack.Screen name="ChatScreen" component={ChatScreen} />
              <Stack.Screen name="MainChatScreen" component={MainChatScreen} />
              <Stack.Screen name="TheCollective" component={TheCollective} />
              <Stack.Screen name="Pickerchoosers" component={Pickerchoosers} />
              <Stack.Screen name="AddSong" component={AddSong} />
              <Stack.Screen name="Feedback" component={FeedbackForm} />
              <Stack.Screen name="Rate" component={RateUsScreen} />
              <Stack.Screen name="Bug" component={BugReportForm} />
              {/* Shelved into future_features */}
              {/* <Stack.Screen name="SimilarityFinder" component={SimilarityFinderWidget} /> */}
            </Stack.Navigator>
          </NavigationContainer>
        </PaperProvider>
      </LockProvider>
    </WebTestingWrapper>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#0A0C10',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  splashBrand: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  splashSub: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 6,
  },
});