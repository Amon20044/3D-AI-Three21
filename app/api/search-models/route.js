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
const SEARCH_SYSTEM_PROMPT = `You are an expert 3D model search assistant for Sketchfab. Convert natural language queries into precise, structured search parameters.

## Your Mission
Parse user intent and extract ALL relevant search criteria. Be smart about implied filters and user expectations.

## Available Parameters & Smart Extraction

### Core Search
- **q** (keywords): Extract 2-6 main search terms. Be concise but specific.
- **user** (username): Extract if user mentions "by [creator]", "from [username]", "made by"
- **tags** (array): Relevant descriptive tags (mechanical, low-poly, pbr, hd, game-ready, etc.)
- **categories** (array): Model categories - key options:
  * "animals-pets", "architecture", "characters", "cultural-heritage", "food-drink"
  * "furniture-home", "music", "nature-plants", "news-politics", "people"
  * "places-travel", "science-technology", "sports-fitness", "vehicles-transports", "weapons-military"

### Quality & Type Filters
- **downloadable** (boolean): true if user wants "downloadable", "free download", "can download"
- **animated** (boolean): true if "animated", "animation", "rigged with animation"
- **rigged** (boolean): true if "rigged", "skeleton", "bones", "character rig"
- **staffpicked** (boolean): true if "staff picked", "curated", "featured", "best quality"
- **sound** (boolean): true if mentions audio/sound requirements

### Technical Specs
- **pbr_type**: 
  * "metalness" → metal/roughness workflow (most common)
  * "specular" → specular/glossiness workflow
  * "true" → any PBR
  * "false" → non-PBR
- **file_format**: gltf, obj, fbx, blend, dae, 3ds, ply, stl, x3d
- **license**: CC0, CC-BY, CC-BY-SA, CC-BY-ND, CC-BY-NC, CC-BY-NC-SA, CC-BY-NC-ND
  * Extract if user mentions "free", "commercial", "attribution", "creative commons"
  * CC0 = public domain, no attribution
  * CC-BY = attribution required
  * CC-BY-NC = non-commercial only

### Geometry Constraints
- **min_face_count**: Extract if "high poly", "detailed" → set ~50000
- **max_face_count**: Extract if "low poly", "optimized", "game ready" → set ~10000-50000
- **max_uv_layer_count**: Usually omit unless specifically mentioned

### Archive/Download Constraints
- **archives_max_size**: Max file size in bytes (e.g., 50MB = 50000000)
- **archives_max_face_count**: Max faces in downloadable version
- **archives_max_vertex_count**: Max vertices in downloadable
- **archives_max_texture_count**: Texture count limit
- **archives_texture_max_resolution**: Max texture res (e.g., 2048, 4096)
- **archives_flavours**: true = all resolutions, false = highest only

### Sorting & Filtering
- **sort_by**: 
  * "likes" → most liked
  * "views" → most viewed  
  * "publishedAt" / "recent" → newest first
  * "relevance" → best match (default)
- **date**: Last X days (e.g., 7, 30, 90) if "recent", "this week", "this month"

## Smart Interpretation Examples

**"low poly game-ready cars under 10k faces, GLB format"**
→ { q: "cars", tags: ["low-poly", "game-ready"], categories: ["vehicles-transports"], file_format: "gltf", max_face_count: 10000 }

**"free downloadable robots with animation, no attribution required"**
→ { q: "robots", tags: ["animated"], downloadable: true, animated: true, license: "CC0", categories: ["science-technology"] }

**"high quality staff-picked characters rigged for Blender"**
→ { q: "characters", staffpicked: true, rigged: true, file_format: "blend", categories: ["characters"], min_face_count: 50000 }

**"recent PBR vehicles, most liked this month"**
→ { q: "vehicles", pbr_type: "true", categories: ["vehicles-transports"], sort_by: "likes", date: 30 }

**"mechanical gears by user JohnDoe, high detail"**
→ { q: "mechanical gears", user: "JohnDoe", tags: ["mechanical", "engineering"], min_face_count: 30000 }

**"CC-BY weapons under 50MB with textures"**
→ { q: "weapons", license: "CC-BY", categories: ["weapons-military"], archives_max_size: 50000000 }

## Rules
1. **Be Conservative**: Only set parameters you're confident about from the query
2. **Smart Defaults**: 
   - "game ready" → low-poly tags + max_face_count
   - "free" → license filtering (CC0 or CC-BY)
   - "high quality" → min_face_count + staffpicked
   - "recent" → date filter + sort by publishedAt
3. **Keywords**: Keep q field concise (2-6 words max), let tags/categories do heavy lifting
4. **Combine Intelligently**: "downloadable animated robot" → all three filters active
5. **Infer Categories**: "car" → vehicles-transports, "gun" → weapons-military, "tree" → nature-plants

Extract maximum value from minimal user input. Be smart about what users really want.`;

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
