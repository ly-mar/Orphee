import React, { useState } from 'react';
import { View, Text, TextInput, Button, Switch, FlatList, StyleSheet, TouchableOpacity, ScrollView, Image, ImageBackground } from 'react-native';
import { db, auth } from './firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { getAuth } from "firebase/auth";
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { Slider } from 'react-native-awesome-slider';
import { useSharedValue } from 'react-native-reanimated';

const CreateParty = () => {
    // State variables
    const [partyName, setPartyName] = useState('');
    const [address, setAddress] = useState('');
    const [theme, setTheme] = useState('');
    const [filteredThemes, setFilteredThemes] = useState([]);
    const [genres, setGenres] = useState([]);
    const [customGenre, setCustomGenre] = useState('');
    const [date, setDate] = useState(new Date());
    const [isPublic, setIsPublic] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedSongs, setSelectedSongs] = useState([]);
    const [invitationMessage, setInvitationMessage] = useState('');
    const [invitationTextColor, setInvitationTextColor] = useState('#000000');
    const [invitationBackgroundColor, setInvitationBackgroundColor] = useState('#FFFFFF');
    const [invitationFont, setInvitationFont] = useState('Arial');
    const [invitationFontSize, setInvitationFontSize] = useState(14);
    const [visualEffect, setVisualEffect] = useState('none');
    const [imageUri, setImageUri] = useState(null); // State for image
    const [selectedEmojis, setSelectedEmojis] = useState([]); // State for emojis

    // Shared values for Slider
    const fontSizeProgress = useSharedValue(invitationFontSize);
    const fontSizeMin = useSharedValue(12);
    const fontSizeMax = useSharedValue(24);

    const colorProgress = useSharedValue(parseInt(invitationTextColor.replace('#', ''), 16));
    const colorMin = useSharedValue(0x000000);
    const colorMax = useSharedValue(0xFFFFFF);

    const bgColorProgress = useSharedValue(parseInt(invitationBackgroundColor.replace('#', ''), 16));
    const bgColorMin = useSharedValue(0x000000);
    const bgColorMax = useSharedValue(0xFFFFF0);

    const themeList = [
        'No Themes', 'Hollywood Glamour', 'Hawaiian Luau', '80s Throwback', 'Casino Night', 
        'Great Gatsby/1920s Speakeasy', 'Pirates of the Caribbean', 'Black and White Ball', 
        'Masquerade Ball', 'Superheroes vs. Villains', 'Cowboy', 'Enchanted Forest Gala', 
        'Time Traveler’s Ball', 'Retro Video Game Arcade', 'Around the World in One Night', 
        'Underwater Atlantis', 'Outer Space Odyssey', 'Steampunk Adventure', 
        'Dreamland Pajama Party', 'Masquerade of Myths', 'Carnival of Curiosities'
    ];

    const fonts = ['Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Comic Sans MS']; // Example fonts

    const handleDateChange = (event, selectedDate) => {
        setDate(selectedDate || date);
    };

    const handleGenreChange = (genre) => {
        setGenres(prevGenres => prevGenres.includes(genre) ? prevGenres.filter(g => g !== genre) : [...prevGenres, genre]);
    };

    const handleAddCustomGenre = () => {
        if (customGenre && !genres.includes(customGenre)) {
            setGenres([...genres, customGenre]);
            setCustomGenre(''); // Clear the input field
        }
    };

    const searchSongs = async () => {
        try {
            const response = await fetch(`https://itunes.apple.com/search?term=${searchQuery}&entity=song`);
            const data = await response.json();
            setSearchResults(data.results);
        } catch (error) {
            console.error("Error fetching songs: ", error);
        }
    };

    const handleSongSelect = (song) => {
        setSelectedSongs(prevSongs => [...prevSongs, song]);
    };

    const handleSubmit = async () => {
        const user = getAuth().currentUser;

        try {
            await addDoc(collection(db, 'parties'), {
                name: partyName,
                address,//: isPublic ? address : null,
                theme,
                genres,
                date,
                isPublic,
                invitation: {
                    message: invitationMessage,
                    textColor: invitationTextColor,
                    backgroundColor: invitationBackgroundColor,
                    font: invitationFont,
                    fontSize: invitationFontSize,
                    visualEffect: visualEffect
                },
                ownerId: user.uid,
            });
            alert('Party created successfully!');
        } catch (e) {
            console.error("Error adding document: ", e);
            alert('Failed to create party.');
        }
    };

    const getFriendUids = (userId) => {
        // This function should return a list of friend UIDs from Firestore
        // Placeholder implementation:
        return ['friendUid1', 'friendUid2'];
    };

    const handleThemeChange = (text) => {
        setTheme(text);
        if (text.length > 0) {
            const filtered = themeList.filter(t => t.toLowerCase().includes(text.toLowerCase()));
            setFilteredThemes(filtered);
        } else {
            setFilteredThemes([]);
        }
    };

    const handleThemeSelect = (selectedTheme) => {
        setTheme(selectedTheme);
        setFilteredThemes([]);
    };

    const addEmoji = (emoji) => {
        setSelectedEmojis(prevEmojis => [...prevEmojis, emoji]);
    };

    const removeEmoji = (index) => {
        setSelectedEmojis(prevEmojis => prevEmojis.filter((_, i) => i !== index));
    };

    return (
        <ImageBackground source={require('./assets/craig-thomas-0oTg0FmAHKA-unsplash.jpg')} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View  style={styles.formContainer}>
                    <Text style={styles.title}>Create a Party</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Party Name"
                        value={partyName}
                        onChangeText={setPartyName}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Address"
                        value={address}
                        onChangeText={setAddress}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Theme"
                        value={theme}
                        onChangeText={handleThemeChange}
                    />
                    {filteredThemes.length > 0 && (
                        <View style={styles.suggestionsContainer}>
                            {filteredThemes.map((suggestedTheme, index) => (
                                <TouchableOpacity key={index} onPress={() => handleThemeSelect(suggestedTheme)}>
                                    <Text style={styles.suggestionText}>{suggestedTheme}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                
                    <FlatList
                        data={genres}
                        renderItem={({ item }) => (
                            <View style={styles.genreItem}>
                                <Text style={styles.genreText}>{item}</Text>
                                <Button title="Remove" onPress={() => handleGenreChange(item)} color="#E91E63" />
                            </View>
                        )}
                        keyExtractor={item => item}
                        style={styles.flatList}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Add Genre"
                        value={customGenre}
                        onChangeText={setCustomGenre}
                    />
                    <Button title='ADD' onPress={handleAddCustomGenre} color='#E91E63'/> 
                    

                    {/* Invitation Card Section */}
                    <Text style={styles.sectionTitle}>Invitation Card</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Write your invitation message here..."
                        value={invitationMessage}
                        onChangeText={setInvitationMessage}
                    />

                    {/* Font Picker */}
                    <Text style={styles.label}>Font</Text>
                    <Picker
                        selectedValue={invitationFont}
                        onValueChange={(itemValue) => setInvitationFont(itemValue)}
                        style={styles.labelslider}
                    >
                        {fonts.map((font, index) => (
                            <Picker.Item key={index} label={font} value={font} />
                        ))}
                    </Picker>

                    {/* Font Size Slider */}
                    <Text style={styles.label}>Font Size</Text>
                    <View style={styles.sliderContainer}>
                        <Slider
                            progress={fontSizeProgress}
                            minimumValue={fontSizeMin}
                            maximumValue={fontSizeMax}
                            onValueChange={(value) => {
                                fontSizeProgress.value = value;
                                setInvitationFontSize(value);
                            }}
                            style={styles.slider}
                        />
                    </View>

                    {/* Color Pickers for Text and Background */}
                    <Text style={styles.label}>Invitation Text Color</Text>
                    <View style={styles.sliderContainer}>
                        <Slider
                            progress={colorProgress}
                            minimumValue={colorMin}
                            maximumValue={colorMax}
                            onValueChange={(value) => {
                                colorProgress.value = value;
                                setInvitationTextColor(`#${Math.floor(value).toString(16).padStart(6, '0')}`);
                            }}
                            style={styles.slider}
                        />
                    </View>

                    <Text style={styles.label}>Invitation Background Color</Text>
                    <View style={styles.sliderContainer}>
                        <Slider
                            progress={bgColorProgress}
                            minimumValue={bgColorMin}
                            maximumValue={bgColorMax}
                            onValueChange={(value) => {
                                bgColorProgress.value = value;
                                setInvitationBackgroundColor(`#${Math.floor(value).toString(16).padStart(6, '0')}`);
                            }}
                            style={styles.slider}
                        />
                    </View>

                    {/* Visual Effects Picker */}
                    <Text style={styles.label}>Visual Effects</Text>
                    <Picker
                        selectedValue={visualEffect}
                        onValueChange={(itemValue) => setVisualEffect(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="None" value="none" />
                        <Picker.Item label="Shadow" value="shadow" />
                        <Picker.Item label="Border" value="border" />
                    </Picker>

                    {/* Apply visual effects to the preview */}
                    <View style={[
                        styles.invitationPreview,
                        { backgroundColor: invitationBackgroundColor },
                        visualEffect === 'shadow' && styles.shadowEffect,
                        visualEffect === 'border' && styles.borderEffect
                    ]}>
                        
                        <Text style={{ color: invitationTextColor, fontFamily: invitationFont, fontSize: invitationFontSize }}>
                            {invitationMessage}
                        </Text>
                    </View>

                    <Text style={styles.label}>Is the party public?</Text>
                    <Switch
                        value={isPublic}
                        onValueChange={setIsPublic}
                        style={styles.switch}
                    />

                    {/* Date and Time Picker Section */}
                    <View style={styles.dateTimeContainer}>
                        <Text style={{color:'black'}}>Select Date and Time</Text>
                        <DateTimePicker
                            value={date}
                            mode="datetime"
                            display="default"
                            onChange={handleDateChange}
                        />
                    </View>

                    <Button title="Create Party" onPress={handleSubmit} color="#FF5722" />
                </View>
            </ScrollView>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex:1,
    },
    scrollContent: {
        padding: 10,
    },
    formContainer: {
        //backgroundColor: '#', // Dark background color
        padding: 20,
        marginBottom: 15,
        //borderColor: '#ff0000', // Neon red color for the border
        //shadowColor: '#ff0000', // Neon red color for the shadow
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 15, // Increased shadow radius for glow effect
        elevation: 10, // Elevation for Android shadow
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#eafcff',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        height: 50,
        backgroundColor:'#fff',
        borderColor: '#fff',
        borderWidth: 1,
        borderRadius: 5,
        marginBottom: 15,
        paddingHorizontal: 10,
        fontSize: 16,
        width: '100%',
    },
    suggestionsContainer: {
        backgroundColor: '#eee',
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 5,
        marginBottom: 15,
        maxHeight: 100,
    },
    suggestionText: {
        padding: 10,
        fontSize: 16,
        borderBottomColor: '#ccc',
        borderBottomWidth: 1,
    },
    genreItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        backgroundColor: '#fff',
        borderRadius: 5,
        marginBottom: 10,
        borderColor: '#ddd',
        borderWidth: 1,
    },
    genreText: {
        fontSize: 16,
        textColor: '#fff',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#eafcff',
        marginVertical: 15,
        textAlign:'center'
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginVertical: 1,
        color: '#eafcff',
        textAlign:'center',
    },
    labelslider: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 10,
        color: '#333',
        position:'relative',
        backgroundColor:'#eafcff',
        borderCurve:'circular',
        borderRadius: 10, 
    },
    picker: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 3,
        color: '#333',
        position:'relative',
        backgroundColor:'#eafcff',
        borderCurve:'circular',
        borderRadius: 10, 
    },
    sliderContainer: {
        marginBottom: 25,  // Increased margin to separate sliders
    },
    slider: {
        width: '100%',
        marginBottom: 15,
    },
    invitationPreview: {
        padding: 20,
        marginTop:10,
        marginVertical: 20,  // Increased margin to prevent overlap
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderColor: '#ddd',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        minHeight: 100,
    },
    previewImage: {
        width: 100,
        height: 100,
        marginTop: 10,
    },
    emojiText: {
        fontSize: 24,
        marginTop: 10,
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
    dateTimeContainer: {
        marginTop: 1,
        paddingVertical: 1,
        backgroundColor: '#eafcff',
        borderRadius: 1,
        borderColor: '#ddd',
        borderWidth: 1,
        marginBottom: 2,  // Increased margin to separate from other elements
        alignItems:'center'
    },
    switch: {
        marginBottom: 15,
    },
    flatList: {
        maxHeight: 200,
    },
});

export default CreateParty;
