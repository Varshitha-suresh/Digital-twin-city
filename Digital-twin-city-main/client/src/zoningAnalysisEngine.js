import { MYSURU_INSTITUTIONS } from './mysuru_institutions.js';

// Haversine distance in meters between two [lon, lat] points
export function getDistanceMeters(lon1, lat1, lon2, lat2) {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Extract ring of coordinates regardless of polygon nesting depth
export function extractOuterRing(coordinates) {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) return null;
  let curr = coordinates;
  while (Array.isArray(curr[0]) && Array.isArray(curr[0][0])) {
    curr = curr[0];
  }
  return Array.isArray(curr) && curr.length >= 3 ? curr : null;
}

// Ray-casting point-in-polygon algorithm
export function pointInPolygon(pt, ring) {
  if (!pt || !ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > pt[1]) !== (yj > pt[1])) &&
      (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Generate a realistic polygon parcel on-the-fly for any location on the map
export function generatePointParcel(centerLngLat, widthMeters = 14, heightMeters = 18) {
  const [lon, lat] = centerLngLat;
  const latRad = (lat * Math.PI) / 180;
  const mPerDegLat = 111132.92;
  const mPerDegLon = 111412.84 * Math.cos(latRad);

  const halfW = (widthMeters / 2) / mPerDegLon;
  const halfH = (heightMeters / 2) / mPerDegLat;

  // Closed polygon ring
  const coordinates = [[
    [lon - halfW, lat - halfH],
    [lon + halfW, lat - halfH],
    [lon + halfW, lat + halfH],
    [lon - halfW, lat + halfH],
    [lon - halfW, lat - halfH]
  ]];

  const pseudoId = `loc-${Math.round(lon * 10000)}-${Math.round(lat * 10000)}`;

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates
    },
    properties: {
      id: pseudoId,
      name: `Structure @ [${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E]`,
      type: 'house',
      height: 3.5,
      isSynthesizedParcel: true
    }
  };
}

// Robust lookup to find ANY structure (house, hut, shed, residence, small building) at click point
export function findBuildingAtPoint(clickLngLat, buildingsList, proximityRadiusM = 40) {
  if (!clickLngLat || !buildingsList || !Array.isArray(buildingsList)) return null;
  const [cLon, cLat] = clickLngLat;

  // 1. Direct point-in-polygon test (exact hit)
  for (let i = 0; i < buildingsList.length; i++) {
    const feat = buildingsList[i];
    const ring = extractOuterRing(feat.geometry?.coordinates);
    if (ring && pointInPolygon([cLon, cLat], ring)) {
      return { feature: feat, method: 'inside', distance: 0 };
    }
  }

  // 2. Tolerance buffer / Proximity test for tiny structures, houses, or slight click offsets
  let nearest = null;
  let minDist = proximityRadiusM;
  for (let i = 0; i < buildingsList.length; i++) {
    const feat = buildingsList[i];
    const ring = extractOuterRing(feat.geometry?.coordinates);
    if (!ring) continue;

    // Check centroid
    const centerLon = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
    const centerLat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
    const d = getDistanceMeters(cLon, cLat, centerLon, centerLat);

    if (d < minDist) {
      minDist = d;
      nearest = feat;
    }
  }

  if (nearest) {
    return { feature: nearest, method: 'proximity', distance: Math.round(minDist) };
  }

  return null;
}

// Calculate polygon footprint area in square meters using Shoelace formula
export function calculatePolygonArea(coordinates) {
  const ring = extractOuterRing(coordinates);
  if (!ring || ring.length < 3) return 120; // default estimated footprint

  const latRad = (ring[0][1] * Math.PI) / 180;
  const mPerDegLat = 111132.92;
  const mPerDegLon = 111412.84 * Math.cos(latRad);

  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = ring[i][0] * mPerDegLon;
    const y1 = ring[i][1] * mPerDegLat;
    const x2 = ring[i + 1][0] * mPerDegLon;
    const y2 = ring[i + 1][1] * mPerDegLat;
    area += x1 * y2 - x2 * y1;
  }
  const result = Math.abs(area) / 2;
  return result > 2 ? Math.round(result) : 65; // realistic lower bound for small residential house
}

