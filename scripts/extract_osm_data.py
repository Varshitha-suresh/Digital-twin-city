import overpy
import json
import geojson

def get_mysuru_buildings():
    api = overpy.Overpass()
    # Query for buildings in Mysuru (bounding box around the city center)
    query = """
    [out:json][timeout:180];
    (
      way["building"](12.18, 76.50, 12.40, 76.80);
      relation["building"](12.18, 76.50, 12.40, 76.80);
    );
    out body;
    >;
    out skel qt;
    """
    
    print("Fetching Mysuru building data from Overpass API...")
    result = api.query(query)
    
    features = []
    
    for way in result.ways:
        coords = [[float(node.lon), float(node.lat)] for node in way.nodes]
        if len(coords) < 3:
            continue
            
        # Ensure it's a closed polygon
        if coords[0] != coords[-1]:
            coords.append(coords[0])
            
        # Get height, default to 3 if not present (simplified for 3D)
        height = float(way.tags.get("height", 3)) if "height" in way.tags else 3
        # Estimate height from levels
        if "building:levels" in way.tags:
            try:
                levels_str = way.tags.get("building:levels")
                # Handle cases like "1,2,3" or "2;3" by taking the max or first
                levels = [float(l.strip()) for l in levels_str.replace(",", " ").replace(";", " ").split() if l.strip().isdigit()]
                if levels:
                    height = max(levels) * 3
                else:
                    height = 3
            except:
                height = 3
            
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [coords]
            },
            "properties": {
                "id": way.id,
                "name": way.tags.get("name", "Unnamed Building"),
                "height": height,
                "type": way.tags.get("building", "yes")
            }
        }
        features.append(feature)
        
    with open("../data/mysuru_buildings.json", "w") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f)
        
    print(f"Successfully extracted {len(features)} buildings to data/mysuru_buildings.json")

if __name__ == "__main__":
    get_mysuru_buildings()
