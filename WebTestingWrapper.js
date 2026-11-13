import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { auth } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { loginUser } from './auth-api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { installWebAlertPolyfill } from './crossPlatformAlert';

installWebAlertPolyfill();

const SHOW_TEST_TOOLBAR =
  typeof process !== 'undefined' &&
  process.env?.EXPO_PUBLIC_SHOW_TEST_BAR === 'true';

/**
 * WebTestingWrapper:
 * Enhances the web browser testing experience:
 * 1. Responsive Viewport Switcher (Mobile 420px, Tablet 720px, Full Width 100%)
 * 2. Developer / Tester Quick Navigation Toolbar (gated behind EXPO_PUBLIC_SHOW_TEST_BAR=true)
 * 3. Keeps app centered and responsive on Web browsers without leaking dev UI in standard builds.
 * On Native (iOS/Android), this simply renders children transparently.
 */
export default function WebTestingWrapper({ children, navigationRef }) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  const [viewportMode, setViewportMode] = useState('mobile'); // 'mobile' | 'tablet' | 'full'
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [loggingIn, setLoggingIn] = useState(false);
  const [isNavExpanded, setIsNavExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleTestLogin = async () => {
    setLoggingIn(true);
    try {
      const res = await loginUser('hihicad881@chainds.com', 'hihicad881@chainds.com');
      if (res.user) {
        if (navigationRef?.isReady?.()) {
          navigationRef.navigate('Home');
        }
      }
    } catch (e) {
      console.error('Test login failed:', e);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      if (navigationRef?.isReady?.()) {
        navigationRef.navigate('Welcome');
      }
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  const navigateTo = (screenName, params = {}) => {
    if (navigationRef?.isReady?.()) {
      navigationRef.navigate(screenName, params);
    }
  };

  const getContainerWidth = () => {
    switch (viewportMode) {
      case 'mobile':
        return 420;
      case 'tablet':
        return 720;
      case 'full':
      default:
        return '100%';
    }
  };

  return (
    <View style={styles.outerShell}>
      {/* Top Testing Control Bar — gated so production/beta screenshots show clean UI */}
      {SHOW_TEST_TOOLBAR && (
        <>
          <View style={styles.topToolbar}>
        {/* Left: Viewport Mode Switcher */}
        <View style={styles.toolSection}>
          <Text style={styles.sectionLabel}>VIEWPORT:</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.modeBtn, viewportMode === 'mobile' && styles.modeBtnActive]}
              onPress={() => setViewportMode('mobile')}
            >
              <MaterialCommunityIcons
                name="cellphone"
                size={16}
                color={viewportMode === 'mobile' ? '#fff' : '#94A3B8'}
              />
              <Text style={[styles.modeBtnText, viewportMode === 'mobile' && styles.modeBtnTextActive]}>
                Mobile (420px)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeBtn, viewportMode === 'tablet' && styles.modeBtnActive]}
              onPress={() => setViewportMode('tablet')}
            >
              <MaterialCommunityIcons
                name="tablet"
                size={16}
                color={viewportMode === 'tablet' ? '#fff' : '#94A3B8'}
              />
              <Text style={[styles.modeBtnText, viewportMode === 'tablet' && styles.modeBtnTextActive]}>
                Tablet (720px)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeBtn, viewportMode === 'full' && styles.modeBtnActive]}
              onPress={() => setViewportMode('full')}
            >
              <MaterialCommunityIcons
                name="monitor"
                size={16}
                color={viewportMode === 'full' ? '#fff' : '#94A3B8'}
              />
              <Text style={[styles.modeBtnText, viewportMode === 'full' && styles.modeBtnTextActive]}>
                Full Width
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Center: Quick Screen Jump Navigator */}
        <View style={styles.toolSection}>
          <TouchableOpacity
            style={styles.navToggleBtn}
            onPress={() => setIsNavExpanded(!isNavExpanded)}
          >
            <MaterialCommunityIcons name="compass-outline" size={16} color="#FF8C00" />
            <Text style={styles.navToggleText}>Quick Screen Jump</Text>
            <MaterialCommunityIcons
              name={isNavExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#FF8C00"
            />
          </TouchableOpacity>
        </View>

        {/* Right: Auth Status & Fast Action */}
        <View style={styles.toolSection}>
          {currentUser ? (
            <View style={styles.authRow}>
              <View style={styles.userBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.userEmail} numberOfLines={1}>
                  {currentUser.email || 'Logged In'}
                </Text>
              </View>
              <TouchableOpacity style={styles.authBtnDanger} onPress={handleSignOut}>
                <Text style={styles.authBtnDangerText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.authBtnPrimary}
              onPress={handleTestLogin}
              disabled={loggingIn}
            >
              <MaterialCommunityIcons name="lightning-bolt" size={16} color="#000" />
              <Text style={styles.authBtnPrimaryText}>
                {loggingIn ? 'Logging in...' : '1-Click Test Login'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Expanded Quick Screen Navigator Bar */}
      {isNavExpanded && (
        <View style={styles.expandedNavContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navLinksRow}>
            <TouchableOpacity style={styles.quickLink} onPress={() => navigateTo('Home')}>
              <Text style={styles.quickLinkText}>🏠 Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => navigateTo('Your13')}>
              <Text style={styles.quickLinkText}>🎵 Your13</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => navigateTo('TheCollective')}>
              <Text style={styles.quickLinkText}>💿 The Collective</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => navigateTo('Profile')}>
              <Text style={styles.quickLinkText}>👤 Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => navigateTo('RankedMusicList')}>
              <Text style={styles.quickLinkText}>🏆 Community Charts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => navigateTo('UserSearchScreen')}>
              <Text style={styles.quickLinkText}>🔍 Search Users</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => navigateTo('RankedUsers', { rankedUsers: [] })}>
              <Text style={styles.quickLinkText}>📊 Ranked Users</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => navigateTo('UserGraph', { rankedUsers: [] })}>
              <Text style={styles.quickLinkText}>🕸️ User Graph</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickLink} onPress={() => navigateTo('Welcome')}>
              <Text style={styles.quickLinkText}>🚪 Welcome / Login</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
        </>
      )}

      {/* Viewport Simulation Center Area */}
      <View style={styles.viewportArea}>
        <View
          style={[
            styles.deviceFrame,
            {
              width: getContainerWidth(),
              maxWidth: '100%',
            },
            viewportMode !== 'full' && styles.framedShadow,
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerShell: {
    flex: 1,
    height: '100vh',
    width: '100vw',
    backgroundColor: '#0A0C10',
    overflow: 'hidden',
  },
  topToolbar: {
    height: 48,
    backgroundColor: '#11141A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E232E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 100,
  },
  toolSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginRight: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    backgroundColor: '#181C24',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#262D3D',
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
  },
  modeBtnActive: {
    backgroundColor: '#2A3346',
  },
  modeBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  navToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1712',
    borderWidth: 1,
    borderColor: '#3D2817',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  navToggleText: {
    color: '#FF8C00',
    fontSize: 12,
    fontWeight: '600',
  },
  expandedNavContainer: {
    backgroundColor: '#161922',
    borderBottomWidth: 1,
    borderBottomColor: '#232938',
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 99,
  },
  navLinksRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickLink: {
    backgroundColor: '#202533',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2F374B',
  },
  quickLinkText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '500',
  },
  authRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16231E',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#234438',
    maxWidth: 180,
    gap: 6,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  userEmail: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '500',
  },
  authBtnDanger: {
    backgroundColor: '#301A1E',
    borderWidth: 1,
    borderColor: '#5C222C',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  authBtnDangerText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '600',
  },
  authBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  authBtnPrimaryText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  viewportArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  deviceFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    height: '100%',
    backgroundColor: '#0A0C10',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  framedShadow: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#242A38',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
  },
});
