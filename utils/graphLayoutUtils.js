// utils/graphLayoutUtils.js — math guards for affinity graph and SVG coordinates [BUG-002]

export function computeRadialPosition({ score, index = 0, total = 1, width = 360, height = 360 }) {
  const cx = Number.isFinite(width) && width > 0 ? width / 2 : 180;
  const cy = Number.isFinite(height) && height > 0 ? height / 2 : 180;

  if (!Number.isFinite(score) || !total || total <= 0) {
    return { x: cx, y: cy };
  }

  const safeTotal = Number.isFinite(total) && total > 0 ? total : 1;
  const clampedScore = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;

  const maxRadius = Math.max(20, Math.min(cx, cy) - 40);
  // Higher compatibility -> closer to user center
  const distance = ((100 - clampedScore) / 100) * maxRadius;
  const angle = (2 * Math.PI * (Number.isFinite(index) ? index : 0)) / safeTotal;

  const x = cx + distance * Math.cos(angle);
  const y = cy + distance * Math.sin(angle);

  return {
    x: Number.isFinite(x) ? x : cx,
    y: Number.isFinite(y) ? y : cy,
  };
}

export function sanitizeGraphLayout(nodes = [], links = [], width = 360, height = 360) {
  const cx = Number.isFinite(width) && width > 0 ? width / 2 : 180;
  const cy = Number.isFinite(height) && height > 0 ? height / 2 : 180;

  const safeNodes = (Array.isArray(nodes) ? nodes : []).map((node, idx, arr) => {
    const rawScore = Number.isFinite(node?.compatibility)
      ? node.compatibility
      : (Number.isFinite(node?.totalScore)
        ? node.totalScore * 100
        : (Number.isFinite(node?.score) ? node.score * 100 : 0));

    const fallback = computeRadialPosition({
      score: rawScore,
      index: idx,
      total: arr.length || 1,
      width,
      height,
    });

    return {
      ...node,
      x: Number.isFinite(node?.x) ? node.x : fallback.x,
      y: Number.isFinite(node?.y) ? node.y : fallback.y,
      radius: Number.isFinite(node?.radius) && node.radius > 0 ? node.radius : 18,
    };
  });

  const nodeMap = new Map(safeNodes.map((n) => [n.id || n.key, n]));
  const safeLinks = (Array.isArray(links) ? links : []).map((link) => {
    const src = typeof link?.source === 'object' ? link.source : nodeMap.get(link?.source);
    const tgt = typeof link?.target === 'object' ? link.target : nodeMap.get(link?.target);
    return {
      ...link,
      x1: Number.isFinite(src?.x) ? src.x : (Number.isFinite(link?.x1) ? link.x1 : cx),
      y1: Number.isFinite(src?.y) ? src.y : (Number.isFinite(link?.y1) ? link.y1 : cy),
      x2: Number.isFinite(tgt?.x) ? tgt.x : (Number.isFinite(link?.x2) ? link.x2 : cx),
      y2: Number.isFinite(tgt?.y) ? tgt.y : (Number.isFinite(link?.y2) ? link.y2 : cy),
    };
  });

  return { nodes: safeNodes, links: safeLinks };
}
