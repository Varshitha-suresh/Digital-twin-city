import React, { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  Search, Loader2, Building2, Trash2, AlertTriangle, X, MapPin, 
  Layers, Navigation, Wind, Leaf, History, Eye, Map as MapIcon, 
  MessageSquare, Camera, Droplets, Zap, Flame, RefreshCw, Info, Activity,
  CheckCircle2, Clock, Upload, Filter, Tag, AlertCircle, Landmark, ShieldAlert, Sparkles, ChevronRight,
  School, Stethoscope, Car, Wrench, ShieldCheck, Ruler, Calendar, Truck
} from 'lucide-react';
import axios from 'axios';
import {
  calculateBuildingMetrics,
  auditUtilitiesAtLocation,
  auditInstitutionsAtLocation,
  computeTrafficDisruption,
  generateZoningRecommendations,
  findBuildingAtPoint,
  formatBuildingName,
  extractOuterRing,
  generatePointParcel
} from './zoningAnalysisEngine.js';
import {
  EMS_HUBS,
  EMS_DESTINATIONS,
  findNearestEmsHub,
  calculateFastestEmsRoute
} from './emsRoutingEngine.js';

// --- STATIC DATA ---
const HYDRANTS = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [76.6551, 12.3051] }, properties: { name: 'Palace Hydrant' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [76.6570, 12.3075] }, properties: { name: 'Muni Office Hydrant' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [76.6510, 12.3040] }, properties: { name: 'West Gate' } }
  ]
};

// Historical Datasets and Chronicles of Old Mysuru
const MYSURU_HISTORICAL_PERIODS = [
  {
    id: 'era-1920',
    year: 1920,
    title: '1920: Nalwadi Krishnaraja Wadiyar Golden Era',
    ruler: 'Maharaja Krishnaraja Wadiyar IV',
    description: 'First electrified city in India, world-class garden city master plan under Sir M. Visvesvaraya, pristine royal lakes and heritage tree boulevards.',
    builtUpCoverage: '14.2 sq.km',
    greenCoverPercent: '68%',
    waterbodiesCount: 28,
    heritageScore: '98/100',
    features: ['Original Amba Vilas Palace & Quadrangle', 'Devaraja Market in pristine condition', 'Natural Kukkarahalli & Karanji wetlands uncompromised']
  },
  {
    id: 'era-1960',
    year: 1960,
    title: '1960: Post-Independence Municipal Expansion',
    ruler: 'Mysore State Administration',
    description: 'Transition into modern administrative hub; early industrial zones at Hebbal; water conduits expanded while central heritage precinct remained conserved.',
    builtUpCoverage: '32.6 sq.km',
    greenCoverPercent: '54%',
    waterbodiesCount: 24,
    heritageScore: '86/100',
    features: ['Saraswathipuram & Manasagangothri educational corridor', 'Initial peripheral fringe development', 'Early road widenings around Sayyaji Rao Rd']
  },
  {
    id: 'era-1995',
    year: 1995,
    title: '1995: Early Urbanization & Lake Infill',
    ruler: 'Mysuru City Corporation & MUDA',
    description: 'Onset of IT industry satellite offices and rapid outward residential layouts (Vijayanagar, Kuvempunagar); early stress on lake catchments.',
    builtUpCoverage: '68.5 sq.km',
    greenCoverPercent: '38%',
    waterbodiesCount: 16,
    heritageScore: '68/100',
    features: ['Buffer zone pressures around Kukkarahalli Lake', 'Concrete commercial conversions near KR Circle', 'Fringe deforestation along foothills']
  },
  {
    id: 'era-2024',
    year: 2024,
    title: '2024: Modern Metropolis & Land Encroachment Conflict',
    ruler: 'Smart Cities Mission / MCC',
    description: 'Contemporary urban agglomeration; heavy arterial traffic corridors; critical urgency to audit and demolish encroachments on heritage waterbodies & reserves.',
    builtUpCoverage: '128.4 sq.km',
    greenCoverPercent: '22%',
    waterbodiesCount: 9,
    heritageScore: '52/100',
    features: ['30% lost wetland buffer in Kukkarahalli', 'Chamundi foothills buffer fragmentation', 'Unauthorized building cantilevers in heritage markets']
  }
];

// Documented Mysuru Heritage Land Encroachment Incidents
const MYSURU_ENCROACHMENTS = [
  {
    id: 'enc-1',
    name: 'Kukkarahalli Lake Wetland Buffer Encroachment',
    category: 'Waterbody & Wetlands',
    coordinates: [76.6295, 12.3060],
    historicalPeriod: '1864 CE (Mummadi Krishnaraja Wadiyar)',
    originalExtent: '120 Hectares (1864 Survey)',
    currentExtent: '84 Hectares (30% Loss)',
    encroachmentType: 'Illegal Commercial Warehouses & Asphalted Parking',
    riskLevel: 'CRITICAL',
    color: '#ef4444',
    yearDetected: '1998 - 2024',
    legalStatus: 'Karnataka High Court PIL 2002 Buffer Notification Pending Demolition',
    impact: 'Catchment severance, untreated sewage infill, 180+ bird roosting spots threatened.'
  },
  {
    id: 'enc-2',
    name: 'Chamundi Hill Reserve Foothill Buffer Encroachment',
    category: 'Eco-Sensitive Heritage Zone',
    coordinates: [76.6710, 12.2850],
    historicalPeriod: '17th Century Sacred Hill Precinct',
    originalExtent: '1,450 Hectares Contiguous Forest Canopy',
    currentExtent: '1,080 Hectares (25.5% Fragmentation)',
    encroachmentType: 'Unsanctioned Commercial Hospitality, Resorts & Construction Debris',
    riskLevel: 'HIGH',
    color: '#f97316',
    yearDetected: '2005 - 2023',
    legalStatus: 'Declared Eco-Sensitive Buffer Zone (ESZ); 14 notices issued by Forest Dept',
    impact: 'Gully erosion along road curves, depletion of groundwater recharge, leopard corridor disruption.'
  },
  {
    id: 'enc-3',
    name: 'Devaraja Market Heritage Precinct Buffer',
    category: 'Heritage Architectural Monument',
    coordinates: [76.6530, 12.3115],
    historicalPeriod: '1886 CE (Chamaraja Wadiyar IX)',
    originalExtent: '3.5 Hectares Open Quadrangle & Carriage Arcades',
    currentExtent: '2.1 Hectares (Enclosed by Unregistered Concrete Annexes)',
    encroachmentType: 'Unauthorized Multi-level Tin Sheds & Concrete Cantilevers',
    riskLevel: 'HIGH',
    color: '#eab308',
    yearDetected: '1985 - 2020',
    legalStatus: 'Heritage Conservation Committee Grade-I Monument Protection Order',
    impact: 'Severe emergency fire accessibility hazard; structural stress on 135-year lime mortar rafters.'
  },
  {
    id: 'enc-4',
    name: 'Karanji Lake Nature Park Catchment Encroachment',
    category: 'Waterbody & Bird Sanctuary',
    coordinates: [76.6730, 12.3040],
    historicalPeriod: '1910s (Royal Avian Lake & Walkway)',
    originalExtent: '90 Hectares Water Spread & Marshy Buffer',
    currentExtent: '68 Hectares (24.4% Infill)',
    encroachmentType: 'Private Institutional Compounds & Road Widening Silt Influx',
    riskLevel: 'CRITICAL',
    color: '#ef4444',
    yearDetected: '1995 - 2022',
    legalStatus: 'Zoo Authority of Karnataka (ZAK) Monitored Lake; Eviction Drive Slated',
    impact: 'Marshland shrinkage, eutrophication spikes, reduction in pelican wintering habitat.'
  },
  {
    id: 'enc-5',
    name: 'Lalitha Mahal Palace Heritage Corridor Encroachment',
    category: 'Royal Vista & Ridge Corridor',
    coordinates: [76.6850, 12.2980],
    historicalPeriod: '1921 CE (Nalwadi Krishnaraja Wadiyar)',
    originalExtent: '45 Hectares Italianate Ridge Gardens',
    currentExtent: '31 Hectares',
    encroachmentType: 'Peripheral Residential Layout Violations & Tree Felling',
    riskLevel: 'MEDIUM',
    color: '#a855f7',
    yearDetected: '2010 - 2024',
    legalStatus: 'MUDA Master Plan 2031 Protected Ridge Line',
    impact: 'Obstruction of historic visual corridor between Lalitha Mahal and Chamundi Hill.'
  }
];

// Key Mysuru Air Quality Monitoring Sectors & CAAQMS Stations
const MYSURU_AQI_STATIONS = [
  { id: 'hebbal', name: 'Hebbal 1st Stage (KSPCB CAAQMS)', coordinates: [76.6110, 12.3350], zone: 'Industrial / Tech Hub', baseOffset: 8 },
  { id: 'palace', name: 'Amba Vilas (Mysore Palace)', coordinates: [76.6551, 12.3051], zone: 'Heritage & Tourism Core', baseOffset: 0 },
  { id: 'devaraja', name: 'Devaraja Market / City Bus Stand', coordinates: [76.6530, 12.3115], zone: 'Commercial & High Traffic', baseOffset: 14 },
  { id: 'chamarajapuram', name: 'Chamarajapuram / Saraswathipuram', coordinates: [76.6385, 12.3010], zone: 'Institutional & Residential', baseOffset: -4 },
  { id: 'chamundi', name: 'Chamundi Hills Foothills', coordinates: [76.6710, 12.2850], zone: 'Eco-Sensitive / Green Zone', baseOffset: -12 },
  { id: 'vijayanagar', name: 'Vijayanagar 2nd Stage', coordinates: [76.6150, 12.3180], zone: 'Residential West', baseOffset: -2 },
  { id: 'kuvempunagar', name: 'Kuvempunagar Complex', coordinates: [76.6320, 12.2890], zone: 'Residential & Commercial South', baseOffset: 2 },
  { id: 'bannimantap', name: 'Bannimantap Torchlight Grounds', coordinates: [76.6500, 12.3330], zone: 'North Highway Corridor', baseOffset: 9 },
  { id: 'subbarayanakere', name: 'Subbarayanakere / KR Circle', coordinates: [76.6505, 12.3070], zone: 'Central Traffic Arterial', baseOffset: 12 },
  { id: 'gokulam', name: 'Gokulam 3rd Stage', coordinates: [76.6260, 12.3270], zone: 'Green Residential', baseOffset: -5 }
];

// Helper to determine Indian NAQI / US EPA category and styling
const getAqiCategory = (val) => {
  if (val <= 50) return { label: 'Good', color: '#00e400', desc: 'Minimal impact' };
  if (val <= 100) return { label: 'Satisfactory / Moderate', color: '#ffff00', desc: 'Minor breathing discomfort to sensitive people' };
  if (val <= 200) return { label: 'Moderate', color: '#ff7e00', desc: 'Breathing discomfort to people with lungs/asthma' };
  if (val <= 300) return { label: 'Poor', color: '#ff0000', desc: 'Breathing discomfort to most people on prolonged exposure' };
  if (val <= 400) return { label: 'Very Poor', color: '#8f3f97', desc: 'Respiratory illness on prolonged exposure' };
  return { label: 'Severe', color: '#7e0023', desc: 'Affects healthy people and seriously impacts those with existing diseases' };
};

