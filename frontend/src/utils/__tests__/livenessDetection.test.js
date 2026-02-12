/**
 * Tests para detectAction — en particular la acción 'open_mouth'
 * Verifica que el umbral de apertura de boca (MOUTH_OPEN_RATIO = 0.75) y
 * el mínimo de frames sostenidos (5) funcionen correctamente.
 */
import { detectAction, CONFIG } from '../livenessDetection';

// ── Helper: crea un detection mock con landmarks de boca configurables ──
function createDetection({
  mouthPoints = [],
  boxWidth = 200,
  boxHeight = 200,
  boxX = 100,
  boxY = 100,
  noseX = 200,
  noseY = 200,
  expressions = {},
} = {}) {
  // Mouth landmarks default: 20 puntos, los relevantes son [0],[3],[6],[9]
  const defaultMouth = Array.from({ length: 20 }, (_, i) => ({ x: 150 + i, y: 200 }));
  const mouth = mouthPoints.length ? mouthPoints : defaultMouth;

  // Eyes: 6 puntos por ojo
  const leftEye = Array.from({ length: 6 }, (_, i) => ({ x: 140 + i * 3, y: 180 + (i % 2 === 0 ? 0 : 5) }));
  const rightEye = Array.from({ length: 6 }, (_, i) => ({ x: 220 + i * 3, y: 180 + (i % 2 === 0 ? 0 : 5) }));

  return {
    detection: { box: { x: boxX, y: boxY, width: boxWidth, height: boxHeight } },
    landmarks: {
      getNose: () => [
        { x: noseX, y: noseY },
        { x: noseX, y: noseY },
        { x: noseX, y: noseY },
        { x: noseX, y: noseY }, // [3] es el que se usa
      ],
      getMouth: () => mouth,
      getLeftEye: () => leftEye,
      getRightEye: () => rightEye,
    },
    expressions,
  };
}

// Crea 20 puntos de boca donde [0],[6] definen el ancho y [3],[9] el alto
function createMouthPoints({ width, height }) {
  const points = Array.from({ length: 20 }, () => ({ x: 200, y: 200 }));
  // [0] y [6] definen extremos horizontales (ancho)
  points[0] = { x: 200 - width / 2, y: 200 };
  points[6] = { x: 200 + width / 2, y: 200 };
  // [3] y [9] definen extremos verticales (alto)
  points[3] = { x: 200, y: 200 - height / 2 };
  points[9] = { x: 200, y: 200 + height / 2 };
  return points;
}

