"""
AETHEL-SSS | Tactical Marine Hydrographic Python Backend
Flask REST API & Sonar DSP AI Service
"""

import os
import sys
import json
import time
import math
import random
from flask import Flask, request, jsonify, send_from_directory, Response

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(BASE_DIR, 'backend'))

from sonar_dsp import SonarDSPAnalyzer, CLASSIFICATION_TAXONOMY, generate_docket_hash

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')

# Initialize DSP Analyzer with default hydrographic parameters
dsp_analyzer = SonarDSPAnalyzer(towfish_altitude=12.4, slant_range=75.0, ping_frequency=455)

# In-memory mission state
mission_state = {
    'mission_name': 'OP-SAGAR-NIRIKSHAN // SECTOR G-09',
    'location': 'Gulf of Mannar Biosphere Reserve (Zone B-4)',
    'vessel': 'RV SAGAR DHWANI (IMO 9128829)',
    'towfish_id': 'TF-HYDRA-400',
    'ping_frequency': 455,
    'base_altitude': 12.4,
    'base_depth': 38.6,
    'speed_knots': 3.8,
    'heading_deg': 184.2,
    'active_anomalies': [],
    'docket_records': []
}

# Seed initial detections
for initial_type in ['ghost-net', 'chemical-drum']:
    initial_target = dsp_analyzer.generate_synthetic_anomaly(chosen_type=initial_type)
    mission_state['active_anomalies'].append(initial_target)
    mission_state['docket_records'].append(initial_target)


# -----------------------------------------------------------------------------
# STATIC FRONTEND ROUTES
# -----------------------------------------------------------------------------
@app.route('/')
def serve_index():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(BASE_DIR, path)


# -----------------------------------------------------------------------------
# REST API ENDPOINTS
# -----------------------------------------------------------------------------
@app.route('/api/status', methods=['GET'])
def get_system_status():
    """System health check & DSP hardware connection status."""
    return jsonify({
        'status': 'OPERATIONAL',
        'system': 'AETHEL-SSS Hydrographic Anomaly AI',
        'version': '2.4-HYDRO-PRO',
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'telemetry_link': 'LOCKED_RADIO_ACOUSTIC_LINK',
        'dsp_cores': 4,
        'gpu_acceleration': 'SYNTHETIC_CUDA_ACOUSTIC_SIM',
        'sampling_rate_hz': 24
    })


@app.route('/api/telemetry', methods=['GET'])
def get_telemetry():
    """Live Towfish telemetry with realistic ocean dynamics."""
    # Jitter simulation
    jitter_alt = round(mission_state['base_altitude'] + (random.random() - 0.5) * 0.2, 1)
    jitter_heading = round(mission_state['heading_deg'] + (random.random() - 0.5) * 0.6, 1)
    jitter_depth = round(jitter_alt + 26.2, 1)
    
    # Coords calculation in Gulf of Mannar
    t = time.time()
    lat_sec = round(24.1 + (t / 4.0) % 20, 1)
    lon_sec = round(52.6 + (t / 3.5) % 20, 1)
    coords = f"08°58'{lat_sec}\"N 78°14'{lon_sec}\"E"

    return jsonify({
        'mission': mission_state['mission_name'],
        'vessel_speed_knots': mission_state['speed_knots'],
        'towfish_altitude_m': jitter_alt,
        'water_depth_m': jitter_depth,
        'slant_range_m': dsp_analyzer.slant_range,
        'heading_deg': jitter_heading,
        'heading_cardinal': 'S-SW',
        'ping_frequency_khz': dsp_analyzer.ping_frequency,
        'coordinates': coords,
        'utc_time': time.strftime('%H:%M:%S UTC', time.gmtime()),
        'ai_confidence_index': 98.4
    })


@app.route('/api/anomalies', methods=['GET'])
def get_anomalies():
    """List of all currently detected anomalies with shadow profiler metrics."""
    return jsonify({
        'total_detected': len(mission_state['active_anomalies']),
        'anomalies': mission_state['active_anomalies']
    })


