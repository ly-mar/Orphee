import React from 'react';
import { View, StyleSheet, Dimensions, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image'; // Import Image from expo-image
import { Text } from 'react-native-paper';
import Taskbar from './Taskbar'; // Import Taskbar component

const windowWidth = Dimensions.get('window').width;

function Thepipeline({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerMainText}>The pipeline</Text>
        <Text style={styles.headerSubText}>Do you know your favorite artist?</Text>
      </View>
      <ScrollView horizontal style={styles.carousel} showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
            style={styles.carouselItem}
            onPress={() => navigation.navigate('GuessPage', { artist: 'Dua Lipa' })}
          >
            <View style={styles.carouselItem}>
              <Image
                style={styles.carouselImage}
                contentFit="cover"
                source={require('./assets/dualipa.png')}
              />
              <Text style={styles.imageCaption}>Dua Lipa</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.carouselItem}
            onPress={() => navigation.navigate('GuessPage', { artist: 'Dr.Dre' })}
          >
          <View style={styles.carouselItem}>
            <Image
              style={styles.carouselImage}
              contentFit="cover"
              source={require('./assets/drdre.png')}
            />
            <Text style={styles.imageCaption}>Dr.Dre</Text>
          </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.carouselItem}
            onPress={() => navigation.navigate('GuessPage', { artist: 'Manno Charlemagne' })}
          >
          <View style={styles.carouselItem}>
            <Image
              style={styles.carouselImage}
              contentFit="cover"
              source={require('./assets/manno.png')}
            />
            <Text style={styles.imageCaption}>Manno Charlemagne</Text>
          </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.carouselItem}
            onPress={() => navigation.navigate('GuessPage', { artist: "Tropicana d'Haiti" })}
          >
          <View style={styles.carouselItem}>
            <Image
              style={styles.carouselImage}
              contentFit="cover"
              source={require('./assets/tropicana.png')}
            />
            <Text style={styles.imageCaption}>Tropicana d'Haiti</Text>
          </View>
          </TouchableOpacity>
      </ScrollView>
      </View>
      <View style={styles.taskbarContainer}>
        <Taskbar />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212', // Dark background color
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: windowWidth * 0.1, // Added margin to position the text correctly
    marginBottom: windowWidth * 0.05,
  },
  headerMainText: {
    color: '#fff',
    fontSize: windowWidth * 0.08, // Larger font size for main header
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  headerSubText: {
    color: '#00ff00', // Green color as in the image
    fontSize: windowWidth * 0.05,
    textAlign: 'center',
    marginTop: windowWidth * 0.02,
    fontWeight: 'bold',
  },
  carousel: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: windowWidth * 0.05, // Added padding to center carousel
  },
  carouselItem: {
    alignItems: 'center', // Center image and text
    marginHorizontal: windowWidth * 0.02, // Add some space between items
    position: 'relative', // Set position to relative to contain absolute positioned elements
  },
  carouselImage: {
    borderRadius: 20, // Adjusted border radius for a smooth look
    width: windowWidth * 0.8, // Make image width relative to screen size
    height: windowWidth * 1.2, // Maintain aspect ratio and adjust height
  },
  imageCaption: {
    position: 'absolute', // Position absolutely within the container
    bottom: 20, // Position caption at the bottom of the image
    right: 20, // Align caption to the right
    color: '#fff', // White text color for contrast
    fontSize: windowWidth * 0.05, // Responsive font size for caption
    fontWeight: 'bold', // Make caption bold
    textShadowColor: '#000', // Add shadow for better readability
    textShadowOffset: { width: 1, height: 1 }, // Shadow offset
    textShadowRadius: 2, // Shadow blur radius
  },
  taskbarContainer: {
    backgroundColor: '#1f1f1f', // Optional background color for the Taskbar
    paddingBottom: 20, // Padding to avoid safe area overlap
    paddingTop: 10, // Padding for better spacing
  },
});

export default Thepipeline;
