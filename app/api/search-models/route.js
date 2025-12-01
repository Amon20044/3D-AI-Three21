import { ApifyClient } from 'apify-client';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Initialize Apify client
const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_KEY,
});

// Comprehensive system prompt for natural language to search parameters
const SEARCH_SYSTEM_PROMPT = `
You are an expert 3D model search assistant for Sketchfab. Convert any natural language search query into precise, structured Sketchfab search parameters. 
IMPORTANT: All fields except "q" MUST be returned as SLUGS (lowercase, hyphens). 
Only "q" stays human-readable text. Everything else must match the API slug format.

Return ONLY valid parameters listed below. If a value is not relevant, omit it.

---------------------------------------------------
## VALID PARAMETERS (STRICT, SLUG OUTPUT)
---------------------------------------------------

### Core Search
- q (string, normal text, not slugified)
- user (string, slugified)
- tags (array[string], slugs)
- categories (array[string], slugs ONLY):
  - animals-pets
  - architecture
  - art-abstract
  - cars-vehicles
  - characters-creatures
  - cultural-heritage-history
  - electronics-gadgets
  - fashion-style
  - food-drink
  - furniture-home
  - music
  - nature-plants
  - news-politics
  - people
  - places-travel
  - science-technology
  - sports-fitness
  - weapons-military

### Date (integer, in days)
Use SLUGS internally only for reasoning; final output is INTEGER:
- "all-time" → omit date
- "this-month" → 30
- "this-week" → 7
- "this-day" → 1

### Sort By (STRICT SLUG OUTPUT)
- relevance
- likes
- views
- recent

### Boolean Filters (STRICT)
(downloadable defaults to true unless user says otherwise)
- downloadable (boolean)
- animated (boolean)
- rigged (boolean)
- staffpicked (boolean)
- sound (boolean)
- archives_flavours (boolean)

### Technical Specs (SLUG OUTPUT)
- pbr_type: metalness | specular | true | false
- file_format: obj | fbx | blend | gltf | stl | ply | dae | x3d
- license (STRICT SLUGS):
  - CC0
  - CC-BY
  - CC-BY-SA
  - CC-BY-ND
  - CC-BY-NC
  - CC-BY-NC-SA
  - CC-BY-NC-ND
  - free-standard
  - standard
  - editorial

License inference:
- “no attribution” → CC0
- “commercial use” → CC0, CC-BY, CC-BY-SA, CC-BY-ND, free-standard, standard
- “non-commercial” → CC-BY-NC*, CC-BY-NC-SA, CC-BY-NC-ND

### Geometry Constraints
- min_face_count (integer)
- max_face_count (integer)
- max_uv_layer_count (integer)

### Archive Constraints
(all values integers or slugs)
- available_archive_type (string)
- archives_max_size
- archives_max_face_count
- archives_max_vertex_count
- archives_max_texture_count
- archives_texture_max_resolution

---------------------------------------------------
## SMART RULES (VERY IMPORTANT)
---------------------------------------------------

1. Only “q” is NOT slugged. Everything else MUST be a strict slug.
2. Infer categories via slug:
   - “car” → cars-vehicles
   - “gun” → weapons-military
   - “tree” → nature-plants
   - “robot” → science-technology
3. Always set downloadable=true unless user says:
   - “don’t download”, “preview only”, “non-downloadable is fine”
4. Set staffpicked=true if user says:
   - best, top quality, curated, featured, premium
5. Set animated=true for “animation”, “has animation”, “animated”
6. Set rigged=true for “rig”, “skeleton”, “bones”
7. Keep q short (2–6 words) and move descriptors into tags
8. NEVER output parameters not listed in this prompt.
9. Output MUST be a valid JSON object.

---------------------------------------------------
## EXAMPLES (SLUGS ONLY EXCEPT q)
---------------------------------------------------

"low poly game-ready cars under 10k faces, glb"
→ {
  "q": "cars",
  "tags": ["low-poly", "game-ready"],
  "categories": ["cars-vehicles"],
  "file_format": "gltf",
  "max_face_count": 10000
}

"free downloadable robots with animation, no attribution"
→ {
  "q": "robots",
  "categories": ["science-technology"],
  "downloadable": true,
  "animated": true,
  "license": "CC0"
}

"best high quality characters rigged for blender"
→ {
  "q": "characters",
  "categories": ["characters-creatures"],
  "staffpicked": true,
  "rigged": true,
  "file_format": "blend",
  "min_face_count": 50000
}

"most liked pbr vehicles this month"
→ {
  "q": "vehicles",
  "categories": ["cars-vehicles"],
  "pbr_type": "true",
  "sort_by": "likes",
  "date": 30
}

"weapons under 50mb, CC-BY"
→ {
  "q": "weapons",
  "categories": ["weapons-military"],
  "license": "CC-BY",
  "archives_max_size": 50000000
}

---------------------------------------------------
Return ONLY the JSON object.

`;

