// GraphVisualization.js
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { computeSimilarityMatrix } from './Algo';

const GraphVisualization = ({ playlists = [] }) => {
  const { nodes, links } = useMemo(() => {
    if (!Array.isArray(playlists) || playlists.length === 0) {
      return { nodes: [], links: [] };
    }

    const weights = [0.5, 0.35, 0.075, 0.075];
    const matrix = computeSimilarityMatrix(playlists, weights);
    const center = 200;

    const computedNodes = playlists.map((playlist, idx) => {
      if (idx === 0) {
        return {
          id: playlist.uid || playlist.username || '0',
          label: playlist.username || 'Center',
          x: center,
          y: center,
          isCenter: true,
        };
      }
      const score = matrix[0]?.[idx] || 0;
      const radius = 50 + (1 - score) * 120;
      const angle = (idx / Math.max(1, playlists.length - 1)) * 2 * Math.PI;
      return {
        id: playlist.uid || playlist.username || String(idx),
        label: playlist.username || `User ${idx}`,
        score,
        x: center + radius * Math.cos(angle),
        y: center + radius * Math.sin(angle),
        isCenter: false,
      };
    });

    const computedLinks = computedNodes.slice(1).map((n) => ({
      x1: center,
      y1: center,
      x2: n.x,
      y2: n.y,
    }));

    return { nodes: computedNodes, links: computedLinks };
  }, [playlists]);

  return (
    <View style={styles.container}>
      <Svg width="100%" height="100%" viewBox="0 0 400 400">
        {links.map((l, i) => (
          <Line
            key={`l-${i}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="#4A5568"
            strokeWidth={1.2}
          />
        ))}
        {nodes.map((n) => (
          <React.Fragment key={n.id}>
            <Circle
              cx={n.x}
              cy={n.y}
              r={n.isCenter ? 22 : 16}
              fill={n.isCenter ? '#FF8C00' : '#10B981'}
            />
            <SvgText
              x={n.x}
              y={n.y - (n.isCenter ? 28 : 22)}
              textAnchor="middle"
              fontSize={11}
              fill="#FFFFFF"
            >
              {n.label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0C10',
  },
});

export default GraphVisualization;