// Taskbar.js
import React from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const Taskbar = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.taskbarWrapper}>
        <View style={styles.taskbar}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
            <MaterialCommunityIcons name="home-variant" size={22} color="#FFFFFF" />
            <Text style={styles.navLabel}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('UserSearchScreen')}>
            <MaterialCommunityIcons name="account-search-outline" size={22} color="#94A3B8" />
            <Text style={styles.navLabel}>Search</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
            <MaterialCommunityIcons name="account-circle-outline" size={22} color="#94A3B8" />
            <Text style={styles.navLabel}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.chartsItem} onPress={() => navigation.navigate('RankedMusicList')}>
            <MaterialCommunityIcons name="chart-box-outline" size={20} color="#FF8C00" />
            <Text style={styles.chartsText}>Charts</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#0D1017',
    borderTopWidth: 1,
    borderTopColor: '#1A202C',
  },
  taskbarWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  taskbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    maxWidth: 480,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  navLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  chartsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1710',
    borderWidth: 1,
    borderColor: '#3D2817',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  chartsText: {
    color: '#FF8C00',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default Taskbar;
