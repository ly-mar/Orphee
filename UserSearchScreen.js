import React, { useState, useEffect } from 'react';
import { View, TextInput, FlatList, Text, ActivityIndicator, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, Image } from 'react-native';
import debounce from 'lodash.debounce';
import { auth, db } from './firebaseConfig';  // Import the firestore database
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import Taskbar from './Taskbar'; // Import Taskbar component

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const UserSearchScreen = () => {
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cache, setCache] = useState({});
  const navigation = useNavigation();
  const [currentUsername, setCurrentUsername] = useState(null);

  
  useEffect(() => {
    const fetchCurrentUsername = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const userRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userRef);
          const userData = userDoc.data();
          if (userData && userData.username) {
            setCurrentUsername(userData.username);
      }
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    };

    fetchCurrentUsername();
  }, []);


  const fetchUsers = async (searchQuery) => {
    if (cache[searchQuery]) {
      setResults(cache[searchQuery]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const usersCollection = collection(db, 'users');
      const q = query(usersCollection, where('username', '>=', searchQuery), where('username', '<=', searchQuery + '\uf8ff'));
      const querySnapshot = await getDocs(q);

      const users = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        username: doc.data().username,
        email: doc.data().email,
        profileImageUrl: doc.data().profileImageUrl || 'https://via.placeholder.com/150', // Default image if not provided
      }));

      setResults(users);
      setCache({ ...cache, [searchQuery]: users });
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      setIsLoading(false);
    }
  };

  const debouncedFetchUsers = debounce((searchQuery) => {
    if (searchQuery.length > 0) {
      fetchUsers(searchQuery);
    } else {
      setResults([]);
    }
  }, 500);

  const handleSearch = (text) => {
    setQueryText(text);
    debouncedFetchUsers(text);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => {
        if (item.username == currentUsername) {
          navigation.navigate('Profile');
        } else {
          navigation.navigate('UserProfile', { userId: item.id });
        }
      }}
    >
      <Image source={{ uri: item.profileImageUrl }} style={styles.profileImage} />
      <View style={styles.textContainer}>
        <Text style={styles.username}>{item.username}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>User Search</Text>
      <TextInput
        style={styles.input}
        placeholder="Search users by username..."
        value={queryText}
        onChangeText={handleSearch}
      />
      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      )}
      <View style={styles.taskbarContainer}>
        <Taskbar />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#121212', // Changed background color to match a dark theme
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#fff', // Added background color for input to ensure visibility
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d3d',
    marginBottom: 10,
  },
profileImage: {
  width: 50,
  height: 50,
  borderRadius: 25,
  marginRight: 15,
},
textContainer: {
  flexDirection: 'column',
  justifyContent: 'center',
},
username: {
  fontWeight: 'bold',
  color: '#ffffff', // Changed to ensure visibility against dark background
  fontSize: 18,
},
taskbarContainer: {
  position: 'absolute',
  bottom: 0,
  width: '100%',
  backgroundColor: '#121212',
  paddingVertical: windowWidth * 0.02,
},
});

export default UserSearchScreen;
