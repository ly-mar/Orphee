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
import { appendTrackToYour13Safely, normalizeYour13List } from './utils/playlistUtils';
import { getCachedUserProfile, setCachedUserProfile } from './utils/sessionCache';
import { LISTENING_CONTEXT_TAGS, sanitizeStandoutLine } from './utils/memoirUtils';

export { normalizeTrack, LISTENING_CONTEXT_TAGS, sanitizeStandoutLine };

export default function Memoir({ route, navigation }) {
    const routeTrack = route?.params?.song || route?.params?.track || null;
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedTrack, setSelectedTrack] = useState(() => routeTrack ? normalizeTrack(routeTrack) : null);
    const [comment, setComment] = useState('');
    const [contextTag, setContextTag] = useState('Late Night');
    const [standoutLine, setStandoutLine] = useState('');
    const [pinToYour13, setPinToYour13] = useState(false);
    const [userSongs, setUserSongs] = useState([]);
    const [userLocked, setUserLocked] = useState(false);
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

            const cached = getCachedUserProfile(uid);
            if (cached) {
                if (cached.username) setUsername(cached.username);
                setUserSongs(normalizeYour13List(cached.your13 || cached.songs || []));
                setUserLocked(Boolean(cached.your13Confirmed || cached.isLocked));
            }

            try {
                const snap = await getDoc(doc(db, 'users', uid));
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.username) setUsername(data.username);
                    const s = normalizeYour13List(data.your13 || data.songs || []);
                    setUserSongs(s);
                    setUserLocked(Boolean(data.your13Confirmed || data.isLocked));
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

    const isAlreadyInYour13 = Boolean(
        selectedTrack &&
        userSongs.some((s) => {
            const sId = String(s.trackId || s.id || '').trim();
            const candId = String(selectedTrack.trackId || selectedTrack.id || '').trim();
            if (sId && candId && sId === candId) return true;
            const sTitle = String(s.trackName || s.title || '').trim().toLowerCase();
            const cTitle = String(selectedTrack.trackName || selectedTrack.title || '').trim().toLowerCase();
            const sArtist = String(s.artistName || s.artist || '').trim().toLowerCase();
            const cArtist = String(selectedTrack.artistName || selectedTrack.artist || '').trim().toLowerCase();
            return sTitle && cTitle && sTitle === cTitle && sArtist === cArtist;
        })
    );
    const canPinToYour13 = Boolean(!isAlreadyInYour13 && !userLocked && userSongs.length < 13);

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
            const sanitizedStandout = (standoutLine || '').trim().slice(0, 80);

            // 1. Primary write: Save to doc(db, 'memoirs', uid) pastMemoirs array
            // This strictly satisfies Firestore production rule `match /memoirs/{userId} { allow write: if isOwner(userId); }`
            // and guarantees successful saves across web, iOS, and Android without permission errors.
            const memoirId = `${uid}_${Date.now()}`;
            const historyEntry = {
                id: memoirId,
                item: normalized,
                comment: comment.trim(),
                contextTag: contextTag || 'Late Night',
                standoutLine: sanitizedStandout,
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

            // 3. Update user document with latestMemoir and optional Your13 pin bridge
            try {
                const userUpdate = {
                    latestMemoir: {
                        id: memoirId,
                        trackId: normalized.trackId,
                        trackName: normalized.trackName,
                        artistName: normalized.artistName,
                        contextTag: contextTag || 'Late Night',
                        standoutLine: sanitizedStandout,
                        comment: comment.trim(),
                        timestamp: new Date().toISOString(),
                    },
                };

                if (pinToYour13 && canPinToYour13) {
                    const appendRes = appendTrackToYour13Safely({
                        currentList: userSongs,
                        candidateTrack: normalized,
                        isLocked: userLocked,
                    });
                    if (appendRes.ok) {
                        userUpdate.your13 = appendRes.nextList;
                        userUpdate.songs = appendRes.nextList;
                        userUpdate.your13Confirmed = false;
                        setUserSongs(appendRes.nextList);
                    }
                }

                await setDoc(doc(db, 'users', uid), userUpdate, { merge: true });
                const cached = getCachedUserProfile(uid) || {};
                setCachedUserProfile(uid, { ...cached, ...userUpdate });
            } catch (userDocErr) {
                console.log('Error updating user latest memoir / your13:', userDocErr?.message);
            }

            // Reset state and loading spinner BEFORE triggering user feedback/navigation [VR-013]
            setSaving(false);
            setComment('');
            setStandoutLine('');
            setPinToYour13(false);
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

                {/* Bridge 1: Pin to Your13 Toggle / Status */}
                {selectedTrack && (
                    <View style={styles.bridgeRow}>
                        {isAlreadyInYour13 ? (
                            <View style={styles.bridgeBadgePinned}>
                                <Feather name="bookmark" size={13} color="#D4F458" />
                                <Text style={styles.bridgeBadgePinnedText}>
                                    Track in Your13 • Memoir attaches to track row 📖
                                </Text>
                            </View>
                        ) : canPinToYour13 ? (
                            <TouchableOpacity
                                style={[styles.bridgeToggleBtn, pinToYour13 && styles.bridgeToggleBtnActive]}
                                onPress={() => setPinToYour13(!pinToYour13)}
                                activeOpacity={0.85}
                            >
                                <Feather
                                    name={pinToYour13 ? "check-circle" : "plus-circle"}
                                    size={14}
                                    color={pinToYour13 ? "#0B0C10" : "#D4F458"}
                                />
                                <Text
                                    style={[
                                        styles.bridgeToggleBtnText,
                                        pinToYour13 && styles.bridgeToggleBtnTextActive,
                                    ]}
                                >
                                    {pinToYour13 ? "Also pinning track to Your13" : "Also pin track to Your13"}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.bridgeBadgeLocked}>
                                <Feather name="lock" size={12} color="#94A3B8" />
                                <Text style={styles.bridgeBadgeLockedText}>
                                    Your13 locked ({userSongs.length}/13 tracks)
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Structured Listening Context Pills */}
                <Text style={styles.inputLabel}>Listening Context</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.contextPillRow}
                >
                    {LISTENING_CONTEXT_TAGS.map((tag) => {
                        const isSelected = contextTag === tag;
                        return (
                            <TouchableOpacity
                                key={tag}
                                style={[
                                    styles.contextPill,
                                    isSelected && styles.contextPillActive,
                                ]}
                                onPress={() => setContextTag(tag)}
                                activeOpacity={0.8}
                            >
                                <Text
                                    style={[
                                        styles.contextPillText,
                                        isSelected && styles.contextPillTextActive,
                                    ]}
                                >
                                    {tag}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Standout Lyric or Timestamp (Max 80 Chars) */}
                <View style={styles.labelWithCounterRow}>
                    <Text style={styles.inputLabel}>Standout Lyric or Timestamp</Text>
                    <Text style={styles.counterText}>{standoutLine.length}/80</Text>
                </View>
                <TextInput
                    style={styles.standoutInput}
                    placeholder="e.g. 02:14 The bridge changes everything, or key lyric..."
                    placeholderTextColor="#64748B"
                    maxLength={80}
                    value={standoutLine}
                    onChangeText={setStandoutLine}
                />

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
        marginBottom: 14,
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
    bridgeRow: {
        marginBottom: 16,
    },
    bridgeToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#151821',
        borderWidth: 1,
        borderColor: '#D4F458',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 14,
        gap: 8,
    },
    bridgeToggleBtnActive: {
        backgroundColor: '#D4F458',
        borderColor: '#D4F458',
    },
    bridgeToggleBtnText: {
        color: '#D4F458',
        fontSize: 13,
        fontWeight: '700',
    },
    bridgeToggleBtnTextActive: {
        color: '#0B0C10',
        fontWeight: '800',
    },
    bridgeBadgePinned: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#151821',
        borderWidth: 1,
        borderColor: 'rgba(212, 244, 88, 0.3)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 6,
    },
    bridgeBadgePinnedText: {
        color: '#D4F458',
        fontSize: 12,
        fontWeight: '600',
    },
    bridgeBadgeLocked: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#151821',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 6,
    },
    bridgeBadgeLockedText: {
        color: '#94A3B8',
        fontSize: 12,
    },
    inputLabel: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
    },
    contextPillRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
        paddingVertical: 2,
    },
    contextPill: {
        backgroundColor: '#1E2430',
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    contextPillActive: {
        borderColor: '#D4F458',
        backgroundColor: '#172027',
    },
    contextPillText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '600',
    },
    contextPillTextActive: {
        color: '#D4F458',
        fontWeight: '700',
    },
    labelWithCounterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    counterText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
    },
    standoutInput: {
        backgroundColor: '#151821',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 11,
        color: '#FFFFFF',
        fontSize: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: 16,
    },
    memoirTextArea: {
        backgroundColor: '#151821',
        borderRadius: 18,
        padding: 16,
        color: '#FFFFFF',
        fontSize: 15,
        minHeight: 120,
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