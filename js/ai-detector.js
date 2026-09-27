/**
 * AETHEL-SSS | AI Acoustic Anomaly & Shadow Height Detection Engine
 * Performs real-time bounding box tracking, shadow vector projection,
 * and physical seabed elevation calculation: h = (Ht * Ls) / Rs
 */

const AIDetector = (function () {
  const overlay = document.getElementById('annotation-layer');
  const targetZoomCanvas = document.getElementById('targetZoomCanvas');
  const zoomCtx = targetZoomCanvas.getContext('2d');

  // Debris classification metadata & standard Indian Maritime Mitigation protocols
  const DEBRIS_TAXONOMY = {
    'ghost-net': {
      name: 'CLASS A // GHOST NETTING',
      pillClass: 'pill-critical',
      action: 'DEPLOY ROV RETRIEVAL HOOK & CUTTER',
      hazardLevel: 'CRITICAL',
      defaultElev: 1.8
    },
    'chemical-drum': {
      name: 'CLASS B // TOXIC / INDUSTRIAL DRUM',
      pillClass: 'pill-high',
      action: 'ISOLATE CORRIDOR; CHEMICAL LEAK TEST',
      hazardLevel: 'HIGH',
      defaultElev: 1.1
    },
    'sunken-wreck': {
      name: 'CLASS C // SUBMERGED HULL / WRECK',
      pillClass: 'pill-moderate',
      action: 'CHART AS NAV HAZARD; ISSUE NOTICETO-MARINERS',
      hazardLevel: 'MODERATE',
      defaultElev: 2.6
    },
    'plastic-mass': {
      name: 'CLASS D // PLASTIC AGGLOMERATE',
      pillClass: 'pill-moderate',
      action: 'SCHEDULE HYDROGRAPHIC SURFACE-TRAWL',
      hazardLevel: 'MODERATE',
      defaultElev: 0.9
    },
    'uxo': {
      name: 'CLASS E // UXO / UNEXPLODED MUNITION',
      pillClass: 'pill-extreme',
      action: 'ALERT INDIAN NAVY EXPLOSIVE ORDNANCE (EOD)',
      hazardLevel: 'EXTREME',
      defaultElev: 0.7
    }
  };

  const inventoryCounts = {
    'ghost-net': 0,
    'chemical-drum': 0,
    'sunken-wreck': 0,
    'plastic-mass': 0,
    'uxo': 0
  };

  let totalDetectedCount = 0;
  let trackedAnomalies = [];
  let currentlyInspected = null;

  // Web Audio Context for authentic Sonar Ping Chirp
  let audioCtx = null;

  function playSonarPingChirp() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      // Sonar frequency sweep (chirp down)
      const now = audioCtx.currentTime;
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.14);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      // Audio autoplay policy
    }
  }

  function registerDetection(target) {
    totalDetectedCount++;
    inventoryCounts[target.type] = (inventoryCounts[target.type] || 0) + 1;
    trackedAnomalies.push(target);

    // Update UI counters
    updateCountUI();

    // Play subtle tactical acoustic chirp
    playSonarPingChirp();

    // Log to Telemetry Audit Trail
    if (window.App && window.App.logTelemetry) {
      const taxonomy = DEBRIS_TAXONOMY[target.type];
      window.App.logTelemetry(
        `AI DETECT: ${target.id} [${taxonomy.name}] conf: ${target.confidence}% at Rs=${target.slantRangeMeters}m`,
        'detection'
      );
    }

    // Auto-inspect first detection if none is currently selected
    if (!currentlyInspected) {
      inspectTarget(target);
    }
  }

  function updateCountUI() {
    const totalEl = document.getElementById('stat-total-anomalies');
    if (totalEl) totalEl.innerText = `${totalDetectedCount} DETECTED`;

    for (const [key, count] of Object.entries(inventoryCounts)) {
      const el = document.getElementById(`count-${key}`);
      if (el) el.innerText = count;
    }

    const activeEl = document.getElementById('disp-active-detections');
    if (activeEl) activeEl.innerText = trackedAnomalies.length;
  }

  /**
   * Called every frame from SonarEngine to synchronize DOM bounding boxes
   * with the canvas pixel coordinates.
   */
  function updateActiveObjects(objectsList) {
    trackedAnomalies = objectsList;
    renderBoundingBoxes();
  }

  function renderBoundingBoxes() {
    const showBoxes = document.getElementById('chk-ai-boxes')?.checked ?? true;
    const showShadows = document.getElementById('chk-shadow-vectors')?.checked ?? true;

    overlay.innerHTML = '';
    if (!showBoxes && !showShadows) return;

    const canvas = document.getElementById('sonarCanvas');
    const scaleX = canvas.clientWidth / canvas.width;
    const scaleY = canvas.clientHeight / canvas.height;

    const halfWidth = canvas.width / 2;

    for (const obj of trackedAnomalies) {
      const isPort = obj.x < halfWidth;
      const isInspected = currentlyInspected && currentlyInspected.id === obj.id;

      // 1. Acoustic Bounding Box
      if (showBoxes) {
        const box = document.createElement('div');
        box.className = `sonar-bbox ${obj.type === 'uxo' || obj.type === 'ghost-net' ? 'hazard-critical' : ''} ${isInspected ? 'active-inspect' : ''}`;
        box.style.left = `${obj.x * scaleX}px`;
        box.style.top = `${obj.y * scaleY}px`;
        box.style.width = `${obj.width * scaleX}px`;
        box.style.height = `${obj.height * scaleY}px`;

        const tag = document.createElement('div');
        tag.className = 'bbox-tag';
        tag.innerText = `${obj.id} [${obj.confidence}%]`;
        box.appendChild(tag);

        box.addEventListener('click', (e) => {
          e.stopPropagation();
          inspectTarget(obj);
        });

        overlay.appendChild(box);
      }

      // 2. Physics Acoustic Shadow Vector Line
      if (showShadows) {
        const shadowLine = document.createElement('div');
        shadowLine.className = 'shadow-vector';
        
        const shadowStartX = isPort ? (obj.x - obj.shadowLength) : (obj.x + obj.width);
        const shadowWidth = obj.shadowLength;

        shadowLine.style.left = `${shadowStartX * scaleX}px`;
        shadowLine.style.top = `${(obj.y + obj.height / 2) * scaleY}px`;
        shadowLine.style.width = `${shadowWidth * scaleX}px`;

        const label = document.createElement('span');
        label.className = 'shadow-vector-label';
        label.innerText = `Ls: ${obj.shadowLengthMeters}m (h: ${obj.elevation}m)`;
        label.style.left = isPort ? '0' : '100%';
        shadowLine.appendChild(label);

        overlay.appendChild(shadowLine);
      }
    }
  }

  /**
   * Activates the Acoustic Shadow Profiler panel for a selected anomaly.
   */
  function inspectTarget(target) {
    currentlyInspected = target;

    const emptyState = document.getElementById('inspector-empty');
    const activeState = document.getElementById('inspector-active');

    if (emptyState) emptyState.classList.add('hidden');
    if (activeState) activeState.classList.remove('hidden');

    const taxonomy = DEBRIS_TAXONOMY[target.type] || DEBRIS_TAXONOMY['ghost-net'];

    // Fill Header & IDs
    document.getElementById('insp-badge').innerText = taxonomy.name;
    document.getElementById('insp-id').innerText = `#${target.id}`;

    // Fill Physics Calculation Metrics
    document.getElementById('insp-ht').innerText = `${target.towfishAltitude} m`;
    document.getElementById('insp-ls').innerText = `${target.shadowLengthMeters} m`;
    document.getElementById('insp-rs').innerText = `${target.slantRangeMeters} m`;
    document.getElementById('insp-height').innerText = `${target.elevation} m`;

    // Fill Confidence & Actions
    document.getElementById('insp-backscatter').innerText = `-${(10 + Math.random() * 8).toFixed(1)} dB`;
    document.getElementById('insp-confidence').innerText = `${target.confidence}%`;
    
    // Generate realistic Gulf of Mannar coordinate offset
    const lat = `08°58'${(22 + (target.y / 20)).toFixed(1)}"N`;
    const lon = `78°14'${(50 + (target.x / 30)).toFixed(1)}"E`;
    const coordsStr = `${lat} ${lon}`;
    document.getElementById('insp-coords').innerText = coordsStr;
    target.coords = coordsStr;

    document.getElementById('insp-action').innerText = taxonomy.action;

    // Draw Zoom Canvas Slice
    renderZoomThumbnail(target);

    // Drop geo pin on survey map
    if (window.MapTracker) {
      window.MapTracker.addHazardPin(target);
    }
  }

  function renderZoomThumbnail(target) {
    const canvas = document.getElementById('sonarCanvas');
    zoomCtx.fillStyle = '#030508';
    zoomCtx.fillRect(0, 0, targetZoomCanvas.width, targetZoomCanvas.height);

    try {
      // Crop 50x30 region around target and draw with 3.5x scale
      const cropW = Math.max(30, target.width + target.shadowLength + 20);
      const cropH = target.height + 20;
      const cropX = Math.max(0, target.x - (target.x < canvas.width / 2 ? target.shadowLength + 10 : 10));
      const cropY = Math.max(0, target.y - 10);

      zoomCtx.drawImage(
        canvas,
        cropX, cropY, cropW, cropH,
        0, 0, targetZoomCanvas.width, targetZoomCanvas.height
      );
    } catch (e) {
      // Fallback
    }
  }

  function clearAnnotations() {
    trackedAnomalies = [];
    overlay.innerHTML = '';
  }

  function getTaxonomy(type) {
    return DEBRIS_TAXONOMY[type] || DEBRIS_TAXONOMY['ghost-net'];
  }

  function getCurrentlyInspected() {
    return currentlyInspected;
  }

  function getTrackedAnomalies() {
    return trackedAnomalies;
  }

  return {
    registerDetection,
    updateActiveObjects,
    renderBoundingBoxes,
    inspectTarget,
    clearAnnotations,
    getTaxonomy,
    getCurrentlyInspected,
    getTrackedAnomalies,
    playSonarPingChirp
  };
})();

window.AIDetector = AIDetector;
