/**
 * Módulo de Liveness Detection Mejorado
 * 
 * Implementa detección anti-spoofing con:
 * 1. Secuencia aleatoria de acciones (no predecible)
 * 2. Análisis de textura anti-pantalla (detecta moiré/píxeles de pantalla)
 * 3. Detección de micro-movimientos naturales (personas reales tienen micro-temblores)
 * 4. Detección de pulso (rPPG temporal - cambios de color por sangre entre frames)
 * 5. Análisis de artefactos de deepfake en bordes faciales
 * 6. Verificación de consistencia de reflejos oculares via píxeles
 */
import * as faceapi from 'face-api.js';

// ── Pool completo de acciones disponibles ──────────────────────────────
const ACTION_POOL = [
  { key: 'turn_right', label: 'Gira la cabeza a la derecha', icon: '👉' },
  { key: 'turn_left', label: 'Gira la cabeza a la izquierda', icon: '👈' },
  { key: 'smile', label: 'Sonríe ampliamente', icon: '😁' },
  { key: 'nod', label: 'Asiente con la cabeza (sí)', icon: '🔽' },
  { key: 'open_mouth', label: 'Abre la boca', icon: '😮' },
  { key: 'raise_eyebrows', label: 'Levanta las cejas con sorpresa', icon: '😲' },
];

// ── Configuración ──────────────────────────────────────────────────────
const CONFIG = {
  TIMEOUT_MS: 35000,            // 35s para completar la secuencia (más tiempo por más verificaciones)
  POLL_INTERVAL_MS: 140,        // Intervalo entre detecciones
  ACTIONS_COUNT: 3,             // Cuántas acciones pedir por sesión
  MIN_STEP_FRAMES: 3,           // Frames mínimos para validar una acción

  // Umbrales de detección facial
  YAW_THRESHOLD: 0.06,          // Desplazamiento nariz para giro
  MOVEMENT_THRESHOLD: 0.10,     // Movimiento acumulado para giro
  SMILE_THRESHOLD: 2.2,         // Score combinado para sonrisa
  MOUTH_OPEN_RATIO: 0.75,       // Ratio alto/ancho boca para "abrir boca" (más exigente)
  SURPRISE_THRESHOLD: 0.55,     // Probabilidad expresión "surprised"
  NOD_Y_THRESHOLD: 0.04,        // Desplazamiento vertical mínimo de nariz para asentir
  NOD_MOVEMENT_THRESHOLD: 0.08,  // Movimiento vertical acumulado para asentir

  // Anti-spoofing
  TEXTURE_VARIANCE_MIN: 8,      // Varianza mínima de textura (pantallas tienen menos)
  MICRO_MOVEMENT_MIN: 0.5,      // Movimiento mínimo entre frames
  MICRO_MOVEMENT_FRAMES: 8,     // Frames para evaluar micro-movimientos

  // Anti-deepfake (rPPG temporal)
  RPPG_MIN_FRAMES: 15,          // Frames mínimos para análisis rPPG
  RPPG_PULSE_VARIANCE_MIN: 0.3, // Varianza mínima en señal de pulso

  // Sistema de scoring anti-spoofing
  // Cada check fallido suma puntos. Si el total >= SPOOF_BLOCK_THRESHOLD, se bloquea.
  SPOOF_BLOCK_THRESHOLD: 4,     // Puntos necesarios para bloquear (ej: 2 checks de peso 2)
  SPOOF_WEIGHT_TEXTURE: 5,      // Textura es el más confiable (pantalla = bloqueo inmediato)
  SPOOF_WEIGHT_ARTIFACTS: 2,    // Artefactos en bordes
  SPOOF_WEIGHT_MICRO_MOV: 1,    // Micro-movimientos (poco confiable solo)
  SPOOF_WEIGHT_RPPG: 2,         // Pulso sanguíneo
  SPOOF_WEIGHT_EYE_REFLECT: 2,  // Reflejos oculares
  SPOOF_WEIGHT_DEVICE: 4,       // Dispositivo/teléfono detectado (muy confiable)
};

// ── Selección aleatoria de acciones ────────────────────────────────────
export function generateRandomSequence(count = CONFIG.ACTIONS_COUNT) {
  const shuffled = [...ACTION_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ── Análisis de textura anti-pantalla ──────────────────────────────────
/**
 * Analiza la varianza de textura del video para detectar pantallas.
 * Las pantallas tienen patrones de píxeles regulares (moiré) y menor varianza.
 */
export function analyzeTexture(videoElement) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const width = videoElement.videoWidth || 320;
    const height = videoElement.videoHeight || 240;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(videoElement, 0, 0, width, height);

    // Tomar región central (donde está la cara)
    const regionSize = Math.min(width, height) * 0.3;
    const startX = Math.floor((width - regionSize) / 2);
    const startY = Math.floor((height - regionSize) / 2);
    const imageData = ctx.getImageData(startX, startY, regionSize, regionSize);
    const pixels = imageData.data;

    // Calcular varianza de luminancia en bloques pequeños
    const blockSize = 4;
    const variances = [];
    
    for (let y = 0; y < regionSize - blockSize; y += blockSize) {
      for (let x = 0; x < regionSize - blockSize; x += blockSize) {
        const block = [];
        for (let by = 0; by < blockSize; by++) {
          for (let bx = 0; bx < blockSize; bx++) {
            const idx = ((y + by) * regionSize + (x + bx)) * 4;
            const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
            block.push(lum);
          }
        }
        const mean = block.reduce((a, b) => a + b, 0) / block.length;
        const variance = block.reduce((a, b) => a + (b - mean) ** 2, 0) / block.length;
        variances.push(variance);
      }
    }

    if (variances.length === 0) return { isReal: true, variance: 999 };

    const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
    const varianceOfVariances = variances.reduce((a, b) => a + (b - avgVariance) ** 2, 0) / variances.length;
    const coefficientOfVariation = Math.sqrt(varianceOfVariances) / (avgVariance || 1);

    // Piel real: varianza alta + distribución irregular
    // Pantalla: varianza baja + distribución regular
    const isReal = avgVariance > CONFIG.TEXTURE_VARIANCE_MIN || coefficientOfVariation > 0.8;

    return {
      isReal,
      variance: avgVariance.toFixed(2),
      regularity: coefficientOfVariation.toFixed(3),
    };
  } catch (err) {
    console.warn('Error en análisis de textura:', err);
    return { isReal: true, variance: 999 };
  }
}

