"""
Generates contiguous, realistic administrative boundaries for Punjab pilot districts and blocks.
Uses Voronoi tessellation of block centroids clipped to district envelopes and merged district perimeters.
Result: Real interlocking cadastral polygons instead of disconnected square boxes.
"""

import json
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, Point, box, mapping
from shapely.ops import unary_union
from scipy.spatial import Voronoi

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "config" / "punjab_pilot.json"
DISTRICTS_GEOJSON_PATH = BASE_DIR / "data" / "geo" / "punjab_pilot_districts.geojson"
UNITS_GEOJSON_PATH = BASE_DIR / "data" / "geo" / "punjab_pilot_units.geojson"

with open(CONFIG_PATH) as f:
    config = json.load(f)

districts_info = config["districts"]

unit_features = []
district_features = []

for dist_name, dist_data in districts_info.items():
    blocks = dist_data["blocks"]
    pts = np.array([[b["lon"], b["lat"]] for b in blocks])
    
    # Define a generous buffer boundary for the district
    min_lon, min_lat, max_lon, max_lat = dist_data["bounds"]
    # Add a slight padding
    pad = 0.06
    envelope = box(min_lon - pad, min_lat - pad, max_lon + pad, max_lat + pad)
    
    # To do bounded Voronoi, add bounding points far away
    far_pts = [
        [min_lon - 2.0, min_lat - 2.0],
        [min_lon - 2.0, max_lat + 2.0],
        [max_lon + 2.0, min_lat - 2.0],
        [max_lon + 2.0, max_lat + 2.0],
        [min_lon - 2.0, (min_lat + max_lat) / 2],
        [max_lon + 2.0, (min_lat + max_lat) / 2],
        [(min_lon + max_lon) / 2, min_lat - 2.0],
        [(min_lon + max_lon) / 2, max_lat + 2.0]
    ]
    all_pts = np.vstack([pts, far_pts])
    vor = Voronoi(all_pts)
    
    district_block_polys = []
    
    for i, blk in enumerate(blocks):
        region_idx = vor.point_region[i]
        region = vor.regions[region_idx]
        
        if -1 not in region and len(region) > 0:
            poly_coords = [vor.vertices[v] for v in region]
            poly = Polygon(poly_coords)
        else:
            # Fallback for edge cases
            poly = Point(blk["lon"], blk["lat"]).buffer(0.08)
            
        # Clip with district boundary box
        poly = poly.intersection(envelope)
        
        # Smooth and simplify slightly to create realistic administrative curves
        poly = poly.simplify(0.002, preserve_topology=True)
        
        district_block_polys.append(poly)
        
        # Cropland area estimation
        area_ha = round(poly.area * (111000 * 96000) / 10000.0) # degrees^2 to hectares
        
        unit_features.append({
            "type": "Feature",
            "id": blk["code"],
            "properties": {
                "unit_id": blk["code"],
                "name": blk["name"],
                "district": dist_name,
                "district_id": dist_data["district_id"],
                "state": dist_data["state"],
                "lat": blk["lat"],
                "lon": blk["lon"],
                "cropland_pct": blk["cropland_pct"],
                "cropland_hectares": area_ha,
                "area_sq_km": round(poly.area * 111.0 * 96.0, 1)
            },
            "geometry": mapping(poly)
        })
        
    # Create the unified contiguous district perimeter
    district_unified_poly = unary_union(district_block_polys)
    district_unified_poly = district_unified_poly.simplify(0.003, preserve_topology=True)
    
    district_features.append({
        "type": "Feature",
        "id": dist_data["district_id"],
        "properties": {
            "district_id": dist_data["district_id"],
            "name": dist_name,
            "state": dist_data["state"],
            "center": dist_data["center"],
            "bounds": dist_data["bounds"],
            "total_blocks": len(blocks)
        },
        "geometry": mapping(district_unified_poly)
    })

units_geojson = {
    "type": "FeatureCollection",
    "features": unit_features
}

districts_geojson = {
    "type": "FeatureCollection",
    "features": district_features
}

with open(UNITS_GEOJSON_PATH, "w") as f:
    json.dump(units_geojson, f, indent=2)

with open(DISTRICTS_GEOJSON_PATH, "w") as f:
    json.dump(districts_geojson, f, indent=2)

print(f"Successfully generated {len(unit_features)} contiguous blocks and {len(district_features)} district perimeters!")
