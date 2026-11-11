import React, { useRef, useEffect, useState } from 'react';
import { Animated, View, Dimensions, Image, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';

const { width } = Dimensions.get('window');

const FadingCarousel = ({ images = [], duration = 3000 }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!Array.isArray(images) || images.length === 0) return;

    let isActive = true;
    let timeoutId = null;
    let activeAnim = null;

    const fadeIn = () => {
      if (!isActive) return;
      fadeAnim.setValue(0);
      activeAnim = Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      });
      activeAnim.start(({ finished }) => {
        if (!isActive || !finished) return;
        timeoutId = setTimeout(() => {
          fadeOut();
        }, duration);
      });
    };

    const fadeOut = () => {
      if (!isActive) return;
      activeAnim = Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      });
      activeAnim.start(({ finished }) => {
        if (!isActive || !finished) return;
        setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
      });
    };

    fadeIn();

    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (activeAnim && typeof activeAnim.stop === 'function') {
        activeAnim.stop();
      }
      fadeAnim.stopAnimation();
    };
  }, [currentIndex, fadeAnim, images.length, duration]);

  const safeImages = Array.isArray(images) ? images : [];
  const activeUri = safeImages.length > 0 ? safeImages[currentIndex % safeImages.length] : null;

  return (
    <View style={styles.carouselContainer}>
      {activeUri && (
        <Animated.View style={[styles.imageContainer, { opacity: fadeAnim }]}>
          <Image source={{ uri: activeUri }} style={styles.image} />
        </Animated.View>
      )}
    </View>
  );
};

FadingCarousel.propTypes = {
  images: PropTypes.arrayOf(PropTypes.string).isRequired,
  duration: PropTypes.number,
};

const styles = StyleSheet.create({
  carouselContainer: {
    width: width,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    position: 'absolute',
  },
  image: {
    width: width,
    height: 250,
    resizeMode: 'cover',
  },
});

export default FadingCarousel;