// Generate a uniform, evenly spread spatial coverage across Greater Mysuru using Inverse Distance Weighting (IDW)
// This guarantees smooth, continuous coverage across the entire city without empty patches or clumping.
const generateAqiGeoJson = (stationsData) => {
  const pointFeatures = [];
  const cellFeatures = [];

  // 1. Add Official Ground Stations
  stationsData.forEach(st => {
    pointFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: st.coordinates },
      properties: { 
        id: st.id,
        name: st.name,
        zone: st.zone,
        aqi: st.aqi,
        pm2_5: st.pm2_5,
        pm10: st.pm10,
        no2: st.no2,
        isStation: true
      }
    });
  });

  // 2. Uniform 15x15 Inverse Distance Weighting (IDW) Spatial Grid across Mysuru (76.59°E to 76.71°E, 12.26°N to 12.37°N)
  const minLng = 76.59, maxLng = 76.71;
  const minLat = 12.26, maxLat = 12.37;
  const stepsLng = 16;
  const stepsLat = 16;
  const dLng = (maxLng - minLng) / stepsLng;
  const dLat = (maxLat - minLat) / stepsLat;

  for (let i = 0; i <= stepsLng; i++) {
    for (let j = 0; j <= stepsLat; j++) {
      const lng = minLng + i * dLng;
      const lat = minLat + j * dLat;

      // Inverse Distance Weighting formula (power p=2)
      let weightSum = 0;
      let aqiSum = 0;
      let pm25Sum = 0;
      let pm10Sum = 0;

      for (const st of stationsData) {
        const dist = Math.hypot(lng - st.coordinates[0], (lat - st.coordinates[1]) * 1.05);
        const w = 1 / Math.pow(Math.max(dist, 0.003), 2.2);
        weightSum += w;
        aqiSum += st.aqi * w;
        pm25Sum += st.pm2_5 * w;
        pm10Sum += st.pm10 * w;
      }

      const interpAqi = Math.round(aqiSum / weightSum);
      const interpPm25 = +(pm25Sum / weightSum).toFixed(1);
      const interpPm10 = +(pm10Sum / weightSum).toFixed(1);
      const cat = getAqiCategory(interpAqi);

      // Point for the continuous heatmap shader
      pointFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { aqi: interpAqi, isStation: false }
      });

      // Polygon cell for the Modern Environmental Iso-Choropleth Grid view
      const halfW = dLng * 0.46;
      const halfH = dLat * 0.46;
      cellFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [lng - halfW, lat - halfH],
            [lng + halfW, lat - halfH],
            [lng + halfW, lat + halfH],
            [lng - halfW, lat + halfH],
            [lng - halfW, lat - halfH]
          ]]
        },
        properties: {
          aqi: interpAqi,
          color: cat.color,
          label: cat.label,
          pm2_5: interpPm25,
          pm10: interpPm10
        }
      });
    }
  }

  return {
    pointsGeoJson: { type: 'FeatureCollection', features: pointFeatures },
    cellsGeoJson: { type: 'FeatureCollection', features: cellFeatures }
  };
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
  const [zoningAuditTab, setZoningAuditTab] = useState('overview'); // 'overview', 'utilities', 'institutions', 'protocol'
  const [utilitiesDataCache, setUtilitiesDataCache] = useState(null);
  const [allBuildingsCache, setAllBuildingsCache] = useState(null);
  const allBuildingsRef = useRef(null);
  const isDemolishModeRef = useRef(false);
  const [currentStyle, setCurrentStyle] = useState('satellite');

  // Vision Features State
  const [floodLevel, setFloodLevel] = useState(0);
  const [timelineYear, setTimelineYear] = useState(2024);
  const [isXrayEnabled, setIsXrayEnabled] = useState(false);
  const [aqiEnabled, setAqiEnabled] = useState(false);
  const [greenEnabled, setGreenEnabled] = useState(false);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [emsOriginHub, setEmsOriginHub] = useState(EMS_HUBS[0].id);
  const [emsDestinationId, setEmsDestinationId] = useState(EMS_DESTINATIONS[0].id);
  const [emsCustomTarget, setEmsCustomTarget] = useState(null); // [lon, lat]
  const [emsRouteResult, setEmsRouteResult] = useState(null);
  const [emsRoutingLoading, setEmsRoutingLoading] = useState(false);
  const [showTurnByTurn, setShowTurnByTurn] = useState(false);
  const [showHydrants, setShowHydrants] = useState(false);
  const [showEncroachments, setShowEncroachments] = useState(true);
  const [selectedEncroachment, setSelectedEncroachment] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  // --- PUBLIC CIVIC FLAG & GRIEVANCE REPORTING STATE ---
  const [reports, setReports] = useState([
    {
      id: 101,
      title: 'Broken Streetlight & Dark Corridor',
      category: 'Streetlighting',
      description: 'Streetlight pole broken near junction, creating a hazardous blindspot at night.',
      status: 'solved', // 'pending', 'in_progress', 'solved'
      coordinates: [76.6534, 12.3082],
      locationName: 'Devaraja Urs Road Junction',
      date: '2026-10-20 09:30 AM',
      image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=400&q=80',
      officialNote: 'Muni maintenance unit replaced bulb & rewired transformer.'
    },
    {
      id: 102,
      title: 'Hazardous Deep Pothole on Highway Turn',
      category: 'Roads & Infrastructure',
      description: 'Deep trench-like pothole causing vehicle wheel damage and 2-wheeler skids.',
      status: 'in_progress',
      coordinates: [76.6450, 12.3160],
      locationName: 'Jhansi Lakshmi Bai Rd, Subbarayanakere',
      date: '2026-10-21 04:15 PM',
      image: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=400&q=80',
      officialNote: 'Asphalt cold-patch dispatched by PWD Ward 7 team.'
    },
    {
      id: 103,
      title: 'Water Main Pipeline Leakage',
      category: 'Water & Utilities',
      description: 'High pressure drinking water pipe ruptured and flooding the pedestrian walkway.',
      status: 'pending',
      coordinates: [76.6380, 12.3015],
      locationName: 'Chamarajapuram 4th Main',
      date: '2026-10-22 06:10 AM',
      image: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=400&q=80',
      officialNote: 'Awaiting Mysuru City Corporation water board inspection.'
    }
  ]);
  const [showReportingHint, setShowReportingHint] = useState(false);
  const showReportingHintRef = useRef(false);
  useEffect(() => {
    showReportingHintRef.current = showReportingHint;
  }, [showReportingHint]);

  const [isFlaggingModalOpen, setIsFlaggingModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportFilter, setReportFilter] = useState('all'); // 'all', 'pending', 'in_progress', 'solved'
  const [draftCoords, setDraftCoords] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState('Roads & Infrastructure');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftImage, setDraftImage] = useState('');
  const reportMarkersRef = useRef({});

  // Fetch persisted complaints from backend server on startup with localStorage fallback
  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/complaints');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setReports(res.data);
          return;
        }
      } catch (err) {
        console.warn('Backend complaints fetch failed, checking localStorage fallback:', err);
      }
      try {
        const cached = localStorage.getItem('mysuru_civic_reports');
        if (cached) {
          setReports(JSON.parse(cached));
        }
      } catch (e) {
        console.warn('Could not read cached reports', e);
      }
    };
    fetchComplaints();
  }, []);

  // Real-time AQI State
  const [aqiLoading, setAqiLoading] = useState(false);
  const [aqiData, setAqiData] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [aqiLastUpdated, setAqiLastUpdated] = useState(null);
  const [aqiMode, setAqiMode] = useState('heatmap'); // 'heatmap' (evenly spread IDW), 'grid' (hex/micro-zone blocks), 'stations' (monitoring stations)
  const aqiPopupRef = useRef(null);

  // Initial GeoJSON setup with base Mysuru station coordinates & IDW grid
  const [aqiDataSets, setAqiDataSets] = useState(() => 
    generateAqiGeoJson(MYSURU_AQI_STATIONS.map(s => ({
      ...s,
      aqi: 52 + s.baseOffset,
      pm2_5: 14.5 + s.baseOffset * 0.4,
      pm10: 38 + s.baseOffset * 0.7,
      no2: 12 + s.baseOffset * 0.3
    })))
  );

  // Function to fetch real-time air quality telemetry from official CAAQMS feeds for Mysore
  const fetchLiveMysoreAqi = async () => {
    setAqiLoading(true);
    try {
      // 1. Fetch real-time Open-Meteo European/US AQI & atmospheric telemetry for Mysuru coordinates
      const res = await axios.get(
        'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=12.3051&longitude=76.6551&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone'
      );
      
      const current = res.data?.current || {};
      const baseAqi = current.us_aqi || 52;
      const basePm25 = current.pm2_5 || 14.2;
      const basePm10 = current.pm10 || 36.5;
      const baseNo2 = current.nitrogen_dioxide || 10.4;
      const baseSo2 = current.sulphur_dioxide || 4.2;
      const baseCo = current.carbon_monoxide || 280;
      const baseO3 = current.ozone || 85;

      // Distribute to Mysore stations taking local zone characteristics into account
      const updatedStations = MYSURU_AQI_STATIONS.map(st => {
        const localAqi = Math.max(15, Math.round(baseAqi + st.baseOffset));
        return {
          ...st,
          aqi: localAqi,
          category: getAqiCategory(localAqi),
          pm2_5: +(basePm25 + st.baseOffset * 0.3).toFixed(1),
          pm10: +(basePm10 + st.baseOffset * 0.6).toFixed(1),
          no2: +(baseNo2 + st.baseOffset * 0.25).toFixed(1),
          so2: baseSo2,
          co: baseCo,
          o3: baseO3
        };
      });

      const { pointsGeoJson, cellsGeoJson } = generateAqiGeoJson(updatedStations);
      setAqiDataSets({ pointsGeoJson, cellsGeoJson });
      setAqiData({
        currentAqi: baseAqi,
        category: getAqiCategory(baseAqi),
        pm2_5: basePm25,
        pm10: basePm10,
        no2: baseNo2,
        so2: baseSo2,
        co: baseCo,
        o3: baseO3,
        stations: updatedStations,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      setAqiLastUpdated(new Date().toLocaleTimeString());

      // Update MapLibre sources dynamically if map loaded
      if (map.current) {
        if (map.current.getSource('aqi-source')) {
          map.current.getSource('aqi-source').setData(pointsGeoJson);
        }
        if (map.current.getSource('aqi-cells-source')) {
          map.current.getSource('aqi-cells-source').setData(cellsGeoJson);
        }
      }
    } catch (err) {
      console.warn('Real-time AQI fetch error, using local fallback:', err);
      // Fallback with sensible default Mysuru values
      const fallbackStations = MYSURU_AQI_STATIONS.map(st => {
        const localAqi = Math.max(20, Math.round(52 + st.baseOffset));
        return {
          ...st,
          aqi: localAqi,
          category: getAqiCategory(localAqi),
          pm2_5: +(15 + st.baseOffset * 0.3).toFixed(1),
          pm10: +(38 + st.baseOffset * 0.6).toFixed(1),
          no2: +(12 + st.baseOffset * 0.2).toFixed(1),
          so2: 4.1,
          co: 285,
          o3: 88
        };
      });
      const { pointsGeoJson, cellsGeoJson } = generateAqiGeoJson(fallbackStations);
      setAqiDataSets({ pointsGeoJson, cellsGeoJson });
      setAqiData({
        currentAqi: 52,
        category: getAqiCategory(52),
        pm2_5: 15.2,
        pm10: 38.0,
        no2: 12.0,
        so2: 4.1,
        co: 285,
        o3: 88,
        stations: fallbackStations,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } finally {
      setAqiLoading(false);
    }
  };

  // Sync isDemolishMode with ref for click handlers
  const isEmergencyActiveRef = useRef(false);
  useEffect(() => {
    isDemolishModeRef.current = isDemolishMode;
  }, [isDemolishMode]);
  useEffect(() => {
    isEmergencyActiveRef.current = isEmergencyActive;
  }, [isEmergencyActive]);

  // Initial fetch of real-time Mysore air quality and preload all buildings
  useEffect(() => {
    fetchLiveMysoreAqi();
    axios.get('/data/mysuru_buildings.json')
      .then(res => {
        if (res.data?.features) {
          setAllBuildingsCache(res.data.features);
          allBuildingsRef.current = res.data.features;
        }
      })
      .catch(err => console.warn('Could not preload buildings geojson:', err));
  }, []);

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
          'aqi-source': { type: 'geojson', data: aqiDataSets.pointsGeoJson },
          'aqi-cells-source': { type: 'geojson', data: aqiDataSets.cellsGeoJson },
          'hydrants': { type: 'geojson', data: HYDRANTS },
          'selected-parcel-source': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          'terrain-grid-source': { type: 'geojson', data: '/data/mysuru_terrain_grid.json' },
          'blast-circle': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          'emergency-path': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
          'mysuru-encroachments': { type: 'geojson', data: '/data/mysuru_encroachments.json' }
        },
        layers: [
          { id: 'street-tiles', type: 'raster', source: 'google-roads', layout: { visibility: 'none' } },
          { id: 'satellite-tiles', type: 'raster', source: 'google-satellite' },
          {
            id: 'encroachment-zones-fill',
            type: 'fill',
            source: 'mysuru-encroachments',
            layout: { visibility: 'visible' },
            paint: {
              'fill-color': ['get', 'color'],
              'fill-opacity': 0.42
            }
          },
          {
            id: 'encroachment-zones-line',
            type: 'line',
            source: 'mysuru-encroachments',
            layout: { visibility: 'visible' },
            paint: {
              'line-color': ['get', 'color'],
              'line-width': 2.5,
              'line-dasharray': [3, 1.5]
            }
          },
          {
            id: 'flood-water-fill',
            type: 'fill',
            source: 'terrain-grid-source',
            layout: { visibility: 'none' },
            paint: {
              'fill-color': [
                'interpolate', ['linear'], ['-', Number(floodLevel), ['get', 'elevation']],
                0, 'rgba(30, 144, 255, 0.25)',
                2, 'rgba(0, 110, 255, 0.55)',
                5, 'rgba(0, 60, 200, 0.75)',
                10, 'rgba(0, 20, 140, 0.88)'
              ],
              'fill-opacity': 0.72
            }
          },
          {
            id: 'flood-water-mesh',
            type: 'line',
            source: 'terrain-grid-source',
            layout: { visibility: 'none' },
            paint: {
              'line-color': '#60a5fa',
              'line-width': 1,
              'line-opacity': 0.4
            }
          },
          {
            id: 'utility-pipes',
            type: 'line',
            source: 'utilities',
            paint: {
              'line-width': 4,
              'line-color': [
                'match', ['get', 'type'],
                'WaterPipe', '#00bcd4',
                'SewagePipe', '#8b5cf6',
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
              'fill-extrusion-height': [
                'case',
                ['==', ['get', 'height'], 0], 3,
                ['get', 'height']
              ],
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
              // Increase weight based on AQI value (normalized)
              'heatmap-weight': [
                'interpolate', ['linear'], ['get', 'aqi'],
                0, 0,
                50, 0.3,
                100, 0.6,
                200, 1.0,
                300, 1.5
              ],
              // Increase intensity as zoom level increases
              'heatmap-intensity': [
                'interpolate', ['linear'], ['zoom'],
                11, 0.8,
                14, 1.5,
                16, 2.5
              ],
              // Standard International & Indian AQI Color ramp:
              // 0: transparent -> 0.15: emerald green -> 0.4: yellow -> 0.65: orange -> 0.85: red -> 1.0: deep purple/maroon
              'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(0, 0, 0, 0)',
                0.15, 'rgba(0, 228, 0, 0.6)',
                0.4, 'rgba(255, 255, 0, 0.75)',
                0.65, 'rgba(255, 126, 0, 0.85)',
                0.85, 'rgba(255, 0, 0, 0.9)',
                1.0, 'rgba(143, 63, 151, 0.95)'
              ],
              // Heatmap for uniform spatial density across Mysore
              'heatmap-radius': [
                'interpolate', ['linear'], ['zoom'],
                10, 35,
                13, 80,
                15, 140,
                17, 220
              ],
              'heatmap-opacity': 0.85
            }
          },
          // Micro-Zone Environmental Choropleth Grid (Iso-Grid Layer)
          {
            id: 'aqi-cells-fill',
            type: 'fill',
            source: 'aqi-cells-source',
            layout: { 'visibility': 'none' },
            paint: {
              'fill-color': ['get', 'color'],
              'fill-opacity': 0.52
            }
          },
          {
            id: 'aqi-cells-line',
            type: 'line',
            source: 'aqi-cells-source',
            layout: { 'visibility': 'none' },
            paint: {
              'line-color': '#ffffff',
              'line-width': 1,
              'line-opacity': 0.35
            }
          },
          {
            id: 'aqi-stations-glow',
            type: 'circle',
            source: 'aqi-source',
            filter: ['==', ['get', 'isStation'], true],
            layout: { 'visibility': 'none' },
            paint: {
              'circle-radius': 16,
              'circle-color': [
                'step', ['get', 'aqi'],
                '#00e400', 51,
                '#ffff00', 101,
                '#ff7e00', 201,
                '#ff0000', 301,
                '#8f3f97'
              ],
              'circle-opacity': 0.35,
              'circle-blur': 0.8
            }
          },
          {
            id: 'aqi-stations-point',
            type: 'circle',
            source: 'aqi-source',
            filter: ['==', ['get', 'isStation'], true],
            layout: { 'visibility': 'none' },
            paint: {
              'circle-radius': 8,
              'circle-color': [
                'step', ['get', 'aqi'],
                '#00e400', 51,
                '#ffff00', 101,
                '#ff7e00', 201,
                '#ff0000', 301,
                '#8f3f97'
              ],
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#ffffff'
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
            id: 'emergency-route-casing',
            type: 'line',
            source: 'emergency-path',
            layout: { 'visibility': 'none' },
            paint: { 'line-color': '#064e3b', 'line-width': 10, 'line-opacity': 0.85 }
          },
          {
            id: 'emergency-route',
            type: 'line',
            source: 'emergency-path',
            layout: { 'visibility': 'none' },
            paint: { 'line-color': '#10b981', 'line-width': 6 }
          },
          {
            id: 'emergency-route-pulse',
            type: 'line',
            source: 'emergency-path',
            layout: { 'visibility': 'none' },
            paint: { 'line-color': '#ffffff', 'line-width': 2.5, 'line-dasharray': [2, 2] }
          },
          {
            id: 'selected-parcel-extrusion',
            type: 'fill-extrusion',
            source: 'selected-parcel-source',
            paint: {
              'fill-extrusion-color': '#ff3b3b',
              'fill-extrusion-height': 5,
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.88
            }
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

      // Helper to select and lock a building/house for zoning analysis
      const selectStructure = (f, clickLngLat) => {
        const heightVal = f.properties.height || 3.5;
        const metrics = calculateBuildingMetrics({
          height: heightVal,
          coordinates: f.geometry?.coordinates
        });
        const displayName = formatBuildingName(f.properties, metrics);

        // Find center coordinates
        const ring = extractOuterRing(f.geometry?.coordinates);
        let centerCoord = [clickLngLat.lng, clickLngLat.lat];
        if (ring && ring.length > 0) {
          const cLon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
          const cLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
          centerCoord = [cLon, cLat];
        }

        setSelectedBuilding({
          id: f.properties.id,
          name: displayName,
          rawName: f.properties.name,
          height: heightVal,
          lngLat: { lng: centerCoord[0], lat: centerCoord[1] },
          type: f.properties.type || 'yes',
          metrics,
          coordinates: f.geometry?.coordinates,
          isSynthesized: !!f.properties.isSynthesizedParcel
        });
        setDemolishedId(null);
        setImpactData(null);

        // Update blast circle marker at exact center
        const source = map.current.getSource('blast-circle');
        if (source) {
          source.setData({
            type: 'Feature', geometry: { type: 'Point', coordinates: centerCoord }
          });
        }

        // If structure was generated on-the-fly or clicked from imagery, render 3D footprint
        const parcelSource = map.current.getSource('selected-parcel-source');
        if (parcelSource) {
          if (f.geometry && f.geometry.type === 'Polygon') {
            parcelSource.setData({
              type: 'FeatureCollection',
              features: [f]
            });
          } else {
            parcelSource.setData({ type: 'FeatureCollection', features: [] });
          }
        }
      };

      // Generalized click handler across canvas with multi-pixel tolerance & spatial lookup
      map.current.on('click', (e) => {
        if (showReportingHintRef.current) {
          // User clicked map to pin an issue: lock exact high precision coordinates
          const coords = [Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))];
          setDraftCoords(coords);
          setDraftTitle('');
          setDraftDesc('');
          setDraftImage('');
          setShowReportingHint(false);
          showReportingHintRef.current = false;
          setIsFlaggingModalOpen(true);
          return;
        }

        // If EMS Strategy mode is active, clicking any spot sets it as the dynamic emergency destination
        if (isEmergencyActiveRef.current) {
          const clickPt = [Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))];
          setEmsCustomTarget(clickPt);
          // Auto-select the nearest dispatch hub for the fastest response
          const nearest = findNearestEmsHub(clickPt);
          if (nearest && nearest.hub) {
            setEmsOriginHub(nearest.hub.id);
          }
          return;
        }

        // 1. Check rendered features with a 16px bounding box tolerance (catches thin houses/huts)
        const bbox = [
          [e.point.x - 16, e.point.y - 16],
          [e.point.x + 16, e.point.y + 16]
        ];
        const features = map.current.queryRenderedFeatures(bbox, { layers: ['3d-buildings'] });
        
        if (features.length > 0) {
          selectStructure(features[0], e.lngLat);
          return;
        }

        // 2. Proximity check against preloaded dataset within 45m radius
        if (allBuildingsRef.current && allBuildingsRef.current.length > 0) {
          const match = findBuildingAtPoint([e.lngLat.lng, e.lngLat.lat], allBuildingsRef.current, 45);
          if (match && match.feature) {
            selectStructure(match.feature, e.lngLat);
            return;
          }
        }

        // 3. UNIVERSAL PICKING: If user is in Zoning / Demolish mode, any clicked plot/home on satellite or map is pickable!
        if (isDemolishModeRef.current || activeTab === 'missions') {
          const synthesizedParcel = generatePointParcel([e.lngLat.lng, e.lngLat.lat], 15, 18);
          selectStructure(synthesizedParcel, e.lngLat);
          return;
        }

        // 4. Clicked open ground when not in zoning mode: clear selection
        setSelectedBuilding(null);
        setImpactData(null);
        const parcelSource = map.current.getSource('selected-parcel-source');
        if (parcelSource) {
          parcelSource.setData({ type: 'FeatureCollection', features: [] });
        }
      });

      // Dedicated layer listener for 3d-buildings
      map.current.on('click', '3d-buildings', (e) => {
        if (showReportingHintRef.current) return;
        if (e.features && e.features.length > 0) {
          selectStructure(e.features[0], e.lngLat);
        }
      });
      
      // AQI Station interactive click and hover
      map.current.on('click', 'aqi-stations-point', (e) => {
        if (showReportingHintRef.current) return;
        if (!e.features || e.features.length === 0) return;
        const p = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates.slice();
        const aqiVal = Math.round(p.aqi);
        const cat = getAqiCategory(aqiVal);
        setSelectedStation({
          id: p.id,
          name: p.name,
          zone: p.zone,
          aqi: aqiVal,
          pm2_5: p.pm2_5,
          pm10: p.pm10,
          no2: p.no2,
          category: cat,
          coordinates: coords
        });

        if (aqiPopupRef.current) aqiPopupRef.current.remove();
        aqiPopupRef.current = new maplibregl.Popup({ offset: 15, closeButton: true, className: 'aqi-station-popup' })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family: inherit; padding: 4px 2px;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${cat.color};"></span>
                <strong style="font-size:13px; color:#111;">${p.name}</strong>
              </div>
              <div style="font-size:11px; color:#666; margin-bottom:8px;">${p.zone || 'Mysuru Air Quality Sector'}</div>
              <div style="display:flex; justify-content:space-between; align-items:center; background:#f4f6f8; padding:6px 10px; border-radius:8px; margin-bottom:6px;">
                <span style="font-size:11px; color:#555; font-weight:600;">AQI Level</span>
                <span style="font-size:16px; font-weight:800; color:${cat.color === '#ffff00' ? '#b58b00' : cat.color};">${aqiVal} <small style="font-size:10px; color:#777;">(${cat.label})</small></span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px;">
                <div style="background:#fff; border:1px solid #eee; padding:4px 6px; border-radius:6px;">PM2.5: <b>${p.pm2_5 || '--'} µg/m³</b></div>
                <div style="background:#fff; border:1px solid #eee; padding:4px 6px; border-radius:6px;">PM10: <b>${p.pm10 || '--'} µg/m³</b></div>
              </div>
            </div>
          `)
          .addTo(map.current);
      });

      map.current.on('mouseenter', 'aqi-stations-point', () => { 
        map.current.getCanvas().style.cursor = 'pointer'; 
      });
      map.current.on('mouseleave', 'aqi-stations-point', () => { 
        map.current.getCanvas().style.cursor = ''; 
      });

      // AQI Micro-Zone Cell click listener
      map.current.on('click', 'aqi-cells-fill', (e) => {
        if (showReportingHintRef.current) return;
        if (!e.features || e.features.length === 0) return;
        const p = e.features[0].properties;
        const aqiVal = Math.round(p.aqi);
        const cat = getAqiCategory(aqiVal);

        if (aqiPopupRef.current) aqiPopupRef.current.remove();
        aqiPopupRef.current = new maplibregl.Popup({ offset: 10, closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: inherit; padding: 4px;">
              <div style="font-size:11px; font-weight:700; color:#555; text-transform:uppercase; letter-spacing:0.5px;">Mysuru Urban Zone</div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin: 6px 0;">
                <span style="font-size:18px; font-weight:900; color:${cat.color === '#ffff00' ? '#b58b00' : cat.color};">AQI ${aqiVal}</span>
                <span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:12px; background:${cat.color}22; color:${cat.color === '#ffff00' ? '#b58b00' : cat.color};">${p.label || cat.label}</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; margin-top:4px;">
                <div style="background:#f5f7fa; padding:4px 6px; border-radius:6px;">PM2.5: <b>${p.pm2_5} µg/m³</b></div>
                <div style="background:#f5f7fa; padding:4px 6px; border-radius:6px;">PM10: <b>${p.pm10} µg/m³</b></div>
              </div>
            </div>
          `)
          .addTo(map.current);
      });

      map.current.on('mouseenter', 'aqi-cells-fill', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'aqi-cells-fill', () => {
        map.current.getCanvas().style.cursor = '';
      });

      map.current.on('mouseenter', '3d-buildings', () => { map.current.getCanvas().style.cursor = 'pointer'; });
      map.current.on('mouseleave', '3d-buildings', () => { map.current.getCanvas().style.cursor = ''; });

      // Encroachment Zone click & hover
      map.current.on('click', 'encroachment-zones-fill', (e) => {
        if (showReportingHintRef.current) return;
        if (!e.features || e.features.length === 0) return;
        const p = e.features[0].properties;
        setSelectedEncroachment(p);
        setActiveTab('heritage');
      });

      map.current.on('mouseenter', 'encroachment-zones-fill', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'encroachment-zones-fill', () => {
        map.current.getCanvas().style.cursor = '';
      });

      // Flood Inundation Water Grid click listener
      map.current.on('click', 'flood-water-fill', (e) => {
        if (showReportingHintRef.current) return;
        if (!e.features || e.features.length === 0) return;
        const p = e.features[0].properties;
        const elev = Number(p.elevation || 0);
        const depth = Math.max(0, Number(floodLevel) - elev);
        
        new maplibregl.Popup({ offset: 12, closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: inherit; padding: 4px 2px;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <span style="font-size:14px;">🌊</span>
                <strong style="font-size:13px; color:#1e40af;">Flood Inundation Point</strong>
              </div>
              <div style="font-size:11px; color:#555; margin-bottom:6px;">Hydrological Inundation Model</div>
              <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:6px 8px; margin-bottom:6px;">
                <div style="font-size:11px; color:#1e3a8a;">Water Depth: <b style="font-size:14px; color:#1d4ed8;">${depth.toFixed(2)} m</b></div>
                <div style="font-size:10px; color:#64748b; margin-top:2px;">Ground Elev: <b>${elev.toFixed(1)} m</b> (MSL: ${(740 + elev).toFixed(1)}m)</div>
              </div>
              <div style="font-size:10px; color:${depth > 2 ? '#b91c1c' : '#047857'}; font-weight:600;">
                Risk Severity: ${depth > 3 ? '🔴 CRITICAL INUNDATION' : (depth > 1 ? '🟠 MODERATE RISK' : '🟡 SURFACE RUNOFF')}
              </div>
            </div>
          `)
          .addTo(map.current);
      });

      map.current.on('mouseenter', 'flood-water-fill', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'flood-water-fill', () => {
        map.current.getCanvas().style.cursor = '';
      });
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

  // 2. Timeline Filter & Historical Sprawl Simulation
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    // Sepia/monochrome atmosphere for earlier eras
    const saturation = timelineYear <= 1920 ? 0.1 : (timelineYear <= 1960 ? 0.45 : (timelineYear <= 1995 ? 0.8 : 1));
    const sepia = timelineYear <= 1920 ? 0.85 : (timelineYear <= 1960 ? 0.45 : (timelineYear <= 1995 ? 0.15 : 0));
    map.current.getCanvas().style.filter = `saturate(${saturation}) sepia(${sepia})`;

    // Temporal Building Sprawl:
    // In 1920, only Core Heritage buildings (low % modulo ids, Palace, core quadrangle) existed.
    // As the timeline advances (1960 -> 1995 -> 2024), additional modern concrete constructions appear.
    // This accurately simulates the rapid urbanization of Greater Mysuru over the last century.
    let sprawlFilter = ['!=', ['get', 'id'], -1]; // show all by default
    if (timelineYear <= 1920) {
      // In 1920, city built-up area was roughly 15% of present footprint
      sprawlFilter = ['<', ['%', ['get', 'id'], 100], 18];
    } else if (timelineYear <= 1960) {
      // In 1960, city expanded to around 40% of present footprint
      sprawlFilter = ['<', ['%', ['get', 'id'], 100], 42];
    } else if (timelineYear <= 1995) {
      // In 1995, city reached around 72% of modern sprawl
      sprawlFilter = ['<', ['%', ['get', 'id'], 100], 75];
    }
    if (map.current.getLayer('3d-buildings')) {
      map.current.setFilter('3d-buildings', sprawlFilter);
    }
  }, [timelineYear, mapLoaded]);

  // 2b. Encroachment Layers Visibility
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (map.current.getLayer('encroachment-zones-fill')) {
      map.current.setLayoutProperty('encroachment-zones-fill', 'visibility', showEncroachments ? 'visible' : 'none');
    }
    if (map.current.getLayer('encroachment-zones-line')) {
      map.current.setLayoutProperty('encroachment-zones-line', 'visibility', showEncroachments ? 'visible' : 'none');
    }
  }, [showEncroachments, mapLoaded]);

  // 3. Realistic Terrain-based Flood Inundation Level
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const numLevel = Number(floodLevel);
    const isFlooding = numLevel > 0;

    // A. 3D Building Inundation based on actual terrain elevation
    // Buildings whose ground elevation is <= floodLevel are submerged with gradient color based on depth
    map.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
      'case',
      ['<=', ['coalesce', ['get', 'groundElevation'], 999], numLevel],
      [
        'interpolate', ['linear'], ['-', numLevel, ['coalesce', ['get', 'groundElevation'], 999]],
        0, '#38bdf8', // 0-1m: shallow water blue
        2, '#0284c7', // 2m: moderate flood
        5, '#1d4ed8', // 5m: deep inundation
        10, '#172554' // 10m+: extreme depth
      ],
      currentStyle === 'satellite' ? '#d4c8b0' : '#e8e0d4'
    ]);

    // B. Terrain Flood Surface Layer
    if (map.current.getLayer('flood-water-fill') && map.current.getLayer('flood-water-mesh')) {
      if (!isFlooding) {
        map.current.setLayoutProperty('flood-water-fill', 'visibility', 'none');
        map.current.setLayoutProperty('flood-water-mesh', 'visibility', 'none');
      } else {
        map.current.setLayoutProperty('flood-water-fill', 'visibility', 'visible');
        map.current.setLayoutProperty('flood-water-mesh', 'visibility', 'visible');
        
        // Filter terrain grid cells submerged by current water level
        const floodFilter = ['<=', ['get', 'elevation'], numLevel];
        map.current.setFilter('flood-water-fill', floodFilter);
        map.current.setFilter('flood-water-mesh', floodFilter);

        // Update dynamic depth coloration for the water surface
        map.current.setPaintProperty('flood-water-fill', 'fill-color', [
          'interpolate', ['linear'], ['-', numLevel, ['get', 'elevation']],
          0, 'rgba(56, 189, 248, 0.40)',
          2, 'rgba(2, 132, 199, 0.65)',
          5, 'rgba(29, 78, 216, 0.80)',
          10, 'rgba(15, 23, 42, 0.92)'
        ]);
      }
    }
  }, [floodLevel, currentStyle, mapLoaded]);

  // 4. AQI & Green Cover (Multi-Mode Display: Heatmap vs Hex Grid vs Monitoring Stations)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    // Check mode
    const isHeatVisible = aqiEnabled && aqiMode === 'heatmap';
    const isGridVisible = aqiEnabled && aqiMode === 'grid';
    const isStationsVisible = aqiEnabled; // Stations stay visible on both for reference

    if (map.current.getLayer('aqi-heat')) {
      map.current.setLayoutProperty('aqi-heat', 'visibility', isHeatVisible ? 'visible' : 'none');
    }
    if (map.current.getLayer('aqi-cells-fill')) {
      map.current.setLayoutProperty('aqi-cells-fill', 'visibility', isGridVisible ? 'visible' : 'none');
    }
    if (map.current.getLayer('aqi-cells-line')) {
      map.current.setLayoutProperty('aqi-cells-line', 'visibility', isGridVisible ? 'visible' : 'none');
    }
    if (map.current.getLayer('aqi-stations-glow')) {
      map.current.setLayoutProperty('aqi-stations-glow', 'visibility', isStationsVisible ? 'visible' : 'none');
    }
    if (map.current.getLayer('aqi-stations-point')) {
      map.current.setLayoutProperty('aqi-stations-point', 'visibility', isStationsVisible ? 'visible' : 'none');
    }

    map.current.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', [
      'case',
      ['==', ['get', 'id'], demolishedId], 0,
      greenEnabled ? 0.25 : (aqiEnabled && aqiMode === 'grid' ? 0.65 : 0.85)
    ]);
    
    map.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', [
      'case',
      ['==', ['get', 'id'], selectedBuilding?.id], '#ff3b3b',
      currentStyle === 'satellite' ? '#d4c8b0' : '#e8e0d4'
    ]);

    // Handle selected-parcel-extrusion demolition opacity
    if (map.current.getLayer('selected-parcel-extrusion')) {
      map.current.setPaintProperty(
        'selected-parcel-extrusion',
        'fill-extrusion-opacity',
        selectedBuilding?.id === demolishedId ? 0 : 0.88
      );
    }
  }, [aqiEnabled, aqiMode, greenEnabled, demolishedId, selectedBuilding, currentStyle]);

  // 5. Hydrants & Emergency Fast Navigation Strategy
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    map.current.setLayoutProperty('hydrant-layer', 'visibility', showHydrants ? 'visible' : 'none');
    
    const isEmsVis = isEmergencyActive ? 'visible' : 'none';
    if (map.current.getLayer('emergency-route')) {
      map.current.setLayoutProperty('emergency-route', 'visibility', isEmsVis);
    }
    if (map.current.getLayer('emergency-route-casing')) {
      map.current.setLayoutProperty('emergency-route-casing', 'visibility', isEmsVis);
    }
    if (map.current.getLayer('emergency-route-pulse')) {
      map.current.setLayoutProperty('emergency-route-pulse', 'visibility', isEmsVis);
    }
  }, [showHydrants, isEmergencyActive, mapLoaded]);

  // Dynamic Google Maps-style shortest & fastest route calculation
  useEffect(() => {
    if (!map.current || !mapLoaded || !isEmergencyActive) return;

    let isSubscribed = true;
    setEmsRoutingLoading(true);

    const hub = EMS_HUBS.find(h => h.id === emsOriginHub) || EMS_HUBS[0];
    let targetCoords = null;
    let targetName = '';

    if (emsCustomTarget) {
      targetCoords = emsCustomTarget;
      targetName = 'User Map Pin Destination';
    } else {
      const dest = EMS_DESTINATIONS.find(d => d.id === emsDestinationId) || EMS_DESTINATIONS[0];
      targetCoords = dest.coordinates;
      targetName = dest.name;
    }

    calculateFastestEmsRoute(hub.coordinates, targetCoords)
      .then(route => {
        if (!isSubscribed) return;
        setEmsRouteResult({
          ...route,
          originName: hub.name,
          destinationName: targetName
        });

        const emsSource = map.current.getSource('emergency-path');
        if (emsSource) {
          emsSource.setData({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: route.coordinates
            },
            properties: {
              distanceKm: route.distanceKm,
              durationMin: route.durationMinutes
            }
          });
        }

        // Fit map bounds smoothly along the calculated emergency path
        if (route.coordinates && route.coordinates.length > 1) {
          const bounds = route.coordinates.reduce((acc, coord) => {
            return [
              [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
              [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]
            ];
          }, [[route.coordinates[0][0], route.coordinates[0][1]], [route.coordinates[0][0], route.coordinates[0][1]]]);

          map.current.fitBounds(bounds, {
            padding: { top: 90, bottom: 90, left: 380, right: 90 },
            maxZoom: 16.5,
            duration: 1200
          });
        }
      })
      .catch(err => {
        console.error('Failed to compute EMS fastest route:', err);
      })
      .finally(() => {
        if (isSubscribed) setEmsRoutingLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [isEmergencyActive, emsOriginHub, emsDestinationId, emsCustomTarget, mapLoaded]);

  // 6. Citizen Public Grievance Markers Synchronization on 3D Map
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clean up previous markers
    Object.values(reportMarkersRef.current).forEach(m => m.remove());
    reportMarkersRef.current = {};

    reports.forEach(r => {
      // Determine pin color based on status
      const statusColor = r.status === 'solved' ? '#00d084' : (r.status === 'in_progress' ? '#3b82f6' : '#ff9800');
      const statusBadge = r.status === 'solved' ? 'Resolved' : (r.status === 'in_progress' ? 'In Progress' : 'Pending');

      // Create rich custom DOM element marker
      const el = document.createElement('div');
      el.className = 'citizen-map-pin';
      el.style.backgroundColor = statusColor;
      el.innerHTML = `
        <div class="pin-inner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
            <line x1="4" y1="22" x2="4" y2="15"></line>
          </svg>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(r.coordinates)
        .addTo(map.current);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedReport(r);
        setActiveTab('social');
        map.current.flyTo({ center: r.coordinates, zoom: 17, pitch: 55, duration: 1500 });
      });

      reportMarkersRef.current[r.id] = marker;
    });

    return () => {
      Object.values(reportMarkersRef.current).forEach(m => m.remove());
    };
  }, [reports, mapLoaded]);

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

  const handleDemolish = async () => {
    if (!selectedBuilding) return;
    
    const center = [selectedBuilding.lngLat.lng, selectedBuilding.lngLat.lat];
    const metrics = selectedBuilding.metrics || calculateBuildingMetrics(selectedBuilding);

    // Fetch or use cached utilities for spatial proximity
    let uData = utilitiesDataCache;
    if (!uData) {
      try {
        const res = await axios.get('/data/mysuru_utilities.json');
        uData = res.data;
        setUtilitiesDataCache(uData);
      } catch (err) {
        console.warn('Could not fetch utilities for audit:', err);
      }
    }

    // 1. Audit underground utilities (Water pipelines, Sewer lines, Gas mains, Electricity)
    const utilityAudit = auditUtilitiesAtLocation(center, uData, 350);

    // 2. Audit nearby educational & healthcare institutions (Schools, Colleges, Hospitals, Clinics)
    const nearbyInstitutions = auditInstitutionsAtLocation(center, selectedBuilding.id, 1000);

    // 3. Compute Traffic flow disruption, diversion radius and bottlenecks
    const traffic = computeTrafficDisruption(metrics, nearbyInstitutions, center);

    // 4. Generate structured Suggestion Steps for destruction timing and restoration viability
    const recommendations = generateZoningRecommendations(
      selectedBuilding,
      metrics,
      utilityAudit,
      nearbyInstitutions,
      traffic
    );

    // Calculate affected households based on building volume and nearby utility disruptions
    const baseHouseholds = Math.round((metrics.footprintArea / 12) * metrics.floors * 0.7);
    const affectedHouseholds = Math.max(35, Math.min(850, baseHouseholds + utilityAudit.water.count * 15 + utilityAudit.electricity.count * 12));

    setDemolishedId(selectedBuilding.id);
    setImpactData({
      metrics,
      utilityAudit,
      nearbyInstitutions,
      traffic,
      recommendations,
      impactedHouseholds: affectedHouseholds,
      trafficDelay: traffic.delayMinutes,
      suggestedReroute: traffic.reroutePlan
    });
    setZoningAuditTab('overview');
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
        <button 
          className={`view-btn ${aqiEnabled ? 'active aqi-active' : ''}`} 
          onClick={() => {
            const next = !aqiEnabled;
            setAqiEnabled(next);
            if (next && activeTab !== 'eco') setActiveTab('eco');
          }}
          title="Toggle Mysore Real-Time Air Quality Heatmap"
        >
          <Wind size={18} /> 
          <span>{aqiEnabled ? `AQI ${aqiData?.currentAqi || ''}` : "AQI Heatmap"}</span>
        </button>
      </div>

      {/* FLOATING REAL-TIME AQI HUD BADGE WHEN AQI LAYER IS ACTIVE */}
      {aqiEnabled && aqiData && (
        <div className="aqi-hud-overlay">
          <div className="aqi-hud-header">
            <span className="live-indicator-dot" />
            <span className="hud-title">MYSURU REAL-TIME AIR DISPERSION</span>
            <span className="hud-time">{aqiData.time}</span>
          </div>
          <div className="aqi-hud-body">
            <div className="hud-score-col">
              <span className="hud-aqi-number" style={{ color: aqiData.category.color === '#ffff00' ? '#c49a00' : aqiData.category.color }}>
                {aqiData.currentAqi}
              </span>
              <span className="hud-aqi-status" style={{ color: aqiData.category.color === '#ffff00' ? '#b58b00' : aqiData.category.color }}>
                {aqiData.category.label}
              </span>
            </div>
            <div className="hud-pollutants-col">
              <div>PM2.5: <b>{aqiData.pm2_5}</b> <small>µg/m³</small></div>
              <div>PM10: <b>{aqiData.pm10}</b> <small>µg/m³</small></div>
              <div>NO₂: <b>{aqiData.no2}</b> <small>µg/m³</small></div>
            </div>
          </div>
          <div className="hud-mode-row">
            <span style={{ fontSize: '0.65rem', color: '#777', fontWeight: 600 }}>Display Mode:</span>
            <div className="hud-mode-btns">
              <button 
                className={`hud-mode-btn ${aqiMode === 'heatmap' ? 'active' : ''}`}
                onClick={() => setAqiMode('heatmap')}
              >
                Heatmap
              </button>
              <button 
                className={`hud-mode-btn ${aqiMode === 'grid' ? 'active' : ''}`}
                onClick={() => setAqiMode('grid')}
              >
                Iso-Grid
              </button>
            </div>
          </div>
          <div className="hud-spectrum-bar">
            <span>0 (Good)</span>
            <div className="spectrum-track" />
            <span>300+ (Hazardous)</span>
          </div>
        </div>
      )}

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
                    const parcelSource = map.current?.getSource('selected-parcel-source');
                    if (parcelSource) parcelSource.setData({ type: 'FeatureCollection', features: [] });
                  }
                }}
              >
                <Trash2 size={18} /> {isDemolishMode ? 'Restore Architecture' : 'Simulate Zoning Impact'}
              </button>
              
              <div style={{ margin: '8px 0 12px 0', fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={13} color="#3b82f6" />
                <span><strong>Universal Picking Active:</strong> Click any building, home, or structure on the map.</span>
              </div>
              
              {selectedBuilding && (
                <div className="building-detail glass">
                  <div className="detail-row">
                    <MapPin size={18} color="#ff3b3b" />
                    <strong>{selectedBuilding.name}</strong>
                  </div>
                  <div className="detail-grid">
                    <div className="stat-item"><small>Height</small><span>{selectedBuilding.height}m</span></div>
                    <div className="stat-item"><small>Footprint</small><span>{selectedBuilding.metrics?.footprintArea || 180} m²</span></div>
                    <div className="stat-item"><small>Levels</small><span>{selectedBuilding.metrics?.floors || 1} Fl</span></div>
                    <div className="stat-item"><small>Type</small><span style={{ textTransform: 'capitalize' }}>{selectedBuilding.type || 'Structure'}</span></div>
                  </div>
                  <div className="action-grid">
                    <button className="analyze-btn" onClick={openStreetView}><Camera size={14}/> Street View</button>
                    {isDemolishMode && <button className="analyze-btn danger" onClick={handleDemolish}><Wrench size={14}/> Generate Audit</button>}
                  </div>
                </div>
              )}

              {impactData && (
                <div className="impact-report">
                  <h4><ShieldAlert size={18}/> Geospatial Zoning & Demolition Assessment</h4>

                  {/* ZONING SUB-TABS */}
                  <div className="zoning-tabs">
                    <button 
                      className={`zoning-tab-btn ${zoningAuditTab === 'overview' ? 'active' : ''}`}
                      onClick={() => setZoningAuditTab('overview')}
                    >
                      <Ruler size={13} />
                      <span>Measures</span>
                    </button>
                    <button 
                      className={`zoning-tab-btn ${zoningAuditTab === 'utilities' ? 'active' : ''}`}
                      onClick={() => setZoningAuditTab('utilities')}
                    >
                      <Droplets size={13} />
                      <span>Pipelines & Flow</span>
                    </button>
                    <button 
                      className={`zoning-tab-btn ${zoningAuditTab === 'institutions' ? 'active' : ''}`}
                      onClick={() => setZoningAuditTab('institutions')}
                    >
                      <School size={13} />
                      <span>Institutions</span>
                      {impactData.nearbyInstitutions?.length > 0 && (
                        <span className={`zoning-pill ${impactData.nearbyInstitutions.some(i => i.type === 'hospital') ? 'alert' : ''}`}>
                          {impactData.nearbyInstitutions.length}
                        </span>
                      )}
                    </button>
                    <button 
                      className={`zoning-tab-btn ${zoningAuditTab === 'protocol' ? 'active' : ''}`}
                      onClick={() => setZoningAuditTab('protocol')}
                    >
                      <ShieldCheck size={13} />
                      <span>Action Steps</span>
                    </button>
                  </div>

                  {/* TAB 1: ACCURATE MEASURES OF DESTRUCTION */}
                  {zoningAuditTab === 'overview' && (
                    <div>
                      <div className="zoning-card">
                        <div className="zoning-card-header">
                          <Ruler size={14} color="#3b82f6" /> Accurate Destruction Metrics
                        </div>
                        <div className="zoning-grid-3">
                          <div className="zoning-metric-box">
                            <strong>{impactData.metrics.footprintArea} m²</strong>
                            <small>Footprint</small>
                          </div>
                          <div className="zoning-metric-box">
                            <strong>{impactData.metrics.totalBuiltUpArea} m²</strong>
                            <small>Built-up Area</small>
                          </div>
                          <div className="zoning-metric-box">
                            <strong>{impactData.metrics.buildingVolumeM3} m³</strong>
                            <small>Demolish Volume</small>
                          </div>
                          <div className="zoning-metric-box">
                            <strong style={{ color: '#ef4444' }}>{impactData.metrics.estimatedDebrisTonnes} T</strong>
                            <small>C&D Rubble</small>
                          </div>
                          <div className="zoning-metric-box">
                            <strong>{impactData.metrics.estimatedTruckTrips}</strong>
                            <small>Truck Dispatches</small>
                          </div>
                          <div className="zoning-metric-box">
                            <strong style={{ color: '#f59e0b' }}>{impactData.metrics.estimatedDemolitionDays} Days</strong>
                            <small>Op Duration</small>
                          </div>
                        </div>
                      </div>

                      <div className="impact-stats" style={{ marginBottom: 0 }}>
                        <div className="stat-card">
                          <strong>{impactData.impactedHouseholds}</strong>
                          <small>Affected Households</small>
                        </div>
                        <div className="stat-card">
                          <strong style={{ color: '#ef4444' }}>{impactData.trafficDelay}</strong>
                          <small>Corridor Delay</small>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: PIPELINES, SEWER LINES & TRAFFIC FLOW */}
                  {zoningAuditTab === 'utilities' && (
                    <div>
                      <div className="zoning-card">
                        <div className="zoning-card-header">
                          <Droplets size={14} color="#00bcd4" /> Subsurface Infrastructure Audit
                        </div>
                        <div className="utility-audit-grid">
                          <div className="utility-item water">
                            <Droplets size={16} color="#00bcd4" />
                            <div className="utility-item-info">
                              <div className="title">
                                <span>Water Main</span>
                                <span className="zoning-pill">{impactData.utilityAudit.water.count} lines</span>
                              </div>
                              <div className="desc">Nearest: {impactData.utilityAudit.water.nearestM}m away</div>
                            </div>
                          </div>

                          <div className="utility-item sewage">
                            <Zap size={16} color="#8b5cf6" />
                            <div className="utility-item-info">
                              <div className="title">
                                <span>Sewer Lines</span>
                                <span className="zoning-pill">{impactData.utilityAudit.sewage.count} pipes</span>
                              </div>
                              <div className="desc">Nearest: {impactData.utilityAudit.sewage.nearestM}m away</div>
                            </div>
                          </div>

                          <div className="utility-item gas">
                            <Flame size={16} color="#ff5722" />
                            <div className="utility-item-info">
                              <div className="title">
                                <span>Gas Pipeline</span>
                                <span className="zoning-pill">{impactData.utilityAudit.gas.count} mains</span>
                              </div>
                              <div className="desc">Nearest: {impactData.utilityAudit.gas.nearestM}m away</div>
                            </div>
                          </div>

                          <div className="utility-item electricity">
                            <Zap size={16} color="#eab308" />
                            <div className="utility-item-info">
                              <div className="title">
                                <span>Power Cables</span>
                                <span className="zoning-pill">{impactData.utilityAudit.electricity.count} grids</span>
                              </div>
                              <div className="desc">Nearest: {impactData.utilityAudit.electricity.nearestM}m away</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* TRAFFIC FLOW DISRUPTION */}
                      <div className="zoning-card">
                        <div className="zoning-card-header">
                          <Car size={14} color="#ef4444" /> Traffic Flow & Road Disruption
                        </div>
                        <div className={`traffic-status-banner ${impactData.traffic.congestionLevel.toLowerCase()}`}>
                          <span>Bottleneck Risk: {impactData.traffic.congestionLevel}</span>
                          <span>{impactData.traffic.delayMinutes}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '6px' }}>
                          <strong>Affected Sector:</strong> {impactData.traffic.corridorName}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '6px' }}>
                          <strong>Diversion Cordon:</strong> {impactData.traffic.diversionRadius}
                        </div>
                        <div style={{ fontSize: '0.70rem', color: '#1e293b', background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <strong>Rerouting Strategy:</strong> {impactData.suggestedReroute}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: NEARBY INSTITUTIONS (SCHOOLS & HOSPITALS) */}
                  {zoningAuditTab === 'institutions' && (
                    <div>
                      <div className="zoning-card">
                        <div className="zoning-card-header">
                          <School size={14} color="#8b5cf6" /> Sensitive Institutions Impact Audit
                        </div>

                        {impactData.nearbyInstitutions && impactData.nearbyInstitutions.length > 0 ? (
                          <div className="institutions-list">
                            {impactData.nearbyInstitutions.map((inst, idx) => (
                              <div key={idx} className="institution-card-item">
                                <div className="institution-card-left">
                                  {inst.type === 'hospital' ? (
                                    <Stethoscope size={16} color="#ef4444" />
                                  ) : (
                                    <School size={16} color="#3b82f6" />
                                  )}
                                  <div>
                                    <div className="institution-name" title={inst.name}>{inst.name}</div>
                                    <div className="institution-type">{inst.categoryLabel}</div>
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div className={`institution-badge ${inst.riskLevel.toLowerCase()}`}>
                                    {inst.riskLevel}
                                  </div>
                                  <div style={{ fontSize: '0.62rem', color: '#64748b', marginTop: '2px' }}>
                                    {inst.distanceMeters}m away
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                            No sensitive schools or hospitals detected within 1km radius.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: SUGGESTION STEPS FOR DESTRUCTION OR RESTORATION */}
                  {zoningAuditTab === 'protocol' && (
                    <div>
                      {/* Restoration Viability */}
                      <div className={`viability-banner ${impactData.recommendations.isHeritageCandidate ? 'heritage' : 'retrofit'}`}>
                        <Sparkles size={16} />
                        <span>{impactData.recommendations.restorationViability}</span>
                      </div>

                      {/* Best Window for Demolition */}
                      <div className="timing-window-box">
                        <div className="timing-title">
                          <Calendar size={13} /> Recommended Execution Timing Window
                        </div>
                        <div className="timing-desc">
                          {impactData.recommendations.destructionTiming}
                        </div>
                      </div>

                      {/* Phased Destruction Steps */}
                      <div className="zoning-card">
                        <div className="zoning-card-header">
                          <Trash2 size={14} color="#ef4444" /> Phased Demolition Protocol
                        </div>
                        <div className="protocol-stepper">
                          {impactData.recommendations.demolitionSteps.map((step, idx) => (
                            <div key={idx} className="protocol-step">
                              <span className="protocol-bullet">{idx + 1}</span>
                              <div className="protocol-content">
                                <span className="step-phase">{step.phase}</span>
                                <span className="step-timing">({step.timing})</span>
                                <div className="step-action">{step.action}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Alternative: Structural Restoration Steps */}
                      <div className="zoning-card">
                        <div className="zoning-card-header">
                          <ShieldCheck size={14} color="#10b981" /> Alternative Restoration & Retrofit Steps
                        </div>
                        <div className="protocol-stepper">
                          {impactData.recommendations.restorationSteps.map((step, idx) => (
                            <div key={idx} className="protocol-step">
                              <span className="protocol-bullet restore">{idx + 1}</span>
                              <div className="protocol-content">
                                <span className="step-phase">{step.phase}</span>
                                <div className="step-action">{step.action}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'crisis' && (
            <div className="panel-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="section-label" style={{ margin: 0 }}>Hydrological Flood Inundation Model</label>
                <span style={{ fontSize: '12px', fontWeight: 700, color: floodLevel > 8 ? '#ef4444' : (floodLevel > 3 ? '#3b82f6' : '#10b981') }}>
                  {floodLevel > 0 ? `${floodLevel}m Flood Crest` : 'Baseline (Dry)'}
                </span>
              </div>
              <input type="range" min="0" max="15" step="0.5" value={floodLevel} onChange={e => setFloodLevel(Number(e.target.value))} className="flood-slider" />
              <div className="slider-labels">
                <span>0m (Safe Baseline)</span>
                <span>7.5m (100-Yr Basin Surge)</span>
                <span>15m (Extreme Flood)</span>
              </div>
              
              {floodLevel > 0 && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '10px 12px', margin: '12px 0', fontSize: '11px', color: '#0369a1' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🌊</span> Real-Time Terrain Inundation Telemetry:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
                    <div style={{ background: '#fff', padding: '4px 6px', borderRadius: '4px', border: '1px solid #e0f2fe' }}>
                      Peak Water Elev: <b>{(740 + Number(floodLevel)).toFixed(1)} m MSL</b>
                    </div>
                    <div style={{ background: '#fff', padding: '4px 6px', borderRadius: '4px', border: '1px solid #e0f2fe' }}>
                      Primary Basin: <b>Kukkarahalli-Dalvoy</b>
                    </div>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '10px', color: '#0284c7' }}>
                    💡 <em>Click any flooded surface or building on the map to inspect local water depth and risk severity.</em>
                  </div>
                </div>
              )}
              
              <div className="grid-btns">
                <button className={`action-btn ${showHydrants ? 'active' : ''}`} onClick={() => setShowHydrants(!showHydrants)}>
                  <Flame size={20}/> Fire Hydrants
                </button>
                <button className={`action-btn ${isEmergencyActive ? 'active' : ''}`} onClick={() => setIsEmergencyActive(!isEmergencyActive)}>
                  <Navigation size={20}/> EMS Fastest Route
                </button>
              </div>

              {/* Dynamic Google Maps-Style Fastest EMS Navigation Console */}
              {isEmergencyActive && (
                <div style={{ marginTop: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ background: '#10b981', color: '#fff', borderRadius: '8px', padding: '4px 6px', display: 'flex', alignItems: 'center' }}>
                        <Navigation size={14} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Google Maps Fast Route Router</span>
                    </div>
                    {emsRoutingLoading && (
                      <span style={{ fontSize: '11px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Loader2 size={12} className="spin" /> Calculating...
                      </span>
                    )}
                  </div>

                  {/* Origin EMS Station Selector */}
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                      Dispatch Station / Ambulatory Hub
                    </label>
                    <select 
                      value={emsOriginHub} 
                      onChange={e => {
                        setEmsOriginHub(e.target.value);
                      }}
                      style={{ width: '100%', padding: '7px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', fontWeight: 600 }}
                    >
                      {EMS_HUBS.map(hub => (
                        <option key={hub.id} value={hub.id}>{hub.name} ({hub.type})</option>
                      ))}
                    </select>
                  </div>

                  {/* Destination Target Selector */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 700 }}>
                        Target Emergency Destination
                      </label>
                      {emsCustomTarget && (
                        <button 
                          onClick={() => setEmsCustomTarget(null)}
                          style={{ fontSize: '10px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          Reset to Presets
                        </button>
                      )}
                    </div>
                    {emsCustomTarget ? (
                      <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={12} color="#10b981" />
                        <span>Pinned Custom Location: [{emsCustomTarget[0].toFixed(4)}, {emsCustomTarget[1].toFixed(4)}]</span>
                      </div>
                    ) : (
                      <select 
                        value={emsDestinationId} 
                        onChange={e => setEmsDestinationId(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', fontWeight: 600 }}
                      >
                        {EMS_DESTINATIONS.map(d => (
                          <option key={d.id} value={d.id}>{d.name} • {d.category}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Route Telemetry Box (ETA, Shortest Distance, Priority Siren) */}
                  {emsRouteResult && (
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '22px', fontWeight: 900, color: '#059669', lineHeight: 1 }}>
                            {emsRouteResult.durationMinutes} <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>min</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            Fastest corridor via OSRM Live Road Graph
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>
                            {emsRouteResult.distanceKm} km
                          </div>
                          <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                            ETA: {emsRouteResult.etaFormatted}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#047857', background: '#ecfdf5', padding: '6px 8px', borderRadius: '6px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '14px' }}>🚨</span>
                        <span><b>Live Siren Corridor</b>: Signal Pre-Emption Active</span>
                      </div>

                      {/* Turn-by-Turn Accordion Button */}
                      {emsRouteResult.steps && emsRouteResult.steps.length > 0 && (
                        <div>
                          <button
                            onClick={() => setShowTurnByTurn(!showTurnByTurn)}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer'
                            }}
                          >
                            <span>Turn-by-Turn Navigation Steps ({emsRouteResult.steps.length})</span>
                            <ChevronRight size={14} style={{ transform: showTurnByTurn ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                          </button>

                          {showTurnByTurn && (
                            <div style={{ maxHeight: '180px', overflowY: 'auto', marginTop: '8px', paddingRight: '4px' }}>
                              {emsRouteResult.steps.map((st, sIdx) => (
                                <div key={sIdx} style={{ display: 'flex', gap: '8px', fontSize: '11px', padding: '5px 0', borderBottom: '1px dashed #f1f5f9' }}>
                                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#dcfce7', color: '#166534', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {sIdx + 1}
                                  </div>
                                  <div style={{ flex: 1, color: '#1e293b' }}>
                                    {st.instruction}
                                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                      {st.distance}m • ~{Math.round(st.duration)}s
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: '10px', fontSize: '10px', color: '#64748b', textAlign: 'center' }}>
                    💡 <em>Click any location on the 3D map while EMS mode is active to instantly route from nearest depot.</em>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'eco' && (
            <div className="panel-section eco-panel">
              <div className="eco-header-row">
                <label className="section-label" style={{ margin: 0 }}>Mysuru Atmospheric Telemetry</label>
                <button 
                  className={`refresh-btn-sm ${aqiLoading ? 'spinning' : ''}`}
                  onClick={fetchLiveMysoreAqi}
                  title="Fetch latest real-time CAAQMS data"
                  disabled={aqiLoading}
                >
                  <RefreshCw size={14} className={aqiLoading ? 'spin' : ''} />
                  <span>{aqiLoading ? 'Syncing...' : 'Sync Live'}</span>
                </button>
              </div>

              {/* Main Mysore AQI Score Card */}
              {aqiData && (
                <div 
                  className="aqi-hero-card"
                  style={{
                    borderColor: aqiData.category.color,
                    boxShadow: `0 8px 24px -6px ${aqiData.category.color}40`
                  }}
                >
                  <div className="aqi-hero-top">
                    <div>
                      <span className="aqi-city-tag">LIVE • MYSURU CAAQMS</span>
                      <div className="aqi-val-row">
                        <span className="aqi-huge-num" style={{ color: aqiData.category.color === '#ffff00' ? '#c49a00' : aqiData.category.color }}>
                          {aqiData.currentAqi}
                        </span>
                        <div className="aqi-badge" style={{ background: `${aqiData.category.color}22`, color: aqiData.category.color === '#ffff00' ? '#b58b00' : aqiData.category.color }}>
                          {aqiData.category.label}
                        </div>
                      </div>
                    </div>
                    <Wind size={36} className="aqi-hero-icon" style={{ color: aqiData.category.color }} />
                  </div>
                  <p className="aqi-hero-desc">{aqiData.category.desc}</p>
                  
                  {/* Detailed atmospheric pollutant breakdown */}
                  <div className="pollutant-grid">
                    <div className="pollutant-chip">
                      <span className="p-label">PM2.5</span>
                      <span className="p-val">{aqiData.pm2_5} <small>µg/m³</small></span>
                    </div>
                    <div className="pollutant-chip">
                      <span className="p-label">PM10</span>
                      <span className="p-val">{aqiData.pm10} <small>µg/m³</small></span>
                    </div>
                    <div className="pollutant-chip">
                      <span className="p-label">NO₂</span>
                      <span className="p-val">{aqiData.no2} <small>µg/m³</small></span>
                    </div>
                    <div className="pollutant-chip">
                      <span className="p-label">Ozone</span>
                      <span className="p-val">{aqiData.o3} <small>µg/m³</small></span>
                    </div>
                  </div>

                  <div className="aqi-meta-bar">
                    <span>Synced: {aqiLastUpdated || 'Just now'}</span>
                    <span>Standard: Indian NAQI / EPA</span>
                  </div>
                </div>
              )}

              {/* Visualization Mode Selector */}
              <div className="aqi-mode-selector">
                <span className="mode-label">Visualization Style:</span>
                <div className="mode-toggle-group">
                  <button 
                    className={`mode-btn ${aqiMode === 'heatmap' ? 'active' : ''}`}
                    onClick={() => { setAqiMode('heatmap'); if (!aqiEnabled) setAqiEnabled(true); }}
                  >
                    Smooth Heatmap
                  </button>
                  <button 
                    className={`mode-btn ${aqiMode === 'grid' ? 'active' : ''}`}
                    onClick={() => { setAqiMode('grid'); if (!aqiEnabled) setAqiEnabled(true); }}
                    title="Evenly spread urban choropleth grid with precise cellular values"
                  >
                    Iso-Choropleth Grid
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="toggle-row" style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wind size={16} color="#0061ff" />
                  <span>Display AQI Layer</span>
                </div>
                <button 
                  className={`toggle-sm ${aqiEnabled ? 'on' : ''}`} 
                  onClick={() => setAqiEnabled(!aqiEnabled)} 
                />
              </div>

              <div className="toggle-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Leaf size={16} color="#00d084" />
                  <span>Vegetation Health (VHI)</span>
                </div>
                <button 
                  className={`toggle-sm ${greenEnabled ? 'on' : ''}`} 
                  onClick={() => setGreenEnabled(!greenEnabled)} 
                />
              </div>

              {/* Station Quick Selector */}
              {aqiData?.stations && (
                <div className="stations-section">
                  <div className="stations-header">
                    <span>Key Mysore Monitoring Sectors ({aqiData.stations.length})</span>
                    <small>Click to Fly</small>
                  </div>
                  <div className="stations-pills-list">
                    {aqiData.stations.map(st => {
                      const isSelected = selectedStation?.id === st.id;
                      return (
                        <div 
                          key={st.id} 
                          className={`station-pill ${isSelected ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedStation(st);
                            if (map.current) {
                              map.current.flyTo({ center: st.coordinates, zoom: 16.5, duration: 1800, pitch: 55 });
                              if (aqiPopupRef.current) aqiPopupRef.current.remove();
                              aqiPopupRef.current = new maplibregl.Popup({ offset: 15, closeButton: true })
                                .setLngLat(st.coordinates)
                                .setHTML(`
                                  <div style="font-family: inherit; padding: 4px 2px;">
                                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                                      <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${st.category.color};"></span>
                                      <strong style="font-size:13px; color:#111;">${st.name}</strong>
                                    </div>
                                    <div style="font-size:11px; color:#666; margin-bottom:8px;">${st.zone}</div>
                                    <div style="display:flex; justify-content:space-between; align-items:center; background:#f4f6f8; padding:6px 10px; border-radius:8px; margin-bottom:6px;">
                                      <span style="font-size:11px; color:#555; font-weight:600;">AQI Level</span>
                                      <span style="font-size:16px; font-weight:800; color:${st.category.color === '#ffff00' ? '#b58b00' : st.category.color};">${st.aqi}</span>
                                    </div>
                                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px;">
                                      <div style="background:#fff; border:1px solid #eee; padding:4px 6px; border-radius:6px;">PM2.5: <b>${st.pm2_5} µg/m³</b></div>
                                      <div style="background:#fff; border:1px solid #eee; padding:4px 6px; border-radius:6px;">PM10: <b>${st.pm10} µg/m³</b></div>
                                    </div>
                                  </div>
                                `)
                                .addTo(map.current);
                            }
                          }}
                        >
                          <div className="st-dot" style={{ background: st.category.color }} />
                          <span className="st-name">{st.name.split('(')[0].trim()}</span>
                          <span className="st-aqi" style={{ color: st.category.color === '#ffff00' ? '#b58b00' : st.category.color }}>
                            {st.aqi}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected Station Inspector Detail */}
              {selectedStation && (
                <div className="station-detail-card">
                  <div className="station-detail-header">
                    <div>
                      <strong>{selectedStation.name}</strong>
                      <div className="sub">{selectedStation.zone}</div>
                    </div>
                    <button className="close-station-btn" onClick={() => setSelectedStation(null)}>×</button>
                  </div>
                  <div className="station-stat-row">
                    <div className="stat-unit">
                      <small>AQI Index</small>
                      <b style={{ color: selectedStation.category.color === '#ffff00' ? '#b58b00' : selectedStation.category.color }}>
                        {selectedStation.aqi}
                      </b>
                    </div>
                    <div className="stat-unit">
                      <small>PM2.5</small>
                      <b>{selectedStation.pm2_5} <span style={{ fontSize: '10px' }}>µg/m³</span></b>
                    </div>
                    <div className="stat-unit">
                      <small>PM10</small>
                      <b>{selectedStation.pm10} <span style={{ fontSize: '10px' }}>µg/m³</span></b>
                    </div>
                  </div>
                </div>
              )}

              {/* Indian / EPA AQI Color Gradient Legend */}
              <div className="aqi-gradient-legend">
                <div className="legend-label-row">
                  <span>Good (0-50)</span>
                  <span>Mod (51-100)</span>
                  <span>Poor (101-200)</span>
                  <span>Severe (&gt;300)</span>
                </div>
                <div className="legend-bar-gradient" />
              </div>

              {greenEnabled && (
                <div className="stat-box" style={{ marginTop: '12px' }}>
                  City Sustainability Score: <strong>A+ (8.4/10)</strong>
                </div>
              )}
            </div>
          )}

          {activeTab === 'heritage' && (
            <div className="panel-section heritage-panel">
              {/* Header */}
              <div className="heritage-header-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Landmark size={20} color="#b45309" />
                  <h4 style={{ margin: 0, fontSize: '0.96rem', color: '#111', fontWeight: 800 }}>
                    Mysore Heritage & Land Encroachment
                  </h4>
                </div>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#666', lineHeight: 1.4 }}>
                  Compare historical royal eras (1920–2024), detect lost wetland buffers, and monitor critical land encroachments across Mysuru.
                </p>
              </div>

              {/* Historical Era Quick Selector */}
              <div className="era-selector-block">
                <span className="sub-title"><History size={14} /> Historical Period Benchmark</span>
                <div className="era-btn-grid">
                  {MYSURU_HISTORICAL_PERIODS.map(era => {
                    const isActive = timelineYear === era.year;
                    return (
                      <button
                        key={era.id}
                        className={`era-btn ${isActive ? 'active' : ''}`}
                        onClick={() => setTimelineYear(era.year)}
                      >
                        <span className="era-yr">{era.year}</span>
                        <span className="era-sub">{era.year <= 1920 ? 'Royal Wadiyar' : (era.year <= 1960 ? 'Post-Indep.' : (era.year <= 1995 ? 'Urban Boom' : 'Present'))}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Temporal Slider */}
              <div className="temporal-slider-wrap">
                <div className="slider-header-row">
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#333' }}>
                    Temporal Sprawl Year: <b>{timelineYear}</b>
                  </span>
                  <span className="vintage-tag">
                    {timelineYear <= 1920 ? 'Sepia Vintage Archive' : (timelineYear <= 1960 ? 'Mid-Century Tone' : (timelineYear <= 1995 ? 'Early Modern' : 'Satellite Real-time'))}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="1920" 
                  max="2024" 
                  step="5" 
                  value={timelineYear} 
                  onChange={e => setTimelineYear(Number(e.target.value))} 
                  className="timeline-slider" 
                />
                <div className="slider-ticks">
                  <span>1920</span>
                  <span>1960</span>
                  <span>1995</span>
                  <span>2024</span>
                </div>
              </div>

              {/* Current Era Deep Dive Stats Card */}
              {(() => {
                const currentEra = MYSURU_HISTORICAL_PERIODS.reduce((prev, curr) => 
                  Math.abs(curr.year - timelineYear) < Math.abs(prev.year - timelineYear) ? curr : prev
                );
                return (
                  <div className="era-stats-card">
                    <div className="era-stats-title">
                      <Sparkles size={14} color="#d97706" />
                      <strong>{currentEra.title}</strong>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#78350f', marginBottom: '8px', fontWeight: 600 }}>
                      Authority: {currentEra.ruler}
                    </div>
                    <p style={{ fontSize: '0.73rem', color: '#444', lineHeight: 1.4, margin: '0 0 10px' }}>
                      {currentEra.description}
                    </p>
                    <div className="era-metrics-grid">
                      <div className="era-metric">
                        <small>Built-up Area</small>
                        <b>{currentEra.builtUpCoverage}</b>
                      </div>
                      <div className="era-metric">
                        <small>Green Canopy</small>
                        <b style={{ color: '#059669' }}>{currentEra.greenCoverPercent}</b>
                      </div>
                      <div className="era-metric">
                        <small>Active Lakes</small>
                        <b style={{ color: '#2563eb' }}>{currentEra.waterbodiesCount}</b>
                      </div>
                      <div className="era-metric">
                        <small>Heritage Index</small>
                        <b>{currentEra.heritageScore}</b>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Encroachments Layer Toggle */}
              <div className="toggle-row" style={{ marginTop: '14px', background: '#fef2f2', border: '1px solid #fee2e2', padding: '8px 12px', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={16} color="#ef4444" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#991b1b' }}>3D Land Encroachment Layer</span>
                </div>
                <button 
                  className={`toggle-sm ${showEncroachments ? 'on' : ''}`} 
                  onClick={() => setShowEncroachments(!showEncroachments)} 
                />
              </div>

              {/* Encroachment Audit Cards */}
              <div className="encroachments-list-section">
                <div className="encroachments-header">
                  <span>Documented Heritage Encroachments ({MYSURU_ENCROACHMENTS.length})</span>
                  <small>Click to Fly</small>
                </div>

                <div className="encroachments-list">
                  {MYSURU_ENCROACHMENTS.map(item => {
                    const isSelected = selectedEncroachment?.id === item.id;
                    return (
                      <div 
                        key={item.id}
                        className={`encroachment-card ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedEncroachment(item);
                          if (map.current) {
                            map.current.flyTo({ center: item.coordinates, zoom: 16.5, pitch: 58, duration: 1600 });
                          }
                        }}
                      >
                        <div className="enc-top-row">
                          <span className={`risk-badge ${item.riskLevel.toLowerCase()}`}>
                            {item.riskLevel} RISK
                          </span>
                          <span className="enc-cat">{item.category}</span>
                        </div>
                        <strong className="enc-title">{item.name}</strong>
                        
                        <div className="loss-comparison-row">
                          <div className="loss-col">
                            <small>Historical (Royal era):</small>
                            <span>{item.originalExtent}</span>
                          </div>
                          <ChevronRight size={14} color="#94a3b8" />
                          <div className="loss-col">
                            <small>Current Extent:</small>
                            <span style={{ color: '#ef4444', fontWeight: 700 }}>{item.currentExtent}</span>
                          </div>
                        </div>

                        <p className="enc-type-note">
                          <b>Encroachment:</b> {item.encroachmentType}
                        </p>
                        
                        <div className="legal-status-pill">
                          <Info size={12} color="#475569" />
                          <span>{item.legalStatus}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'social' && (
            <div className="panel-section social-panel">
              <div className="social-header-card">
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#111' }}>Public Grievance & Civic Flagging</h4>
                  <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: '#666' }}>
                    Pin infrastructure faults with exact coordinates & photo evidence
                  </p>
                </div>
                <button 
                  className={`action-btn wide ${showReportingHint ? 'active' : ''}`}
                  onClick={() => setShowReportingHint(true)}
                  style={{ marginTop: '10px' }}
                >
                  <MapPin size={18} /> {showReportingHint ? 'Click point on map...' : 'Pin Issue on 3D Map'}
                </button>
              </div>

              {showReportingHint && (
                <div className="pin-instruct-box">
                  <span className="pulse-dot-mini" />
                  <span>Tap anywhere on the Mysuru 3D map to lock coordinates and file your report.</span>
                </div>
              )}

              {/* Status Filter Tabs */}
              <div className="civic-filter-bar">
                <button 
                  className={`civic-filter-chip ${reportFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setReportFilter('all')}
                >
                  All ({reports.length})
                </button>
                <button 
                  className={`civic-filter-chip ${reportFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => setReportFilter('pending')}
                >
                  Pending ({reports.filter(r => r.status === 'pending').length})
                </button>
                <button 
                  className={`civic-filter-chip ${reportFilter === 'in_progress' ? 'active' : ''}`}
                  onClick={() => setReportFilter('in_progress')}
                >
                  In Progress ({reports.filter(r => r.status === 'in_progress').length})
                </button>
                <button 
                  className={`civic-filter-chip ${reportFilter === 'solved' ? 'active' : ''}`}
                  onClick={() => setReportFilter('solved')}
                >
                  Resolved ({reports.filter(r => r.status === 'solved').length})
                </button>
              </div>

              {/* Selected Report Inspector Card */}
              {selectedReport && (
                <div className="report-detail-modal-card">
                  <div className="report-detail-top">
                    <span className={`status-pill ${selectedReport.status}`}>
                      {selectedReport.status === 'solved' && <CheckCircle2 size={12} />}
                      {selectedReport.status === 'in_progress' && <Clock size={12} />}
                      {selectedReport.status === 'pending' && <AlertCircle size={12} />}
                      {selectedReport.status === 'solved' ? 'Resolved' : (selectedReport.status === 'in_progress' ? 'In Progress' : 'Pending Verification')}
                    </span>
                    <button className="close-station-btn" onClick={() => setSelectedReport(null)}>×</button>
                  </div>

                  <strong className="rep-title">{selectedReport.title}</strong>
                  <div className="rep-meta-row">
                    <span><Tag size={12} /> {selectedReport.category}</span>
                    <span><Clock size={12} /> {selectedReport.date}</span>
                  </div>

                  {selectedReport.image && (
                    <div className="rep-img-preview">
                      <img src={selectedReport.image} alt={selectedReport.title} />
                    </div>
                  )}

                  <p className="rep-desc">{selectedReport.description}</p>

                  <div className="rep-coords-box">
                    <MapPin size={14} color="#0061ff" />
                    <span><b>Exact Coordinates:</b> {selectedReport.coordinates[1].toFixed(5)}°N, {selectedReport.coordinates[0].toFixed(5)}°E</span>
                  </div>

                  {selectedReport.officialNote && (
                    <div className="official-note-box">
                      <small>Official City Response:</small>
                      <p>{selectedReport.officialNote}</p>
                    </div>
                  )}

                  {/* Civic Status Progression Control */}
                  <div className="status-cycle-row">
                    <span style={{ fontSize: '0.68rem', color: '#666', fontWeight: 600 }}>Update Status:</span>
                    <div className="cycle-btn-group">
                      {['pending', 'in_progress', 'solved'].map(stKey => (
                        <button 
                          key={stKey}
                          className={`cycle-btn ${selectedReport.status === stKey ? 'active' : ''}`}
                          onClick={() => {
                            const updated = reports.map(r => r.id === selectedReport.id ? { ...r, status: stKey } : r);
                            setReports(updated);
                            setSelectedReport({ ...selectedReport, status: stKey });
                            try {
                              localStorage.setItem('mysuru_civic_reports', JSON.stringify(updated));
                            } catch (e) { console.warn(e); }
                            axios.patch(`http://localhost:3001/api/complaints/${selectedReport.id}/status`, { status: stKey })
                              .catch(err => console.warn('Could not update status on server:', err));
                          }}
                        >
                          {stKey === 'pending' ? 'Pending' : (stKey === 'in_progress' ? 'In Progress' : 'Solved')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Citizen Reports Scroll List */}
              <div className="report-feed-list">
                {reports
                  .filter(r => reportFilter === 'all' || r.status === reportFilter)
                  .map(r => (
                    <div 
                      key={r.id} 
                      className={`report-feed-card ${selectedReport?.id === r.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedReport(r);
                        if (map.current) {
                          map.current.flyTo({ center: r.coordinates, zoom: 17, pitch: 55, duration: 1500 });
                        }
                      }}
                    >
                      <div className="card-top-row">
                        <span className={`status-pill ${r.status}`}>
                          {r.status === 'solved' ? 'Resolved' : (r.status === 'in_progress' ? 'In Progress' : 'Pending')}
                        </span>
                        <span className="card-date">{r.date.split(' ')[0]}</span>
                      </div>
                      <strong className="card-title">{r.title}</strong>
                      <p className="card-excerpt">{r.description}</p>
                      <div className="card-foot-row">
                        <span className="card-loc"><MapPin size={12}/> {r.coordinates[1].toFixed(4)}°N, {r.coordinates[0].toFixed(4)}°E</span>
                        {r.image && <span className="card-has-photo">📷 Photo Attached</span>}
                      </div>
                    </div>
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

      {/* ====================== CITIZEN ISSUE SUBMISSION MODAL ====================== */}
      {isFlaggingModalOpen && draftCoords && (
        <div className="modal-backdrop">
          <div className="civic-modal-card">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="modal-icon-badge">
                  <MapPin size={20} color="#0061ff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#111' }}>File Public Grievance</h3>
                  <span style={{ fontSize: '0.72rem', color: '#666' }}>Mysuru Municipal Citizen Engagement Portal</span>
                </div>
              </div>
              <button 
                className="close-station-btn" 
                onClick={() => { setIsFlaggingModalOpen(false); setDraftCoords(null); }}
              >
                ×
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!draftTitle.trim() || !draftDesc.trim()) return;

                const newGrievance = {
                  id: Date.now(),
                  title: draftTitle.trim(),
                  category: draftCategory,
                  description: draftDesc.trim(),
                  status: 'pending',
                  coordinates: draftCoords,
                  locationName: `Mysuru Sector (${draftCoords[1].toFixed(4)}°N, ${draftCoords[0].toFixed(4)}°E)`,
                  date: new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                  image: draftImage || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=400&q=80',
                  officialNote: 'Assigned to Ward Grievance Response Desk.'
                };

                // 1. Update React State immediately
                setReports(prev => {
                  const updated = [newGrievance, ...prev];
                  try {
                    localStorage.setItem('mysuru_civic_reports', JSON.stringify(updated));
                  } catch (e) { console.warn('Could not save to localStorage', e); }
                  return updated;
                });
                setSelectedReport(newGrievance);
                setActiveTab('social');
                setIsFlaggingModalOpen(false);

                // 2. Persist to backend server API
                axios.post('http://localhost:3001/api/complaints', newGrievance)
                  .then(res => console.log('Complaint stored on server successfully:', res.data))
                  .catch(err => console.warn('Could not persist complaint to server (saved locally):', err));

                // 3. Smooth flyTo map focus on pinned complaint location
                if (map.current) {
                  map.current.flyTo({ center: draftCoords, zoom: 17, pitch: 55, duration: 1600 });
                }

                setDraftCoords(null);
                setDraftTitle('');
                setDraftDesc('');
                setDraftImage('');
              }}
              className="civic-form"
            >
              {/* Exact Coordinates Display */}
              <div className="form-group">
                <label className="form-label">Pinned Geospatial Coordinates</label>
                <div className="coords-display-pill">
                  <MapPin size={16} color="#0061ff" />
                  <span className="coords-text">
                    Latitude: <b>{draftCoords[1].toFixed(6)}° N</b> &nbsp;|&nbsp; Longitude: <b>{draftCoords[0].toFixed(6)}° E</b>
                  </span>
                  <span className="coords-tag">GPS Verified</span>
                </div>
              </div>

              {/* Title Input */}
              <div className="form-group">
                <label className="form-label">Issue Title / Summary *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Hazardous Road Pothole, Broken Streetlight..." 
                  value={draftTitle}
                  onChange={e => setDraftTitle(e.target.value)}
                  required 
                />
              </div>

              {/* Category Dropdown */}
              <div className="form-group">
                <label className="form-label">Infrastructure Category</label>
                <select 
                  className="form-input select"
                  value={draftCategory}
                  onChange={e => setDraftCategory(e.target.value)}
                >
                  <option value="Roads & Infrastructure">Roads & Infrastructure (Potholes, Signals)</option>
                  <option value="Streetlighting">Streetlighting & Power Cables</option>
                  <option value="Water & Utilities">Water Pipelines & Drainage Overflows</option>
                  <option value="Sanitation & Waste">Solid Waste & Sanitation</option>
                  <option value="Parks & Greenery">Public Parks & Tree Hazards</option>
                  <option value="Air & Environment">Severe Dust / Smoke Emission Source</option>
                </select>
              </div>

              {/* Problem Explanation Textarea */}
              <div className="form-group">
                <label className="form-label">Explain The Problem In Detail *</label>
                <textarea 
                  className="form-textarea"
                  placeholder="Describe the problem, severity, and any landmarks to help municipal teams find and fix it quickly..."
                  rows={3}
                  value={draftDesc}
                  onChange={e => setDraftDesc(e.target.value)}
                  required
                />
              </div>

              {/* Photo Evidence Upload / Image URL */}
              <div className="form-group">
                <label className="form-label">Photo Evidence (Upload File or Enter Image URL)</label>
                <div className="upload-options-box">
                  <label className="file-upload-btn">
                    <Upload size={16} /> Choose Image from Device
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setDraftImage(reader.result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#999' }}>or paste image URL:</span>
                  <input 
                    type="url" 
                    className="form-input" 
                    placeholder="https://example.com/photo.jpg" 
                    value={draftImage.startsWith('data:') ? '' : draftImage}
                    onChange={e => setDraftImage(e.target.value)}
                  />
                </div>

                {draftImage && (
                  <div className="draft-img-thumb-wrap">
                    <img src={draftImage} alt="Uploaded Proof Preview" />
                    <button 
                      type="button" 
                      className="remove-thumb-btn"
                      onClick={() => setDraftImage('')}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="cancel-btn" 
                  onClick={() => { setIsFlaggingModalOpen(false); setDraftCoords(null); }}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-grievance-btn">
                  <CheckCircle2 size={16} /> Submit Verified Grievance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
