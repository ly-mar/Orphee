import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, ImageBackground, Dimensions } from 'react-native';
import Taskbar from './Taskbar'; // Import Taskbar component

const windowWidth = Dimensions.get('window').width;

function Coplay({ navigation }) {
  return (
    <ImageBackground 
      source={require('./assets/clem-onojeghuo-kfoSKoWc9Gg-unsplash.jpg')}
      style={styles.backgroundImage}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Coplay - M.C or Patron?</Text>
          <Text style={styles.cardText}>Choose your pill.</Text>
        </View>
        <View style={styles.cardContainer}>
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CreateParty')}>
            <Image source={require('./assets/create_party.jpg')} style={styles.cardImageTop} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Create a Party</Text>
              <Text style={styles.cardText}>Create a party and enjoy music with your friends.</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('JoinParty')}>
            <Image source={require('./assets/nick-fewings-9P1pZy3gwxg-unsplash.jpg')} style={styles.cardImageTop} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Join a Party</Text>
              <Text style={styles.cardText}>Join an existing party and connect with others.</Text>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.taskbarContainer}>
          <Taskbar />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)', // Added transparency to darken the background image for better text visibility
    justifyContent: 'flex-start', // Align items to the top of the container
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: windowWidth * 0.05, // Responsive vertical padding
    paddingHorizontal: windowWidth * 0.1, // Responsive horizontal padding
    backgroundColor: '#000', // Dark header background color
    width: '100%',
    marginBottom: windowWidth * 0.05, // Responsive margin to separate header from cards
  },
  headerText: {
    color: '#fff',
    fontSize: windowWidth * 0.06, // Responsive font size
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cardContainer: {
    flexDirection: 'column', // Stack cards vertically
    alignItems: 'center', // Center the cards
    width: '100%',
    paddingHorizontal: windowWidth * 0.05, // Responsive padding
    paddingBottom: windowWidth * 0.1, // Additional padding at the bottom
  },
  card: {
    backgroundColor: '#1f1f1f',
    borderRadius: windowWidth * 0.02, // Responsive borderRadius
    width: '90%', // Increase the width to take up more horizontal space
    marginBottom: windowWidth * 0.05, // Responsive margin
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
    alignItems: 'center',
  },
  cardImageTop: {
    width: '100%',
    height: windowWidth * 0.35, // Maintain aspect ratio relative to width
  },
  cardBody: {
    padding: windowWidth * 0.001, // Responsive padding
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: windowWidth * 0.05, // Responsive font size
    fontWeight: 'bold',
    color: '#fff', // White text color for better contrast
    textAlign: 'center', // Center-align the text
  },
  cardText: {
    fontSize: windowWidth * 0.04, // Smaller font for description
    color: '#cccccc', // Light grey text color for contrast
    textAlign: 'center',
    marginVertical: windowWidth * 0.01, // Small vertical margin for spacing
  },
  taskbarContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#121212', // Dark background color to match the overall theme
    paddingVertical: windowWidth * 0.02, // Responsive padding
  },
});

export default Coplay;
