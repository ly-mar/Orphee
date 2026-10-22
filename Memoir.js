// Memoir.js
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    FlatList,
    StyleSheet,
    Dimensions,
    SafeAreaView,
    Image,
    Alert,
    ActivityIndicator,
} from 'react-native';
import Taskbar from './Taskbar';
import { FontAwesome5 } from '@expo/vector-icons';
import { doc, setDoc, updateDoc, arrayUnion, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import eventEmitter from './events';

const windowWidth = Dimensions.get('window').width;

export const normalizeTrack = (raw = {}) => {
    const trackId = Number(raw.trackId || raw.id || Date.now());
    const trackName = raw.trackName || raw.title || 'Unknown Track';
    const artistName = raw.artistName || raw.artist || 'Unknown Artist';
    const collectionName = raw.collectionName || raw.album || 'Single';
    const artworkUrl100 =
        raw.artworkUrl100 || raw.imageUrl || 'https://via.placeholder.com/300';
    const previewUrl = raw.previewUrl || '';
    const primaryGenreName = raw.primaryGenreName || raw.genre || 'Music';
    const releaseDate = raw.releaseDate || new Date().toISOString();

    return {
        trackId,
        id: trackId,
        trackName,
        title: trackName,
        artistName,
        artist: artistName,
        collectionName,
        artworkUrl100,
        imageUrl: artworkUrl100,
        previewUrl,
        primaryGenreName,
        genre: primaryGenreName,
        releaseDate,
    };
};

const getHighResImage = (imageUrl) => {
    if (!imageUrl) return 'https://via.placeholder.com/400';
    return imageUrl.replace('100x100', '400x400');
};

const MemoirSearchPage = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [comment, setComment] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [memoirSelection, setMemoirSelection] = useState(null);

    useEffect(() => {
        if (searchQuery.trim().length >= 2) {
            const timer = setTimeout(() => {
                setDebouncedQuery(searchQuery.trim());
            }, 380);
            return () => clearTimeout(timer);
        } else {
            setDebouncedQuery('');
            setSearchResults([]);
        }
    }, [searchQuery]);

    useEffect(() => {
        if (debouncedQuery.length >= 2) {
            fetchMusic(debouncedQuery);
        }
    }, [debouncedQuery]);

    const fetchMusic = async (queryTerm) => {
        try {
            setLoading(true);
            const response = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(
                    queryTerm
                )}&media=music&entity=song&limit=25`
            );
            const data = await response.json();
            const normalized = Array.isArray(data.results)
                ? data.results.map(normalizeTrack)
                : [];
            setSearchResults(normalized);
        } catch (error) {
            console.error('Error fetching music:', error);
            setSearchResults([]);
        } finally {
            setLoading(false);
        }
    };

    const addMemoirToFirestore = async (userId, memoir) => {
        const userRef = doc(db, 'memoirs', userId);
        const docSnapshot = await getDoc(userRef);

        const entry = {
            id: `${userId}_${Date.now()}`,
            item: normalizeTrack(memoir.item),
            comment: memoir.comment,
            timestamp: Timestamp.now(),
        };

        if (!docSnapshot.exists()) {
            await setDoc(userRef, { pastMemoirs: [entry] });
        } else {
            await updateDoc(userRef, {
                pastMemoirs: arrayUnion(entry),
            });
        }
        return entry;
    };

    const handleCommentSubmit = async () => {
        if (!memoirSelection || !comment.trim()) {
            Alert.alert('Incomplete Memoir', 'Please write a reflection for this track.');
            return;
        }

        const userId = auth.currentUser?.uid;
        if (!userId) {
            Alert.alert('Authentication Required', 'Please sign in to save your memoir.');
            return;
        }

        try {
            const savedEntry = await addMemoirToFirestore(userId, {
                item: memoirSelection,
                comment: comment.trim(),
            });

            eventEmitter.emit('memoirSelected', savedEntry);

            setIsModalVisible(false);
            setComment('');
            setMemoirSelection(null);
            Alert.alert('Memoir Saved', 'Your musical memory has been archived.');
        } catch (error) {
            console.error('Error adding memoir:', error);
            Alert.alert('Error', 'Unable to save memoir right now.');
        }
    };

    const handleSelect = (item) => {
        setMemoirSelection(normalizeTrack(item));
        setIsModalVisible(true);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.topHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <FontAwesome5 name="arrow-left" size={14} color="#FFF" />
                    <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Song Memoir</Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate('MemoirHistoryScreen')}
                    style={styles.historyBtn}
                >
                    <FontAwesome5 name="history" size={13} color="#FF8C00" />
                    <Text style={styles.historyBtnText}>Archive</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchBarContainer}>
                <FontAwesome5 name="search" size={15} color="#FF8C00" style={{ marginRight: 10 }} />
                <TextInput
                    style={styles.searchBar}
                    placeholder="Search iTunes for a song that holds a memory..."
                    placeholderTextColor="#718096"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {loading && (
                <ActivityIndicator size="small" color="#FF8C00" style={{ marginVertical: 10 }} />
            )}

            <FlatList
                data={searchResults}
                keyExtractor={(item) => item.trackId.toString()}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <View style={styles.resultCard}>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('SongDetails', { song: item })}
                        >
                            <Image
                                source={{ uri: getHighResImage(item.artworkUrl100) }}
                                style={styles.resultCoverImage}
                            />
                        </TouchableOpacity>

                        <View style={styles.resultInfoContainer}>
                            <Text style={styles.trackTitle} numberOfLines={1}>
                                {item.trackName}
                            </Text>
                            <Text style={styles.artistName} numberOfLines={1}>
                                {item.artistName}
                            </Text>
                            <Text style={styles.genre} numberOfLines={1}>
                                {item.primaryGenreName}
                                {item.releaseDate
                                    ? ` • ${new Date(item.releaseDate).getFullYear()}`
                                    : ''}
                            </Text>

                            <View style={styles.cardActions}>
                                <TouchableOpacity
                                    style={styles.writeMemoirBtn}
                                    onPress={() => handleSelect(item)}
                                >
                                    <FontAwesome5 name="pen-nib" size={12} color="#000" />
                                    <Text style={styles.writeMemoirBtnText}>Write Memoir</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.previewLinkBtn}
                                    onPress={() => navigation.navigate('SongDetails', { song: item })}
                                >
                                    <FontAwesome5 name="play" size={10} color="#FF8C00" />
                                    <Text style={styles.previewLinkText}>Preview</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    !loading && (
                        <Text style={styles.noResultsText}>
                            {searchQuery.trim().length >= 2
                                ? 'No matching songs found.'
                                : 'Search a track above to attach a personal memory.'}
                        </Text>
                    )
                }
            />

            <Modal
                visible={isModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalTopRow}>
                            <Text style={styles.modalHeaderTitle}>Attach Memory</Text>
                            <TouchableOpacity
                                onPress={() => setIsModalVisible(false)}
                                style={styles.closeButton}
                            >
                                <FontAwesome5 name="times" size={18} color="#A0AEC0" />
                            </TouchableOpacity>
                        </View>

                        {memoirSelection && (
                            <>
                                <View style={styles.trackCard}>
                                    <Image
                                        source={{ uri: getHighResImage(memoirSelection.artworkUrl100) }}
                                        style={styles.modalCoverImage}
                                    />
                                    <View style={styles.modalTrackInfo}>
                                        <Text style={styles.modalTrackTitle} numberOfLines={1}>
                                            {memoirSelection.trackName}
                                        </Text>
                                        <Text style={styles.modalArtistName} numberOfLines={1}>
                                            {memoirSelection.artistName}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.commentSection}>
                                    <TextInput
                                        style={styles.commentInput}
                                        placeholder="What memory does this song bring back?"
                                        placeholderTextColor="#718096"
                                        value={comment}
                                        onChangeText={setComment}
                                        multiline
                                    />
                                    <TouchableOpacity
                                        style={styles.submitButton}
                                        onPress={handleCommentSubmit}
                                    >
                                        <FontAwesome5 name="paper-plane" size={15} color="#000" />
                                        <Text style={styles.submitButtonText}>Save</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            <View style={styles.taskbarContainer}>
                <Taskbar />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0D0E12',
    },
    topHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1F2430',
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1E29',
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 6,
    },
    backBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
    },
    historyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 140, 0, 0.14)',
        borderWidth: 1,
        borderColor: '#FF8C00',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        gap: 6,
    },
    historyBtnText: {
        color: '#FF8C00',
        fontSize: 12,
        fontWeight: '700',
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: '#161922',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#242936',
        height: 46,
    },
    searchBar: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 14,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 90,
    },
    resultCard: {
        flexDirection: 'row',
        backgroundColor: '#161922',
        borderRadius: 12,
        marginBottom: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#242936',
        alignItems: 'center',
    },
    resultCoverImage: {
        width: 72,
        height: 72,
        borderRadius: 8,
        marginRight: 12,
    },
    resultInfoContainer: {
        flex: 1,
    },
    trackTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    artistName: {
        fontSize: 13,
        color: '#CBD5E1',
        marginTop: 2,
    },
    genre: {
        fontSize: 11,
        color: '#718096',
        marginTop: 2,
        marginBottom: 8,
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    writeMemoirBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF8C00',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
        gap: 6,
    },
    writeMemoirBtnText: {
        color: '#000000',
        fontSize: 12,
        fontWeight: '700',
    },
    previewLinkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FF8C00',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 6,
        gap: 5,
    },
    previewLinkText: {
        color: '#FF8C00',
        fontSize: 12,
        fontWeight: '600',
    },
    noResultsText: {
        textAlign: 'center',
        color: '#718096',
        marginTop: 32,
        fontSize: 14,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalSheet: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#161922',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#2A3142',
    },
    modalTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    modalHeaderTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
    },
    closeButton: {
        padding: 4,
    },
    trackCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0D1017',
        padding: 12,
        borderRadius: 12,
        marginBottom: 14,
    },
    modalCoverImage: {
        width: 64,
        height: 64,
        borderRadius: 8,
        marginRight: 12,
    },
    modalTrackInfo: {
        flex: 1,
    },
    modalTrackTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    modalArtistName: {
        fontSize: 13,
        color: '#FF8C00',
        marginTop: 3,
    },
    commentSection: {
        gap: 12,
    },
    commentInput: {
        minHeight: 80,
        padding: 12,
        borderRadius: 10,
        backgroundColor: '#0D1017',
        color: '#FFFFFF',
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#242936',
        textAlignVertical: 'top',
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF8C00',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 8,
    },
    submitButtonText: {
        color: '#000000',
        fontWeight: '800',
        fontSize: 15,
    },
    taskbarContainer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        backgroundColor: '#0D1017',
    },
});

export default MemoirSearchPage;