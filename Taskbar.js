// Taskbar.js
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';

export default function Taskbar({ navigation: propNavigation }) {
  const hookNavigation = useNavigation();
  const navigation = propNavigation || hookNavigation;

  let currentRouteName = 'ProfileScreen';
  try {
    const route = useRoute();
    if (route?.name) currentRouteName = route.name;
  } catch (_) { }

  const navItems = [
    { name: 'Home', icon: 'home', lib: 'Feather' },
    { name: 'Your13', icon: 'disc', lib: 'Feather' },
    //{ name: 'Algo', icon: 'repeat', lib: 'Feather' },
    { name: 'Memoir', icon: 'book', lib: 'Feather' },
    { name: 'ProfileScreen', icon: 'person', lib: 'Ionicons' },
  ];

  return (
    <View style={styles.floatingDockWrapper} pointerEvents="box-none">
      <View style={styles.pillContainer}>
        {navItems.map((item) => {
          const isActive = currentRouteName === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.navItem, isActive && styles.navItemActiveCircle]}
              onPress={() => navigation.navigate(item.name)}
              activeOpacity={0.85}
            >
              {item.lib === 'Ionicons' ? (
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={isActive ? '#0B0C10' : '#CBD5E1'}
                />
              ) : (
                <Feather
                  name={item.icon}
                  size={20}
                  color={isActive ? '#0B0C10' : '#CBD5E1'}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingDockWrapper: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(28, 30, 38, 0.94)',
    width: '90%',
    maxWidth: 440,
    height: 68,
    borderRadius: 34,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  navItem: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemActiveCircle: {
    backgroundColor: '#D4F458',
  },
});