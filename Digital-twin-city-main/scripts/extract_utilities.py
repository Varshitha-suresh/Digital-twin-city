import overpy
import json
import random

def extract_pipelines():
    api = overpy.Overpass()
    
    # Extract real water pipelines from OSM for Mysuru
    print("Extracting water/pipeline data from OSM...")
    query = """
    [out:json][timeout:120];
    (
      way["man_made"="pipeline"](12.20, 76.55, 12.38, 76.75);
      way["waterway"](12.20, 76.55, 12.38, 76.75);
      way["man_made"="water_well"](12.20, 76.55, 12.38, 76.75);
    );
    out body;
    >;
    out skel qt;
    """
    
    features = []
    
    try:
        result = api.query(query)
        for way in result.ways:
            coords = [[float(n.lon), float(n.lat)] for n in way.nodes]
            if len(coords) < 2:
                continue
            pipe_type = "WaterPipe"
            if "waterway" in way.tags:
                pipe_type = "WaterPipe"
            features.append({
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": coords},
                "properties": {
                    "type": pipe_type,
                    "name": way.tags.get("name", "Water Line"),
                    "source": "osm"
                }
            })
        print(f"Found {len(features)} real pipeline features from OSM")
    except Exception as e:
        print(f"OSM query error: {e}")
    
    # Now extract ROADS to generate synthetic utility networks along them
    print("Extracting roads for synthetic utility generation...")
    road_query = """
    [out:json][timeout:120];
    (
      way["highway"~"primary|secondary|tertiary|residential"](12.27, 76.60, 12.35, 76.70);
    );
    out body;
    >;
    out skel qt;
    """
    
    try:
        road_result = api.query(road_query)
        road_count = 0
        for way in road_result.ways:
            coords = [[float(n.lon), float(n.lat)] for n in way.nodes]
            if len(coords) < 2:
                continue
            
            highway_type = way.tags.get("highway", "residential")
            road_name = way.tags.get("name", "Unnamed Road")
            
            # Generate Water pipes along primary/secondary roads
            if highway_type in ["primary", "secondary", "tertiary"]:
                # Offset slightly to simulate underground position
                water_coords = [[c[0] + 0.00008, c[1] + 0.00005] for c in coords]
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": water_coords},
                    "properties": {
                        "type": "WaterPipe",
                        "name": f"Water Main - {road_name}",
                        "diameter": "500mm" if highway_type == "primary" else "300mm",
                        "source": "synthetic"
                    }
                })
                
                # Gas lines along primary roads only
                if highway_type in ["primary", "secondary"]:
                    gas_coords = [[c[0] - 0.00008, c[1] - 0.00005] for c in coords]
                    features.append({
                        "type": "Feature",
                        "geometry": {"type": "LineString", "coordinates": gas_coords},
                        "properties": {
                            "type": "GasLine",
                            "name": f"Gas Pipeline - {road_name}",
                            "diameter": "200mm",
                            "source": "synthetic"
                        }
                    })
            
            # Sewage lines along all roads
            sewage_coords = [[c[0] + 0.00012, c[1] - 0.00008] for c in coords]
            features.append({
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": sewage_coords},
                "properties": {
                    "type": "SewagePipe",
                    "name": f"Sewer Line - {road_name}",
                    "diameter": "400mm" if highway_type in ["primary", "secondary"] else "200mm",
                    "source": "synthetic"
                }
            })
            
            # Electricity cables along all roads
            elec_coords = [[c[0] - 0.00012, c[1] + 0.00008] for c in coords]
            features.append({
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": elec_coords},
                "properties": {
                    "type": "ElectricityLine",
                    "name": f"Power Cable - {road_name}",
                    "voltage": "11kV" if highway_type in ["primary", "secondary"] else "440V",
                    "source": "synthetic"
                }
            })
            
            road_count += 1
        
        print(f"Generated synthetic utilities along {road_count} roads")
    except Exception as e:
        print(f"Road extraction error: {e}")
    
    collection = {"type": "FeatureCollection", "features": features}
    
    with open("../data/mysuru_utilities.json", "w") as f:
        json.dump(collection, f)
    
    # Also copy to client public
    with open("../client/public/data/mysuru_utilities.json", "w") as f:
        json.dump(collection, f)
    
    print(f"Total utility features: {len(features)}")
    print("Saved to data/mysuru_utilities.json")

if __name__ == "__main__":
    extract_pipelines()