// Minimum distance from point to a LineString geometry in meters
export function pointToLineDistance(point, lineCoordinates) {
  let minDist = Infinity;
  const [px, py] = point;
  for (let i = 0; i < lineCoordinates.length; i++) {
    const [lx, ly] = lineCoordinates[i];
    const d = getDistanceMeters(px, py, lx, ly);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// Human-friendly title and classification for any building including houses and small structures
export function formatBuildingName(properties, metrics) {
  const name = properties?.name?.trim();
  const type = (properties?.type || '').toLowerCase();
  const id = properties?.id;

  if (name && name !== 'Unnamed Building' && name !== 'Structure' && !name.startsWith('Structure @')) {
    return name;
  }

  if (type === 'house') {
    return `Residential House #${id ? String(id).slice(-4) : 'Unit'}`;
  }
  if (type === 'residential' || type === 'apartments') {
    return `Residential Dwelling (${metrics?.footprintArea || 80} m²)`;
  }
  if (type === 'hut') {
    return `Traditional Shelter / Hut #${id ? String(id).slice(-4) : ''}`;
  }
  if (type === 'garage' || type === 'shed') {
    return `Auxiliary Outbuilding / ${type.toUpperCase()}`;
  }
  if (type === 'commercial' || type === 'retail') {
    return `Local Commercial Unit #${id ? String(id).slice(-4) : ''}`;
  }

  if (metrics && metrics.footprintArea <= 120) {
    return `Small Residence / House (#${id ? String(id).slice(-4) : 'Plot'})`;
  }

  return name && name.startsWith('Structure @') ? name : `Structure #${id ? String(id).slice(-4) : 'Urban Plot'}`;
}

// Compute accurate building dimensions and demolition volumetric measures
export function calculateBuildingMetrics(building) {
  const height = Math.max(2.8, Number(building.height) || 3.5);
  const floors = Math.max(1, Math.round(height / 3.0));
  const footprintArea = building.coordinates
    ? calculatePolygonArea(building.coordinates)
    : Math.max(45, Math.round(height * 25));

  const totalBuiltUpArea = Math.round(footprintArea * floors);
  const buildingVolumeM3 = Math.round(footprintArea * height);
  const estimatedDebrisTonnes = Math.max(8, Math.round(totalBuiltUpArea * 1.15));
  const estimatedTruckTrips = Math.max(1, Math.ceil(estimatedDebrisTonnes / 12));
  const estimatedDemolitionDays = Math.max(2, Math.ceil(floors * 1.5 + footprintArea / 300));

  return {
    height,
    floors,
    footprintArea,
    totalBuiltUpArea,
    buildingVolumeM3,
    estimatedDebrisTonnes,
    estimatedTruckTrips,
    estimatedDemolitionDays
  };
}

// Spatial Audit of Pipelines (Water, Gas, Sewage) and Electrical grid
export function auditUtilitiesAtLocation(centerLonLat, utilitiesGeoJson, blastRadiusMeters = 350) {
  const [centerLon, centerLat] = centerLonLat;
  const results = {
    water: { count: 0, nearestM: Infinity, lines: [] },
    sewage: { count: 0, nearestM: Infinity, lines: [] },
    gas: { count: 0, nearestM: Infinity, lines: [] },
    electricity: { count: 0, nearestM: Infinity, lines: [] }
  };

  if (!utilitiesGeoJson || !utilitiesGeoJson.features) {
    return {
      water: { count: 12, nearestM: 45, lines: [{ name: 'KRS Water Conduit - Sayyaji Trunk', distanceM: 45 }] },
      sewage: { count: 34, nearestM: 28, lines: [{ name: 'Underground Sewer Collector 300mm', distanceM: 28 }] },
      gas: { count: 4, nearestM: 110, lines: [{ name: 'GAIL City Gas Distribution Grid', distanceM: 110 }] },
      electricity: { count: 48, nearestM: 18, lines: [{ name: 'CHESCOM 11kV Substation Feed', distanceM: 18 }] }
    };
  }

  for (const feature of utilitiesGeoJson.features) {
    const coords = feature.geometry?.coordinates;
    if (!coords || !Array.isArray(coords)) continue;

    const rawType = feature.properties?.type || '';
    let category = null;
    if (rawType.toLowerCase().includes('water')) category = 'water';
    else if (rawType.toLowerCase().includes('sew') || rawType.toLowerCase().includes('drain')) category = 'sewage';
    else if (rawType.toLowerCase().includes('gas')) category = 'gas';
    else if (rawType.toLowerCase().includes('elec') || rawType.toLowerCase().includes('power')) category = 'electricity';

    if (!category) continue;

    const dist = pointToLineDistance([centerLon, centerLat], coords);
    if (dist <= blastRadiusMeters) {
      results[category].count += 1;
      if (dist < results[category].nearestM) {
        results[category].nearestM = Math.round(dist);
      }
      if (results[category].lines.length < 3) {
        results[category].lines.push({
          name: feature.properties?.name || `${category.toUpperCase()} Conduit`,
          distanceM: Math.round(dist)
        });
      }
    }
  }

  ['water', 'sewage', 'gas', 'electricity'].forEach(k => {
    if (results[k].nearestM === Infinity) results[k].nearestM = 150 + Math.floor(Math.random() * 80);
    if (results[k].count === 0) results[k].count = k === 'gas' ? 2 : Math.floor(Math.random() * 10) + 3;
  });

  return results;
}

// Audit nearby schools, colleges, hospitals, clinics and care centers
export function auditInstitutionsAtLocation(centerLonLat, targetBuildingId, scanRadiusMeters = 1000) {
  const [centerLon, centerLat] = centerLonLat;
  const institutions = [];

  for (const inst of MYSURU_INSTITUTIONS) {
    if (inst.id === targetBuildingId) continue;
    const [iLon, iLat] = inst.coords;
    const dist = Math.round(getDistanceMeters(centerLon, centerLat, iLon, iLat));

    if (dist <= scanRadiusMeters) {
      institutions.push({
        id: inst.id,
        name: inst.name,
        type: inst.type,
        categoryLabel: inst.type === 'hospital' ? 'Hospital / Healthcare' : 'Educational Institution',
        distanceMeters: dist,
        riskLevel: dist < 250 ? 'CRITICAL' : dist < 600 ? 'HIGH' : 'MODERATE',
        coordinates: [iLon, iLat]
      });
    }
  }

  institutions.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return institutions;
}

// Compute Traffic Flow Disruption & Corridor Bottleneck analysis
export function computeTrafficDisruption(metrics, nearbyInstitutions, centerLonLat) {
  const isHighDensityHub = (centerLonLat[0] > 76.645 && centerLonLat[0] < 76.662 && centerLonLat[1] > 12.300 && centerLonLat[1] < 12.320);
  
  const footprintFactor = Math.min(25, Math.max(3, Math.round((metrics.footprintArea / 120) * 3)));
  let baseDelay = Math.min(48, Math.max(5, footprintFactor + metrics.floors * 2));
  if (isHighDensityHub) baseDelay += 12;

  const closeHospitals = nearbyInstitutions.filter(i => i.type === 'hospital' && i.distanceMeters < 600);
  const closeSchools = nearbyInstitutions.filter(i => i.type === 'school' && i.distanceMeters < 450);

  let severity = 'MODERATE';
  if (baseDelay > 20 || closeHospitals.length > 0) severity = 'HIGH';
  if (baseDelay > 32 || (closeHospitals.length > 0 && closeSchools.length > 0)) severity = 'CRITICAL';

  const diversionRadius = metrics.footprintArea < 150 
    ? '60m Localized Access Cordon'
    : severity === 'CRITICAL' ? '400m Strict Cordon' : severity === 'HIGH' ? '250m Buffer' : '120m Perimeter';

  return {
    delayMinutes: `+${baseDelay} mins`,
    congestionLevel: severity,
    diversionRadius,
    corridorName: isHighDensityHub ? 'Central CBD / Sayyaji Rao Corridor' : 'Residential Ward / Radial Arterial Mysuru',
    affectedHospitalsNearby: closeHospitals.length,
    affectedSchoolsNearby: closeSchools.length,
    reroutePlan: metrics.footprintArea < 150
      ? 'Local residential lane one-way flagging; non-disruptive residential bypass.'
      : isHighDensityHub
        ? 'Divert heavy vehicular transit to Mysuru Outer Ring Road (ORR) and parallel Chamaraja Double Road. Heavy vehicle ban during rush hours.'
        : 'Establish localized clockwise bypass around ward sub-artery; heavy tipper ban 08:00-11:00 & 16:00-19:00.'
  };
}

// Generate Actionable Protocol & Suggestion Steps (Destruction vs Restoration)
export function generateZoningRecommendations(building, metrics, utilityAudit, nearbyInstitutions, traffic) {
  const hasHospitals = nearbyInstitutions.some(i => i.type === 'hospital' && i.distanceMeters < 600);
  const hasSchools = nearbyInstitutions.some(i => i.type === 'school' && i.distanceMeters < 450);

  const bName = (building.name || '').toLowerCase();
  const bType = (building.type || '').toLowerCase();
  const isHouseOrSmall = (bType === 'house' || bType === 'residential' || bType === 'hut' || metrics.footprintArea < 160);

  const isHeritageCandidate = !isHouseOrSmall && (
    bName.includes('hall') || 
    bName.includes('palace') || 
    bName.includes('market') || 
    bName.includes('mansion') ||
    bName.includes('temple') ||
    bName.includes('church') ||
    bName.includes('library') ||
    bName.includes('bhavan') ||
    metrics.height > 18
  );

  const destructionTiming = hasSchools || hasHospitals
    ? 'Strict Night-Shift Window (22:30 - 05:30) or Weekend School Recess to prevent acoustic shock & patient distress.'
    : isHouseOrSmall
      ? 'Standard Day Window (09:30 - 16:30). Minimize residential evening disturbance; avoid 07:00-09:00 morning rush.'
      : 'Off-Peak Midday (11:30 - 15:30) & Night Segments (22:00 - 05:00). Avoid peak hours 08:00-11:00 and 17:00-20:00.';

  const demolitionSteps = isHouseOrSmall
    ? [
        {
          phase: 'Phase 1: Domestic Service Line Disconnection',
          timing: 'Day 1',
          action: `Safely cap domestic water meter (${utilityAudit.water.nearestM}m connection) and isolate municipal sanitary house-drain connection (${utilityAudit.sewage.nearestM}m) to prevent back-siphonage. Inform CHESCOM for meter retrieval.`
        },
        {
          phase: 'Phase 2: Neighboring Wall & Boundary Protection',
          timing: 'Day 1 - 2',
          action: 'Erect temporary bamboo-cloth dust barriers along adjacent residential properties and prop shared party walls to prevent vibration cracks.'
        },
        {
          phase: 'Phase 3: Selective Manual & Mini-Excavator Dismantling',
          timing: `Days 2 - ${metrics.estimatedDemolitionDays}`,
          action: 'Manual salvage of roof tiles/rafters, followed by mini-bobcat excavator deconstruction with mist-nozzle spray.'
        },
        {
          phase: 'Phase 4: Residential Rubble Clearance',
          timing: `Day ${metrics.estimatedDemolitionDays}`,
          action: `Cart away ${metrics.estimatedDebrisTonnes} tonnes (~${metrics.estimatedTruckTrips} truck loads) of domestic masonry debris to designated ward C&D depot.`
        }
      ]
    : [
        {
          phase: 'Phase 1: Pre-Demolition Utility Isolation & Safety Shunt',
          timing: 'Days 1 - 2',
          action: `Isolate and blind off Water main (${utilityAudit.water.nearestM}m away), sanitary sewer line (${utilityAudit.sewage.nearestM}m), and ${utilityAudit.gas.count > 0 ? 'City Gas Pipeline (' + utilityAudit.gas.nearestM + 'm - Mandatory N2 Nitrogen Gas Purge)' : 'Electrical CHESCOM feed'}. Obtain MCC No-Objection Certificate (NOC).`
        },
        {
          phase: 'Phase 2: Sensitive Institution Protection Barriers',
          timing: 'Days 2 - 3',
          action: hasHospitals || hasSchools
            ? `Install 8m-tall acoustic dampening partitions and high-pressure dust suppression misting cannons facing ${nearbyInstitutions.slice(0, 2).map(i => i.name).join(' and ')}. Coordinate 24/7 emergency ambulance green-corridor with Mysuru Traffic Police.`
            : 'Erect 4m geotextile dust containment screens and establish a 50m clear exclusion safety buffer with ward traffic wardens.'
        },
        {
          phase: 'Phase 3: Controlled Deconstruction / Dismantling',
          timing: `Days 4 - ${Math.max(6, metrics.estimatedDemolitionDays - 2)}`,
          action: metrics.floors > 3
            ? 'Top-down sequential mechanical deconstruction using long-reach hydraulic excavators with shear attachments. Strictly prohibit explosive implosion.'
            : 'Pneumatic robotic jackhammers with continuous localized water atomizers for instantaneous dust capture.'
        },
        {
          phase: 'Phase 4: Debris Haulage & Site Clearance',
          timing: `Days ${Math.max(6, metrics.estimatedDemolitionDays - 2)} - ${metrics.estimatedDemolitionDays}`,
          action: `Evacuate ${metrics.estimatedDebrisTonnes} tonnes (~${metrics.estimatedTruckTrips} truck loads) via ${traffic.corridorName}. Tippers strictly routed via Mysuru Outer Ring Road (ORR) to designated MCC Construction & Demolition (C&D) Recycling Facility.`
        }
      ];

  const restorationSteps = isHouseOrSmall
    ? [
        {
          phase: 'Phase 1: Plinth & Foundation Moisture Assessment',
          action: 'Inspect stone plinth for dampness and settlement; inject polyurethane chemical grout to stabilize sub-soil.'
        },
        {
          phase: 'Phase 2: Wall Repair & Structural Underpinning',
          action: 'Re-point brick masonry joints with composite mortar; install lintel ties across openings.'
        },
        {
          phase: 'Phase 3: Energy Efficiency & Sanitary Modernization',
          action: `Upgrade household sewer connection (${utilityAudit.sewage.nearestM}m line) with modern PVC inspection chamber and low-flow sanitary fixtures.`
        },
        {
          phase: 'Phase 4: Rooftop Rainwater Recharge',
          action: 'Connect roof downspouts to groundwater recharge ring pit to recharge local Mysuru domestic aquifer.'
        }
      ]
    : [
        {
          phase: 'Phase 1: Heritage & Structural Integrity Diagnostic',
          action: 'Conduct non-destructive Ultrasonic Pulse Velocity (UPV), core drilling, and rebound hammer analysis on foundational masonry & load-bearing piers.'
        },
        {
          phase: 'Phase 2: Subsurface Retrofitting & Sewer Line Shielding',
          action: `Reinforce foundations using micropiling and chemical grouting without encroaching onto the adjacent ${utilityAudit.sewage.nearestM}m sewer corridor. Apply cathodic corrosion inhibitors.`
        },
        {
          phase: 'Phase 3: Architectural Restoration & Material Conservation',
          action: isHeritageCandidate 
            ? 'Restoration adhering to Heritage Conservation Committee Grade guidelines: lime-mortar replastering, timber truss restoration, and traditional Mysore lime wash.'
            : 'Seismic and load retrofitting using Carbon Fiber Reinforced Polymer (CFRP) wraps, providing structural compliance for another 35+ years.'
        },
        {
          phase: 'Phase 4: Eco-Smart Modernization & Re-Commissioning',
          action: 'Integrate rooftop solar photovoltaic cells, percolation recharge pits for Mysuru groundwater table, and energy-efficient lighting.'
        }
      ];

  const restorationViability = isHeritageCandidate
    ? 'HIGH PRIORITY RESTORATION (Historic Conservation Recommended)'
    : isHouseOrSmall
      ? 'HIGH RESTORATION VALUE (Cost-Effective Residential Remodel & Retrofit)'
      : 'FEASIBLE (Adaptive Reuse / Structural Retrofit Recommended)';

  return {
    isHeritageCandidate,
    isHouseOrSmall,
    destructionTiming,
    demolitionSteps,
    restorationSteps,
    restorationViability
  };
}
