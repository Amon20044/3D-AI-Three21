export const runtime = 'nodejs';

/**
 * Sketchfab Model Download API Route
 * 
 * Fetches download links for a Sketchfab model using its UID.
 * Only works for downloadable models.
 * 
 * Response contains:
 * - source: Original source files
 * - gltf: glTF format
 * - usdz: USDZ format (Apple AR)
 * - glb: GLB format (binary glTF)
 * 
 * Each format includes: url, size, expires
 */

const SKETCHFAB_API_TOKEN = process.env.SKETCHFAB_API_TOKEN;
const SKETCHFAB_API_BASE = 'https://api.sketchfab.com/v3';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const uid = searchParams.get('uid');

        if (!uid) {
            return new Response(JSON.stringify({
                error: 'Model UID is required',
                hint: 'Provide uid as query parameter: /api/download-model?uid=MODEL_UID'
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!SKETCHFAB_API_TOKEN) {
            console.error('❌ SKETCHFAB_API_TOKEN not configured');
            return new Response(JSON.stringify({
                error: 'Server configuration error',
                hint: 'Sketchfab API token not configured'
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`📥 Fetching download links for model: ${uid}`);

        const response = await fetch(`${SKETCHFAB_API_BASE}/models/${uid}/download`, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${SKETCHFAB_API_TOKEN}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Sketchfab API error (${response.status}):`, errorText);
            
            // Handle specific error cases
            if (response.status === 404) {
                return new Response(JSON.stringify({
                    error: 'Model not found or not downloadable',
                    hint: 'The model may not exist or may not be available for download'
                }), { 
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            if (response.status === 401 || response.status === 403) {
                return new Response(JSON.stringify({
                    error: 'Download not authorized',
                    hint: 'You may not have permission to download this model. Check if the model is free to download or if you have the required license.'
                }), { 
                    status: response.status,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({
                error: 'Failed to fetch download links',
                details: errorText
            }), { 
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const downloadData = await response.json();

        console.log(`✅ Download links retrieved for model: ${uid}`);
        console.log('📦 Available formats:', Object.keys(downloadData));

        // Structure the response with available formats
        const formats = {};
        
        if (downloadData.source) {
            formats.source = {
                url: downloadData.source.url,
                size: downloadData.source.size,
                expires: downloadData.source.expires
            };
        }
        
        if (downloadData.gltf) {
            formats.gltf = {
                url: downloadData.gltf.url,
                size: downloadData.gltf.size,
                expires: downloadData.gltf.expires
            };
        }
        
        if (downloadData.usdz) {
            formats.usdz = {
                url: downloadData.usdz.url,
                size: downloadData.usdz.size,
                expires: downloadData.usdz.expires
            };
        }
        
        if (downloadData.glb) {
            formats.glb = {
                url: downloadData.glb.url,
                size: downloadData.glb.size,
                expires: downloadData.glb.expires
            };
        }

        return new Response(JSON.stringify({
            success: true,
            uid: uid,
            formats: formats,
            formatCount: Object.keys(formats).length,
            attribution: {
                message: 'Please respect the model license and credit the original creator.'
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('❌ Download API error:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            details: error.message
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
