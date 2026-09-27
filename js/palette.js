/**
 * AETHEL-SSS | Acoustic Palette Module
 * Generates calibrated Look-Up Tables (LUTs) for dual-beam side-scan backscatter.
 */

const SonarPalettes = (function () {
  // Pre-calculated 256-step Look-Up Tables for instantaneous canvas pixel rendering
  const LUT = {
    amber: new Uint32Array(256),
    copper: new Uint32Array(256),
    emerald: new Uint32Array(256),
    grayscale: new Uint32Array(256)
  };

  // Helper to pack RGBA into 32-bit integer (Little-Endian: ABGR)
  function packRGBA(r, g, b, a = 255) {
    return ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
  }

  // Linear interpolation
  function lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }

  // Multi-stop gradient builder
  function buildGradientLUT(lutArray, stops) {
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      // Find bounding stops
      let s1 = stops[0], s2 = stops[stops.length - 1];
      for (let s = 0; s < stops.length - 1; s++) {
        if (t >= stops[s].pos && t <= stops[s + 1].pos) {
          s1 = stops[s];
          s2 = stops[s + 1];
          break;
        }
      }
      const segmentT = (t - s1.pos) / (s2.pos - s1.pos || 1);
      const r = Math.round(lerp(s1.r, s2.r, segmentT));
      const g = Math.round(lerp(s1.g, s2.g, segmentT));
      const b = Math.round(lerp(s1.b, s2.b, segmentT));
      lutArray[i] = packRGBA(r, g, b, 255);
    }
  }

  // Initialize standard Marine Hydrographic Color Palettes
  function initLUTs() {
    // 1. Classic Amber Phosphor (High contrast underwater acoustics)
    buildGradientLUT(LUT.amber, [
      { pos: 0.00, r: 4,   g: 3,   b: 2 },     // Acoustic Shadow (Black/Dark Brown)
      { pos: 0.15, r: 35,  g: 16,  b: 4 },     // Soft Seabed Mud
      { pos: 0.45, r: 145, g: 76,  b: 15 },    // General Backscatter
      { pos: 0.75, r: 232, g: 158, b: 67 },    // Sand Ripples / Highlights
      { pos: 0.95, r: 255, g: 220, b: 150 },   // Specular Reflection
      { pos: 1.00, r: 255, g: 255, b: 240 }    // Saturation Peak
    ]);

    // 2. Copper Sepia (SonarWiz Standard)
    buildGradientLUT(LUT.copper, [
      { pos: 0.00, r: 2,   g: 1,   b: 1 },
      { pos: 0.20, r: 48,  g: 18,  b: 8 },
      { pos: 0.50, r: 168, g: 74,  b: 36 },
      { pos: 0.80, r: 235, g: 142, b: 92 },
      { pos: 1.00, r: 255, g: 240, b: 230 }
    ]);

    // 3. Glint Emerald (Subsea Night/Defense Sonar)
    buildGradientLUT(LUT.emerald, [
      { pos: 0.00, r: 1,   g: 4,   b: 2 },
      { pos: 0.20, r: 4,   g: 38,  b: 20 },
      { pos: 0.50, r: 15,  g: 135, b: 78 },
      { pos: 0.80, r: 32,  g: 224, b: 145 },
      { pos: 1.00, r: 220, g: 255, b: 240 }
    ]);

    // 4. Monochromatic High-Contrast Grayscale (Raw Acoustic Decibels)
    buildGradientLUT(LUT.grayscale, [
      { pos: 0.00, r: 2,   g: 3,   b: 5 },
      { pos: 0.30, r: 45,  g: 52,  b: 62 },
      { pos: 0.65, r: 140, g: 152, b: 168 },
      { pos: 0.90, r: 220, g: 228, b: 238 },
      { pos: 1.00, r: 255, g: 255, b: 255 }
    ]);
  }

  initLUTs();

  let currentPalette = 'amber';

  return {
    getColor(value, palette = currentPalette) {
      const idx = Math.max(0, Math.min(255, Math.floor(value)));
      return (LUT[palette] || LUT.amber)[idx];
    },
    getLUT(palette = currentPalette) {
      return LUT[palette] || LUT.amber;
    },
    setPalette(name) {
      if (LUT[name]) {
        currentPalette = name;
        document.body.className = document.body.className.replace(/palette-\w+/, `palette-${name}`);
        return true;
      }
      return false;
    },
    getCurrentPalette() {
      return currentPalette;
    }
  };
})();
