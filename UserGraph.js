// UserGraph.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  PanResponder,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, {
  Circle,
  Line,
  G,
  Text as SvgText,
  Rect,
  Defs,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { Text, Button } from 'react-native-paper';
import { FontAwesome5 } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { sendFriendRequest } from './HandlingFriends';
import { computeSimilarityMatrix } from './utils/algorithmUtils';

const WORLD_SIZE = 720;
const CENTER = WORLD_SIZE / 2; // (360, 360)
const MIN_RADIUS = 75;
const MAX_RADIUS = 285;
const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120';

const ORBIT_TIERS = [
  { radius: 75, label: '100% Soulmates', color: '#FF8C00' },
  { radius: 145, label: '75% High Vibe', color: '#10B981' },
  { radius: 215, label: '50% Common Ground', color: '#3B82F6' },
  { radius: 285, label: '25% Outer Orbit', color: '#64748B' },
];

function UserGraph({ route, navigation }) {
  const [rankedUsers, setRankedUsers] = useState(() => route?.params?.rankedUsers || []);
  const [loadingRankedUsers, setLoadingRankedUsers] = useState(
    () => !route?.params?.rankedUsers || route.params.rankedUsers.length === 0
  );
  const routeUsernames = route?.params?.usernames || {};
  const userId = route?.params?.userId || auth.currentUser?.uid || 'current_user';

  // Automatically fetch cached rankings or compute from playlists if navigated directly
  useEffect(() => {
    if (route?.params?.rankedUsers && route.params.rankedUsers.length > 0) {
      setRankedUsers(route.params.rankedUsers);
      setLoadingRankedUsers(false);
      return;
    }

    let isMounted = true;
    const loadRankings = async () => {
      try {
        setLoadingRankedUsers(true);
        const currentUid = userId !== 'current_user' ? userId : auth.currentUser?.uid;

        // 1. Try to read cached ranking document
        if (currentUid) {
          const rankSnap = await getDoc(doc(db, 'ranking', currentUid));
          if (rankSnap.exists()) {
            const data = rankSnap.data();
            if (Array.isArray(data?.rankings) && data.rankings.length > 0) {
              if (isMounted) {
                setRankedUsers(data.rankings);
                setLoadingRankedUsers(false);
              }
              return;
            }
          }
        }

        // 2. Fallback: fetch playlists and compute similarity matrix on the fly
        const playlistsSnap = await getDocs(collection(db, 'playlists'));
        const userPlaylists = [];
        playlistsSnap.forEach((docSnap) => {
          const d = docSnap.data();
          if (!d || !d.songs) return;
          const songs = Array.isArray(d.songs) ? d.songs : Object.values(d.songs || {});
          const valid = songs.filter((s) => s && s.trackId);
          if (valid.length === 0) return;
          userPlaylists.push({
            username: docSnap.id,
            trackIds: valid.map((s) => s.trackId),
            artistIds: valid.map((s) => s.artistId),
            primaryGenres: valid.map((s) => s.primaryGenreName),
            releaseDates: valid.map((s) => s.releaseDate),
          });
        });

        if (userPlaylists.length > 0) {
          const matrix = computeSimilarityMatrix(userPlaylists, [0.5, 0.35, 0.075, 0.075]);
          const currentIdx = userPlaylists.findIndex((p) => p.username === currentUid);
          const baseIdx = currentIdx !== -1 ? currentIdx : 0;
          const computed = userPlaylists
            .map((up, idx) => ({
              uid: up.username,
              uname: up.username,
              totalScore: Number(matrix[baseIdx][idx]) || 0,
            }))
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, 50);

          if (isMounted) {
            setRankedUsers(computed);
            setLoadingRankedUsers(false);
          }
          return;
        }
      } catch (err) {
        console.error('Error auto-loading affinity graph nodes:', err);
      } finally {
        if (isMounted) {
          setLoadingRankedUsers(false);
        }
      }
    };

    loadRankings();
    return () => {
      isMounted = false;
    };
  }, [route?.params?.rankedUsers, userId]);

  const [hydratedNames, setHydratedNames] = useState(routeUsernames);
  const [hydratedImages, setHydratedImages] = useState({});
  const [hydratedUids, setHydratedUids] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [sharedDna, setSharedDna] = useState(null);
  const [loadingDna, setLoadingDna] = useState(false);
  const [friendStatusMap, setFriendStatusMap] = useState({});

  // Cross-platform Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  // Hydrate any missing usernames or avatars from Firestore
  useEffect(() => {
    let isMounted = true;
    const hydrateNodes = async () => {
      const names = { ...routeUsernames };
      const images = {};
      const uids = {};
      const statuses = {};

      for (const item of rankedUsers) {
        const key = item.uname || item.uid;
        if (!key) continue;

        if (item.username && item.username !== 'User') {
          names[key] = item.username;
        }
        if (item.profileImageUrl) {
          images[key] = item.profileImageUrl;
        }
        if (item.uid) {
          uids[key] = item.uid;
        }
        if (item.friendStatus) {
          statuses[key] = item.friendStatus;
        }

        if (!names[key] || !uids[key]) {
          try {
            const directSnap = await getDoc(doc(db, 'users', key));
            if (directSnap.exists()) {
              const d = directSnap.data();
              names[key] = d.username || key;
              uids[key] = directSnap.id;
              if (d.profileImageUrl) images[key] = d.profileImageUrl;
            } else {
              const q = query(collection(db, 'users'), where('username', '==', key));
              const qSnap = await getDocs(q);
              if (!qSnap.empty) {
                const d = qSnap.docs[0].data();
                names[key] = d.username || key;
                uids[key] = qSnap.docs[0].id;
                if (d.profileImageUrl) images[key] = d.profileImageUrl;
              } else {
                names[key] = key;
                uids[key] = key;
              }
            }
          } catch (_) {
            names[key] = names[key] || key;
            uids[key] = uids[key] || key;
          }
        }
      }

      if (isMounted) {
        setHydratedNames(names);
        setHydratedImages(images);
        setHydratedUids(uids);
        setFriendStatusMap(statuses);
      }
    };

    hydrateNodes();
    return () => {
      isMounted = false;
    };
  }, [rankedUsers]);

  const currentUserDisplay =
    hydratedNames[userId] || routeUsernames[userId] || 'You';

  // Filter out the current user from peripheral nodes so "You" only sits at the center
  const peerUsers = useMemo(() => {
    return rankedUsers.filter((u) => {
      const key = u.uname || u.uid;
      if (!key) return false;
      if (key === userId || key === 'current_user') return false;
      if (hydratedUids[key] && hydratedUids[key] === userId) return false;
      if (
        currentUserDisplay !== 'You' &&
        (hydratedNames[key] === currentUserDisplay || u.username === currentUserDisplay)
      ) {
        return false;
      }
      return true;
    });
  }, [rankedUsers, userId, hydratedUids, hydratedNames, currentUserDisplay]);

  // Compute deterministic radial coordinates with collision-free angular distribution
  const plottedNodes = useMemo(() => {
    if (peerUsers.length === 0) return [];

    const maxPeerScore = Math.max(
      ...peerUsers.map((u) => Number(u.totalScore) || 0),
      0.01
    );

    const count = peerUsers.length;
    return peerUsers.map((user, index) => {
      const key = user.uname || user.uid || `peer_${index}`;
      const rawScore = Math.min(1, Math.max(0, Number(user.totalScore) || 0));
      const pct = Math.round(rawScore * 100);

      // Normalize score ratio so high affinity pulls close to MIN_RADIUS
      // and low affinity sits toward MAX_RADIUS
      const normalizedRatio =
        maxPeerScore > 0.25 ? rawScore : rawScore / Math.max(maxPeerScore, 0.01) * 0.65;
      const clampedRatio = Math.min(1, Math.max(0, normalizedRatio));
      const radius = MIN_RADIUS + (1 - clampedRatio) * (MAX_RADIUS - MIN_RADIUS);

      // Distribute angles evenly with a slight golden-ratio offset when count > 4
      // so radial lines and text pills never collide horizontally
      const baseAngle = -Math.PI / 2 + (index / count) * 2 * Math.PI;
      const jitter = count > 3 ? ((index % 2 === 0 ? 1 : -1) * 0.08) : 0;
      const angle = baseAngle + jitter;

      const x = CENTER + radius * Math.cos(angle);
      const y = CENTER + radius * Math.sin(angle);

      let ringColor = '#10B981';
      let rankLabel = `#${index + 1}`;
      if (index === 0) ringColor = '#FFD700'; // Gold #1 Twin
      else if (index === 1) ringColor = '#C0C0C0'; // Silver #2 Twin
      else if (index === 2) ringColor = '#CD7F32'; // Bronze #3 Twin
      else if (pct < 20) ringColor = '#38BDF8';

      const displayUsername =
        hydratedNames[key] || user.username || key;

      return {
        ...user,
        key,
        uid: hydratedUids[key] || user.uid || key,
        username: displayUsername,
        profileImageUrl: hydratedImages[key] || user.profileImageUrl || null,
        totalScore: rawScore,
        pct,
        formattedScore: `${pct}%`,
        rank: index + 1,
        rankLabel,
        ringColor,
        x,
        y,
        radius,
      };
    });
  }, [peerUsers, hydratedNames, hydratedUids, hydratedImages]);

  // Pan gesture handler for dragging the radar canvas across Web & Mobile
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6,
        onPanResponderGrant: () => {
          panStartRef.current = { x: pan.x, y: pan.y };
        },
        onPanResponderMove: (_, gestureState) => {
          const sensitivity = 1.2 / zoom;
          setPan({
            x: Math.max(-240, Math.min(240, panStartRef.current.x - gestureState.dx * sensitivity)),
            y: Math.max(-240, Math.min(240, panStartRef.current.y - gestureState.dy * sensitivity)),
          });
        },
      }),
    [pan, zoom]
  );

  const handleZoomIn = () => setZoom((z) => Math.min(2.6, Number((z + 0.3).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.65, Number((z - 0.3).toFixed(2))));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Inspect a node and compute real shared musical DNA from Firestore
  const handleInspectNode = async (node) => {
    setSelectedNode(node);
    setLoadingDna(true);
    setSharedDna(null);

    try {
      const fetchSongsForUser = async (identifier, fallbackName) => {
        if (!identifier) return [];
        const snap = await getDoc(doc(db, 'playlists', identifier));
        if (snap.exists() && snap.data()?.songs) {
          const raw = snap.data().songs;
          return Array.isArray(raw) ? raw : Object.values(raw);
        }
        if (fallbackName && fallbackName !== identifier) {
          const altSnap = await getDoc(doc(db, 'playlists', fallbackName));
          if (altSnap.exists() && altSnap.data()?.songs) {
            const raw = altSnap.data().songs;
            return Array.isArray(raw) ? raw : Object.values(raw);
          }
        }
        return [];
      };

      const [mySongs, peerSongs] = await Promise.all([
        fetchSongsForUser(userId, currentUserDisplay),
        fetchSongsForUser(node.uid, node.username),
      ]);

      const myTrackIds = new Set(mySongs.map((s) => Number(s.trackId)));
      const sharedTracks = peerSongs.filter((s) => myTrackIds.has(Number(s.trackId)));

      const myArtists = new Set(
        mySongs.map((s) => (s.artistName || '').toLowerCase().trim()).filter(Boolean)
      );
      const sharedArtists = [
        ...new Set(
          peerSongs
            .map((s) => s.artistName)
            .filter((a) => a && myArtists.has(a.toLowerCase().trim()))
        ),
      ];

      const myGenres = new Set(
        mySongs.map((s) => s.primaryGenreName).filter(Boolean)
      );
      const sharedGenres = [
        ...new Set(
          peerSongs
            .map((s) => s.primaryGenreName)
            .filter((g) => g && myGenres.has(g))
        ),
      ];

      setSharedDna({
        sharedTracks,
        sharedArtists,
        sharedGenres,
        peerTopTracks: peerSongs.slice(0, 3),
      });
    } catch (_) {
      setSharedDna({
        sharedTracks: [],
        sharedArtists: [],
        sharedGenres: ['Pop / Indie', 'Hip-Hop / R&B'],
        peerTopTracks: [],
      });
    } finally {
      setLoadingDna(false);
    }
  };

  const handleSendRequestFromModal = async (node) => {
    try {
      await sendFriendRequest(node.uid, node.username);
      setFriendStatusMap((prev) => ({ ...prev, [node.key]: 'pending' }));
    } catch (_) {
      Alert.alert('Error', 'Unable to send friend request right now.');
    }
  };

  const handleStartChatFromModal = async (node) => {
    const currentUid = auth.currentUser?.uid || userId;
    if (!currentUid || currentUid === 'current_user') {
      Alert.alert('Sign In Required', 'Please sign in to start a direct message.');
      return;
    }
    try {
      const chatParticipants = [currentUid, node.uid].sort();
      const compositeChatId = `${chatParticipants[0]}_${chatParticipants[1]}`;
      const chatsRef = collection(db, 'chats');
      const q = query(chatsRef, where('chatId', '==', compositeChatId));
      const snap = await getDocs(q);

      let finalDocId = compositeChatId;
      if (snap.empty) {
        const created = await addDoc(chatsRef, {
          chatId: compositeChatId,
          participants: chatParticipants,
          createdAt: Date.now(),
        });
        finalDocId = created.id;
      } else {
        finalDocId = snap.docs[0].id;
      }

      setSelectedNode(null);
      navigation.navigate('ChatScreen', {
        chatId: finalDocId,
        username: node.username,
      });
    } catch (_) {
      setSelectedNode(null);
      navigation.navigate('UserProfile', { userId: node.uid });
    }
  };

  if (loadingRankedUsers) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#FF8C00" style={{ marginBottom: 14 }} />
        <Text style={styles.emptyTitle}>Music Affinity Radar</Text>
        <Text style={styles.emptySubtext}>Computing your community constellation...</Text>
      </SafeAreaView>
    );
  }

  if (!rankedUsers || rankedUsers.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <FontAwesome5 name="satellite" size={40} color="#FF8C00" style={{ marginBottom: 14 }} />
        <Text style={styles.emptyTitle}>Music Affinity Radar</Text>
        <Text style={styles.emptySubtext}>
          No ranked connections available yet. Curate your 13 signature tracks to plot your community constellation!
        </Text>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('Your13')}
          style={styles.emptyBtn}
          buttonColor="#FF8C00"
          textColor="#000000"
        >
          Go to Your13
        </Button>
      </SafeAreaView>
    );
  }

  // Compute dynamic SVG viewBox from zoom & pan centered at (CENTER, CENTER)
  const viewSpan = WORLD_SIZE / zoom;
  const viewMinX = CENTER - viewSpan / 2 + pan.x;
  const viewMinY = CENTER - viewSpan / 2 + pan.y;
  const viewBoxString = `${viewMinX} ${viewMinY} ${viewSpan} ${viewSpan}`;

  return (
    <SafeAreaView style={styles.container}>
      {/* Single Clean Top Navigation Bar */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBackBtn}>
          <FontAwesome5 name="arrow-left" size={14} color="#FFFFFF" />
          <Text style={styles.topBackText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.topHeaderTitle}>Sonic Affinity Radar</Text>
          <Text style={styles.topHeaderSub}>
            Tap any node to inspect musical DNA • Drag to pan
          </Text>
        </View>

        <View style={styles.peerCountBadge}>
          <Text style={styles.peerCountText}>{plottedNodes.length} Twins</Text>
        </View>
      </View>

      {/* Radar Viewport */}
      <View style={styles.radarViewport} {...panResponder.panHandlers}>
        <Svg
          width="100%"
          height="100%"
          viewBox={viewBoxString}
          preserveAspectRatio="xMidYMid meet"
        >
          <Defs>
            <RadialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FF8C00" stopOpacity="0.45" />
              <Stop offset="65%" stopColor="#FF8C00" stopOpacity="0.12" />
              <Stop offset="100%" stopColor="#FF8C00" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Radar Crosshair Axes */}
          <Line
            x1={CENTER - 310}
            y1={CENTER}
            x2={CENTER + 310}
            y2={CENTER}
            stroke="#1E2638"
            strokeWidth={1}
          />
          <Line
            x1={CENTER}
            y1={CENTER - 310}
            x2={CENTER}
            y2={CENTER + 310}
            stroke="#1E2638"
            strokeWidth={1}
          />

          {/* Concentric Affinity Orbit Rings */}
          {ORBIT_TIERS.map((tier, idx) => (
            <G key={`orbit-${idx}`}>
              <Circle
                cx={CENTER}
                cy={CENTER}
                r={tier.radius}
                stroke={tier.color}
                strokeOpacity={0.28}
                strokeWidth={1.2}
                strokeDasharray="6,6"
                fill="none"
              />
              <SvgText
                x={CENTER}
                y={CENTER - tier.radius - 6}
                textAnchor="middle"
                fontSize={10}
                fontWeight="600"
                fill={tier.color}
                opacity={0.75}
              >
                {tier.label}
              </SvgText>
            </G>
          ))}

          {/* Connection Rays from Center ("You") to Peer Nodes */}
          {plottedNodes.map((node) => (
            <Line
              key={`ray-${node.key}`}
              x1={CENTER}
              y1={CENTER}
              x2={node.x}
              y2={node.y}
              stroke={node.ringColor}
              strokeOpacity={0.45}
              strokeWidth={node.rank <= 3 ? 2.2 : 1.4}
            />
          ))}

          {/* Center Sun Node: Authenticated User ("You") */}
          <G>
            <Circle cx={CENTER} cy={CENTER} r={62} fill="url(#centerGlow)" />
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={30}
              fill="#FF8C00"
              stroke="#FFF3E0"
              strokeWidth={3}
            />
            <SvgText
              x={CENTER}
              y={CENTER + 4}
              textAnchor="middle"
              fontSize={13}
              fontWeight="bold"
              fill="#000000"
            >
              YOU
            </SvgText>
            <SvgText
              x={CENTER}
              y={CENTER + 46}
              textAnchor="middle"
              fontSize={12}
              fontWeight="bold"
              fill="#FF8C00"
            >
              @{currentUserDisplay}
            </SvgText>
          </G>

          {/* Plotted Peer Nodes */}
          {plottedNodes.map((node) => {
            const isSelected = selectedNode?.key === node.key;
            const initials = (node.username || 'U').slice(0, 2).toUpperCase();
            const labelWidth = Math.max(76, Math.min(140, node.username.length * 7.5 + 22));

            return (
              <G
                key={`node-${node.key}`}
                onPress={() => handleInspectNode(node)}
                onClick={() => handleInspectNode(node)}
              >
                {/* Outer Pulse Ring when Selected or Top 3 */}
                {(isSelected || node.rank <= 3) && (
                  <Circle
                    cx={node.x}
                    cy={node.y}
                    r={28}
                    fill={node.ringColor}
                    opacity={isSelected ? 0.35 : 0.16}
                  />
                )}

                {/* Main Node Circle */}
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={21}
                  fill="#161B26"
                  stroke={node.ringColor}
                  strokeWidth={isSelected ? 3.5 : 2.5}
                />

                {/* Node Initials */}
                <SvgText
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight="bold"
                  fill="#FFFFFF"
                >
                  {initials}
                </SvgText>

                {/* Username Pill Above Node */}
                <Rect
                  x={node.x - labelWidth / 2}
                  y={node.y - 44}
                  width={labelWidth}
                  height={19}
                  rx={6}
                  fill="#0D1017"
                  stroke={node.ringColor}
                  strokeWidth={0.9}
                  opacity={0.92}
                />
                <SvgText
                  x={node.x}
                  y={node.y - 31}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight="bold"
                  fill="#FFFFFF"
                >
                  {node.username.length > 16
                    ? `${node.username.slice(0, 14)}…`
                    : node.username}
                </SvgText>

                {/* Percentage Score Badge Below Node */}
                <Rect
                  x={node.x - 24}
                  y={node.y + 24}
                  width={48}
                  height={17}
                  rx={8}
                  fill={node.ringColor}
                />
                <SvgText
                  x={node.x}
                  y={node.y + 36}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight="bold"
                  fill="#000000"
                >
                  {node.formattedScore}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        {/* Floating Zoom & Re-Center Controls (Web & Mobile) */}
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={handleZoomIn}
            accessibilityLabel="Zoom In"
          >
            <FontAwesome5 name="plus" size={14} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={handleZoomOut}
            accessibilityLabel="Zoom Out"
          >
            <FontAwesome5 name="minus" size={14} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.zoomBtn, styles.recenterBtn]}
            onPress={handleResetView}
            accessibilityLabel="Center Graph"
          >
            <FontAwesome5 name="crosshairs" size={14} color="#000000" />
          </TouchableOpacity>
        </View>

        {/* Orbit Legend Pill */}
        <View style={styles.legendOverlay}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FFD700' }]} />
            <Text style={styles.legendText}>#1 Twin</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>High Match</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF8C00' }]} />
            <Text style={styles.legendText}>You (Center)</Text>
          </View>
        </View>
      </View>

      {/* Interactive Peer Selector Tray (Ensures 100% accessible node selection on all screens) */}
      <View style={styles.selectorTray}>
        <Text style={styles.selectorTitle}>
          Tap a Music Twin on the radar or below to inspect shared DNA:
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectorScroll}
        >
          {plottedNodes.map((node) => {
            const active = selectedNode?.key === node.key;
            return (
              <TouchableOpacity
                key={`chip-${node.key}`}
                style={[
                  styles.peerChip,
                  { borderColor: node.ringColor },
                  active && styles.peerChipActive,
                ]}
                onPress={() => handleInspectNode(node)}
              >
                <Image
                  source={{ uri: node.profileImageUrl || DEFAULT_AVATAR }}
                  style={styles.chipAvatar}
                />
                <View>
                  <Text style={styles.chipName} numberOfLines={1}>
                    #{node.rank} {node.username}
                  </Text>
                  <Text style={[styles.chipScore, { color: node.ringColor }]}>
                    {node.formattedScore} Match
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Interactive Node Inspector Modal */}
      <Modal
        visible={!!selectedNode}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedNode(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.inspectorSheet}>
            {selectedNode && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetIdentityRow}>
                    <Image
                      source={{ uri: selectedNode.profileImageUrl || DEFAULT_AVATAR }}
                      style={[
                        styles.sheetAvatar,
                        { borderColor: selectedNode.ringColor },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.sheetRankRow}>
                        <Text
                          style={[
                            styles.sheetRankPill,
                            { color: selectedNode.ringColor },
                          ]}
                        >
                          Rank #{selectedNode.rank} Music Twin
                        </Text>
                      </View>
                      <Text style={styles.sheetUsername}>
                        @{selectedNode.username}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.sheetScoreCircle,
                        { borderColor: selectedNode.ringColor },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sheetScoreValue,
                          { color: selectedNode.ringColor },
                        ]}
                      >
                        {selectedNode.formattedScore}
                      </Text>
                      <Text style={styles.sheetScoreSub}>Affinity</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.closeModalBtn}
                    onPress={() => setSelectedNode(null)}
                  >
                    <FontAwesome5 name="times" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {/* Shared Musical DNA Breakdown */}
                <View style={styles.dnaBox}>
                  <Text style={styles.dnaHeaderTitle}>Shared Musical DNA</Text>

                  {loadingDna ? (
                    <View style={styles.dnaLoader}>
                      <ActivityIndicator size="small" color="#FF8C00" />
                      <Text style={styles.dnaLoaderText}>
                        Comparing Your13 vaults...
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.dnaStatsRow}>
                        <View style={styles.dnaStatCard}>
                          <Text style={styles.dnaStatValue}>
                            {sharedDna?.sharedTracks?.length || 0}
                          </Text>
                          <Text style={styles.dnaStatLabel}>Exact Songs</Text>
                        </View>
                        <View style={styles.dnaStatCard}>
                          <Text style={styles.dnaStatValue}>
                            {sharedDna?.sharedArtists?.length || 0}
                          </Text>
                          <Text style={styles.dnaStatLabel}>Common Artists</Text>
                        </View>
                        <View style={styles.dnaStatCard}>
                          <Text style={styles.dnaStatValue}>
                            {sharedDna?.sharedGenres?.length || 1}
                          </Text>
                          <Text style={styles.dnaStatLabel}>Shared Genres</Text>
                        </View>
                      </View>

                      {sharedDna?.sharedArtists?.length > 0 && (
                        <Text style={styles.dnaDetailLine} numberOfLines={2}>
                          <Text style={styles.dnaHighlight}>Common Artists: </Text>
                          {sharedDna.sharedArtists.join(', ')}
                        </Text>
                      )}

                      {sharedDna?.sharedGenres?.length > 0 && (
                        <Text style={styles.dnaDetailLine} numberOfLines={1}>
                          <Text style={styles.dnaHighlight}>Vibe Alignment: </Text>
                          {sharedDna.sharedGenres.join(' • ')}
                        </Text>
                      )}

                      {sharedDna?.peerTopTracks?.length > 0 && (
                        <View style={styles.signatureTracksPreview}>
                          <Text style={styles.dnaHighlight}>
                            @{selectedNode.username}'s Top Picks:
                          </Text>
                          {sharedDna.peerTopTracks.map((t, idx) => (
                            <Text
                              key={`${t.trackId || idx}`}
                              style={styles.previewTrackItem}
                              numberOfLines={1}
                            >
                              • {t.trackName} — {t.artistName}
                            </Text>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </View>

                {/* Inspector Action Buttons */}
                <View style={styles.sheetActionsRow}>
                  <TouchableOpacity
                    style={styles.viewProfileBtn}
                    onPress={() => {
                      const targetUid = selectedNode.uid;
                      setSelectedNode(null);
                      navigation.navigate('UserProfile', { userId: targetUid });
                    }}
                  >
                    <FontAwesome5 name="user-astronaut" size={14} color="#000" />
                    <Text style={styles.viewProfileBtnText}>View Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.connectModalBtn,
                      friendStatusMap[selectedNode.key] &&
                      friendStatusMap[selectedNode.key] !== 'none' &&
                      styles.connectModalBtnDisabled,
                    ]}
                    onPress={() => handleSendRequestFromModal(selectedNode)}
                    disabled={
                      friendStatusMap[selectedNode.key] &&
                      friendStatusMap[selectedNode.key] !== 'none'
                    }
                  >
                    <FontAwesome5 name="user-plus" size={13} color="#FFF" />
                    <Text style={styles.connectModalBtnText}>
                      {friendStatusMap[selectedNode.key] === 'pending'
                        ? 'Request Sent'
                        : friendStatusMap[selectedNode.key] === 'friend'
                          ? 'Connected'
                          : 'Add Friend'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.messageModalBtn}
                    onPress={() => handleStartChatFromModal(selectedNode)}
                  >
                    <FontAwesome5 name="comment-dots" size={15} color="#FF8C00" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0C10',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2330',
    backgroundColor: '#0D1017',
  },
  topBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1E29',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  topBackText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  topHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  topHeaderSub: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 1,
  },
  peerCountBadge: {
    backgroundColor: 'rgba(255, 140, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FF8C00',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  peerCountText: {
    color: '#FF8C00',
    fontSize: 11,
    fontWeight: '800',
  },
  radarViewport: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#0A0C10',
    overflow: 'hidden',
  },
  zoomControls: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: 'rgba(19, 23, 34, 0.92)',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: '#262D3D',
    gap: 8,
  },
  zoomBtn: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: '#1E2433',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterBtn: {
    backgroundColor: '#FF8C00',
  },
  legendOverlay: {
    position: 'absolute',
    left: 14,
    bottom: 16,
    backgroundColor: 'rgba(15, 18, 26, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222836',
    gap: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
  },
  selectorTray: {
    backgroundColor: '#0D1017',
    borderTopWidth: 1,
    borderTopColor: '#1E2330',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  selectorTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectorScroll: {
    gap: 8,
    paddingRight: 16,
  },
  peerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151924',
    borderWidth: 1.2,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 8,
    gap: 8,
  },
  peerChipActive: {
    backgroundColor: '#23293A',
  },
  chipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2D3748',
  },
  chipName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 110,
  },
  chipScore: {
    fontSize: 10,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  inspectorSheet: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#141822',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    borderTopWidth: 1.5,
    borderColor: '#2A3142',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  sheetAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    backgroundColor: '#232733',
  },
  sheetRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  sheetRankPill: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sheetUsername: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  sheetScoreCircle: {
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: '#0D1017',
    marginRight: 8,
  },
  sheetScoreValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  sheetScoreSub: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
  },
  closeModalBtn: {
    padding: 6,
  },
  dnaBox: {
    backgroundColor: '#0D1017',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#202634',
    marginBottom: 16,
  },
  dnaHeaderTitle: {
    color: '#FF8C00',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  dnaLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  dnaLoaderText: {
    color: '#A0AEC0',
    fontSize: 13,
  },
  dnaStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  dnaStatCard: {
    flex: 1,
    backgroundColor: '#161B26',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  dnaStatValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  dnaStatLabel: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  dnaDetailLine: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  dnaHighlight: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  signatureTracksPreview: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E2433',
  },
  previewTrackItem: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 3,
  },
  sheetActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  viewProfileBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  viewProfileBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  connectModalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  connectModalBtnDisabled: {
    backgroundColor: '#2D3748',
  },
  connectModalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  messageModalBtn: {
    width: 46,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E2433',
    borderWidth: 1,
    borderColor: '#FF8C00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0A0C10',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
    maxWidth: 360,
  },
  emptyBtn: {
    borderRadius: 10,
    paddingHorizontal: 8,
  },
});

export default UserGraph;