/**
 * AETHEL-SSS | Sonar Waterfall Engine
 * High-performance 60FPS dual-channel side-scan acoustic simulator & canvas renderer.
 */

class SonarEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    
    // Virtual Sonar Buffer Dimensions
    this.width = 1000;
    this.height = 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Direct pixel manipulation via ImageData & Uint32Array (Little Endian ABGR)
    this.imgData = this.ctx.createImageData(this.width, this.height);
    this.buf32 = new Uint32Array(this.imgData.data.buffer);

    // Acoustic Signal Parameters
    this.gain = 18;          // dB (0 - 40)
    this.tvg = 24;           // dB/km
    this.contrast = 1.25;    // Dynamic range multiplier
    this.speedKnots = 3.8;   // Vessel speed
    this.pingFrequency = 455; // 455 kHz or 900 kHz
    this.towfishAltitude = 12.4; // Meters above seabed
    this.slantRange = 75.0;  // Meters per channel

    // Simulation State
    this.isPaused = false;
    this.pingCount = 0;
    this.subPixelAccumulator = 0;
    
    // Seabed Topography & Micro-relief state
    this.sandRipplePhase = 0;
    this.seabedRoughness = 0.35;
    
    // Active targets traveling down the waterfall
    this.activeObjects = [];

    // Initialize buffer with low-level acoustic noise
    this.initBuffer();

    // Bind animation loop
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  initBuffer() {
    const lut = SonarPalettes.getLUT();
    for (let y = 0; y < this.height; y++) {
      this.generatePingLine(y);
    }
    this.ctx.putImageData(this.imgData, 0, 0);
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      // Keep internal high resolution while matching container aspect
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
    }
  }

  /**
   * Generates a single acoustic ping scanline representing Port & Starboard beams
   * with Nadir Water-Column Blanking.
   */
  generatePingLine(yIndex, injectedAnomaly = null) {
    const lut = SonarPalettes.getLUT();
    const halfWidth = Math.floor(this.width / 2);
    const nadirWidth = Math.floor((this.towfishAltitude / this.slantRange) * halfWidth * 0.45);

    // Acoustic gain factor
    const gainFactor = Math.pow(10, (this.gain - 15) / 20);

    this.sandRipplePhase += 0.04;

    for (let x = 0; x < this.width; x++) {
      const pixelIdx = yIndex * this.width + x;
      
      // Distance from center nadir path (-halfWidth to +halfWidth)
      const distFromCenter = Math.abs(x - halfWidth);

      // 1. Nadir Deadzone / Water Column (Sound traveling through open water before seafloor return)
      if (distFromCenter < nadirWidth) {
        // Deep water column has near-zero backscatter with faint particulate noise
        const waterNoise = Math.random() * 8;
        this.buf32[pixelIdx] = lut[Math.min(255, Math.floor(waterNoise))];
        continue;
      }

      // 2. Seafloor Acoustic Return (First bottom arrival is a sharp specular highlight)
      let backscatter = 0;
      if (distFromCenter === nadirWidth || distFromCenter === nadirWidth + 1) {
        backscatter = 220 + Math.random() * 30; // Bright first bottom echo
      } else {
        // Slant range normalized (0.0 to 1.0)
        const rangeRatio = (distFromCenter - nadirWidth) / (halfWidth - nadirWidth);
        
        // Time Varied Gain (TVG) compensation curve: combats spherical spreading loss
        const tvgComp = 1.0 + rangeRatio * (this.tvg / 30.0);

        // Seabed acoustic backscatter texture (speckle + sand ripples)
        const ripple = Math.sin(this.sandRipplePhase + x * 0.08) * 18;
        const speckle = (Math.random() - 0.5) * 45;
        const baselineSeabed = 85 * (1.0 - rangeRatio * 0.3); // Natural grazing angle falloff

        backscatter = (baselineSeabed + ripple + speckle) * gainFactor * tvgComp;
        
        // Dynamic range / contrast curve
        backscatter = ((backscatter - 100) * this.contrast) + 100;
      }

      // 3. Inject active targets passing through this scanline
      if (this.activeObjects.length > 0) {
        for (const obj of this.activeObjects) {
          if (yIndex >= obj.y && yIndex < obj.y + obj.height) {
            // Check if x is within highlight or acoustic shadow
            // Real physics: Target highlight is bright, shadow falls AWAY from nadir
            const isPort = obj.x < halfWidth;
            const shadowDirection = isPort ? -1 : 1; // Shadows project outward away from towfish
            
            // Highlight region (Specular echo of debris)
            if (x >= obj.x && x < obj.x + obj.width) {
              backscatter = obj.highlightIntensity + (Math.random() * 20);
            } 
            // Acoustic Shadow region (Sound blocked by object elevation)
            else {
              const shadowStart = shadowDirection > 0 ? obj.x + obj.width : obj.x - obj.shadowLength;
              const shadowEnd = shadowDirection > 0 ? obj.x + obj.width + obj.shadowLength : obj.x;
              
              if (x >= shadowStart && x <= shadowEnd) {
                // Total acoustic void
                backscatter = Math.random() * 5; 
              }
            }
          }
        }
      }

      // Clamp and lookup in precalculated Palette LUT
      const finalIntensity = Math.max(0, Math.min(255, Math.floor(backscatter)));
      this.buf32[pixelIdx] = lut[finalIntensity];
    }
  }

  /**
   * Main 60 FPS animation loop
   */
  tick() {
    if (!this.isPaused) {
      // Calculate lines to scroll based on vessel speed (knots)
      const scrollStep = (this.speedKnots / 3.0);
      this.subPixelAccumulator += scrollStep;

      while (this.subPixelAccumulator >= 1.0) {
        this.scrollWaterfallDown();
        this.subPixelAccumulator -= 1.0;
        this.pingCount++;
      }

      // Render updated buffer
      this.ctx.putImageData(this.imgData, 0, 0);

      // Update AI Detection tracking
      if (window.AIDetector) {
        window.AIDetector.updateActiveObjects(this.activeObjects, scrollStep);
      }
    }

    requestAnimationFrame(this.tick);
  }

  /**
   * Scrolls the entire waterfall buffer downward by 1 scanline and generates a new ping at the top.
   */
  scrollWaterfallDown() {
    // Shift rows down by 1 using high-speed TypedArray copyWithin
    this.buf32.copyWithin(this.width, 0, this.width * (this.height - 1));

    // Generate brand-new acoustic ping scanline at y = 0
    this.generatePingLine(0);

    // Update active targets Y positions
    for (let i = this.activeObjects.length - 1; i >= 0; i--) {
      this.activeObjects[i].y += 1;
      // Remove objects that have scrolled past the bottom
      if (this.activeObjects[i].y > this.height) {
        this.activeObjects.splice(i, 1);
      }
    }
  }

  /**
   * Injects an acoustic target with physics parameters (echo highlight + shadow length).
   */
  spawnAcousticTarget(targetData) {
    const halfWidth = Math.floor(this.width / 2);
    const nadirWidth = Math.floor((this.towfishAltitude / this.slantRange) * halfWidth * 0.45);
    
    // Choose channel (Port or Starboard)
    const channel = targetData.channel || (Math.random() > 0.5 ? 'port' : 'stbd');
    const minX = channel === 'port' ? 50 : halfWidth + nadirWidth + 20;
    const maxX = channel === 'port' ? halfWidth - nadirWidth - 50 : this.width - 100;
    
    const xPos = targetData.x !== undefined ? targetData.x : Math.floor(minX + Math.random() * (maxX - minX));
    
    // Calculate physical slant range (Rs) based on distance from center
    const distFromCenter = Math.abs(xPos - halfWidth);
    const slantRangeMeters = ((distFromCenter) / halfWidth) * this.slantRange;

    // Object height off seafloor (m)
    const objectHeight = targetData.elevation || (0.8 + Math.random() * 2.2);

    // Physics Acoustic Shadow Formula: Ls = (h * Rs) / Ht
    const shadowLengthMeters = (objectHeight * slantRangeMeters) / this.towfishAltitude;
    
    // Convert shadow length in meters to screen pixels
    const shadowPixels = Math.floor((shadowLengthMeters / this.slantRange) * halfWidth);

    const newTarget = {
      id: `ANOM-${Math.floor(1000 + Math.random() * 9000)}`,
      x: xPos,
      y: 0,
      width: targetData.width || Math.floor(18 + Math.random() * 22),
      height: targetData.height || Math.floor(14 + Math.random() * 18),
      shadowLength: Math.max(15, shadowPixels),
      elevation: parseFloat(objectHeight.toFixed(2)),
      slantRangeMeters: parseFloat(slantRangeMeters.toFixed(1)),
      shadowLengthMeters: parseFloat(shadowLengthMeters.toFixed(1)),
      towfishAltitude: this.towfishAltitude,
      highlightIntensity: 245 + Math.random() * 10,
      type: targetData.type || 'ghost-net',
      confidence: (91.0 + Math.random() * 8.5).toFixed(1),
      timestamp: new Date().toISOString()
    };

    this.activeObjects.push(newTarget);

    if (window.AIDetector) {
      window.AIDetector.registerDetection(newTarget);
    }

    return newTarget;
  }

  flushBuffer() {
    this.activeObjects = [];
    this.initBuffer();
    if (window.AIDetector) {
      window.AIDetector.clearAnnotations();
    }
  }

  setGain(val) { this.gain = parseFloat(val); }
  setTVG(val) { this.tvg = parseFloat(val); }
  setContrast(val) { this.contrast = parseFloat(val); }
  setSpeed(val) { this.speedKnots = parseFloat(val); }
  togglePause() { this.isPaused = !this.isPaused; return this.isPaused; }
}

// Attach globally
window.SonarEngine = SonarEngine;
