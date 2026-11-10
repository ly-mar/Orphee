import React from 'react';
import { View, StyleSheet } from 'react-native';

export function clampProgressValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

const CustomProgressBar = ({ progress }) => {
  const clamped = clampProgressValue(progress);
  return (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBar, { width: `${clamped * 100}%` }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  progressBarContainer: {
    height: 10,
    width: '100%',
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3498db',
  },
});

export default CustomProgressBar;