// ── Captura de señal RGB para rPPG (un frame) ─────────────────────────
/**
 * Captura el promedio RGB de la región de la mejilla en un frame.
 * Se debe llamar en cada frame para acumular datos temporales.
 */
function captureRGBSignal(videoElement) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const width = videoElement.videoWidth || 320;
    const height = videoElement.videoHeight || 240;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(videoElement, 0, 0, width, height);

    // Región de mejilla izquierda (buena señal de pulso)
    const regionX = Math.floor(width * 0.25);
    const regionY = Math.floor(height * 0.45);
    const regionW = Math.floor(width * 0.15);
    const regionH = Math.floor(height * 0.12);
    const imageData = ctx.getImageData(regionX, regionY, regionW, regionH);
    const pixels = imageData.data;

    let rSum = 0, gSum = 0, bSum = 0;
    const pixelCount = pixels.length / 4;

    for (let i = 0; i < pixels.length; i += 4) {
      rSum += pixels[i];
      gSum += pixels[i + 1];
      bSum += pixels[i + 2];
    }

    return {
      r: rSum / pixelCount,
      g: gSum / pixelCount,
      b: bSum / pixelCount,
      t: Date.now(),
    };
  } catch (err) {
    return null;
  }
}

// ── Análisis temporal rPPG (pulso real) ────────────────────────────────
/**
 * Analiza CAMBIOS TEMPORALES de color en la piel para detectar pulso.
 * Necesita al menos 15 frames (≈2 segundos) de datos.
 * Las personas reales tienen variación periódica por el corazón.
 * Los deepfakes y fotos NO tienen esta variación fisiológica.
 */
export function analyzeBloodPulse(rgbHistory) {
  if (rgbHistory.length < CONFIG.RPPG_MIN_FRAMES) {
    return { isReal: true, pulse: 'insufficient_data' };
  }

  // Extraer canal verde (más sensible al pulso sanguíneo)
  const greenChannel = rgbHistory.map(f => f.g);

  // Calcular diferencias entre frames consecutivos (primera derivada)
  const diffs = [];
  for (let i = 1; i < greenChannel.length; i++) {
    diffs.push(Math.abs(greenChannel[i] - greenChannel[i - 1]));
  }

  // Estadísticas de variación temporal
  const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const varianceDiff = diffs.reduce((a, b) => a + (b - meanDiff) ** 2, 0) / diffs.length;
  const stdDiff = Math.sqrt(varianceDiff);

  // Detectar si hay variación periódica (indicador de pulso)
  // Personas reales: stdDiff > 0.3 (hay fluctuación)
  // Fotos/deepfakes: stdDiff ≈ 0 (sin fluctuación) o muy uniforme
  const hasVariation = stdDiff > CONFIG.RPPG_PULSE_VARIANCE_MIN;

  // Verificar que no sea ruido uniforme (pantallas tienen ruido constante)
  // Personas reales tienen picos y valles (pulso)
  let crossings = 0;
  for (let i = 1; i < diffs.length; i++) {
    if ((diffs[i] > meanDiff && diffs[i - 1] <= meanDiff) ||
        (diffs[i] <= meanDiff && diffs[i - 1] > meanDiff)) {
      crossings++;
    }
  }
  // El pulso genera ~1-2 cruces por segundo (60-120 BPM)
  const timeSpan = (rgbHistory[rgbHistory.length - 1].t - rgbHistory[0].t) / 1000;
  const crossingsPerSecond = crossings / (timeSpan || 1);
  const hasNaturalRhythm = crossingsPerSecond > 0.5 && crossingsPerSecond < 8;

  const isReal = hasVariation && hasNaturalRhythm;

  return {
    isReal,
    pulse: isReal ? 'detected' : 'not_detected',
    stdDiff: stdDiff.toFixed(3),
    crossingsPerSec: crossingsPerSecond.toFixed(1),
  };
}

// ── Detección de artefactos de deepfake en bordes ────────────────────
/**
 * Los deepfakes tienen artefactos visibles en los bordes de la cara.
 * Analiza la transición cara-fondo buscando discontinuidades.
 */
