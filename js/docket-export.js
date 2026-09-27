/**
 * AETHEL-SSS | Ministry Incident Docket & GeoJSON Exporter
 * Generates official Hydrographic Survey Directorate incident dockets and downloadable GIS data.
 */

const DocketExporter = (function () {
  const modal = document.getElementById('docket-modal');
  const tableBody = document.getElementById('docket-table-body');

  const loggedDocketItems = [];

  function init() {
    // Modal buttons
    document.getElementById('btn-emergency-docket').addEventListener('click', openDocket);
    document.getElementById('btn-close-docket').addEventListener('click', closeDocket);
    document.getElementById('btn-dismiss-modal').addEventListener('click', closeDocket);
    document.getElementById('btn-print-docket').addEventListener('click', printDocket);
    document.getElementById('btn-export-geojson').addEventListener('click', downloadGeoJSON);

    // Flag item from Inspector
    document.getElementById('btn-flag-for-docket').addEventListener('click', () => {
      const target = window.AIDetector ? window.AIDetector.getCurrentlyInspected() : null;
      if (target) {
        addItem(target);
        if (window.App && window.App.logTelemetry) {
          window.App.logTelemetry(`DOCKET: Target ${target.id} flagged for official salvage docket.`, 'system');
        }
      }
    });
  }

  function addItem(target) {
    if (loggedDocketItems.some(i => i.id === target.id)) return;
    loggedDocketItems.push(target);
  }

  function openDocket() {
    renderTable();
    modal.classList.remove('hidden');
  }

  function closeDocket() {
    modal.classList.add('hidden');
  }

  async function renderTable() {
    tableBody.innerHTML = '';

    let items = loggedDocketItems.length > 0
      ? loggedDocketItems
      : (window.AIDetector ? window.AIDetector.getTrackedAnomalies() : []);

    let criticalCount = 0;
    let totalVol = 0;

    // Fetch certified docket from Python backend
    try {
      const res = await fetch('/api/export-docket');
      if (res.ok) {
        const docketData = await res.json();
        document.getElementById('rpt-id').innerText = docketData.docket_number;
        document.getElementById('rpt-timestamp').innerText = docketData.generated_at_utc;
        
        // Show SHA-256 Attestation
        const authSub = document.querySelector('.docket-authorization .auth-col:last-child .auth-sub');
        if (authSub && docketData.sha256_verification_hash) {
          authSub.innerText = `Sha-256 Hash: ${docketData.sha256_verification_hash.substring(0, 16)}... Certified`;
        }
      }
    } catch (e) {
      // Offline fallback
    }

    items.forEach((item, index) => {
      const row = document.createElement('tr');
      const isCrit = item.type === 'uxo' || item.type === 'ghost-net';
      if (isCrit) criticalCount++;
      totalVol += (item.elevation * 3.2);

      const taxonomy = window.AIDetector ? window.AIDetector.getTaxonomy(item.type) : { name: item.type, action: 'SURVEY' };

      row.innerHTML = `
        <td class="mono font-bold">${item.id}</td>
        <td><span class="risk-pill ${taxonomy.pillClass || 'pill-moderate'}">${taxonomy.name}</span></td>
        <td class="mono">${item.coords || '08°58\'24.8"N 78°14\'53.1"E'}</td>
        <td class="mono">${item.shadowLengthMeters}m / ${item.slantRangeMeters}m</td>
        <td class="mono highlight-cyan font-bold">${item.elevation} m</td>
        <td class="mono">${item.confidence}%</td>
        <td class="action-tag">${taxonomy.action}</td>
      `;
      tableBody.appendChild(row);
    });

    // Update Banner Stats
    document.getElementById('rpt-total-scanned').innerText = items.length;
    document.getElementById('rpt-high-hazards').innerText = criticalCount;
    document.getElementById('rpt-est-volume').innerText = `${totalVol.toFixed(1)} m³`;
  }

  function printDocket() {
    window.print();
  }

  function downloadGeoJSON() {
    const items = loggedDocketItems.length > 0
      ? loggedDocketItems
      : (window.AIDetector ? window.AIDetector.getTrackedAnomalies() : []);

    const features = items.map((item, idx) => {
      // Rough conversion around Gulf of Mannar coordinates
      const lon = 78.247 + (item.x ? item.x * 0.0001 : idx * 0.001);
      const lat = 8.973 + (item.y ? item.y * 0.0001 : idx * 0.001);

      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lon, lat]
        },
        properties: {
          incidentId: item.id,
          classification: item.type,
          acousticShadowLengthMeters: item.shadowLengthMeters,
          calculatedHeightMeters: item.elevation,
          slantRangeMeters: item.slantRangeMeters,
          towfishAltitudeMeters: item.towfishAltitude,
          confidencePercent: item.confidence,
          timestamp: item.timestamp || new Date().toISOString()
        }
      };
    });

    const geojson = {
      type: "FeatureCollection",
      crs: {
        type: "name",
        properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" }
      },
      features: features
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AETHEL_HYDRO_SURVEY_${Date.now()}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    init,
    addItem,
    openDocket
  };
})();

window.DocketExporter = DocketExporter;
