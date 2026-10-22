import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { db, auth } from './firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { FontAwesome5 } from '@expo/vector-icons'; // Assuming using Expo for icons

const CreateParty = () => {
    const [parties, setParties] = useState([]);

    useEffect(() => {
        const fetchParties = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'parties'));
                const partiesList = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setParties(partiesList);
            } catch (error) {
                console.error("Error fetching parties: ", error);
            }
        };

        fetchParties();
    }, []);

    // Function to handle party registration
    const handleRegister = async (party) => {
        // Get the current user
        const user = auth.currentUser;
        if (!user) {
            Alert.alert("Not Logged In", "Please log in to register for a party.");
            return;
        }

        const partyDocRef = doc(db, 'parties', party.id);
        const userDocRef = doc(db, 'parties', party.name);  // Document for storing registered users by party name

        try {
            const partyDoc = await getDoc(partyDocRef);

            if (!partyDoc.exists()) {
                Alert.alert("Party Not Found", "The party document does not exist.");
                return;
            }

            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                // Create a new document for this party and add the current user
                await setDoc(userDocRef, {
                    registeredUsers: [user.displayName || user.email],  // Use username or email
                    registrationCount: 1,
                });
            } else {
                // Update the existing document for this party
                await updateDoc(userDocRef, {
                    registeredUsers: arrayUnion(user.displayName || user.email),  // Use username or email
                    registrationCount: userDoc.data().registeredUsers.length + 1,
                });
            }

            // Update the party document to reflect the new registration count
            await updateDoc(partyDocRef, {
                registrationCount: userDoc.exists() ? userDoc.data().registeredUsers.length + 1 : 1,
            });

            // Update the local state
            setParties((prevParties) =>
                prevParties.map((p) =>
                    p.id === party.id ? { ...p, registrationCount: userDoc.exists() ? userDoc.data().registeredUsers.length + 1 : 1 } : p
                )
            );

            Alert.alert('Registered!', `You have successfully registered for ${party.name}.`);

        } catch (error) {
            console.error("Error registering for the party: ", error);
            Alert.alert("Registration Error", "There was an error registering for the party.");
        }
    };
    

    const renderPartyItem = ({ item }) => {
        // Ensure item.invitation exists before accessing its properties
        const invitation = item.invitation || {};
    
        return (
            <TouchableOpacity onPress={() => handleRegister(item)}>
                <View style={[
                    styles.card,
                    {
                        backgroundColor: invitation.backgroundColor || '#fff',  // Fallback color if invitation or backgroundColor is missing
                        ...(invitation.visualEffect === 'shadow' ? styles.shadowEffect : {}),
                        ...(invitation.visualEffect === 'border' ? styles.borderEffect : {}),
                    }
                ]}>
                    <View style={styles.cardContent}>
                        <View style={styles.header}>
                            <FontAwesome5 name='critical-role' size={30} />
                            <Text style={[
                                styles.partyName,
                                {
                                    fontFamily: invitation.font || 'System',   // Fallback font if missing
                                    fontSize: invitation.fontSize || 14,      // Fallback font size if missing
                                    color: invitation.textColor || '#000',    // Fallback text color if missing
                                }
                            ]}>
                                {item.name || 'Unnamed Party'}
                            </Text>
                        </View>
                        <Text style={[
                            styles.invitationMessage,
                            {
                                fontFamily: invitation.font || 'System',
                                fontSize: invitation.fontSize || 14,
                                color: invitation.textColor || '#000',
                            }
                        ]}>
                            {invitation.message || 'No message provided'}
                        </Text>
                        <Text style={styles.partyDetails}>Theme: {item.theme || 'N/A'}</Text>
                        <Text style={styles.partyDetails}>Address: {item.address || 'N/A'}</Text>
                        <Text style={styles.partyDetails}>
                            Date: {item.date ? new Date(item.date.seconds * 1000).toLocaleDateString() : 'N/A'}
                        </Text>
                        {/* Display the registration count */}
                        <Text style={styles.partyDetails}>Registered: {item.registrationCount || 0}</Text>
                    </View>
                    <View style={styles.cardFooter}>
                        <FontAwesome5 name="user-friends" size={16} color="#000" />
                        <Text style={styles.attendees}>{item.isPublic ? 'Public' : 'Private'}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };
    

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView>
                {/* Title "The Venue" */}
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>The Venue</Text>
                </View>
                <FlatList
                    data={parties}
                    keyExtractor={item => item.name}
                    renderItem={renderPartyItem}
                    contentContainerStyle={styles.flatListContent}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    titleContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    title: {
        fontSize: 48,
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        textShadowColor: '#FFD700',
        textShadowOffset: { width: 3, height: 3 },
        textShadowRadius: 1,
        shadowColor: '#00BFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 10,
    },
    flatListContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    card: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 4,
    },
    cardContent: {
        flex: 1,
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    partyName: {
        textAlign: 'center',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    invitationMessage: {
        textAlign: 'center',
        marginBottom: 8,
    },
    partyDetails: {
        fontSize: 14,
        color: '#333',
        textAlign: 'center',
        marginBottom: 4,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    attendees: {
        fontSize: 16,
        color: '#000',
        marginLeft: 8,
    },
    shadowEffect: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 5,
    },
    borderEffect: {
        borderWidth: 2,
        borderColor: '#000',
    },
});

export default CreateParty;