export function detectDeepfakeArtifacts(videoElement, detection) {
  try {
    if (!detection?.detection?.box) return { isReal: true, riskLevel: 'unknown' };

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const width = videoElement.videoWidth || 320;
    const height = videoElement.videoHeight || 240;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(videoElement, 0, 0, width, height);

    const box = detection.detection.box;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Analizar SOLO el borde de la cara (donde los deepfakes fallan)
    const margin = 3; // Píxeles alrededor del borde de la cara
    let borderTransitions = [];

    // Borde superior e inferior de la cara
    for (let x = Math.max(0, Math.floor(box.x)); x < Math.min(width, Math.floor(box.x + box.width)); x += 2) {
      for (const edgeY of [Math.floor(box.y), Math.floor(box.y + box.height)]) {
        if (edgeY < margin || edgeY >= height - margin) continue;

        // Comparar píxel interior vs exterior
        const innerIdx = (edgeY * width + x) * 4;
        const outerIdx = ((edgeY + (edgeY === Math.floor(box.y) ? -margin : margin)) * width + x) * 4;

        if (innerIdx >= 0 && innerIdx < data.length - 3 && outerIdx >= 0 && outerIdx < data.length - 3) {
          const diff = Math.abs(data[innerIdx] - data[outerIdx]) +
                       Math.abs(data[innerIdx + 1] - data[outerIdx + 1]) +
                       Math.abs(data[innerIdx + 2] - data[outerIdx + 2]);
          borderTransitions.push(diff);
        }
      }
    }

    if (borderTransitions.length < 10) return { isReal: true, riskLevel: 'unknown' };

    // Deepfakes: transiciones MUY bruscas y uniformes en el borde
    const mean = borderTransitions.reduce((a, b) => a + b, 0) / borderTransitions.length;
    const variance = borderTransitions.reduce((a, b) => a + (b - mean) ** 2, 0) / borderTransitions.length;
    const std = Math.sqrt(variance);

    // Cara real: transiciones graduales y variadas (std alto)
    // Deepfake: transiciones uniformemente bruscas (std bajo, mean alto)
    const isReal = std > 15 || mean < 80;

    return {
      isReal,
      riskLevel: isReal ? 'low' : 'high',
      borderStd: std.toFixed(1),
      borderMean: mean.toFixed(1),
    };
  } catch (err) {
    console.warn('Error en detección de artefactos:', err);
    return { isReal: true, riskLevel: 'unknown' };
  }
}

// ── Detección de consistencia de reflejos oculares via píxeles ────────
/**
 * Los ojos reales tienen reflejos especulares (puntos brillantes) consistentes.
 * Analiza los PÍXELES reales de la zona ocular, no solo landmarks.
 */
export function detectEyeReflections(videoElement, detection) {
  try {
    if (!detection?.landmarks) return { isReal: true, consistency: 'unknown' };

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const width = videoElement.videoWidth || 320;
    const height = videoElement.videoHeight || 240;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(videoElement, 0, 0, width, height);

    const leftEye = detection.landmarks.getLeftEye();
    const rightEye = detection.landmarks.getRightEye();

    // Función para obtener brillo máximo en la región del ojo
    const getEyeBrightness = (eyePoints) => {
      const xs = eyePoints.map(p => p.x);
      const ys = eyePoints.map(p => p.y);
      const minX = Math.max(0, Math.floor(Math.min(...xs)) - 2);
      const maxX = Math.min(width, Math.ceil(Math.max(...xs)) + 2);
      const minY = Math.max(0, Math.floor(Math.min(...ys)) - 2);
      const maxY = Math.min(height, Math.ceil(Math.max(...ys)) + 2);

      const eyeData = ctx.getImageData(minX, minY, maxX - minX, maxY - minY);
      const pixels = eyeData.data;

      let maxBrightness = 0;
      let brightPixels = 0;
      const brightnessValues = [];

      for (let i = 0; i < pixels.length; i += 4) {
        const brightness = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        brightnessValues.push(brightness);
        if (brightness > maxBrightness) maxBrightness = brightness;
        if (brightness > 200) brightPixels++; // Píxeles muy brillantes = reflejo
      }

      const totalPixels = brightnessValues.length || 1;
      const avgBrightness = brightnessValues.reduce((a, b) => a + b, 0) / totalPixels;

      return {
        max: maxBrightness,
        avg: avgBrightness,
        reflectionRatio: brightPixels / totalPixels, // Proporción de píxeles reflejo
      };
    };

    const leftBrightness = getEyeBrightness(leftEye);
    const rightBrightness = getEyeBrightness(rightEye);

    // Ojos reales: reflejos similares en ambos ojos (misma fuente de luz)
    const maxDiff = Math.abs(leftBrightness.max - rightBrightness.max);
    const reflectionDiff = Math.abs(leftBrightness.reflectionRatio - rightBrightness.reflectionRatio);

    // Deepfakes: reflejos inconsistentes entre ojos
    const isConsistent = maxDiff < 80 && reflectionDiff < 0.15;

    // También verificar que HAY reflejos (una foto plana no los tiene)
    const hasReflections = leftBrightness.reflectionRatio > 0.01 || rightBrightness.reflectionRatio > 0.01;

    return {
      isReal: isConsistent,
      hasReflections,
      consistency: isConsistent ? 'consistent' : 'anomalous',
      maxDiff: maxDiff.toFixed(0),
    };
  } catch (err) {
    console.warn('Error en detección de reflejos:', err);
    return { isReal: true, consistency: 'unknown' };
  }
}

// ── Análisis de micro-movimientos ──────────────────────────────────────
/**
 * Las personas reales tienen micro-temblores involuntarios.
 * Una foto o video reproducido es demasiado estable o demasiado uniforme.
 */
export function analyzeMicroMovements(nosePositions) {
  if (nosePositions.length < CONFIG.MICRO_MOVEMENT_FRAMES) {
    return { isReal: true, movement: 999 };
  }

  const recent = nosePositions.slice(-CONFIG.MICRO_MOVEMENT_FRAMES);
  let totalMovement = 0;

  for (let i = 1; i < recent.length; i++) {
    const dx = recent[i].x - recent[i - 1].x;
    const dy = recent[i].y - recent[i - 1].y;
    totalMovement += Math.sqrt(dx * dx + dy * dy);
  }

  const avgMovement = totalMovement / (recent.length - 1);
  const isReal = avgMovement > CONFIG.MICRO_MOVEMENT_MIN;

  return {
    isReal,
    movement: avgMovement.toFixed(3),
  };
}