export async function POST(req) {
    try {
        const { query, mode, manualFilters } = await req.json();

        let searchParams = {
            // Core search
            q: "",
            user: "",
            tags: [],
            categories: [],

            // Quality & type filters  
            downloadable: null,
            animated: null,
            rigged: null,
            staffpicked: null,
            sound: null,

            // Technical specs
            pbr_type: "",
            file_format: "",
            license: "",

            // Geometry constraints
            min_face_count: null,
            max_face_count: null,
            max_uv_layer_count: null,

            // Archive/download constraints
            available_archive_type: "",
            archives_max_size: null,
            archives_max_face_count: null,
            archives_max_vertex_count: null,
            archives_max_texture_count: null,
            archives_texture_max_resolution: null,
            archives_flavours: false,

            // Sorting & filtering
            collection: "",
            sort_by: "",
            date: null
        };

        // Natural language mode - use AI to convert query
        if (mode === 'natural' && query) {
            console.log('🤖 Natural language search:', query);

            const gemini = createGoogleGenerativeAI({
                apiKey: process.env.GOOGLE_API_KEY
            });

            const result = await generateObject({
                model: gemini("gemini-2.5-flash"),
                system: SEARCH_SYSTEM_PROMPT,
                prompt: `Convert this search query to Sketchfab parameters: "${query}"`,
                schema: z.object({
                    // Core search
                    q: z.string().describe('Main search keywords (2-6 words)'),
                    user: z.string().optional().describe('Sketchfab username'),
                    tags: z.array(z.string()).optional().describe('Tag slugs'),
                    categories: z.array(z.string()).optional().describe('Category slugs'),

                    // Quality & type filters
                    downloadable: z.boolean().optional().describe('Only downloadable models'),
                    animated: z.boolean().optional().describe('Only animated models'),
                    rigged: z.boolean().optional().describe('Only rigged models'),
                    staffpicked: z.boolean().optional().describe('Staff-picked only'),
                    sound: z.boolean().optional().describe('Models with sound'),

                    // Technical specs (removed empty strings from enums - Gemini doesn't accept them)
                    pbr_type: z.enum(['metalness', 'specular', 'true', 'false']).optional().describe('PBR workflow type'),
                    file_format: z.enum(['gltf', 'obj', 'fbx', 'blend', 'dae', '3ds', 'ply', 'stl', 'x3d']).optional().describe('File format'),
                    license: z.enum(['CC0', 'CC-BY', 'CC-BY-SA', 'CC-BY-ND', 'CC-BY-NC', 'CC-BY-NC-SA', 'CC-BY-NC-ND']).optional().describe('License type'),

                    // Geometry constraints
                    min_face_count: z.number().optional().describe('Minimum polygon faces'),
                    max_face_count: z.number().optional().describe('Maximum polygon faces'),
                    max_uv_layer_count: z.number().optional().describe('Max UV layers'),

                    // Archive/download constraints
                    archives_max_size: z.number().optional().describe('Max archive size in bytes'),
                    archives_max_face_count: z.number().optional().describe('Max faces in archive'),
                    archives_max_vertex_count: z.number().optional().describe('Max vertices in archive'),
                    archives_max_texture_count: z.number().optional().describe('Max texture count'),
                    archives_texture_max_resolution: z.number().optional().describe('Max texture resolution'),
                    archives_flavours: z.boolean().optional().describe('All texture resolutions'),

                    // Sorting & filtering
                    sort_by: z.enum(['likes', 'views', 'publishedAt', 'recent', 'relevance']).optional().describe('Sort field'),
                    date: z.number().optional().describe('Last X days'),

                    // Additional filters
                    collection: z.string().optional().describe('Collection UID'),
                    available_archive_type: z.enum(['zip', 'blend', 'source']).optional().describe('Archive type')
                }),
                temperature: 0.3 // Low temperature for consistent results
            });

            searchParams = {
                ...searchParams,
                ...result.object,
                tags: result.object.tags || [],
                categories: result.object.categories || []
            };

            console.log('🔍 AI-generated search params:', JSON.stringify(searchParams, null, 2));
        }
        // Manual mode - use provided filters
        else if (mode === 'manual' && manualFilters) {
            searchParams = { ...searchParams, ...manualFilters };
            console.log('🎛️ Manual search params:', searchParams);
        } else {
            return new Response(JSON.stringify({
                error: 'Invalid search mode or missing parameters'
            }), { status: 400 });
        }

        // Execute Apify actor
        console.log('🚀 Running Apify Sketchfab search...');

        // Clean up params - remove null, empty strings, and empty arrays
        const cleanedParams = Object.entries(searchParams).reduce((acc, [key, value]) => {
            if (value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
                acc[key] = value;
            }
            return acc;
        }, {});

        console.log('🧹 Cleaned params:', JSON.stringify(cleanedParams, null, 2));

        const run = await apifyClient.actor("tCErBTV7dcifSOlkU").call(cleanedParams);

        // Fetch results
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

        console.log(`✅ Found ${items.length} models`);

        return new Response(JSON.stringify({
            success: true,
            count: items.length,
            searchParams: searchParams,
            models: items,
            attribution: {
                sketchfab: 'Models provided by Sketchfab',
                apify: 'Search powered by Apify',
                message: 'All models are property of their respective creators. Please respect licenses and attributions.'
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('❌ Search error:', error);
        return new Response(JSON.stringify({
            error: 'Model search failed',
            details: error.message
        }), { status: 500 });
    }
}
