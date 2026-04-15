import React, { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  Search, Loader2, Building2, Trash2, AlertTriangle, X, MapPin, 
  Layers, Navigation, Wind, Leaf, History, Eye, Map as MapIcon, 
  MessageSquare, Camera, Droplets, Zap, Flame 
} from 'lucide-react';
import axios from 'axios';

// --- STATIC DATA ---
const HYDRANTS = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [76.6551, 12.3051] }, properties: { name: 'Palace Hydrant' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [76.6570, 12.3075] }, properties: { name: 'Muni Office Hydrant' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [76.6510, 12.3040] }, properties: { name: 'West Gate' } }
  ]
};

const MOCK_AQI = {
  type: 'FeatureCollection',
  features: Array.from({ length: 30 }, () => ({
    type: 'Feature',
    properties: { aqi: Math.random() * 200 },
    geometry: { type: 'Point', coordinates: [76.64 + Math.random() * 0.04, 12.29 + Math.random() * 0.04] }
  }))
};

const App = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState('missions');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isDemolishMode, setIsDemolishMode] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [demolishedId, setDemolishedId] = useState(null);
  const [impactData, setImpactData] = useState(null);
  const [currentStyle, setCurrentStyle] = useState('satellite');

  // Vision Features State
  const [floodLevel, setFloodLevel] = useState(0);
  const [timelineYear, setTimelineYear] = useState(2024);
  const [isXrayEnabled, setIsXrayEnabled] = useState(false);
  const [aqiEnabled, setAqiEnabled] = useState(false);
  const [greenEnabled, setGreenEnabled] = useState(false);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [showHydrants, setShowHydrants] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [reports, setReports] = useState([]);
  const [showReportingHint, setShowReportingHint] = useState(false);

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'google-satellite': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256 },
          'google-roads': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'], tileSize: 256 },
          'buildings': { type: 'geojson', data: '/data/mysuru_buildings.json' },
          'utilities': { type: 'geojson', data: '/data/mysuru_utilities.json' },
          'aqi-source': { type: 'geojson', data: MOCK_AQI },
          'hydrants': { type: 'geojson', data: HYDRANTS },
          'blast-circle': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          'emergency-path': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
        },
        layers: [
          { id: 'street-tiles', type: 'raster', source: 'google-roads', layout: { visibility: 'none' } },
          { id: 'satellite-tiles', type: 'raster', source: 'google-satellite' },
          {
            id: 'utility-pipes',
            type: 'line',
            source: 'utilities',
            paint: {
              'line-width': 4,
              'line-color': [
                'match', ['get', 'type'],
                'WaterPipe', '#00bcd4',
                'ElectricityLine', '#ffeb3b',
                'GasLine', '#ff5722',
                '#ffffff'
              ],
              'line-opacity': 0 
            }
          },
          {
            id: '3d-buildings',
            type: 'fill-extrusion',
            source: 'buildings',
            paint: {
              'fill-extrusion-color': '#d4c8b0',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.85
            }
          },
          {
            id: 'aqi-heat',
            type: 'heatmap',
            source: 'aqi-source',
            layout: { 'visibility': 'none' },
            paint: {
              'heatmap-weight': ['get', 'aqi'],
              'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,255,0,0)', 0.5, 'yellow', 1, 'red']
            }
          },
          {
            id: 'hydrant-layer',
            type: 'circle',
            source: 'hydrants',
            layout: { 'visibility': 'none' },
            paint: { 'circle-radius': 6, 'circle-color': '#ff9800', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }
          },
          {
            id: 'emergency-route',
            type: 'line',
            source: 'emergency-path',
            layout: { 'visibility': 'none' },
            paint: { 'line-color': '#00d084', 'line-width': 6, 'line-dasharray': [2, 1] }
          },
          {
            id: 'blast-radius',
            type: 'circle',
            source: 'blast-circle',
            paint: { 'circle-radius': 100, 'circle-color': '#ff3b3b', 'circle-opacity': 0.2, 'circle-stroke-width': 2, 'circle-stroke-color': '#ff3b3b' }
          }
        ]
      },
      center: [76.6551, 12.3051],
      zoom: 16,
      pitch: 55,
      antialias: true
    });

    map.current.on('load', () => {
      setMapLoaded(true);
      map.current.on('click', '3d-buildings', (e) => {
        const f = e.features[0];
        setSelectedBuilding({
          id: f.properties.id,
          name: f.properties.name || 'Structure',
          height: f.properties.height || 3,
          lngLat: e.lngLat
        });
        setDemolishedId(null); // Reset demolition on new selection
        
        const source = map.current.getSource('blast-circle');
        if (source) {
          source.setData({
            type: 'Feature', geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] }
          });
        }
      });

      map.current.on('click', (e) => {
        // Clear selection if clicking empty space
        const features = map.current.queryRenderedFeatures(e.point, { layers: ['3d-buildings'] });
        if (features.length === 0 && !showReportingHint) {
          setSelectedBuilding(null);
          setImpactData(null);
        }

        if (showReportingHint) {
          const newReport = { id: Date.now(), lngLat: e.lngLat, type: 'issue' };
          setReports(prev => [...prev, newReport]);
          setShowReportingHint(false);
          new maplibregl.Marker({ color: '#ffa500' }).setLngLat(e.lngLat).addTo(map.current);
        }
      });
      
      map.current.on('mouseenter', '3d-buildings', () => { map.current.getCanvas().style.cursor = 'pointer'; });
      map.current.on('mouseleave', '3d-buildings', () => { map.current.getCanvas().style.cursor = ''; });
    });

    return () => map.current?.remove();
  }, []);

  // --- VISION LOGIC EFFECTS ---

  // 1. Underground X-Ray & Ground Style
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const isSatellite = currentStyle === 'satellite';
    map.current.setLayoutProperty('satellite-tiles', 'visibility', isSatellite ? 'visible' : 'none');
    map.current.setLayoutProperty('street-tiles', 'visibility', !isSatellite ? 'visible' : 'none');
    
    const groundLayer = isSatellite ? 'satellite-tiles' : 'street-tiles';
    map.current.setPaintProperty(groundLayer, 'raster-opacity', isXrayEnabled ? 0.1 : 1);
    map.current.setPaintProperty('utility-pipes', 'line-opacity', isXrayEnabled ? 1 : 0);
  }, [isXrayEnabled, currentStyle]);

  // 2. Timeline Filter
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const saturation = timelineYear < 1960 ? 0 : 1;
    const sepia = timelineYear < 1960 ? 0.7 : 0;
    map.current.getCanvas().style.filter = `saturate(${saturation}) sepia(${sepia})`;
  }, [timelineYear]);

  // 3. Flood Level
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    map.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
      'case',
      ['<', ['%', ['get', 'id'], 15], Number(floodLevel)], '#0061ff',
      currentStyle === 'satellite' ? '#d4c8b0' : '#e8e0d4'
    ]);
  }, [floodLevel, currentStyle]);

  // 4. AQI & Green Cover
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    map.current.setLayoutProperty('aqi-heat', 'visibility', aqiEnabled ? 'visible' : 'none');
    map.current.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', [
      'case',
      ['==', ['get', 'id'], demolishedId], 0,
      greenEnabled ? 0.25 : 0.85
    ]);
    
    map.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
      'case',
      ['==', ['get', 'id'], selectedBuilding?.id], '#ff3b3b',
      currentStyle === 'satellite' ? '#d4c8b0' : '#e8e0d4'
    ]);
  }, [aqiEnabled, greenEnabled, demolishedId, selectedBuilding, currentStyle]);

  // 5. Hydrants & Emergency Routes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    map.current.setLayoutProperty('hydrant-layer', 'visibility', showHydrants ? 'visible' : 'none');
    map.current.setLayoutProperty('emergency-route', 'visibility', isEmergencyActive ? 'visible' : 'none');
  }, [showHydrants, isEmergencyActive]);

  // --- ACTIONS ---
  const handleSearch = async (e) => {
    if (e.key !== 'Enter' || !searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${searchQuery},Mysuru,India&format=json&limit=1`);
      if (res.data[0]) {
        map.current.flyTo({ center: [res.data[0].lon, res.data[0].lat], zoom: 17, duration: 2500, pitch: 55 });
      }
    } catch (err) { console.error(err); }
    setIsSearching(false);
  };

  const handleDemolish = () => {
    if (!selectedBuilding) return;
    
    // Simulating backend heuristic analysis locally
    const utilities = ['Electricity', 'Water', 'Gas'];
    const utilitiesCut = utilities.filter(() => Math.random() > 0.4);
    if (utilitiesCut.length === 0) utilitiesCut.push('Electricity'); // Ensure at least one

    const householdImpact = Math.floor(Math.random() * 250) + 40;
    const trafficDelayMinutes = Math.floor(Math.random() * 20) + 5;
    
    setDemolishedId(selectedBuilding.id);
    setImpactData({
      utilitiesCut,
      impactedHouseholds: householdImpact,
      trafficDelay: `+${trafficDelayMinutes} mins`,
      suggestedReroute: 'Reroute via Outer Ring Road, Mysuru'
    });
  };

  const openStreetView = () => {
    if (!selectedBuilding) return;
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${selectedBuilding.lngLat.lat},${selectedBuilding.lngLat.lng}`, '_blank');
  };

  return (
    <div className="app-root">
      {!mapLoaded && (
        <div className="preloader">
          <div className="preloader-content">
            <Loader2 className="spin" size={48} />
            <h3>Initializing Command Shell...</h3>
            <p>Syncing GIS layers and spatial metadata</p>
          </div>
        </div>
      )}
      <div ref={mapContainer} className="map-viewport" />

      {/* FLOATING SEARCH */}
      <div className="search-container">
        <div className="search-box">
          <div className="search-icon-wrap">
            {isSearching ? <Loader2 className="spin" size={20} /> : <Search size={20} />}
          </div>
          <input 
            className="search-field"
            placeholder="Search Landmarks (e.g. Mysore Palace)..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
      </div>

      {/* VIEW CONTROLS */}
      <div className="view-actions">
        <button className={`view-btn ${isXrayEnabled ? 'active' : ''}`} onClick={() => setIsXrayEnabled(!isXrayEnabled)}>
          <Eye size={18} /> <span>{isXrayEnabled ? "Surface" : "X-Ray"}</span>
        </button>
        <button className={`view-btn ${currentStyle === 'satellite' ? 'active' : ''}`} onClick={() => setCurrentStyle(currentStyle === 'satellite' ? 'streets' : 'satellite')}>
          <Layers size={18} /> <span>{currentStyle === 'satellite' ? "Streets" : "Satellite"}</span>
        </button>
      </div>

      {/* SIDE PANEL */}
      <div className="side-panel">
        <div className="panel-header" onClick={() => setSelectedBuilding(null)}>
          <Building2 size={28} className="icon-main" />
          <div>
            <h2>Policy Simulation Shell</h2>
            <span className="panel-subtitle">Integrated Impact Engine v3.0</span>
          </div>
        </div>

        {/* CATEGORY TABS */}
        <div className="panel-tabs">
          <button className={`tab-btn ${activeTab === 'missions' ? 'active' : ''}`} onClick={() => setActiveTab('missions')} title="Zoning Simulations"><Zap size={16}/><span>Zoning</span></button>
          <button className={`tab-btn ${activeTab === 'crisis' ? 'active' : ''}`} onClick={() => setActiveTab('crisis')} title="Resilience Policies"><AlertTriangle size={16}/><span>Resilience</span></button>
          <button className={`tab-btn ${activeTab === 'eco' ? 'active' : ''}`} onClick={() => setActiveTab('eco')} title="Climate Metrics"><Leaf size={16}/><span>Climate</span></button>
          <button className={`tab-btn ${activeTab === 'heritage' ? 'active' : ''}`} onClick={() => setActiveTab('heritage')} title="Heritage Preservation"><History size={16}/><span>Preservation</span></button>
          <button className={`tab-btn ${activeTab === 'social' ? 'active' : ''}`} onClick={() => setActiveTab('social')} title="Public Engagement"><MessageSquare size={16}/><span>Public</span></button>
        </div>

        <div className="scroll-area">
          {activeTab === 'missions' && (
            <div className="panel-section">
              <button 
                className={`demolish-toggle ${isDemolishMode ? 'active' : ''}`} 
                onClick={() => {
                  setIsDemolishMode(!isDemolishMode);
                  if (isDemolishMode) {
                    setDemolishedId(null);
                    setSelectedBuilding(null);
                    setImpactData(null);
                  }
                }}
              >
                <Trash2 size={18} /> {isDemolishMode ? 'Restore Architecture' : 'Simulate Zoning Impact'}
              </button>
              
              {selectedBuilding && (
                <div className="building-detail glass">
                  <div className="detail-row">
                    <MapPin size={18} color="#ff3b3b" />
                    <strong>{selectedBuilding.name}</strong>
                  </div>
                  <div className="detail-grid">
                    <div className="stat-item"><small>Height</small><span>{selectedBuilding.height}m</span></div>
                    <div className="stat-item"><small>Status</small><span style={{color:'#00d084'}}>Operational</span></div>
                  </div>
                  <div className="action-grid">
                    <button className="analyze-btn" onClick={openStreetView}><Camera size={14}/> Street View</button>
                    {isDemolishMode && <button className="analyze-btn danger" onClick={handleDemolish}>Generate Report</button>}
                  </div>
                </div>
              )}

              {impactData && (
                <div className="impact-report">
                  <h4><AlertTriangle size={16}/> Heuristic Policy Audit</h4>
                  <div className="impact-stats">
                    <div className="stat-card"><strong>{impactData.impactedHouseholds}</strong><small>Affected Homes</small></div>
                    <div className="stat-card"><strong>{impactData.trafficDelay}</strong><small>Traffic Delay</small></div>
                  </div>
                  <div className="impact-badges">
                    {impactData.utilitiesCut.map(u => <span key={u} className="badge">{u} Cut</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'crisis' && (
            <div className="panel-section">
              <label className="section-label">Flood Inundation Level</label>
              <input type="range" min="0" max="15" value={floodLevel} onChange={e => setFloodLevel(Number(e.target.value))} className="flood-slider" />
              <div className="slider-labels"><span>0m (Safe)</span><span>15m (Critical)</span></div>
              
              <div className="grid-btns">
                <button className={`action-btn ${showHydrants ? 'active' : ''}`} onClick={() => setShowHydrants(!showHydrants)}>
                  <Flame size={20}/> Fire Hydrants
                </button>
                <button className={`action-btn ${isEmergencyActive ? 'active' : ''}`} onClick={() => setIsEmergencyActive(!isEmergencyActive)}>
                  <Navigation size={20}/> EMS Strategy
                </button>
              </div>
            </div>
          )}

          {activeTab === 'eco' && (
            <div className="panel-section eco-panel">
              <label className="section-label">Environmental Metrics</label>
              <div className="toggle-row">
                <span>AQI Heatmap Layer</span>
                <button className={`toggle-sm ${aqiEnabled ? 'on' : ''}`} onClick={() => setAqiEnabled(!aqiEnabled)} />
              </div>
              <div className="toggle-row">
                <span>Vegetation Health Index</span>
                <button className={`toggle-sm ${greenEnabled ? 'on' : ''}`} onClick={() => setGreenEnabled(!greenEnabled)} />
              </div>
              {greenEnabled && <div className="stat-box">City Sustainability Score: <strong>A+ (8.2/10)</strong></div>}
            </div>
          )}

          {activeTab === 'heritage' && (
            <div className="panel-section">
              <label className="section-label">Temporal Sprawl: {timelineYear}</label>
              <input type="range" min="1920" max="2024" step="10" value={timelineYear} onChange={e => setTimelineYear(Number(e.target.value))} className="timeline-slider" />
              <p className="hint-text">Simulate historical city sprawl and vintage atmosphere.</p>
              {selectedBuilding?.name.toLowerCase().includes("palace") && (
                <div className="heritage-card">
                  <div className="img-wrap"><img src="https://upload.wikimedia.org/wikipedia/commons/1/1a/Mysore_Palace_Morning.jpg" alt="Heritage"/></div>
                  <p>Amba Vilas Palace: Primary residence of the Wadiyar dynasty.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'social' && (
            <div className="panel-section social-panel">
              <button 
                className={`action-btn wide ${showReportingHint ? 'active' : ''}`}
                onClick={() => setShowReportingHint(true)}
              >
                <MessageSquare size={18} /> File Citizen Report
              </button>
              {showReportingHint && <span className="pulse-text">Select point on map to verify report.</span>}
              <div className="report-list">
                <div className="report-item">✅ Streetlight fixed at Ward 15</div>
                {reports.map(r => (
                  <div key={r.id} className="report-item yellow">⚠️ New Report (Pending)</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="panel-section monitor-section">
          <div className="compliance-bar">
            <span>Overall Policy Compliance</span>
            <strong>{floodLevel > 5 || aqiEnabled ? '74%' : '92%'}</strong>
          </div>
          <div className="status-indicator">
            <div className="dot" style={{ background: floodLevel > 8 ? '#ff3b3b' : '#00d084' }} />
            <span>System Health: {floodLevel > 8 ? 'Critical Threshold' : 'Optimal Policy Range'}</span>
          </div>
        </div>

        <div className="panel-footer">Integrated Policy Pulse Shell v3.0 | Mysore 2026</div>
      </div>
    </div>
  );
};

export default App;