// ── Detección de dispositivo/teléfono frente a la cámara ────────────────
/**
 * Detecta si alguien está mostrando un teléfono/tablet frente a la cámara.
 * Analiza:
 * 1. Bordes rectangulares oscuros alrededor de la cara (bisel del dispositivo)
 * 2. Regiones de color piel en los bordes del frame (dedos sosteniendo el teléfono)
 * 3. Proporción cara vs frame (en un teléfono, la cara ocupa menos % del área visible)
 * 4. Uniformidad del fondo alrededor de la cara (pantallas tienen fondos uniformes)
 * 5. Líneas rectas rectangulares (bordes físicos del dispositivo)
 */
export function detectDevicePresentation(videoElement, detection) {
  try {
    if (!detection?.detection?.box) return { isDevice: false, confidence: 0 };

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = videoElement.videoWidth || 320;
    const height = videoElement.videoHeight || 240;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(videoElement, 0, 0, width, height);

    const box = detection.detection.box;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let score = 0;
    const details = {};

    // ── CHECK 1: Bisel rectangular oscuro alrededor de la cara ──
    const margin = 25;
    const darkThreshold = 50;
    let darkBorderPixels = 0;
    let totalBorderPixels = 0;

    // Franja superior
    for (let y = Math.max(0, Math.floor(box.y) - margin); y < Math.floor(box.y) && y < height; y++) {
      for (let x = Math.floor(box.x); x < Math.floor(box.x + box.width) && x < width; x++) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        totalBorderPixels++;
        if (lum < darkThreshold) darkBorderPixels++;
      }
    }
    // Franja inferior
    for (let y = Math.floor(box.y + box.height); y < Math.min(height, Math.floor(box.y + box.height) + margin); y++) {
      for (let x = Math.floor(box.x); x < Math.floor(box.x + box.width) && x < width; x++) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        totalBorderPixels++;
        if (lum < darkThreshold) darkBorderPixels++;
      }
    }
    // Franjas laterales
    for (let y = Math.floor(box.y); y < Math.floor(box.y + box.height) && y < height; y++) {
      for (let x = Math.max(0, Math.floor(box.x) - margin); x < Math.floor(box.x) && x < width; x++) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        totalBorderPixels++;
        if (lum < darkThreshold) darkBorderPixels++;
      }
      for (let x = Math.floor(box.x + box.width); x < Math.min(width, Math.floor(box.x + box.width) + margin); x++) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        totalBorderPixels++;
        if (lum < darkThreshold) darkBorderPixels++;
      }
    }

    const darkRatio = totalBorderPixels > 0 ? darkBorderPixels / totalBorderPixels : 0;
    details.darkBezelRatio = darkRatio.toFixed(3);
    if (darkRatio > 0.40) score += 30;
    else if (darkRatio > 0.25) score += 15;

    // ── CHECK 2: Dedos/piel en los bordes del frame ──
    const skinEdgeWidth = 30;
    let skinPixels = 0;
    let edgePixels = 0;

    const isSkinColor = (r, g, b) => {
      return r > 60 && g > 40 && b > 20 &&
             r > g && r > b &&
             (r - g) > 15 &&
             Math.abs(r - g) < 130 &&
             r < 255 && g < 230 && b < 200;
    };

    // Borde izquierdo
    for (let y = 0; y < height; y += 3) {
      for (let x = 0; x < skinEdgeWidth && x < width; x += 3) {
        const idx = (y * width + x) * 4;
        edgePixels++;
        if (isSkinColor(data[idx], data[idx + 1], data[idx + 2])) skinPixels++;
      }
    }
    // Borde derecho
    for (let y = 0; y < height; y += 3) {
      for (let x = width - skinEdgeWidth; x < width; x += 3) {
        const idx = (y * width + x) * 4;
        edgePixels++;
        if (isSkinColor(data[idx], data[idx + 1], data[idx + 2])) skinPixels++;
      }
    }
    // Borde inferior
    for (let y = height - skinEdgeWidth; y < height; y += 3) {
      for (let x = 0; x < width; x += 3) {
        const idx = (y * width + x) * 4;
        edgePixels++;
        if (isSkinColor(data[idx], data[idx + 1], data[idx + 2])) skinPixels++;
      }
    }

    const skinRatio = edgePixels > 0 ? skinPixels / edgePixels : 0;
    details.fingerSkinRatio = skinRatio.toFixed(3);
    if (skinRatio > 0.12) score += 25;
    else if (skinRatio > 0.06) score += 10;

    // ── CHECK 3: Proporción cara/frame ──
    const faceArea = box.width * box.height;
    const frameArea = width * height;
    const faceRatio = faceArea / frameArea;
    details.faceToFrameRatio = faceRatio.toFixed(3);
    if (faceRatio < 0.05) score += 20;
    else if (faceRatio < 0.08) score += 10;

    // ── CHECK 4: Uniformidad del fondo ──
    const bgSamples = [];
    const bgMargin = 40;

    for (let x = 0; x < width; x += 8) {
      const y = Math.max(0, Math.floor(box.y) - bgMargin);
      if (y < height) {
        const idx = (y * width + x) * 4;
        bgSamples.push(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
      }
    }
    for (let y = Math.floor(box.y); y < Math.floor(box.y + box.height) && y < height; y += 8) {
      const xL = Math.max(0, Math.floor(box.x) - bgMargin);
      const xR = Math.min(width - 1, Math.floor(box.x + box.width) + bgMargin);
      if (xL >= 0) {
        const idx = (y * width + xL) * 4;
        bgSamples.push(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
      }
      if (xR < width) {
        const idx = (y * width + xR) * 4;
        bgSamples.push(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
      }
    }

    if (bgSamples.length > 5) {
      const bgMean = bgSamples.reduce((a, b) => a + b, 0) / bgSamples.length;
      const bgVariance = bgSamples.reduce((a, b) => a + (b - bgMean) ** 2, 0) / bgSamples.length;
      const bgStd = Math.sqrt(bgVariance);
      details.bgUniformity = bgStd.toFixed(1);
      if (bgStd < 10) score += 20;
      else if (bgStd < 18) score += 10;
    }

    // ── CHECK 5: Líneas rectas rectangulares (bordes del teléfono) ──
    let strongVertical = 0;
    let strongHorizontal = 0;
    const edgeStr = 80;

    const checkCols = [
      Math.max(0, Math.floor(box.x) - 15),
      Math.max(0, Math.floor(box.x) - 10),
      Math.min(width - 2, Math.floor(box.x + box.width) + 10),
      Math.min(width - 2, Math.floor(box.x + box.width) + 15),
    ];
    for (const cx of checkCols) {
      let ec = 0;
      const lineLen = Math.floor(box.height / 4);
      for (let y = Math.floor(box.y); y < Math.floor(box.y + box.height) && y < height; y += 4) {
        const i1 = (y * width + cx) * 4, i2 = (y * width + cx + 1) * 4;
        const d = Math.abs(
          (0.299 * data[i1] + 0.587 * data[i1 + 1] + 0.114 * data[i1 + 2]) -
          (0.299 * data[i2] + 0.587 * data[i2 + 1] + 0.114 * data[i2 + 2])
        );
        if (d > edgeStr) ec++;
      }
      if (lineLen > 0 && ec / lineLen > 0.5) strongVertical++;
    }

    const checkRows = [
      Math.max(0, Math.floor(box.y) - 15),
      Math.max(0, Math.floor(box.y) - 10),
      Math.min(height - 2, Math.floor(box.y + box.height) + 10),
      Math.min(height - 2, Math.floor(box.y + box.height) + 15),
    ];
    for (const ry of checkRows) {
      let ec = 0;
      const lineLen = Math.floor(box.width / 4);
      for (let x = Math.floor(box.x); x < Math.floor(box.x + box.width) && x < width; x += 4) {
        const i1 = (ry * width + x) * 4, i2 = ((ry + 1) * width + x) * 4;
        if (i2 + 2 < data.length) {
          const d = Math.abs(
            (0.299 * data[i1] + 0.587 * data[i1 + 1] + 0.114 * data[i1 + 2]) -
            (0.299 * data[i2] + 0.587 * data[i2 + 1] + 0.114 * data[i2 + 2])
          );
          if (d > edgeStr) ec++;
        }
      }
      if (lineLen > 0 && ec / lineLen > 0.5) strongHorizontal++;
    }

    details.verticalEdges = strongVertical;
    details.horizontalEdges = strongHorizontal;
    if (strongVertical >= 2 && strongHorizontal >= 2) score += 30;
    else if (strongVertical >= 1 && strongHorizontal >= 1) score += 15;

    // ── VEREDICTO ──
    const isDevice = score >= 45;
    details.score = score;

    return {
      isDevice,
      confidence: Math.min(score, 100),
      details,
      message: isDevice
        ? `Dispositivo detectado (score: ${score}/100)`
        : `Sin dispositivo (score: ${score}/100)`,
    };
  } catch (err) {
    console.warn('Error en detección de dispositivo:', err);
    return { isDevice: false, confidence: 0, details: {} };
  }
}

// ── Detectores de acciones individuales ────────────────────────────────
function detectAction(actionKey, detection, state) {
  const box = detection.detection.box;
  const centerX = box.x + box.width / 2;
  const nose = detection.landmarks.getNose()[3];
  const mouth = detection.landmarks.getMouth();
  const leftEye = detection.landmarks.getLeftEye();
  const rightEye = detection.landmarks.getRightEye();

  switch (actionKey) {
    case 'turn_right': {
      const yawRight = nose.x - centerX > box.width * CONFIG.YAW_THRESHOLD;
      return yawRight && state.movementAccum > box.width * CONFIG.MOVEMENT_THRESHOLD && state.stepFrames >= CONFIG.MIN_STEP_FRAMES;
    }

    case 'turn_left': {
      const yawLeft = centerX - nose.x > box.width * CONFIG.YAW_THRESHOLD;
      return yawLeft && state.movementAccum > box.width * CONFIG.MOVEMENT_THRESHOLD && state.stepFrames >= CONFIG.MIN_STEP_FRAMES;
    }

    case 'smile': {
      const mouthWidth = Math.hypot(mouth[6].x - mouth[0].x, mouth[6].y - mouth[0].y);
      const mouthHeight = Math.hypot(mouth[3].x - mouth[9].x, mouth[3].y - mouth[9].y) || 1;
      const smileScore = (detection.expressions?.happy || 0) + mouthWidth / mouthHeight;
      return smileScore > CONFIG.SMILE_THRESHOLD;
    }

    case 'open_mouth': {
      const mouthWidth = Math.hypot(mouth[6].x - mouth[0].x, mouth[6].y - mouth[0].y) || 1;
      const mouthHeight = Math.hypot(mouth[3].x - mouth[9].x, mouth[3].y - mouth[9].y);
      const openRatio = mouthHeight / mouthWidth;
      // Requiere apertura clara y sostenida (mínimo 5 frames)
      return openRatio > CONFIG.MOUTH_OPEN_RATIO && state.stepFrames >= 5;
    }

    case 'raise_eyebrows': {
      const surpriseScore = detection.expressions?.surprised || 0;
      const leftEyeHeight = Math.abs(leftEye[1].y - leftEye[5].y);
      const rightEyeHeight = Math.abs(rightEye[1].y - rightEye[5].y);
      const avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2;
      const eyesWide = avgEyeHeight > box.height * 0.04;
      // Requiere AMBOS: expresión sorprendida Y ojos abiertos
      return surpriseScore > CONFIG.SURPRISE_THRESHOLD && eyesWide && state.stepFrames >= CONFIG.MIN_STEP_FRAMES;
    }

    case 'nod': {
      // Detectar asentimiento: cabeza baja → cabeza sube (movimiento vertical de nariz)
      const noseY = nose.y;
      const boxH = box.height;

      // Calibrar posición Y base en el primer frame
      if (state.nodState.baseY === null) {
        state.nodState.baseY = noseY;
        state.nodState.lastY = noseY;
        return false;
      }

      // Acumular movimiento vertical absoluto
      state.nodState.yAccum += Math.abs(noseY - state.nodState.lastY);
      const deltaFromBase = (noseY - state.nodState.baseY) / boxH;

      console.log(`[NOD] deltaY: ${deltaFromBase.toFixed(4)} | yAccum: ${(state.nodState.yAccum/boxH).toFixed(4)} | wentDown: ${state.nodState.wentDown}`);

      // Fase 1: Cabeza baja (nariz se mueve hacia abajo, deltaY positivo)
      if (!state.nodState.wentDown && deltaFromBase > CONFIG.NOD_Y_THRESHOLD) {
        state.nodState.wentDown = true;
        console.log('[NOD] ✅ Cabeza bajó');
      }

      // Fase 2: Cabeza vuelve arriba (nariz regresa a posición original o más arriba)
      if (state.nodState.wentDown && deltaFromBase < CONFIG.NOD_Y_THRESHOLD * 0.3 
          && state.nodState.yAccum / boxH > CONFIG.NOD_MOVEMENT_THRESHOLD) {
        console.log('[NOD] ✅ Asentimiento COMPLETO!');
        return true;
      }

      state.nodState.lastY = noseY;
      return false;
    }

    default:
      return false;
  }
}

// ── Función principal de liveness ──────────────────────────────────────
/**
 * Ejecuta la secuencia completa de liveness detection.
 * 
 * @param {HTMLVideoElement} videoElement - Referencia al elemento <video>
 * @param {Object} callbacks - { onStepChange, onLog, onStatusChange }
 * @returns {Promise<{passed: boolean, antiSpoofing: Object}>}
 */
export async function ensureLiveness(videoElement, callbacks = {}) {
  const { onStepChange, onLog, onStatusChange } = callbacks;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const sequence = generateRandomSequence();
  
  const log = (msg) => {
    onLog?.(msg);
    onStatusChange?.(msg);
  };

  log(`🔐 Verificación anti-spoofing: ${sequence.map(a => a.icon).join(' → ')}`);

  const start = Date.now();
  let step = 0;
  onStepChange?.(0, sequence);

  // Estado de tracking
  let lastNoseX = null;
  let movementAccum = 0;
  let stepFrames = 0;
  let totalFrames = 0;              // Contador global de frames (nunca se resetea)
  const nosePositions = [];         // Para micro-movimientos (se resetea por acción)
  const rgbHistory = [];            // Para rPPG temporal (se acumula TODO el tiempo)
  let textureChecked = false;
  let textureResult = null;
  let microMovementResult = null;
  let pulseResult = null;
  let artifactCheckDone = false;
  let eyeReflectionResults = [];    // Acumular múltiples lecturas
  let nodState = { baseY: null, wentDown: false, yAccum: 0 };
  let spoofRisk = 0;                // Score acumulado de riesgo anti-spoofing
  let textureResults = [];          // Múltiples muestras de textura
  let microMovementFailCount = 0;   // Veces que micro-movimientos falló
  let deviceCheckDone = false;       // Detección de dispositivo/teléfono

  while (Date.now() - start < CONFIG.TIMEOUT_MS && step < sequence.length) {
    const detection = await faceapi
      .detectSingleFace(videoElement)
      .withFaceLandmarks()
      .withFaceExpressions();

    if (detection?.landmarks) {
      const nose = detection.landmarks.getNose()[3];
      stepFrames += 1;
      totalFrames += 1;

      // Registrar posición de nariz para micro-movimientos
      nosePositions.push({ x: nose.x, y: nose.y, t: Date.now() });

      // ── Capturar señal RGB para rPPG (SIEMPRE, no se resetea) ──
      const rgbSample = captureRGBSignal(videoElement);
      if (rgbSample) rgbHistory.push(rgbSample);

      // Acumular movimiento para giros
      if (lastNoseX !== null) {
        movementAccum += Math.abs(nose.x - lastNoseX);
      }
      lastNoseX = nose.x;

      // ── Análisis anti-pantalla (frame 5 y frame 40 — dos muestras) ──
      if ((!textureChecked && totalFrames >= 5) || (textureChecked && totalFrames === 40 && textureResults.length < 2)) {
        const txResult = analyzeTexture(videoElement);
        textureResults.push(txResult);
        console.log(`[LIVENESS] Textura (#${textureResults.length}):`, txResult);
        
        if (!txResult.isReal) {
          // Textura es el check más confiable — peso alto, bloqueo inmediato
          spoofRisk += CONFIG.SPOOF_WEIGHT_TEXTURE;
          log('🚫 Se detectó una pantalla o imagen reproducida.');
          console.log(`[ANTI-SPOOF] 🚨 Textura falló. spoofRisk: ${spoofRisk}/${CONFIG.SPOOF_BLOCK_THRESHOLD}`);
          throw new Error('Se detectó una pantalla o imagen. Use su rostro real frente a la cámara.');
        }
        if (!textureChecked) {
          textureResult = txResult;
          textureChecked = true;
          log('✅ Verificación de textura superada');
        }
      }

      // ── Análisis de artefactos deepfake (una vez, después de 10 frames) ──
      if (!artifactCheckDone && totalFrames >= 10) {
        const artifacts = detectDeepfakeArtifacts(videoElement, detection);
        artifactCheckDone = true;
        console.log('[LIVENESS] Artefactos deepfake:', artifacts);
        if (!artifacts.isReal) {
          spoofRisk += CONFIG.SPOOF_WEIGHT_ARTIFACTS;
          log('⚠️ Bordes faciales irregulares detectados');
          console.log(`[ANTI-SPOOF] Artefactos +${CONFIG.SPOOF_WEIGHT_ARTIFACTS}. spoofRisk: ${spoofRisk}/${CONFIG.SPOOF_BLOCK_THRESHOLD}`);
        } else {
          log('✅ Sin artefactos de deepfake');
        }
      }

      // ── Acumular reflejos oculares (cada 10 frames globales) ──
      if (totalFrames > 0 && totalFrames % 10 === 0) {
        const eyeResult = detectEyeReflections(videoElement, detection);
        eyeReflectionResults.push(eyeResult);
        console.log('[LIVENESS] Reflejos oculares:', eyeResult);
      }

      // ── Detección de dispositivo/teléfono (una vez, después de 15 frames) ──
      if (!deviceCheckDone && totalFrames >= 15) {
        const deviceResult = detectDevicePresentation(videoElement, detection);
        deviceCheckDone = true;
        console.log('[LIVENESS] Detección de dispositivo:', deviceResult);
        if (deviceResult.isDevice) {
          spoofRisk += CONFIG.SPOOF_WEIGHT_DEVICE;
          log('🚫 Se detectó un dispositivo/teléfono frente a la cámara');
          console.log(`[ANTI-SPOOF] Dispositivo +${CONFIG.SPOOF_WEIGHT_DEVICE}. spoofRisk: ${spoofRisk}/${CONFIG.SPOOF_BLOCK_THRESHOLD}`);
        } else {
          log('✅ Sin dispositivo detectado');
        }
      }

      // ── Verificar micro-movimientos periódicamente ──
      if (nosePositions.length >= CONFIG.MICRO_MOVEMENT_FRAMES) {
        microMovementResult = analyzeMicroMovements(nosePositions);
        console.log('[LIVENESS] Micro-movimientos:', microMovementResult);
        if (!microMovementResult.isReal) {
          microMovementFailCount++;
          // Solo sumar riesgo si falla múltiples veces (evitar falso positivo puntual)
          if (microMovementFailCount >= 3) {
            spoofRisk += CONFIG.SPOOF_WEIGHT_MICRO_MOV;
            console.log(`[ANTI-SPOOF] Micro-mov +${CONFIG.SPOOF_WEIGHT_MICRO_MOV} (falló ${microMovementFailCount}x). spoofRisk: ${spoofRisk}/${CONFIG.SPOOF_BLOCK_THRESHOLD}`);
          }
          log('⚠️ Movimientos naturales bajos');
        } else {
          log('✅ Movimientos naturales verificados');
        }
        nosePositions.length = 0;
      }

      // ── Verificar score acumulado mid-session ──
      if (spoofRisk >= CONFIG.SPOOF_BLOCK_THRESHOLD) {
        log('🚫 Múltiples indicadores de spoofing detectados.');
        console.log(`[ANTI-SPOOF] 🚨 BLOQUEADO. spoofRisk: ${spoofRisk}/${CONFIG.SPOOF_BLOCK_THRESHOLD}`);
        throw new Error('Se detectaron múltiples indicadores de suplantación. Asegúrese de estar frente a la cámara en persona.');
      }

      // ── Evaluar la acción actual ──
      const currentAction = sequence[step];
      const state = { movementAccum, stepFrames, nodState };
      const passed = detectAction(currentAction.key, detection, state);

      // DEBUG: Log valores de detección para la acción actual
      if (stepFrames % 5 === 0) {
        const mouth = detection.landmarks.getMouth();
        const leftEye = detection.landmarks.getLeftEye();
        const rightEye = detection.landmarks.getRightEye();
        const box = detection.detection.box;
        const centerX = box.x + box.width / 2;
        const mouthW = Math.hypot(mouth[6].x - mouth[0].x, mouth[6].y - mouth[0].y) || 1;
        const mouthH = Math.hypot(mouth[3].x - mouth[9].x, mouth[3].y - mouth[9].y);
        const leW = Math.hypot(leftEye[3].x - leftEye[0].x, leftEye[3].y - leftEye[0].y);
        const leH = (Math.abs(leftEye[1].y - leftEye[5].y) + Math.abs(leftEye[2].y - leftEye[4].y)) / 2;
        const reW = Math.hypot(rightEye[3].x - rightEye[0].x, rightEye[3].y - rightEye[0].y);
        const reH = (Math.abs(rightEye[1].y - rightEye[5].y) + Math.abs(rightEye[2].y - rightEye[4].y)) / 2;
        console.log(`[LIVENESS] Acción: ${currentAction.key} | Frame: ${stepFrames}`, {
          mouthRatio: (mouthH / mouthW).toFixed(3),
          happy: detection.expressions?.happy?.toFixed(3),
          surprised: detection.expressions?.surprised?.toFixed(3),
          eyeAR: ((leH/(leW||1) + reH/(reW||1))/2).toFixed(3),
          nodState: JSON.stringify(state.nodState),
          noseYaw: ((nose.x - centerX) / box.width).toFixed(4),
          movementAccum: movementAccum.toFixed(1),
        });
      }

      if (passed) {
        log(`${currentAction.icon} ${currentAction.label} detectado ✅`);
        step += 1;
        onStepChange?.(step, sequence);
        movementAccum = 0;
        stepFrames = 0;
        lastNoseX = null;
        nosePositions.length = 0;
        nodState = { baseY: null, wentDown: false, yAccum: 0, lastY: null };
        // ⚠️ NO resetear rgbHistory — necesitamos datos continuos para rPPG
      } else {
        log(`Mantén la acción: ${currentAction.icon} ${currentAction.label}`);
      }
    } else {
      log('🔍 Buscando rostro...');
    }

    await wait(CONFIG.POLL_INTERVAL_MS);
  }

  if (step < sequence.length) {
    log('No se completó la secuencia de vida ❌');
    throw new Error('No se completaron las acciones de vida. Tiempo agotado.');
  }

  // ── Verificaciones finales anti-deepfake (con scoring) ──

  // 1. Análisis de pulso temporal (rPPG)
  pulseResult = analyzeBloodPulse(rgbHistory);
  console.log('[LIVENESS] Pulso rPPG final:', pulseResult, 'frames:', rgbHistory.length);
  if (!pulseResult.isReal && rgbHistory.length >= CONFIG.RPPG_MIN_FRAMES) {
    spoofRisk += CONFIG.SPOOF_WEIGHT_RPPG;
    log('⚠️ Señal de pulso no detectada');
    console.log(`[ANTI-SPOOF] rPPG +${CONFIG.SPOOF_WEIGHT_RPPG}. spoofRisk: ${spoofRisk}/${CONFIG.SPOOF_BLOCK_THRESHOLD}`);
  } else {
    log('✅ Señal de pulso verificada');
  }

  // 2. Consistencia de reflejos oculares (promedio de lecturas)
  if (eyeReflectionResults.length > 0) {
    const anomalousCount = eyeReflectionResults.filter(r => !r.isReal).length;
    const anomalyRate = anomalousCount / eyeReflectionResults.length;
    console.log('[LIVENESS] Reflejos oculares final:', { anomalousCount, total: eyeReflectionResults.length, anomalyRate });
    if (anomalyRate > 0.6) {
      spoofRisk += CONFIG.SPOOF_WEIGHT_EYE_REFLECT;
      log('⚠️ Reflejos oculares irregulares');
      console.log(`[ANTI-SPOOF] Reflejos +${CONFIG.SPOOF_WEIGHT_EYE_REFLECT}. spoofRisk: ${spoofRisk}/${CONFIG.SPOOF_BLOCK_THRESHOLD}`);
    } else {
      log('✅ Reflejos oculares consistentes');
    }
  }

  // 3. Verificación final de textura 
  const finalTexture = analyzeTexture(videoElement);
  if (!finalTexture.isReal) {
    spoofRisk += CONFIG.SPOOF_WEIGHT_TEXTURE;
    console.log(`[ANTI-SPOOF] Textura final falló. spoofRisk: ${spoofRisk}/${CONFIG.SPOOF_BLOCK_THRESHOLD}`);
  }

  // 4. Segunda verificación de dispositivo (al final, confirmar)
  const finalDeviceCheck = detectDevicePresentation(videoElement, 
    await faceapi.detectSingleFace(videoElement).withFaceLandmarks().withFaceExpressions()
  );
  console.log('[LIVENESS] Dispositivo final:', finalDeviceCheck);
  if (finalDeviceCheck.isDevice) {
    spoofRisk += CONFIG.SPOOF_WEIGHT_DEVICE;
    console.log(`[ANTI-SPOOF] Dispositivo final +${CONFIG.SPOOF_WEIGHT_DEVICE}. spoofRisk: ${spoofRisk}/${CONFIG.SPOOF_BLOCK_THRESHOLD}`);
  }

  // 5. VEREDICTO FINAL: si el score acumulado supera el umbral, bloquear
  console.log(`[ANTI-SPOOF] === VEREDICTO FINAL === spoofRisk: ${spoofRisk}/${CONFIG.SPOOF_BLOCK_THRESHOLD}`);
  if (spoofRisk >= CONFIG.SPOOF_BLOCK_THRESHOLD) {
    log('🚫 Se detectaron múltiples indicadores de suplantación de identidad.');
    throw new Error(
      `Verificación anti-spoofing fallida (score: ${spoofRisk}/${CONFIG.SPOOF_BLOCK_THRESHOLD}). ` +
      'Se detectaron indicadores de video, pantalla o deepfake. ' +
      'Asegúrese de estar frente a la cámara en persona.'
    );
  }
  log('✅ Verificación anti-spoofing completa');

  return {
    passed: true,
    antiSpoofing: {
      texture: textureResult || finalTexture,
      microMovements: microMovementResult,
      bloodPulse: pulseResult,
      eyeReflections: {
        readings: eyeReflectionResults.length,
        anomalyRate: eyeReflectionResults.length > 0
          ? (eyeReflectionResults.filter(r => !r.isReal).length / eyeReflectionResults.length).toFixed(2)
          : 'n/a',
      },
      deviceDetection: {
        midSession: deviceCheckDone,
        finalCheck: finalDeviceCheck,
      },
      actionsCompleted: sequence.map(a => a.key),
      totalRGBFrames: rgbHistory.length,
      spoofRiskScore: spoofRisk,
      spoofThreshold: CONFIG.SPOOF_BLOCK_THRESHOLD,
      duration: Date.now() - start,
      securityLevel: spoofRisk === 0 ? 'high' : spoofRisk < CONFIG.SPOOF_BLOCK_THRESHOLD ? 'medium' : 'blocked',
    },
  };
}

// ── Exports ────────────────────────────────────────────────────────────
export { ACTION_POOL, CONFIG, detectAction };