function createState(overrides = {}) {
  return {
    stepFrames: 0,
    movementAccum: 0,
    nodState: { baseY: null, lastY: null, yAccum: 0, wentDown: false },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('detectAction — open_mouth', () => {
  test('CONFIG.MOUTH_OPEN_RATIO debe ser 0.75', () => {
    expect(CONFIG.MOUTH_OPEN_RATIO).toBe(0.75);
  });

  test('rechaza boca apenas abierta (ratio ~0.5, inferior al umbral 0.75)', () => {
    // Boca ancho=60, alto=30 → ratio = 30/60 = 0.5 < 0.75
    const mouth = createMouthPoints({ width: 60, height: 30 });
    const detection = createDetection({ mouthPoints: mouth });
    const state = createState({ stepFrames: 10 });

    expect(detectAction('open_mouth', detection, state)).toBe(false);
  });

  test('rechaza boca medianamente abierta (ratio ~0.6)', () => {
    // Boca ancho=50, alto=30 → ratio = 30/50 = 0.6 < 0.75
    const mouth = createMouthPoints({ width: 50, height: 30 });
    const detection = createDetection({ mouthPoints: mouth });
    const state = createState({ stepFrames: 10 });

    expect(detectAction('open_mouth', detection, state)).toBe(false);
  });

  test('rechaza boca con ratio justo en el umbral (ratio = 0.75 exacto, no mayor)', () => {
    // Boca ancho=40, alto=30 → ratio = 30/40 = 0.75, no es > 0.75
    const mouth = createMouthPoints({ width: 40, height: 30 });
    const detection = createDetection({ mouthPoints: mouth });
    const state = createState({ stepFrames: 10 });

    expect(detectAction('open_mouth', detection, state)).toBe(false);
  });

  test('acepta boca claramente abierta (ratio ~0.85) con suficientes frames', () => {
    // Boca ancho=40, alto=34 → ratio = 34/40 = 0.85 > 0.75
    const mouth = createMouthPoints({ width: 40, height: 34 });
    const detection = createDetection({ mouthPoints: mouth });
    const state = createState({ stepFrames: 6 });

    expect(detectAction('open_mouth', detection, state)).toBe(true);
  });

  test('acepta boca muy abierta (ratio ~1.0) con suficientes frames', () => {
    // Boca ancho=30, alto=30 → ratio = 30/30 = 1.0 > 0.75
    const mouth = createMouthPoints({ width: 30, height: 30 });
    const detection = createDetection({ mouthPoints: mouth });
    const state = createState({ stepFrames: 5 });

    expect(detectAction('open_mouth', detection, state)).toBe(true);
  });

  test('rechaza boca bien abierta pero con pocos frames (< 5)', () => {
    // Ratio alto pero solo 4 frames → no suficientes
    const mouth = createMouthPoints({ width: 30, height: 30 });
    const detection = createDetection({ mouthPoints: mouth });
    const state = createState({ stepFrames: 4 });

    expect(detectAction('open_mouth', detection, state)).toBe(false);
  });

  test('rechaza boca bien abierta con solo 1 frame', () => {
    const mouth = createMouthPoints({ width: 30, height: 30 });
    const detection = createDetection({ mouthPoints: mouth });
    const state = createState({ stepFrames: 1 });

    expect(detectAction('open_mouth', detection, state)).toBe(false);
  });

  test('rechaza boca bien abierta con 0 frames', () => {
    const mouth = createMouthPoints({ width: 30, height: 30 });
    const detection = createDetection({ mouthPoints: mouth });
    const state = createState({ stepFrames: 0 });

    expect(detectAction('open_mouth', detection, state)).toBe(false);
  });

  test('acepta boca exactamente a 5 frames (mínimo requerido)', () => {
    const mouth = createMouthPoints({ width: 30, height: 30 });
    const detection = createDetection({ mouthPoints: mouth });
    const state = createState({ stepFrames: 5 });

    expect(detectAction('open_mouth', detection, state)).toBe(true);
  });

  test('rechaza boca cerrada (ratio ~0) incluso con muchos frames', () => {
    // Boca ancho=60, alto=2 → ratio ≈ 0.03
    const mouth = createMouthPoints({ width: 60, height: 2 });
    const detection = createDetection({ mouthPoints: mouth });
    const state = createState({ stepFrames: 100 });

    expect(detectAction('open_mouth', detection, state)).toBe(false);
  });
});

describe('detectAction — otras acciones (regresión)', () => {
  test('smile detecta sonrisa amplia', () => {
    // mouthWidth / mouthHeight (grande) + happy expression
    const mouth = createMouthPoints({ width: 60, height: 10 });
    const detection = createDetection({
      mouthPoints: mouth,
      expressions: { happy: 0.9 },
    });
    const state = createState({ stepFrames: 5 });

    // smileScore = 0.9 + 60/10 = 6.9 > 2.2
    expect(detectAction('smile', detection, state)).toBe(true);
  });

  test('smile rechaza cara neutra', () => {
    const mouth = createMouthPoints({ width: 30, height: 25 });
    const detection = createDetection({
      mouthPoints: mouth,
      expressions: { happy: 0.1 },
    });
    const state = createState({ stepFrames: 5 });

    // smileScore = 0.1 + 30/25 = 1.3 < 2.2
    expect(detectAction('smile', detection, state)).toBe(false);
  });

  test('acción desconocida retorna false', () => {
    const detection = createDetection();
    const state = createState({ stepFrames: 10 });

    expect(detectAction('unknown_action', detection, state)).toBe(false);
  });
});

describe('generateRandomSequence', () => {
  const { generateRandomSequence } = require('../livenessDetection');

  test('genera la cantidad correcta de acciones', () => {
    const seq = generateRandomSequence(3);
    expect(seq).toHaveLength(3);
  });

  test('cada acción tiene key, label e icon', () => {
    const seq = generateRandomSequence(3);
    seq.forEach((action) => {
      expect(action).toHaveProperty('key');
      expect(action).toHaveProperty('label');
      expect(action).toHaveProperty('icon');
    });
  });

  test('no repite acciones en la misma secuencia', () => {
    const seq = generateRandomSequence(4);
    const keys = seq.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('todas las acciones pertenecen al ACTION_POOL', () => {
    const { ACTION_POOL } = require('../livenessDetection');
    const validKeys = ACTION_POOL.map((a) => a.key);
    const seq = generateRandomSequence(3);
    seq.forEach((action) => {
      expect(validKeys).toContain(action.key);
    });
  });
});
