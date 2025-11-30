# Enhanced AI Search - Testing Examples

## Test These Queries to See AI Magic! 🚀

### Basic Searches
```
"mechanical gears"
→ AI extracts: q="mechanical gears", tags=["mechanical"], categories=["science-technology"]

"robots"  
→ AI extracts: q="robots", categories=["science-technology"]

"cars"
→ AI extracts: q="cars", categories=["vehicles-transports"]
```

### Quality Filters
```
"downloadable robots"
→ AI extracts: q="robots", downloadable=true, categories=["science-technology"]

"staff-picked high quality characters"
→ AI extracts: q="characters", staffpicked=true, min_face_count=50000, categories=["characters"]

"animated characters with sound"
→ AI extracts: q="characters", animated=true, sound=true, categories=["characters"]
```

### Technical Specifications
```
"low poly game-ready cars under 10k faces"
→ AI extracts: q="cars", tags=["low-poly", "game-ready"], max_face_count=10000, categories=["vehicles-transports"]

"PBR metalness workflow weapons"
→ AI extracts: q="weapons", pbr_type="metalness", categories=["weapons-military"]

"rigged character for Blender"
→ AI extracts: q="character", rigged=true, file_format="blend", categories=["characters"]
```

### License & Commercial Use
```
"free downloadable robots, no attribution required"
→ AI extracts: q="robots", downloadable=true, license="CC0", categories=["science-technology"]

"CC-BY vehicles for commercial use"
→ AI extracts: q="vehicles", license="CC-BY", categories=["vehicles-transports"]

"public domain weapons"
→ AI extracts: q="weapons", license="CC0", categories=["weapons-military"]
```

### Advanced Filtering
```
"recent staff-picked vehicles, most liked this month"
→ AI extracts: q="vehicles", staffpicked=true, sort_by="likes", date=30, categories=["vehicles-transports"]

"high detail mechanical parts over 50k faces"
→ AI extracts: q="mechanical parts", tags=["mechanical"], min_face_count=50000, categories=["science-technology"]

"GLB robots under 50MB with textures under 4k"
→ AI extracts: q="robots", file_format="gltf", archives_max_size=50000000, archives_texture_max_resolution=4096
```

### Creator-Specific
```
"robots by username JohnDoe"
→ AI extracts: q="robots", user="JohnDoe", categories=["science-technology"]

"mechanical gears from EngineersHub"
→ AI extracts: q="mechanical gears", user="EngineersHub", tags=["mechanical"]
```

### Complex Multi-Filter Queries
```
"downloadable animated low-poly characters under 20k faces, rigged for game engines, GLB format, recent uploads, most viewed"
→ AI extracts: {
  q: "characters",
  downloadable: true,
  animated: true,
  rigged: true,
  file_format: "gltf",
  max_face_count: 20000,
  tags: ["low-poly", "game-ready"],
  categories: ["characters"],
  sort_by: "views",
  date: 30
}

"free CC0 PBR vehicles with high detail, staff picked, downloadable, under 100MB"
→ AI extracts: {
  q: "vehicles",
  license: "CC0",
  pbr_type: "true",
  staffpicked: true,
  downloadable: true,
  archives_max_size: 100000000,
  min_face_count: 50000,
  categories: ["vehicles-transports"]
}
```

## What Makes This Powerful?

### 🧠 Smart Inference
- "game ready" → automatically adds low-poly tag + sets max_face_count
- "free" → infers license filtering (CC0 or CC-BY)
- "recent" → sets date filter + sort by publishedAt
- "high quality" → sets min_face_count + staffpicked

### 🎯 Context Understanding
- "car" → knows it's vehicles-transports category
- "gun" → knows it's weapons-military category  
- "tree" → knows it's nature-plants category

### 🔧 Technical Awareness
- "GLB" → correctly maps to "gltf" file format
- "metal roughness" → sets pbr_type to "metalness"
- "rigged character" → combines rigged=true + characters category

### 📊 Multi-Filter Intelligence
- Combines multiple filters from one sentence
- Understands relationships (downloadable + animation + rigging)
- Sets appropriate defaults based on context

## Testing in the App

1. Go to `/find-models`
2. Click "Natural Language Search"
3. Try any of the above queries
4. Check the console to see extracted parameters
5. Verify results match your intent

## Expected Console Output

When you search "low poly cars under 10k faces GLB", you'll see:

```json
🔍 AI-generated search params: {
  "q": "cars",
  "tags": ["low-poly"],
  "categories": ["vehicles-transports"],
  "file_format": "gltf",
  "max_face_count": 10000,
  "downloadable": null,
  "animated": null,
  "rigged": null,
  "staffpicked": null,
  "sound": null,
  "pbr_type": "",
  "license": "",
  "min_face_count": null,
  // ... other params ...
}
```

The AI only sets what it's confident about, leaving others as null/"" defaults!

## Pro Tips for Best Results

1. **Be Specific**: "low poly game-ready cars" > "cars"
2. **Mention Constraints**: "under 10k faces", "under 50MB"
3. **Specify Licenses**: "CC0", "free", "no attribution"
4. **State Quality**: "staff-picked", "high detail", "downloadable"
5. **Combine Filters**: AI handles multiple filters in one query!

The AI will extract maximum value from your natural language! 🎉
