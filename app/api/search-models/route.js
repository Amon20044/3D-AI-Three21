import { ApifyClient } from 'apify-client';

export const runtime = 'nodejs';
export const maxDuration = 60; // Extended for AI processing on Apify side

// Initialize Apify client
const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_KEY,
});

/**
 * Sketchfab Model Search API Route
 * 
 * This route interfaces with the updated Apify Sketchfab Actor that supports:
 * - AI-powered natural language search (LangGraph + Google Gemini)
 * - Manual filter-based search
 * 
 * The AI processing is now handled by the Apify actor itself,
 * so we just pass useAI flag and naturalQuery to the actor.
 */

export async function POST(req) {
    try {
        const { query, mode, manualFilters } = await req.json();

        // Build input for Apify actor based on the new schema
        let actorInput = {};

        // Natural language mode - use AI on Apify side
        if (mode === 'natural' && query) {
            console.log('🤖 Natural language search (AI mode):', query);
            
            actorInput = {
                useAI: true,
                naturalQuery: query,
                googleApiKey: process.env.GOOGLE_API_KEY // Pass Google API key for Gemini
            };

            console.log('📤 Sending to Apify with AI mode enabled');
        }
        // Manual mode - use provided filters directly
        else if (mode === 'manual' && manualFilters) {
            console.log('🎛️ Manual search mode');
            
            // Build manual filter params matching the Apify actor schema
            actorInput = {
                useAI: false,
                // Core search params
                q: manualFilters.q || '',
                user: manualFilters.user || '',
                tags: manualFilters.tags || [],
                categories: manualFilters.categories || [],
                
                // Quality & type filters
                downloadable: manualFilters.downloadable,
                animated: manualFilters.animated,
                rigged: manualFilters.rigged,
                staffpicked: manualFilters.staffpicked,
                sound: manualFilters.sound,
                
                // Technical specs
                pbr_type: manualFilters.pbr_type || '',
                file_format: manualFilters.file_format || '',
                license: manualFilters.license || '',
                
                // Geometry constraints
                min_face_count: manualFilters.min_face_count,
                max_face_count: manualFilters.max_face_count,
                max_uv_layer_count: manualFilters.max_uv_layer_count,
                
                // Archive/download constraints
                available_archive_type: manualFilters.available_archive_type || '',
                archives_max_size: manualFilters.archives_max_size,
                archives_max_face_count: manualFilters.archives_max_face_count,
                archives_max_vertex_count: manualFilters.archives_max_vertex_count,
                archives_max_texture_count: manualFilters.archives_max_texture_count,
                archives_texture_max_resolution: manualFilters.archives_texture_max_resolution,
                archives_flavours: manualFilters.archives_flavours || false,
                
                // Sorting & filtering
                collection: manualFilters.collection || '',
                sort_by: manualFilters.sort_by || '',
                date: manualFilters.date
            };

            console.log('📤 Manual search params:', JSON.stringify(actorInput, null, 2));
        } else {
            return new Response(JSON.stringify({
                error: 'Invalid search mode or missing parameters',
                hint: 'Use mode="natural" with query, or mode="manual" with manualFilters'
            }), { status: 400 });
        }

        // Clean up params - remove null, undefined, empty strings, and empty arrays
        const cleanedInput = Object.entries(actorInput).reduce((acc, [key, value]) => {
            if (
                value !== null && 
                value !== undefined && 
                value !== '' && 
                !(Array.isArray(value) && value.length === 0)
            ) {
                acc[key] = value;
            }
            return acc;
        }, {});

        console.log('🧹 Cleaned actor input:', JSON.stringify(cleanedInput, null, 2));

        // Execute Apify actor
        console.log('🚀 Running Apify Sketchfab search actor...');
        
        const run = await apifyClient.actor("N3hdEyWDox8xXpahn").call(cleanedInput, {
            timeout: 120 // 2 minute timeout for AI processing
        });

        // Fetch results from dataset
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

        console.log(`✅ Actor run completed. Found ${items.length} items in dataset`);

        // Log the raw output for debugging
        if (items.length > 0) {
            console.log('📊 Raw actor output (first item):', JSON.stringify(items[0], null, 2));
        }

        // The actor may return metadata as the first item, filter it out
        // Metadata typically has fields like 'searchParams', 'aiEnabled', 'resultCount'
        const metadata = items.find(item => item.searchParams || item.aiEnabled !== undefined);
        const models = items.filter(item => item.uid && item.name); // Models have uid and name

        console.log(`📦 Processed: ${models.length} models, metadata: ${metadata ? 'found' : 'none'}`);

        return new Response(JSON.stringify({
            success: true,
            count: models.length,
            searchParams: metadata?.searchParams || cleanedInput,
            aiEnabled: metadata?.aiEnabled || cleanedInput.useAI,
            models: models,
            attribution: {
                sketchfab: 'Models provided by Sketchfab',
                apify: 'Search powered by Apify (LangGraph + Gemini AI)',
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
            details: error.message,
            hint: 'Check Apify API key and Google API key are set correctly'
        }), { status: 500 });
    }
}
