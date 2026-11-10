// components/SimilarityFinderWidget.js
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    View,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Image,
    TextInput,
    Modal,
    FlatList,
    ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Audio } from 'expo-av';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import {
    PRECOMPUTED_SONG_CATALOG,
    fetchMLCatalog,
    fetchFAISSTop10,
    embedTrackViaMLService,
    calculateSimilarity,
    hydrateTrackForSimilarity,
} from './similarityEngine';
import { createDebouncedSearch, getHighResImage } from '../services/musicApi';
import Taskbar from '../Taskbar';

const LANGUAGE_LABELS = {
    en: 'EN • English',
    fr: 'FR • Français',
    es: 'ES • Español',
    yo: 'YO/EN • Afro-Pidgin',
    pt: 'PT • Português',
};

export default function SimilarityFinderWidget({ navigation, isEmbedded = false }) {
    const [activeTab, setActiveTab] = useState('top10'); // 'top10' | 'calculator'
    const [catalog, setCatalog] = useState(PRECOMPUTED_SONG_CATALOG);
    const [catalogSource, setCatalogSource] = useState('bundled_ml_artifact');
    const [top10Results, setTop10Results] = useState([]);
    const [loadingTop10, setLoadingTop10] = useState(false);
    const [embeddingLiveTrack, setEmbeddingLiveTrack] = useState(false);

    // Tab 1: Seed Track
    const [seedSong, setSeedSong] = useState(() => PRECOMPUTED_SONG_CATALOG[0] || {});

    // Tab 2: Calculator Pair
    const [songA, setSongA] = useState(() => PRECOMPUTED_SONG_CATALOG[0] || {});
    const [songB, setSongB] = useState(() => PRECOMPUTED_SONG_CATALOG[1] || PRECOMPUTED_SONG_CATALOG[0] || {});

    // Modal Picker State
    const [pickerTarget, setPickerTarget] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [liveSearchResults, setLiveSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Audio Preview State
    const soundRef = useRef(null);
    const [playingTrackId, setPlayingTrackId] = useState(null);

    const stopAudio = useCallback(async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
            } catch (_) { }
            try {
                await soundRef.current.unloadAsync();
            } catch (_) { }
            soundRef.current = null;
        }
        setPlayingTrackId(null);
    }, []);

    useEffect(() => {
        return () => {
            stopAudio();
        };
    }, [stopAudio]);

    // 1. Load the 194-track ML catalog from FastAPI on mount
    useEffect(() => {
        let isMounted = true;
        fetchMLCatalog().then(({ tracks, source }) => {
            if (!isMounted || !tracks || tracks.length === 0) return;
            setCatalog(tracks);
            setCatalogSource(source);
            setSeedSong((prev) => (prev?.trackId ? prev : tracks[0]));
            setSongA((prev) => (prev?.trackId ? prev : tracks[0]));
            setSongB((prev) => (prev?.trackId ? prev : tracks[1] || tracks[0]));
        });
        return () => {
            isMounted = false;
        };
    }, []);

    // 2. Query FAISS /top10 whenever seedSong or catalog updates
    useEffect(() => {
        if (!seedSong?.trackId) return;
        let isMounted = true;
        setLoadingTop10(true);

        fetchFAISSTop10(seedSong, catalog)
            .then((results) => {
                if (isMounted) setTop10Results(results);
            })
            .finally(() => {
                if (isMounted) setLoadingTop10(false);
            });

        return () => {
            isMounted = false;
        };
    }, [seedSong, catalog]);

    const debouncedSearch = useMemo(
        () =>
            createDebouncedSearch((results) => {
                setIsSearching(false);
                setLiveSearchResults(results.map(hydrateTrackForSimilarity));
            }, 380),
        []
    );

    useEffect(() => {
        return () => {
            if (debouncedSearch.cancel) debouncedSearch.cancel();
        };
    }, [debouncedSearch]);

    const handleSearchInput = (text) => {
        setSearchQuery(text);
        if (text.trim().length >= 2) {
            setIsSearching(true);
            debouncedSearch(text.trim(), { limit: 15 });
        } else {
            setLiveSearchResults([]);
            setIsSearching(false);
        }
    };

    const handleTogglePreview = async (track) => {
        if (!track?.previewUrl) return;
        try {
            if (playingTrackId === track.trackId) {
                await stopAudio();
                return;
            }
            await stopAudio();
            const { sound } = await Audio.Sound.createAsync(
                { uri: track.previewUrl },
                { shouldPlay: true },
                (status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        setPlayingTrackId(null);
                    }
                }
            );
            soundRef.current = sound;
            setPlayingTrackId(track.trackId);
        } catch (_) {
            setPlayingTrackId(null);
        }
    };

    const comparisonResult = useMemo(
        () => calculateSimilarity(songA, songB),
        [songA, songB]
    );

    // 3. When selecting a track (especially from live iTunes), run real 68-D + 384-D extraction via /embed
    const handleSelectTrackFromModal = async (selectedTrack) => {
        const target = pickerTarget;
        setEmbeddingLiveTrack(true);

        try {
            const embeddedTrack = await embedTrackViaMLService(selectedTrack);

            setCatalog((prev) => {
                const existingIdx = prev.findIndex((item) => item.trackId === embeddedTrack.trackId);
                if (existingIdx !== -1) {
                    const updated = [...prev];
                    updated[existingIdx] = embeddedTrack;
                    return updated;
                }
                return [embeddedTrack, ...prev];
            });

            if (target === 'seed') setSeedSong(embeddedTrack);
            else if (target === 'songA') setSongA(embeddedTrack);
            else if (target === 'songB') setSongB(embeddedTrack);
        } finally {
            setEmbeddingLiveTrack(false);
            setPickerTarget(null);
            setSearchQuery('');
            setLiveSearchResults([]);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 78) return '#10B981';
        if (score >= 52) return '#FF8C00';
        if (score >= 30) return '#3B82F6';
        return '#94A3B8';
    };

    const renderTrackSelectorCard = (label, track, targetKey) => {
        const isVerifiedML =
            Array.isArray(track?.audioEmbedding) && track.audioEmbedding.length === 68;

        return (
            <TouchableOpacity
                style={styles.selectorCard}
                activeOpacity={0.85}
                onPress={() => setPickerTarget(targetKey)}
            >
                <View style={styles.selectorHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.selectorRoleLabel}>{label}</Text>
                        <View
                            style={[
                                styles.vectorBadge,
                                { backgroundColor: isVerifiedML ? 'rgba(16, 185, 129, 0.16)' : '#222836' },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.vectorBadgeText,
                                    { color: isVerifiedML ? '#10B981' : '#94A3B8' },
                                ]}
                            >
                                {isVerifiedML ? '68-D + 384-D ML' : 'Metadata Mode'}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.changePill}>
                        <FontAwesome5 name="exchange-alt" size={10} color="#FF8C00" />
                        <Text style={styles.changePillText}>Change Track</Text>
                    </View>
                </View>

                <View style={styles.selectorTrackRow}>
                    <Image
                        source={{ uri: getHighResImage(track.artworkUrl100) }}
                        style={styles.selectorCover}
                    />
                    <View style={styles.selectorMeta}>
                        <Text style={styles.selectorTitle} numberOfLines={1}>
                            {track.trackName}
                        </Text>
                        <Text style={styles.selectorArtist} numberOfLines={1}>
                            {track.artistName}
                        </Text>
                        <View style={styles.tagRow}>
                            <View style={styles.miniTag}>
                                <Text style={styles.miniTagText}>{track.primaryGenreName}</Text>
                            </View>
                            <View style={styles.miniTag}>
                                <Text style={styles.miniTagText}>{track.releaseYear}</Text>
                            </View>
                            <View style={styles.miniTag}>
                                <Text style={styles.miniTagText}>
                                    {(track.language || 'en').toUpperCase()}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderProgressBar = (label, iconName, percentage, color, subtitle) => (
        <View style={styles.dimensionBlock}>
            <View style={styles.dimensionHeader}>
                <View style={styles.dimensionTitleRow}>
                    <FontAwesome5 name={iconName} size={13} color={color} />
                    <Text style={styles.dimensionLabel}>{label}</Text>
                </View>
                <Text style={[styles.dimensionValue, { color }]}>{percentage}%</Text>
            </View>
            <View style={styles.barTrack}>
                <View
                    style={[
                        styles.barFill,
                        {
                            width: `${Math.min(100, Math.max(0, percentage))}%`,
                            backgroundColor: color,
                        },
                    ]}
                />
            </View>
            {subtitle ? <Text style={styles.dimensionSub}>{subtitle}</Text> : null}
        </View>
    );

    const Wrapper = isEmbedded ? View : SafeAreaView;

    return (
        <Wrapper style={styles.container}>
            {!isEmbedded && (
                <View style={styles.topHeader}>
                    <TouchableOpacity
                        onPress={() => navigation?.goBack()}
                        style={styles.backBtn}
                    >
                        <FontAwesome5 name="arrow-left" size={14} color="#FFFFFF" />
                        <Text style={styles.backBtnText}>Back</Text>
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>Similarity Finder</Text>
                        <Text style={styles.headerSubtitle}>
                            {catalogSource === 'live_fastapi_faiss'
                                ? `🟢 FAISS Live • ${catalog.length} Tracks (68-D + 384-D)`
                                : `⚡ ${catalog.length} Indexed ML Tracks (68-D + 384-D)`}
                        </Text>
                    </View>
                    <View style={{ width: 64 }} />
                </View>
            )}

            <View style={styles.tabSwitchContainer}>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'top10' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('top10')}
                >
                    <MaterialCommunityIcons
                        name="playlist-star"
                        size={18}
                        color={activeTab === 'top10' ? '#000000' : '#94A3B8'}
                    />
                    <Text
                        style={[
                            styles.tabBtnText,
                            activeTab === 'top10' && styles.tabBtnTextActive,
                        ]}
                    >
                        10 Similar Tracks
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tabBtn,
                        activeTab === 'calculator' && styles.tabBtnActive,
                    ]}
                    onPress={() => setActiveTab('calculator')}
                >
                    <MaterialCommunityIcons
                        name="scale-balance"
                        size={17}
                        color={activeTab === 'calculator' ? '#000000' : '#94A3B8'}
                    />
                    <Text
                        style={[
                            styles.tabBtnText,
                            activeTab === 'calculator' && styles.tabBtnTextActive,
                        ]}
                    >
                        Similarity Calculator
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {activeTab === 'top10' ? (
                    <View style={styles.sectionWrapper}>
                        {renderTrackSelectorCard('SEED TRACK', seedSong, 'seed')}

                        <View style={styles.resultsHeaderRow}>
                            <Text style={styles.resultsSectionTitle}>
                                Top 10 Most Similar Songs
                            </Text>
                            <Text style={styles.resultsCountBadge}>
                                FAISS 68-D Audio + 384-D Lyric Index
                            </Text>
                        </View>

                        {loadingTop10 ? (
                            <ActivityIndicator
                                size="large"
                                color="#FF8C00"
                                style={{ marginVertical: 24 }}
                            />
                        ) : (
                            top10Results.map((item, idx) => {
                                const badgeColor = getScoreColor(item.similarity);
                                const isPlaying = playingTrackId === item.trackId;

                                return (
                                    <TouchableOpacity
                                        key={`${item.trackId}-${idx}`}
                                        style={styles.similarCard}
                                        activeOpacity={0.88}
                                        onPress={() => {
                                            setSongA(seedSong);
                                            setSongB(item);
                                            setActiveTab('calculator');
                                        }}
                                    >
                                        <View style={styles.rankNumberBox}>
                                            <Text style={styles.rankNumberText}>#{idx + 1}</Text>
                                        </View>

                                        <Image
                                            source={{ uri: getHighResImage(item.artworkUrl100) }}
                                            style={styles.similarCover}
                                        />

                                        <View style={styles.similarInfo}>
                                            <Text style={styles.similarTitle} numberOfLines={1}>
                                                {item.trackName}
                                            </Text>
                                            <Text style={styles.similarArtist} numberOfLines={1}>
                                                {item.artistName} • {item.releaseYear}
                                            </Text>

                                            <View style={styles.tagRow}>
                                                {(item.genreTags || [item.primaryGenreName])
                                                    .slice(0, 2)
                                                    .map((tag, tIdx) => (
                                                        <View key={tIdx} style={styles.miniTag}>
                                                            <Text style={styles.miniTagText}>{tag}</Text>
                                                        </View>
                                                    ))}
                                                <View style={[styles.miniTag, styles.langTag]}>
                                                    <Text style={styles.langTagText}>
                                                        {(item.language || 'en').toUpperCase()}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.microBreakdownRow}>
                                                <Text style={styles.microBreakdownText}>
                                                    Audio {item.breakdown.audioScore}% • Lyrics{' '}
                                                    {item.breakdown.lyricScore}% • Meta{' '}
                                                    {item.breakdown.metaScore}%
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.similarRightCol}>
                                            <View
                                                style={[
                                                    styles.matchBadge,
                                                    { borderColor: badgeColor },
                                                ]}
                                            >
                                                <Text
                                                    style={[styles.matchBadgeText, { color: badgeColor }]}
                                                >
                                                    {item.similarity}%
                                                </Text>
                                                <Text style={styles.matchBadgeSub}>Match</Text>
                                            </View>

                                            {item.previewUrl ? (
                                                <TouchableOpacity
                                                    style={styles.inlinePlayBtn}
                                                    onPress={() => handleTogglePreview(item)}
                                                >
                                                    <FontAwesome5
                                                        name={isPlaying ? 'stop' : 'play'}
                                                        size={10}
                                                        color="#FF8C00"
                                                    />
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>
                ) : (
                    <View style={styles.sectionWrapper}>
                        {renderTrackSelectorCard('SONG A (BASELINE)', songA, 'songA')}

                        <View style={styles.vsDividerRow}>
                            <View style={styles.vsLine} />
                            <TouchableOpacity
                                style={styles.swapCircleBtn}
                                onPress={() => {
                                    const temp = songA;
                                    setSongA(songB);
                                    setSongB(temp);
                                }}
                            >
                                <FontAwesome5 name="exchange-alt" size={13} color="#000000" />
                            </TouchableOpacity>
                            <View style={styles.vsLine} />
                        </View>

                        {renderTrackSelectorCard('SONG B (COMPARISON)', songB, 'songB')}

                        <View style={styles.scoreHeroCard}>
                            <Text style={styles.scoreHeroLabel}>
                                COMPOSITE 68-D AUDIO & 384-D LYRIC MATCH
                            </Text>
                            <View
                                style={[
                                    styles.scoreCircle,
                                    { borderColor: getScoreColor(comparisonResult.overallScore) },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.scoreHeroNumber,
                                        { color: getScoreColor(comparisonResult.overallScore) },
                                    ]}
                                >
                                    {comparisonResult.overallScore}%
                                </Text>
                                <Text style={styles.scoreHeroVerdict}>
                                    {comparisonResult.overallScore >= 80
                                        ? 'Sonic Twins'
                                        : comparisonResult.overallScore >= 55
                                            ? 'Strong Vibe Alignment'
                                            : comparisonResult.overallScore >= 30
                                                ? 'Partial Crossover'
                                                : 'Contrasting Worlds'}
                                </Text>
                            </View>

                            <View style={styles.dimensionsContainer}>
                                {renderProgressBar(
                                    'Librosa 68-D Audio Vector (45% Weight)',
                                    'wave-square',
                                    comparisonResult.audioScore,
                                    '#FF8C00',
                                    '40 MFCCs, 12 Chroma CQT, 6 Tonnetz, 7 Spectral Contrast, Centroid, ZCR & Tempo'
                                )}
                                {renderProgressBar(
                                    'ONNX 384-D Lyric & Context Vector (30% Weight)',
                                    'quote-left',
                                    comparisonResult.lyricScore,
                                    '#10B981',
                                    'paraphrase-multilingual-MiniLM-L12-v2 embedding on LRCLIB lyrics & cultural cues'
                                )}
                                {renderProgressBar(
                                    'Metadata & Era Proximity (25% Weight)',
                                    'tags',
                                    comparisonResult.metaScore,
                                    '#3B82F6',
                                    'Genre taxonomy, artist link, release year decay & ISO language'
                                )}
                            </View>

                            <View style={styles.subMetricsGrid}>
                                <View style={styles.subMetricPill}>
                                    <Text style={styles.subMetricValue}>
                                        {comparisonResult.details.genreScore}%
                                    </Text>
                                    <Text style={styles.subMetricLabel}>Genre Match</Text>
                                </View>
                                <View style={styles.subMetricPill}>
                                    <Text style={styles.subMetricValue}>
                                        {comparisonResult.details.artistScore}%
                                    </Text>
                                    <Text style={styles.subMetricLabel}>Artist Proximity</Text>
                                </View>
                                <View style={styles.subMetricPill}>
                                    <Text style={styles.subMetricValue}>
                                        {comparisonResult.details.yearScore}%
                                    </Text>
                                    <Text style={styles.subMetricLabel}>
                                        Era ({Math.abs((songA.releaseYear || 2020) - (songB.releaseYear || 2020))}y gap)
                                    </Text>
                                </View>
                                <View style={styles.subMetricPill}>
                                    <Text style={styles.subMetricValue}>
                                        {comparisonResult.details.languageScore}%
                                    </Text>
                                    <Text style={styles.subMetricLabel}>
                                        Lang ({(songA.language || 'en').toUpperCase()}/{(songB.language || 'en').toUpperCase()})
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Track Selector Modal (194-Track ML Catalog + Live iTunes On-the-Fly Embedding) */}
            <Modal
                visible={!!pickerTarget}
                transparent
                animationType="slide"
                onRequestClose={() => setPickerTarget(null)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Select Track ({catalog.length} ML Indexed)
                            </Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setPickerTarget(null);
                                    setSearchQuery('');
                                    setLiveSearchResults([]);
                                }}
                            >
                                <FontAwesome5 name="times" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalSearchBox}>
                            <FontAwesome5
                                name="search"
                                size={14}
                                color="#FF8C00"
                                style={{ marginRight: 10 }}
                            />
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder={`Filter ${catalog.length} ML tracks or search iTunes live...`}
                                placeholderTextColor="#718096"
                                value={searchQuery}
                                onChangeText={handleSearchInput}
                            />
                        </View>

                        {embeddingLiveTrack && (
                            <View style={styles.embeddingBanner}>
                                <ActivityIndicator size="small" color="#000000" />
                                <Text style={styles.embeddingBannerText}>
                                    Extracting 68-D Librosa Audio & 384-D ONNX Lyric Embeddings...
                                </Text>
                            </View>
                        )}

                        {isSearching && (
                            <ActivityIndicator
                                size="small"
                                color="#FF8C00"
                                style={{ marginVertical: 8 }}
                            />
                        )}

                        <FlatList
                            data={
                                (() => {
                                    const localMatches = catalog.filter((t) =>
                                        `${t.trackName} ${t.artistName} ${t.primaryGenreName}`
                                            .toLowerCase()
                                            .includes(searchQuery.toLowerCase())
                                    );
                                    if (liveSearchResults.length === 0) return localMatches;
                                    const seenIds = new Set(localMatches.map((m) => m.trackId));
                                    return [
                                        ...localMatches,
                                        ...liveSearchResults.filter((r) => !seenIds.has(r.trackId)),
                                    ];
                                })()
                            }
                            keyExtractor={(item, index) => `${item.trackId}-${index}`}
                            renderItem={({ item }) => {
                                const hasMLVectors =
                                    Array.isArray(item.audioEmbedding) &&
                                    item.audioEmbedding.length === 68;

                                return (
                                    <TouchableOpacity
                                        style={styles.modalTrackItem}
                                        disabled={embeddingLiveTrack}
                                        onPress={() => handleSelectTrackFromModal(item)}
                                    >
                                        <Image
                                            source={{ uri: getHighResImage(item.artworkUrl100) }}
                                            style={styles.modalTrackCover}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.modalTrackName} numberOfLines={1}>
                                                {item.trackName}
                                            </Text>
                                            <Text style={styles.modalTrackSub} numberOfLines={1}>
                                                {item.artistName} • {item.primaryGenreName} •{' '}
                                                {item.releaseYear} (
                                                {LANGUAGE_LABELS[item.language] || item.language})
                                            </Text>
                                        </View>
                                        <View
                                            style={[
                                                styles.modalSourceBadge,
                                                {
                                                    backgroundColor: hasMLVectors
                                                        ? 'rgba(16, 185, 129, 0.16)'
                                                        : 'rgba(255, 140, 0, 0.16)',
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 10,
                                                    fontWeight: '800',
                                                    color: hasMLVectors ? '#10B981' : '#FF8C00',
                                                }}
                                            >
                                                {hasMLVectors ? 'INDEXED' : 'LIVE EMBED'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {!isEmbedded && <Taskbar navigation={navigation} />}
        </Wrapper>
    );
}

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
        borderBottomColor: '#1E2330',
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1E29',
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 10,
        gap: 6,
    },
    backBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    headerCenter: {
        alignItems: 'center',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 19,
        fontWeight: '800',
    },
    headerSubtitle: {
        color: '#10B981',
        fontSize: 11,
        fontWeight: '700',
        marginTop: 2,
    },
    tabSwitchContainer: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 8,
        backgroundColor: '#161922',
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: '#242936',
        maxWidth: 500,
        alignSelf: 'center',
        width: '92%',
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 9,
        gap: 6,
    },
    tabBtnActive: {
        backgroundColor: '#FF8C00',
    },
    tabBtnText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '700',
    },
    tabBtnTextActive: {
        color: '#000000',
        fontWeight: '800',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 90,
        alignItems: 'center',
    },
    sectionWrapper: {
        width: '100%',
        maxWidth: 500,
    },
    selectorCard: {
        backgroundColor: '#161922',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1.5,
        borderColor: '#2A3142',
        marginTop: 6,
    },
    selectorHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    selectorRoleLabel: {
        color: '#FF8C00',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.7,
    },
    vectorBadge: {
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 6,
    },
    vectorBadgeText: {
        fontSize: 9,
        fontWeight: '800',
    },
    changePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 140, 0, 0.14)',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 8,
        gap: 5,
    },
    changePillText: {
        color: '#FF8C00',
        fontSize: 11,
        fontWeight: '700',
    },
    selectorTrackRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectorCover: {
        width: 62,
        height: 62,
        borderRadius: 10,
        marginRight: 12,
        backgroundColor: '#232733',
    },
    selectorMeta: {
        flex: 1,
    },
    selectorTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    selectorArtist: {
        color: '#CBD5E1',
        fontSize: 13,
        marginTop: 2,
        marginBottom: 6,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    miniTag: {
        backgroundColor: '#222836',
        paddingVertical: 2,
        paddingHorizontal: 7,
        borderRadius: 6,
    },
    miniTagText: {
        color: '#CBD5E1',
        fontSize: 10,
        fontWeight: '600',
    },
    langTag: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
    },
    langTagText: {
        color: '#60A5FA',
        fontSize: 10,
        fontWeight: '800',
    },
    resultsHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 18,
        marginBottom: 10,
    },
    resultsSectionTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    resultsCountBadge: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '600',
    },
    similarCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#161922',
        borderRadius: 13,
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#242936',
    },
    rankNumberBox: {
        width: 28,
        alignItems: 'center',
        marginRight: 6,
    },
    rankNumberText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '800',
    },
    similarCover: {
        width: 56,
        height: 56,
        borderRadius: 8,
        marginRight: 10,
        backgroundColor: '#232733',
    },
    similarInfo: {
        flex: 1,
        marginRight: 8,
    },
    similarTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    similarArtist: {
        color: '#94A3B8',
        fontSize: 12,
        marginBottom: 4,
    },
    microBreakdownRow: {
        marginTop: 5,
    },
    microBreakdownText: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '600',
    },
    similarRightCol: {
        alignItems: 'center',
        gap: 6,
    },
    matchBadge: {
        borderWidth: 1.5,
        borderRadius: 10,
        paddingVertical: 4,
        paddingHorizontal: 8,
        alignItems: 'center',
        backgroundColor: '#0D1017',
        minWidth: 54,
    },
    matchBadgeText: {
        fontSize: 14,
        fontWeight: '900',
    },
    matchBadgeSub: {
        color: '#94A3B8',
        fontSize: 9,
        fontWeight: '600',
    },
    inlinePlayBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#1F2430',
        borderWidth: 1,
        borderColor: '#FF8C00',
        alignItems: 'center',
        justifyContent: 'center',
    },
    vsDividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 10,
    },
    vsLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#242936',
    },
    swapCircleBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#FF8C00',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 12,
    },
    scoreHeroCard: {
        backgroundColor: '#161922',
        borderRadius: 16,
        padding: 18,
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#262D3D',
        alignItems: 'center',
    },
    scoreHeroLabel: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 12,
    },
    scoreCircle: {
        width: 132,
        height: 132,
        borderRadius: 66,
        borderWidth: 4,
        backgroundColor: '#0D1017',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },
    scoreHeroNumber: {
        fontSize: 34,
        fontWeight: '900',
    },
    scoreHeroVerdict: {
        color: '#CBD5E1',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
        textAlign: 'center',
        paddingHorizontal: 8,
    },
    dimensionsContainer: {
        width: '100%',
        gap: 14,
        marginBottom: 16,
    },
    dimensionBlock: {
        width: '100%',
    },
    dimensionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    dimensionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    dimensionLabel: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    dimensionValue: {
        fontSize: 14,
        fontWeight: '800',
    },
    barTrack: {
        width: '100%',
        height: 8,
        backgroundColor: '#0D1017',
        borderRadius: 4,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        borderRadius: 4,
    },
    dimensionSub: {
        color: '#718096',
        fontSize: 11,
        marginTop: 4,
    },
    subMetricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        width: '100%',
        gap: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#222836',
    },
    subMetricPill: {
        width: '48%',
        backgroundColor: '#0D1017',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#202634',
    },
    subMetricValue: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    subMetricLabel: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 2,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    modalSheet: {
        width: '100%',
        maxWidth: 500,
        height: '80%',
        backgroundColor: '#141822',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        borderTopWidth: 1.5,
        borderColor: '#2A3142',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
    },
    modalSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0D1017',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: '#242936',
        marginBottom: 12,
    },
    modalSearchInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 14,
    },
    embeddingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF8C00',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 10,
        gap: 8,
    },
    embeddingBannerText: {
        color: '#000000',
        fontSize: 12,
        fontWeight: '800',
    },
    modalTrackItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1E2433',
    },
    modalTrackCover: {
        width: 48,
        height: 48,
        borderRadius: 8,
        marginRight: 12,
    },
    modalTrackName: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    modalTrackSub: {
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 2,
    },
    modalSourceBadge: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        marginLeft: 8,
    },
});