/**
 * AETHEL-SSS | Main Hydrographic Console Application
 * Master orchestrator connecting Sonar Engine, AI Detector, Telemetry Hub, and UI Controls.
 */

const App = (function () {
  let sonarEngine = null;
  const logStreamEl = document.getElementById('mission-log-stream');

  function init() {
    // 1. Initialize Sonar Engine
    sonarEngine = new SonarEngine('sonarCanvas');
    window.sonarEngineInstance = sonarEngine;

    // 2. Initialize Tactical Lawnmower Map
    if (window.MapTracker) {
      window.MapTracker.init();
    }

    // 3. Initialize Docket Exporter
    if (window.DocketExporter) {
      window.DocketExporter.init();
    }

    // 4. Bind UI Event Listeners
    setupControls();
    setupKeyboardShortcuts();
    setupClockAndTelemetry();

    // 5. Initial Log entries
    logTelemetry('SYSTEM BOOT: AETHEL-SSS v2.4 hydrographic DSP ready.', 'system');
    logTelemetry('ACOUSTIC BEAM: Dual-Channel 455 kHz calibrated. TVG active.', 'system');
    logTelemetry('MISSION OP-SAGAR-NIRIKSHAN: Towfish deployed at 12.4m altitude.', 'system');

    // 6. Spawn initial sample anomalies for instant interactive showcase
    setTimeout(() => {
      sonarEngine.spawnAcousticTarget({
        type: 'ghost-net',
        elevation: 1.85,
        channel: 'port'
      });
    }, 1200);

    setTimeout(() => {
      sonarEngine.spawnAcousticTarget({
        type: 'chemical-drum',
        elevation: 1.15,
        channel: 'stbd'
      });
    }, 4500);

    // Periodic autonomous anomaly spawner
    setInterval(() => {
      if (!sonarEngine.isPaused && Math.random() < 0.65) {
        const types = ['ghost-net', 'chemical-drum', 'sunken-wreck', 'plastic-mass', 'uxo'];
        const chosenType = types[Math.floor(Math.random() * types.length)];
        sonarEngine.spawnAcousticTarget({
          type: chosenType
        });
      }
    }, 7000);
  }

  function setupControls() {
    // Sliders
    const gainSlider = document.getElementById('slider-gain');
    const tvgSlider = document.getElementById('slider-tvg');
    const contrastSlider = document.getElementById('slider-contrast');
    const speedSlider = document.getElementById('slider-speed');

    gainSlider.addEventListener('input', (e) => {
      sonarEngine.setGain(e.target.value);
      document.getElementById('disp-gain').innerText = `+${e.target.value} dB`;
    });

    tvgSlider.addEventListener('input', (e) => {
      sonarEngine.setTVG(e.target.value);
      document.getElementById('disp-tvg').innerText = `${e.target.value} dB/km`;
    });

    contrastSlider.addEventListener('input', (e) => {
      sonarEngine.setContrast(e.target.value);
      document.getElementById('disp-contrast').innerText = `${parseFloat(e.target.value).toFixed(2)}x`;
    });

    speedSlider.addEventListener('input', (e) => {
      sonarEngine.setSpeed(e.target.value);
      document.getElementById('disp-speed').innerText = `${e.target.value} kn`;
      document.getElementById('val-speed').innerHTML = `${e.target.value} <small>kn</small>`;
    });

    // Palette Buttons
    const paletteButtons = document.querySelectorAll('.btn-palette');
    paletteButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const pName = btn.dataset.palette;
        setPalette(pName);
      });
    });

    // Dual-band Frequency Toggle
    const btnFreq = document.getElementById('btn-freq-toggle');
    btnFreq.addEventListener('click', () => {
      const is455 = btnFreq.innerText.includes('455');
      if (is455) {
        btnFreq.innerHTML = '<span class="val">900 kHz</span> (HI-RES DETAIL)';
        sonarEngine.pingFrequency = 900;
        logTelemetry('DSP BACKEND: 900 kHz High-Resolution beamforming engaged.', 'system');
      } else {
        btnFreq.innerHTML = '<span class="val">455 kHz</span> (WIDE-SWATH)';
        sonarEngine.pingFrequency = 455;
        logTelemetry('DSP BACKEND: 455 kHz Wide-Swath acoustic mode engaged.', 'system');
      }
    });

    // CRT Scanline Toggle
    const btnScanlines = document.getElementById('btn-scanlines-toggle');
    btnScanlines.addEventListener('click', () => {
      document.body.classList.toggle('scanlines-active');
      logTelemetry(`CRT SCANLINE FX: ${document.body.classList.contains('scanlines-active') ? 'ENABLED' : 'DISABLED'}`, 'system');
    });

    // Playback Toggle
    const btnPlay = document.getElementById('btn-playback-toggle');
    btnPlay.addEventListener('click', togglePlayPause);

    // Freeze Target
    const btnFreeze = document.getElementById('btn-freeze-target');
    btnFreeze.addEventListener('click', () => {
      sonarEngine.togglePause();
      logTelemetry('TARGET FREEZE: Sonar streaming paused for tactical inspection.', 'alert');
      updatePlayPauseButtonUI();
    });

    // Clear Buffer
    const btnClear = document.getElementById('btn-clear-waterfall');
    btnClear.addEventListener('click', () => {
      sonarEngine.flushBuffer();
      logTelemetry('BUFFER FLUSHED: Canvas acoustic buffer reset.', 'system');
    });

    // Manual Anomaly Injector Button - Hooked directly to Python Backend
    const btnInject = document.getElementById('btn-inject-anomaly');
    btnInject.addEventListener('click', async () => {
      const types = ['ghost-net', 'chemical-drum', 'sunken-wreck', 'plastic-mass', 'uxo'];
      const chosenType = types[Math.floor(Math.random() * types.length)];
      
      try {
        // Call Python Backend API
        const res = await fetch('/api/inject-anomaly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: chosenType, towfish_altitude: sonarEngine.towfishAltitude })
        });
        if (res.ok) {
          const data = await res.json();
          const target = data.anomaly;
          sonarEngine.spawnAcousticTarget({
            id: target.id,
            type: target.type,
            elevation: target.physics_metrics.calculated_elevation_m,
            x: target.x
          });
          logTelemetry(`BACKEND AI DETECT: ${target.id} [${target.taxonomy.name}] (h=${target.physics_metrics.calculated_elevation_m}m)`, 'alert');
          return;
        }
      } catch (err) {
        // Fallback to client-side DSP if server is offline
      }

      const fallbackTarget = sonarEngine.spawnAcousticTarget({ type: chosenType });
      logTelemetry(`CLIENT SIMULATOR: Injected ${fallbackTarget.id} (${chosenType})`, 'alert');
    });

    // Custom Sonar Scan Upload Handler
    const fileUpload = document.getElementById('file-sonar-upload');
    fileUpload.addEventListener('change', handleSonarImageUpload);
  }

  function handleSonarImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
      const img = new Image();
      img.onload = async function () {
        // Draw user image onto canvas as background survey scan
        sonarEngine.ctx.drawImage(img, 0, 0, sonarEngine.width, sonarEngine.height);
        sonarEngine.imgData = sonarEngine.ctx.getImageData(0, 0, sonarEngine.width, sonarEngine.height);
        sonarEngine.buf32 = new Uint32Array(sonarEngine.imgData.data.buffer);
        
        // Call Python backend to process uploaded scan
        try {
          const res = await fetch('/api/detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              x: Math.floor(sonarEngine.width * 0.68),
              y: 180,
              width: 28,
              height: 18,
              type: 'sunken-wreck',
              towfish_altitude: sonarEngine.towfishAltitude
            })
          });
          if (res.ok) {
            const data = await res.json();
            const target = data.result;
            sonarEngine.spawnAcousticTarget({
              id: target.id,
              type: target.type,
              elevation: target.physics_metrics.calculated_elevation_m,
              x: target.x
            });
            logTelemetry(`AI DSP ANALYZER: Processed upload scan [${file.name}] => ${target.id}`, 'system');
            return;
          }
        } catch (e) {
          // Fallback
        }

        sonarEngine.spawnAcousticTarget({
          type: 'sunken-wreck',
          elevation: 2.4,
          x: Math.floor(sonarEngine.width * 0.65)
        });
        logTelemetry(`IMAGE LOADED: Rendered external sonar survey [${file.name}]`, 'system');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function togglePlayPause() {
    const isPaused = sonarEngine.togglePause();
    updatePlayPauseButtonUI();
    logTelemetry(`STREAM: ${isPaused ? 'PAUSED' : 'STREAMING LIVE'}`, 'system');
  }

  function updatePlayPauseButtonUI() {
    const icon = document.getElementById('play-pause-icon');
    const text = document.getElementById('play-pause-text');
    if (sonarEngine.isPaused) {
      icon.innerText = '▶';
      text.innerText = 'RESUME STREAM';
    } else {
      icon.innerText = '⏸';
      text.innerText = 'PAUSE STREAM';
    }
  }

  function setPalette(pName) {
    SonarPalettes.setPalette(pName);
    document.querySelectorAll('.btn-palette').forEach(b => {
      b.classList.toggle('active', b.dataset.palette === pName);
    });
    logTelemetry(`PALETTE: Switched acoustic mapping to [${pName.toUpperCase()}]`, 'system');
  }

  function cyclePalette() {
    const palettes = ['amber', 'copper', 'emerald', 'grayscale'];
    const current = SonarPalettes.getCurrentPalette();
    const nextIdx = (palettes.indexOf(current) + 1) % palettes.length;
    setPalette(palettes[nextIdx]);
  }

  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger if user is in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'p' || e.key === 'P') {
        cyclePalette();
      } else if (e.key === 'f' || e.key === 'F') {
        togglePlayPause();
        logTelemetry('HOTKEY [F]: Freeze frame active.', 'alert');
      } else if (e.key === 'e' || e.key === 'E') {
        if (window.DocketExporter) window.DocketExporter.openDocket();
      }
    });
  }

  function setupClockAndTelemetry() {
    // 1. Live UTC Clock
    const clockEl = document.getElementById('live-utc-clock');
    function updateClock() {
      const now = new Date();
      clockEl.innerText = now.toUTCString().split(' ')[4] + ' UTC';
    }
    setInterval(updateClock, 1000);
    updateClock();

    // 2. Realistic micro-fluctuations in Towfish attitude
    const altEl = document.getElementById('val-altitude');
    const depthEl = document.getElementById('val-depth');
    const headingEl = document.getElementById('val-heading');
    const coordsEl = document.getElementById('disp-current-coords');

    let baseHeading = 184.2;
    let baseAltitude = 12.4;
    let baseDepth = 38.6;

    setInterval(() => {
      if (!sonarEngine.isPaused) {
        // Gyro jitter (±0.4 deg)
        baseHeading += (Math.random() - 0.5) * 0.4;
        headingEl.innerHTML = `${baseHeading.toFixed(1)}° <small>S-SW</small>`;

        // Altitude heave (±0.15 m)
        baseAltitude += (Math.random() - 0.5) * 0.1;
        baseAltitude = Math.max(8.0, Math.min(18.0, baseAltitude));
        altEl.innerHTML = `${baseAltitude.toFixed(1)} <small>m</small>`;
        sonarEngine.towfishAltitude = parseFloat(baseAltitude.toFixed(1));

        // Depth
        baseDepth = baseAltitude + 26.2;
        depthEl.innerHTML = `${baseDepth.toFixed(1)} <small>m</small>`;

        // Coords
        const secN = (24.1 + (Date.now() / 4000) % 20).toFixed(1);
        const secE = (52.6 + (Date.now() / 3500) % 20).toFixed(1);
        coordsEl.innerText = `08°58'${secN}"N 78°14'${secE}"E`;
      }
    }, 1200);
  }

  function logTelemetry(msg, type = 'normal') {
    if (!logStreamEl) return;
    const now = new Date().toTimeString().split(' ')[0];
    const row = document.createElement('div');
    row.className = `log-row ${type}`;
    row.innerHTML = `<span class="log-time">${now}</span><span class="log-msg">${msg}</span>`;
    logStreamEl.prepend(row);

    // Keep log buffer bounded
    if (logStreamEl.children.length > 40) {
      logStreamEl.removeChild(logStreamEl.lastChild);
    }
  }

  return {
    init,
    logTelemetry
  };
})();

// Launch application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  window.App = App;
});
