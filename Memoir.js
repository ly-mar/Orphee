// Memoir.js
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import axios from 'axios';
import { auth, db } from './firebaseConfig';
import {
    collection,
    addDoc,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    serverTimestamp,
} from 'firebase/firestore';
import { Feather } from '@expo/vector-icons';
import Taskbar from './Taskbar';
import { normalizeTrack, getHighResImage } from './services/musicApi';
import { createAudioPreviewController } from './audioPreviewController';
import { createItunesSearchClient, deduplicateTracks } from './utils/itunesSearchUtils';
import { showNonBlockingNotice } from './crossPlatformAlert';

export { normalizeTrack };

export default function Memoir({ route, navigation }) {
    const routeTrack = route?.params?.song || route?.params?.track || null;
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedTrack, setSelectedTrack] = useState(() => routeTrack ? normalizeTrack(routeTrack) : null);
    const [comment, setComment] = useState('');
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [saving, setSaving] = useState(false);
    const [username, setUsername] = useState('Sigma');

    useEffect(() => {
        const incoming = route?.params?.song || route?.params?.track;
        if (incoming) {
            setSelectedTrack(normalizeTrack(incoming));
            setSearchResults([]);
            setSearchQuery('');
        }
    }, [route?.params?.song, route?.params?.track]);

    const itunesClientRef = useRef(null);
    if (!itunesClientRef.current) {
        itunesClientRef.current = createItunesSearchClient({ limit: 12 });
    }

    const audioControllerRef = useRef(null);
    if (!audioControllerRef.current) {
        audioControllerRef.current = createAudioPreviewController({
            onError: (msg) => console.warn(msg),
        });
    }

    useEffect(() => {
        const unsubscribeBlur = navigation?.addListener?.('blur', () => {
            audioControllerRef.current?.stop();
        });
        return () => {
            unsubscribeBlur?.();
            audioControllerRef.current?.dispose();
        };
    }, [navigation]);

    useEffect(() => {
        const loadUser = async () => {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            try {
                const snap = await getDoc(doc(db, 'users', uid));
                if (snap.exists() && snap.data().username) {
                    setUsername(snap.data().username);
                }
            } catch (_) { }
        };
        loadUser();
    }, []);

    useEffect(() => {
        if (searchQuery.trim().length < 2) {
            itunesClientRef.current?.cancel();
            setSearchResults([]);
            setLoadingSearch(false);
            return;
        }
        const timer = setTimeout(async () => {
            setLoadingSearch(true);
            const results = await itunesClientRef.current.search(searchQuery);
            if (results !== null) {
                setSearchResults(deduplicateTracks(results.map(normalizeTrack)));
                setLoadingSearch(false);
            }
        }, 350);

        return () => {
            clearTimeout(timer);
        };
    }, [searchQuery]);

    const handleSaveMemoir = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            showNonBlockingNotice('Authentication Required', 'Please log in to publish a song memoir.');
            return;
        }
        if (!selectedTrack) {
            showNonBlockingNotice('Select a Song', 'Please search for a song above and tap "+" to attach it to your memoir.');
            return;
        }
        if (!comment.trim()) {
            showNonBlockingNotice('Add Reflection', 'Please write your reflection or memory in the text box below.');
            return;
        }

        try {
            setSaving(true);
            const normalized = normalizeTrack(selectedTrack);

            // 1. Primary write: Save to doc(db, 'memoirs', uid) pastMemoirs array
            // This strictly satisfies Firestore production rule `match /memoirs/{userId} { allow write: if isOwner(userId); }`
            // and guarantees successful saves across web, iOS, and Android without permission errors.
            const memoirId = `${uid}_${Date.now()}`;
            const historyEntry = {
                id: memoirId,
                item: normalized,
                comment: comment.trim(),
                timestamp: {
                    seconds: Math.floor(Date.now() / 1000),
                    nanoseconds: 0,
                },
                createdAt: new Date().toISOString(),
                userId: uid,
                username: username || 'Sigma',
                trackId: normalized.trackId,
                title: normalized.trackName,
                trackName: normalized.trackName,
                artist: normalized.artistName,
                artistName: normalized.artistName,
                collectionName: normalized.collectionName || '',
                imageUrl: normalized.imageUrl || normalized.artworkUrl100,
                artworkUrl100: normalized.artworkUrl100,
                previewUrl: normalized.previewUrl || '',
                primaryGenreName: normalized.primaryGenreName || 'Music',
            };

            const userRef = doc(db, 'memoirs', uid);
            const userDocSnap = await getDoc(userRef);

            if (!userDocSnap.exists()) {
                await setDoc(userRef, {
                    userId: uid,
                    username: username || 'Sigma',
                    pastMemoirs: [historyEntry],
                    updatedAt: new Date().toISOString(),
                });
            } else {
                const existingMemoirs = userDocSnap.data()?.pastMemoirs;
                if (Array.isArray(existingMemoirs)) {
                    await updateDoc(userRef, {
                        pastMemoirs: arrayUnion(historyEntry),
                        updatedAt: new Date().toISOString(),
                    });
                } else {
                    await setDoc(
                        userRef,
                        {
                            userId: uid,
                            username: username || 'Sigma',
                            pastMemoirs: [historyEntry],
                            updatedAt: new Date().toISOString(),
                        },
                        { merge: true }
                    );
                }
            }

            // 2. Opportunistic secondary write to individual document in 'memoirs' collection
            // Wrapped safely so that if deployed production rules strictly enforce memoirs/{userId},
            // any auto-generated ID permission rejection is caught and ignored gracefully.
            try {
                await addDoc(collection(db, 'memoirs'), {
                    ...historyEntry,
                    timestamp: serverTimestamp(),
                });
            } catch (collectionErr) {
                console.log('Individual memoir collection addDoc bypassed (production enforces memoirs/{userId}):', collectionErr?.message);
            }

            // Reset state and loading spinner BEFORE triggering user feedback/navigation [VR-013]
            setSaving(false);
            setComment('');
            setSelectedTrack(null);
            setSearchQuery('');
            setSearchResults([]);
            showNonBlockingNotice('Memoir Published', 'Your song memory has been added to your profile.');
            navigation.navigate('ProfileScreen');
        } catch (error) {
            console.error('Error saving memoir:', error);
            setSaving(false);
            showNonBlockingNotice('Save Error', error?.message || 'Could not save your memoir. Please try again.');
        }
    };

    const canGoBack = Boolean(navigation?.canGoBack?.());

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.headerRow}>
                    {canGoBack && (
                        <TouchableOpacity
                            style={styles.backCircleBtn}
                            onPress={() => navigation.goBack()}
                        >
                            <Feather name="chevron-left" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    )}
                    <View style={{ flex: 1, marginLeft: canGoBack ? 12 : 0 }}>
                        <Text style={styles.screenTitle}>Add Song Memoir</Text>
                        <Text style={styles.screenSub}>
                            Attach a personal story or timestamp to a track
                        </Text>
                    </View>
                </View>

                <View style={styles.searchBar}>
                    <Feather name="search" size={16} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search song or artist..."
                        placeholderTextColor="#64748B"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {loadingSearch && (
                    <ActivityIndicator size="small" color="#D4F458" style={{ marginVertical: 10 }} />
                )}

                {searchResults.length > 0 && !selectedTrack && (
                    <View style={styles.resultsCard}>
                        {searchResults.map((item) => (
                            <TouchableOpacity
                                key={item.trackId}
                                style={styles.resultRow}
                                onPress={() => {
                                    setSelectedTrack(item);
                                    setSearchResults([]);
                                    setSearchQuery('');
                                }}
                            >
                                {item.imageUrl ? (
                                    <Image source={{ uri: item.imageUrl }} style={styles.resultCover} />
                                ) : (
                                    <View style={[styles.resultCover, { backgroundColor: '#1E2433', alignItems: 'center', justifyContent: 'center' }]}>
                                        <Feather name="music" size={16} color="#64748B" />
                                    </View>
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.resultTitle} numberOfLines={1}>
                                        {item.trackName}
                                    </Text>
                                    <Text style={styles.resultArtist} numberOfLines={1}>
                                        {item.artistName}
                                    </Text>
                                </View>
                                <Feather name="plus-circle" size={18} color="#D4F458" />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {selectedTrack && (
                    <View style={styles.selectedTrackCard}>
                        {selectedTrack.imageUrl ? (
                            <Image source={{ uri: selectedTrack.imageUrl }} style={styles.selectedArt} />
                        ) : (
                            <View style={[styles.selectedArt, { backgroundColor: '#1E2433', alignItems: 'center', justifyContent: 'center' }]}>
                                <Feather name="music" size={18} color="#64748B" />
                            </View>
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.selectedTitle}>{selectedTrack.trackName}</Text>
                            <Text style={styles.selectedArtist}>{selectedTrack.artistName}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedTrack(null)}>
                            <Feather name="x-circle" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                )}

                <Text style={styles.inputLabel}>Your Reflection</Text>
                <TextInput
                    style={styles.memoirTextArea}
                    placeholder="Write the memory, moment, or story this song brings back..."
                    placeholderTextColor="#64748B"
                    multiline
                    value={comment}
                    onChangeText={setComment}
                />

                <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                    onPress={handleSaveMemoir}
                    disabled={saving}
                    activeOpacity={0.85}
                >
                    {saving ? (
                        <View style={styles.savingRow}>
                            <ActivityIndicator size="small" color="#0B0C10" />
                            <Text style={styles.saveBtnText}>Publishing Memoir...</Text>
                        </View>
                    ) : (
                        <Text style={styles.saveBtnText}>Publish Song Memoir</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            <Taskbar navigation={navigation} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0B0C10',
    },
    scrollContent: {
        padding: 18,
        paddingBottom: 120,
        maxWidth: 520,
        width: '100%',
        alignSelf: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    backCircleBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#171922',
        alignItems: 'center',
        justifyContent: 'center',
    },
    screenTitle: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '800',
    },
    screenSub: {
        color: '#94A3B8',
        fontSize: 13,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#151821',
        borderRadius: 18,
        paddingHorizontal: 14,
        height: 48,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: 14,
    },
    searchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 14,
        marginLeft: 10,
    },
    resultsCard: {
        backgroundColor: '#151821',
        borderRadius: 18,
        padding: 10,
        marginBottom: 16,
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        gap: 12,
    },
    resultCover: {
        width: 46,
        height: 46,
        borderRadius: 10,
    },
    resultTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    resultArtist: {
        color: '#94A3B8',
        fontSize: 12,
    },
    selectedTrackCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#171922',
        borderRadius: 18,
        padding: 12,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#D4F458',
        gap: 12,
    },
    selectedArt: {
        width: 58,
        height: 58,
        borderRadius: 12,
    },
    selectedTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    selectedArtist: {
        color: '#D4F458',
        fontSize: 13,
        marginTop: 2,
    },
    inputLabel: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 8,
    },
    memoirTextArea: {
        backgroundColor: '#151821',
        borderRadius: 18,
        padding: 16,
        color: '#FFFFFF',
        fontSize: 15,
        minHeight: 140,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: 20,
    },
    saveBtn: {
        backgroundColor: '#D4F458',
        paddingVertical: 15,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    savingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    saveBtnText: {
        color: '#0B0C10',
        fontSize: 15,
        fontWeight: '800',
    },
});