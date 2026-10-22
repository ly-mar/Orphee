import React, { useRef, useEffect, useState } from 'react';
import { Animated, View, Dimensions, Image, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';

const { width } = Dimensions.get('window');

const FadingCarousel = ({ images, duration = 3000 }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fadeIn = () => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          fadeOut();
        }, duration);
      });
    };

    const fadeOut = () => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
      });
    };

    fadeIn();
  }, [currentIndex, fadeAnim, images.length, duration]);

  return (
    <View style={styles.carouselContainer}>
      {images.length > 0 && (
        <Animated.View style={[styles.imageContainer, { opacity: fadeAnim }]}>
          <Image source={{ uri: images[currentIndex] }} style={styles.image} />
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
