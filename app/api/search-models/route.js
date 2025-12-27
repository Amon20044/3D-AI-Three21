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
 * - Cursor-based pagination (24 items per page max)
 * 
 * The AI processing is now handled by the Apify actor itself,
 * so we just pass useAI flag and naturalQuery to the actor.
 */

export async function POST(req) {
    try {
        const { query, mode, manualFilters, cursor, count = 24, useAI: useAIOverride } = await req.json();

        // Build input for Apify actor based on the new schema
        let actorInput = {
            count: Math.min(count, 24), // Cap at 24 per Sketchfab API limit
        };

        // Add cursor for pagination if provided
        if (cursor) {
            actorInput.cursor = cursor;
            console.log('📄 Pagination cursor:', cursor);
        }

        // Check if useAI was explicitly set to false (for pagination requests)
        const forceNoAI = useAIOverride === false;
        if (forceNoAI) {
            console.log('🔄 Pagination mode: AI disabled for direct Sketchfab API usage');
        }

        // Natural language mode - use AI on Apify side (unless explicitly disabled)
        if (mode === 'natural' && query) {
            if (forceNoAI) {
                // Pagination request: Skip AI, use the query directly
                console.log('🔄 Pagination: Using natural query directly without AI:', query);
                actorInput = {
                    ...actorInput,
                    useAI: false,
                    q: query // Use query as direct search term
                };
            } else {
                // Initial search: Use AI to process the query
                console.log('🤖 Natural language search (AI mode):', query);
                actorInput = {
                    ...actorInput,
                    useAI: true,
                    naturalQuery: query,
                    googleApiKey: process.env.GOOGLE_API_KEY // Pass Google API key for Gemini
                };
                console.log('📤 Sending to Apify with AI mode enabled');
            }
        }
        // Manual mode - use provided filters directly
        else if (mode === 'manual' && manualFilters) {
            console.log('🎛️ Manual search mode');
            
            // Build manual filter params matching the Apify actor schema
            actorInput = {
                ...actorInput,
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

        // The actor returns metadata as the first item with _metadata: true
        const metadata = items.find(item => item._metadata === true);
        const models = items.filter(item => item.uid && item.name); // Models have uid and name

        console.log(`📦 Processed: ${models.length} models, metadata: ${metadata ? 'found' : 'none'}`);

        // Extract pagination info from metadata
        const pagination = metadata?.pagination || {
            has_next: false,
            has_previous: false,
            next_cursor: null,
            previous_cursor: null
        };

        console.log('📄 Pagination info:', JSON.stringify(pagination, null, 2));

        return new Response(JSON.stringify({
            success: true,
            count: models.length,
            searchParams: metadata?.search_params || cleanedInput,
            aiEnabled: metadata?.ai_powered || cleanedInput.useAI,
            // AI-generated params (if AI mode was used)
            generatedQuery: metadata?.generated_q || null,
            generatedTags: metadata?.generated_tags || null,
            originalQuery: metadata?.original_query || null,
            // Pagination
            pagination: {
                hasNext: pagination.has_next,
                hasPrevious: pagination.has_previous,
                nextCursor: pagination.next_cursor,
                previousCursor: pagination.previous_cursor
            },
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