@app.route('/api/detect', methods=['POST'])
def run_detection():
    """
    Runs the Physics-Based Acoustic Shadow Profiling on incoming sonar target data.
    Input payload: { 'x': int, 'y': int, 'width': int, 'height': int, 'type': str }
    """
    payload = request.get_json(silent=True) or {}
    
    # Update altitude if passed
    if 'towfish_altitude' in payload:
        dsp_analyzer.towfish_altitude = float(payload['towfish_altitude'])

    analyzed_target = dsp_analyzer.analyze_acoustic_region(payload)
    
    # Save to mission state
    mission_state['active_anomalies'].append(analyzed_target)
    mission_state['docket_records'].append(analyzed_target)

    return jsonify({
        'success': True,
        'result': analyzed_target
    })


@app.route('/api/inject-anomaly', methods=['POST'])
def inject_synthetic_anomaly():
    """Triggered by the UI button or background survey feed."""
    payload = request.get_json(silent=True) or {}
    chosen_type = payload.get('type')
    new_anomaly = dsp_analyzer.generate_synthetic_anomaly(chosen_type=chosen_type)
    
    mission_state['active_anomalies'].append(new_anomaly)
    mission_state['docket_records'].append(new_anomaly)
    
    return jsonify({
        'success': True,
        'anomaly': new_anomaly
    })


@app.route('/api/export-docket', methods=['GET', 'POST'])
def export_ministry_docket():
    """
    Compiles official Ministry of Ports, Shipping and Waterways /
    Indian Naval Hydrographic Department inspection docket with SHA-256 attestation.
    """
    incidents = mission_state['docket_records']
    crypto_hash = generate_docket_hash(incidents)

    critical_count = sum(1 for i in incidents if i.get('taxonomy', {}).get('threat') in ['CRITICAL', 'EXTREME'])
    total_volume_m3 = round(sum(i.get('physics_metrics', {}).get('calculated_elevation_m', 1.0) * 3.2 for i in incidents), 1)

    docket = {
        'docket_number': f"IND-HYDRO-2026-{random.randint(1000, 9999)}",
        'authority': 'Government of India // Ministry of Ports, Shipping and Waterways',
        'directorate': 'National Hydrographic Office / Underwater Salvage Cell',
        'vessel': mission_state['vessel'],
        'mission': mission_state['mission_name'],
        'sector': mission_state['location'],
        'generated_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'summary': {
            'total_targets_scanned': len(incidents),
            'high_risk_hazards': critical_count,
            'estimated_debris_volume_m3': total_volume_m3,
            'clearance_recommendation': 'IMMEDIATE ROV INTERVENTION REQUIRED' if critical_count > 0 else 'MONITOR SECTOR'
        },
        'sha256_verification_hash': crypto_hash,
        'incidents': incidents
    }

    return jsonify(docket)


@app.route('/api/survey-track', methods=['GET'])
def get_survey_track():
    """Coordinates and bathymetric clearance corridor for the mission map."""
    waypoints = [
        {'x': 30, 'y': 25, 'lat': 8.974, 'lon': 78.245, 'depth_m': 38.2},
        {'x': 250, 'y': 25, 'lat': 8.974, 'lon': 78.258, 'depth_m': 38.5},
        {'x': 250, 'y': 55, 'lat': 8.972, 'lon': 78.258, 'depth_m': 38.8},
        {'x': 30, 'y': 55, 'lat': 8.972, 'lon': 78.245, 'depth_m': 38.6},
        {'x': 30, 'y': 85, 'lat': 8.970, 'lon': 78.245, 'depth_m': 39.1},
        {'x': 250, 'y': 85, 'lat': 8.970, 'lon': 78.258, 'depth_m': 39.4}
    ]
    return jsonify({
        'survey_corridor': 'Lawnmower 100m Spacing',
        'swath_width_m': 150.0,
        'waypoints': waypoints,
        'hazard_pins': [
            {
                'id': i['id'],
                'type': i['type'],
                'coords': i['coords'],
                'threat': i.get('taxonomy', {}).get('threat', 'MODERATE')
            } for i in mission_state['active_anomalies']
        ]
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"[*] AETHEL-SSS Python Hydrographic Backend starting on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
