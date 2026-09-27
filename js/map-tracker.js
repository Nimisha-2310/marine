/**
 * AETHEL-SSS | Tactical Survey Track & Bathymetric Map
 * Simulates standard hydrographic lawnmower survey patterns and georeferenced hazard pins.
 */

const MapTracker = (function () {
  const canvas = document.getElementById('surveyMapCanvas');
  const ctx = canvas.getContext('2d');

  let width = 280;
  let height = 160;

  // Lawnmower Survey Waypoints
  const waypoints = [
    { x: 30, y: 25 },
    { x: 250, y: 25 },
    { x: 250, y: 55 },
    { x: 30, y: 55 },
    { x: 30, y: 85 },
    { x: 250, y: 85 },
    { x: 250, y: 115 },
    { x: 30, y: 115 },
    { x: 30, y: 140 },
    { x: 250, y: 140 }
  ];

  let currentSegment = 0;
  let segmentProgress = 0.0;
  let vesselPos = { x: waypoints[0].x, y: waypoints[0].y };

  const hazardPins = [];

  function init() {
    resize();
    window.addEventListener('resize', resize);
    animate();
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      width = canvas.width;
      height = canvas.height;
    }
  }

  function addHazardPin(target) {
    // Avoid exact duplicate ID pins
    if (hazardPins.some(p => p.id === target.id)) return;

    hazardPins.push({
      id: target.id,
      x: vesselPos.x + (Math.random() * 8 - 4),
      y: vesselPos.y + (Math.random() * 8 - 4),
      type: target.type,
      elevation: target.elevation,
      isCritical: target.type === 'uxo' || target.type === 'ghost-net'
    });
  }

  function animate() {
    // Move vessel along lawnmower survey track
    segmentProgress += 0.0025;
    if (segmentProgress >= 1.0) {
      segmentProgress = 0.0;
      currentSegment = (currentSegment + 1) % (waypoints.length - 1);
    }

    const p1 = waypoints[currentSegment];
    const p2 = waypoints[currentSegment + 1];

    vesselPos.x = p1.x + (p2.x - p1.x) * segmentProgress;
    vesselPos.y = p1.y + (p2.y - p1.y) * segmentProgress;

    draw();
    requestAnimationFrame(animate);
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Planned Survey Track (Lawnmower path)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let i = 0; i < waypoints.length; i++) {
      if (i === 0) ctx.moveTo(waypoints[i].x, waypoints[i].y);
      else ctx.lineTo(waypoints[i].x, waypoints[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Draw Covered Swath Corridor along traveled path
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(27, 231, 186, 0.08)';
    ctx.lineWidth = 14; // Swath width
    ctx.lineCap = 'round';
    for (let i = 0; i <= currentSegment; i++) {
      if (i === 0) ctx.moveTo(waypoints[i].x, waypoints[i].y);
      else if (i < currentSegment) ctx.lineTo(waypoints[i].x, waypoints[i].y);
      else ctx.lineTo(vesselPos.x, vesselPos.y);
    }
    ctx.stroke();

    // 3. Draw Completed Centerline
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(27, 231, 186, 0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= currentSegment; i++) {
      if (i === 0) ctx.moveTo(waypoints[i].x, waypoints[i].y);
      else if (i < currentSegment) ctx.lineTo(waypoints[i].x, waypoints[i].y);
      else ctx.lineTo(vesselPos.x, vesselPos.y);
    }
    ctx.stroke();

    // 4. Draw Georeferenced Hazard Pins
    for (const pin of hazardPins) {
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = pin.isCritical ? '#FF4A5A' : '#E89E43';
      ctx.shadowColor = pin.isCritical ? 'rgba(255, 74, 90, 0.8)' : 'rgba(232, 158, 67, 0.8)';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Pin ID tag
      ctx.fillStyle = '#C0D0E0';
      ctx.font = '8px monospace';
      ctx.fillText(pin.id, pin.x + 6, pin.y + 3);
    }

    // 5. Draw Survey Towfish Vessel
    ctx.beginPath();
    ctx.arc(vesselPos.x, vesselPos.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#1BE7BA';
    ctx.shadowColor = '#1BE7BA';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ping circle ripple
    const rippleRadius = (Date.now() / 30) % 24;
    ctx.beginPath();
    ctx.arc(vesselPos.x, vesselPos.y, rippleRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(27, 231, 186, ${1.0 - rippleRadius / 24})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  return {
    init,
    addHazardPin
  };
})();

window.MapTracker = MapTracker;
