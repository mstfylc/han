// HAN — Multi-han indoor floor corridor blueprints & Manhattan walking route solver.

export interface FloorCorridorBlueprint {
  placeId: string;
  corridorY: number[];
  connectorX: number[];
  isCourtyard?: boolean;
}

export interface CorridorPoint {
  x: number;
  y: number;
}

export interface CorridorRouteResult {
  points: string;
  meters: number;
  steps: number;
  mid: CorridorPoint;
}

export const DEFAULT_CORRIDOR_Y: number[] = [115, 205, 295];
export const DEFAULT_CONNECTOR_X: number[] = [112, 450, 788];

export const FLOOR_BLUEPRINTS: Record<string, FloorCorridorBlueprint> = {
  santral: {
    placeId: "santral",
    corridorY: [115, 205, 295],
    connectorX: [112, 450, 788],
  },
  sark: {
    placeId: "sark",
    corridorY: [115, 205, 295],
    connectorX: [112, 450, 788],
  },
  dogubank: {
    placeId: "dogubank",
    corridorY: [115, 205, 295],
    connectorX: [112, 450, 788],
  },
  buyukyeni: {
    placeId: "buyukyeni",
    corridorY: [125, 205, 285],
    connectorX: [112, 450, 788],
    isCourtyard: true,
  },
  kurkcu: {
    placeId: "kurkcu",
    corridorY: [125, 205, 285],
    connectorX: [112, 450, 788],
    isCourtyard: true,
  },
  kalcilar: {
    placeId: "kalcilar",
    corridorY: [125, 205, 285],
    connectorX: [112, 450, 788],
    isCourtyard: true,
  },
  zincirli: {
    placeId: "zincirli",
    corridorY: [125, 205, 285],
    connectorX: [112, 450, 788],
    isCourtyard: true,
  },
  cukur: {
    placeId: "cukur",
    corridorY: [125, 205, 285],
    connectorX: [112, 450, 788],
    isCourtyard: true,
  },
};

export function getFloorBlueprint(placeId?: string): FloorCorridorBlueprint {
  if (placeId && FLOOR_BLUEPRINTS[placeId]) {
    return FLOOR_BLUEPRINTS[placeId];
  }
  return {
    placeId: placeId || "default",
    corridorY: DEFAULT_CORRIDOR_Y,
    connectorX: DEFAULT_CONNECTOR_X,
  };
}

function nearestValue(target: number, candidates: number[]): number {
  let best = candidates[0];
  let bestDist = Math.abs(target - best);
  for (let i = 1; i < candidates.length; i++) {
    const d = Math.abs(target - candidates[i]);
    if (d < bestDist) {
      bestDist = d;
      best = candidates[i];
    }
  }
  return best;
}

/**
 * Computes an orthogonal Manhattan corridor walking polyline between two points
 * on a han floor SVG (900x385 coordinate space), snapping onto horizontal
 * corridor axes and vertical staircase/gallery connectors.
 */
export function computeCorridorPolyline(
  start: CorridorPoint,
  target: CorridorPoint,
  blueprint?: FloorCorridorBlueprint,
): CorridorRouteResult {
  const corridorY = blueprint?.corridorY?.length ? blueprint.corridorY : DEFAULT_CORRIDOR_Y;
  const connectorX = blueprint?.connectorX?.length ? blueprint.connectorX : DEFAULT_CONNECTOR_X;

  const startCorrY = nearestValue(start.y, corridorY);
  const targetCorrY = nearestValue(target.y, corridorY);

  const rawPts: CorridorPoint[] = [
    { x: start.x, y: start.y },
    { x: start.x, y: startCorrY },
  ];

  if (startCorrY === targetCorrY) {
    rawPts.push({ x: target.x, y: targetCorrY });
  } else {
    let bestConnX = connectorX[0];
    let bestCost = Math.abs(start.x - bestConnX) + Math.abs(target.x - bestConnX);
    for (let i = 1; i < connectorX.length; i++) {
      const cx = connectorX[i];
      const cost = Math.abs(start.x - cx) + Math.abs(target.x - cx);
      if (cost < bestCost) {
        bestCost = cost;
        bestConnX = cx;
      }
    }
    rawPts.push({ x: bestConnX, y: startCorrY });
    rawPts.push({ x: bestConnX, y: targetCorrY });
    rawPts.push({ x: target.x, y: targetCorrY });
  }

  rawPts.push({ x: target.x, y: target.y });

  // Deduplicate adjacent identical coordinates
  const pts: CorridorPoint[] = [];
  for (const pt of rawPts) {
    const prev = pts[pts.length - 1];
    if (!prev || Math.abs(prev.x - pt.x) >= 0.5 || Math.abs(prev.y - pt.y) >= 0.5) {
      pts.push(pt);
    }
  }

  let pixelDist = 0;
  const segLens: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segLens.push(len);
    pixelDist += len;
  }

  // Locate geometric midpoint along the polyline
  const halfDist = pixelDist / 2;
  let acc = 0;
  let mid: CorridorPoint = {
    x: (start.x + target.x) / 2,
    y: targetCorrY,
  };
  for (let i = 0; i < segLens.length; i++) {
    const len = segLens[i];
    if (acc + len >= halfDist && len > 0) {
      const ratio = (halfDist - acc) / len;
      mid = {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * ratio,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * ratio,
      };
      break;
    }
    acc += len;
  }

  const meters = Math.max(5, Math.round(pixelDist * 0.08));
  const steps = Math.round(meters * 1.35);
  const points = pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");

  return {
    points,
    meters,
    steps,
    mid: { x: Math.round(mid.x), y: Math.round(mid.y) },
  };
}
