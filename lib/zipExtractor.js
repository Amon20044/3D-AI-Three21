/**
 * ZIP Extractor Utility for Sketchfab Models
 * Downloads and extracts 3D model files from Sketchfab ZIP archives
 * Handles: Direct model links, nested ZIPs, various folder structures
 */

import JSZip from 'jszip';
import { set as idbSet } from 'idb-keyval';

// Supported model extensions in priority order (all lowercase for comparison)
const SUPPORTED_EXTENSIONS = ['.glb', '.fbx', '.obj', '.stl'];

// Extensions that are NOT self-contained (need external files)
const WARN_EXTENSIONS = ['.gltf'];

/**
 * Check if a filename has a supported 3D model extension
 * Handles case-insensitive matching
 */
function getSupportedExtension(filename) {
    const lowerName = filename.toLowerCase();
    for (const ext of SUPPORTED_EXTENSIONS) {
        if (lowerName.endsWith(ext)) {
            return ext;
        }
    }
    return null;
}

/**
 * Check if data is a ZIP file by looking at magic bytes
 */
function isZipFile(arrayBuffer) {
    const view = new Uint8Array(arrayBuffer);
    // ZIP files start with PK (0x50, 0x4B)
    return view.length >= 4 && view[0] === 0x50 && view[1] === 0x4B;
}

/**
 * Check if data is a GLB file by looking at magic bytes
 * GLB files start with "glTF" magic (0x46546C67 in little-endian = 0x67, 0x6C, 0x54, 0x46)
 */
function isGlbFile(arrayBuffer) {
    const view = new Uint8Array(arrayBuffer);
    // GLB magic: "glTF" in ASCII
    return view.length >= 4 && 
           view[0] === 0x67 && // 'g'
           view[1] === 0x6C && // 'l'
           view[2] === 0x54 && // 'T'
           view[3] === 0x46;   // 'F'
}

/**
 * Check if data is an FBX file by looking at magic bytes
 * FBX files start with "Kaydara FBX Binary"
 */
function isFbxFile(arrayBuffer) {
    const view = new Uint8Array(arrayBuffer);
    // FBX magic: "Kaydara FBX Binary" starts with "Kaydara"
    if (view.length < 20) return false;
    const magic = String.fromCharCode(...view.slice(0, 18));
    return magic.startsWith('Kaydara FBX Binary');
}

/**
 * Check if data is an OBJ file (text-based, starts with comments or vertex data)
 */
function isObjFile(arrayBuffer) {
    const view = new Uint8Array(arrayBuffer);
    if (view.length < 10) return false;
    const start = String.fromCharCode(...view.slice(0, Math.min(100, view.length)));
    // OBJ files typically start with # comment, v (vertex), vt, vn, f, etc.
    return /^(#|v\s|vt\s|vn\s|f\s|mtllib|usemtl|o\s|g\s)/m.test(start);
}

/**
 * Check if data is an STL file
 * ASCII STL starts with "solid", Binary STL has 80-byte header
 */
function isStlFile(arrayBuffer) {
    const view = new Uint8Array(arrayBuffer);
    if (view.length < 84) return false;
    const start = String.fromCharCode(...view.slice(0, 5));
    // ASCII STL starts with "solid"
    if (start.toLowerCase() === 'solid') return true;
    // Binary STL: 80 byte header + 4 byte triangle count
    // Check if file size matches expected: 80 + 4 + (triangles * 50)
    const triangleCount = new DataView(arrayBuffer).getUint32(80, true);
    const expectedSize = 80 + 4 + (triangleCount * 50);
    return Math.abs(view.length - expectedSize) < 10;
}

/**
 * Detect file type from content (magic bytes)
 * Returns: 'zip', 'glb', 'fbx', 'obj', 'stl', or null
 */
function detectFileType(arrayBuffer) {
    if (isZipFile(arrayBuffer)) return 'zip';
    if (isGlbFile(arrayBuffer)) return 'glb';
    if (isFbxFile(arrayBuffer)) return 'fbx';
    if (isObjFile(arrayBuffer)) return 'obj';
    if (isStlFile(arrayBuffer)) return 'stl';
    return null;
}

/**
 * Check if a URL or content-type indicates a direct model file
 * (Kept for reference but we now primarily use magic byte detection)
 */
function isDirectModelUrl(url, contentType = '') {
    const lowerUrl = url.toLowerCase();
    const lowerType = contentType.toLowerCase();
    
    // Check URL extension
    if (getSupportedExtension(lowerUrl)) {
        return true;
    }
    
    // Check content-type for binary/model types that aren't ZIP
    if (lowerType.includes('model/gltf-binary') || 
        lowerType.includes('application/octet-stream')) {
        // Could be a model, need to check magic bytes
        return false; // Will check content later
    }
    
    return false;
}

/**
 * Downloads a file from URL and returns as ArrayBuffer
 * Also returns content-type header for format detection
 */
async function downloadFile(url, onProgress) {
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const contentLength = response.headers.get('content-length');
    const total = parseInt(contentLength, 10);
    let loaded = 0;

    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;

        if (onProgress && total) {
            onProgress({
                phase: 'downloading',
                loaded,
                total,
                percent: Math.round((loaded / total) * 100)
            });
        }
    }

    // Combine chunks into single ArrayBuffer
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return { buffer: result.buffer, contentType };
}

/**
 * Recursively searches for model files in ZIP (including nested ZIPs)
 * Returns the first supported model file found
 */
async function findModelInZip(zip, preferredFormat = null, depth = 0) {
    const files = [];
    const nestedZips = [];
    const indent = '  '.repeat(depth);
    
    if (depth === 0) {
        console.log('🔍 Searching for 3D models in ZIP...');
        console.log('📦 ZIP contents:');
    }
    
    // Collect all files with supported extensions and nested ZIPs
    zip.forEach((relativePath, zipEntry) => {
        // Log all files for debugging (skip texture files to reduce noise)
        const isTexture = /\.(png|jpg|jpeg|tga|bmp|gif|webp)$/i.test(relativePath);
        const lowerPath = relativePath.toLowerCase();
        
        if (!isTexture) {
            console.log(`${indent}  ${zipEntry.dir ? '📁' : '📄'} ${relativePath}`);
        }
        
        if (zipEntry.dir) return;
        
        // Get the filename only (last part of path), handle both / and \ separators
        const fileName = relativePath.split(/[/\\]/).pop() || relativePath;
        
        // Check for nested ZIP files
        if (lowerPath.endsWith('.zip')) {
            console.log(`${indent}  📦 Found nested ZIP: ${relativePath}`);
            nestedZips.push({
                path: relativePath,
                entry: zipEntry
            });
            return;
        }
        
        // Check if filename ends with any supported extension (case-insensitive)
        const ext = getSupportedExtension(fileName);
        
        if (ext) {
            console.log(`${indent}  ✅ Found model: ${relativePath} (${ext})`);
            
            // Calculate priority score (lower is better)
            // - Root level or 'source' folder preferred
            // - FBX in source folder often is the original/best quality
            const pathLower = relativePath.toLowerCase();
            const pathDepth = relativePath.split(/[/\\]/).length;
            let priority = pathDepth + (depth * 10); // Nested ZIPs have lower priority
            
            if (pathLower.includes('/source/') || pathLower.includes('\\source\\')) {
                priority = 1 + (depth * 10); // Source folder - high priority
            } else if (pathDepth <= 2) {
                priority = 0 + (depth * 10); // Root or first subfolder - highest priority
            }
            
            files.push({
                path: relativePath,
                extension: ext,
                entry: zipEntry,
                priority: priority,
                fileName: fileName,
                fromNestedZip: depth > 0
            });
        }
    });
    
    console.log(`${indent}📊 Found ${files.length} model files, ${nestedZips.length} nested ZIPs`);

    // If no models found in current ZIP, search nested ZIPs (max depth 2)
    if (files.length === 0 && nestedZips.length > 0 && depth < 2) {
        console.log(`${indent}🔄 Searching nested ZIPs...`);
        
        for (const nestedZip of nestedZips) {
            try {
                console.log(`${indent}  📦 Extracting nested ZIP: ${nestedZip.path}`);
                const nestedZipData = await nestedZip.entry.async('arraybuffer');
                const nestedZipObj = await JSZip.loadAsync(nestedZipData);
                
                // Recursively search the nested ZIP
                const nestedResult = await findModelInZip(nestedZipObj, preferredFormat, depth + 1);
                if (nestedResult) {
                    // Mark as from nested ZIP for reference
                    nestedResult.nestedZipPath = nestedZip.path;
                    return nestedResult;
                }
            } catch (nestedError) {
                console.warn(`${indent}  ⚠️ Failed to extract nested ZIP ${nestedZip.path}:`, nestedError.message);
            }
        }
    }

    if (files.length === 0) {
        // Collect all files for debugging
        const allFiles = [];
        zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
                allFiles.push(relativePath);
            }
        });
        
        console.log(`${indent}❌ No supported models found. All files in ZIP:`, allFiles);
        
        // Check for GLTF files (warn user)
        let hasGltf = false;
        let gltfPath = '';
        zip.forEach((relativePath) => {
            if (relativePath.toLowerCase().endsWith('.gltf')) {
                hasGltf = true;
                gltfPath = relativePath;
            }
        });
        
        if (hasGltf) {
            console.log(`${indent}⚠️ Found GLTF file: ${gltfPath} (not self-contained)`);
            throw new Error(
                'This ZIP contains GLTF files which reference external textures. ' +
                'Please download the GLB format instead for a self-contained file.'
            );
        }
        
        // Only throw error at top level
        if (depth === 0) {
            // Provide helpful error with file list
            const fileList = allFiles.slice(0, 10).join(', ');
            const moreFiles = allFiles.length > 10 ? ` ... and ${allFiles.length - 10} more` : '';
            throw new Error(
                `No supported 3D model files found in ZIP (GLB, FBX, OBJ, STL). ` +
                `Files in ZIP: ${fileList}${moreFiles}`
            );
        }
        
        return null; // Return null for nested ZIP - let parent continue searching
    }

    console.log(`${indent}🎯 Selected model: ${files[0].path}`);
    
    // Sort by preferred format, then by priority
    files.sort((a, b) => {
        // Preferred format first
        if (preferredFormat) {
            const aMatch = a.extension === preferredFormat;
            const bMatch = b.extension === preferredFormat;
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
        }
        
        // Then by extension priority (GLB > FBX > OBJ > STL)
        const aIdx = SUPPORTED_EXTENSIONS.indexOf(a.extension);
        const bIdx = SUPPORTED_EXTENSIONS.indexOf(b.extension);
        if (aIdx !== bIdx) return aIdx - bIdx;
        
        // Then by folder priority
        return a.priority - b.priority;
    });

    return files[0];
}

/**
 * Get file type from extension
 */
function getFileType(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
        case 'fbx': return 'fbx';
        case 'obj': return 'obj';
        case 'stl': return 'stl';
        case 'glb':
        case 'gltf':
        default: return 'gltf';
    }
}

/**
 * Main function to download, extract, and prepare model for import
 * Handles: ZIP files, nested ZIPs, and direct model file downloads
 * 
 * @param {string} downloadUrl - URL to download the file
 * @param {Object} modelInfo - Model metadata from Sketchfab
 * @param {string} preferredFormat - Preferred format extension (e.g., '.glb')
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Object with file, type, and metadata ready for import
 */
export async function extractModelFromZip(downloadUrl, modelInfo = {}, preferredFormat = null, onProgress = () => {}) {
    try {
        // Phase 1: Download file
        onProgress({ phase: 'downloading', percent: 0, message: 'Starting download...' });
        
        const { buffer, contentType } = await downloadFile(downloadUrl, (progress) => {
            onProgress({
                ...progress,
                message: `Downloading... ${progress.percent}%`
            });
        });

        // Phase 2: Detect file type from content (magic bytes)
        const detectedType = detectFileType(buffer);
        
        console.log(`📥 Downloaded file: ${buffer.byteLength} bytes, detected type: ${detectedType}, contentType: ${contentType}`);
        
        // Handle direct model file (GLB, FBX, OBJ, STL - not a ZIP)
        if (detectedType && detectedType !== 'zip') {
            console.log(`📄 Direct model file detected: ${detectedType}`);
            onProgress({ phase: 'processing', percent: 80, message: `Processing ${detectedType.toUpperCase()} file...` });
            
            // Map detected type to file type
            const fileType = detectedType === 'glb' ? 'gltf' : detectedType;
            const extension = detectedType === 'glb' ? '.glb' : `.${detectedType}`;
            
            // Generate filename from URL or model info
            let fileName = modelInfo?.name 
                ? `${modelInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}${extension}`
                : `model${extension}`;
            
            // Try to get filename from URL if possible
            const urlPath = downloadUrl.split('?')[0];
            const urlFileName = urlPath.split('/').pop();
            if (urlFileName && getSupportedExtension(urlFileName)) {
                fileName = urlFileName;
            }
            
            const file = new File([buffer], fileName, { 
                type: fileType === 'gltf' ? 'model/gltf-binary' : 'application/octet-stream'
            });
            
            // Save to IndexedDB for import
            onProgress({ phase: 'saving', percent: 90, message: 'Preparing for import...' });
            
            await idbSet('lastModelFile', file);
            await idbSet('lastModelType', fileType);
            await idbSet('lastModelInfo', {
                ...modelInfo,
                filename: fileName,
                type: fileType,
                fileSize: buffer.byteLength,
                importedAt: new Date().toISOString(),
                source: 'sketchfab-direct'
            });

            onProgress({ phase: 'complete', percent: 100, message: 'Model ready!' });

            return {
                file,
                type: fileType,
                fileName,
                modelInfo: {
                    ...modelInfo,
                    filename: fileName,
                    type: fileType,
                    fileSize: buffer.byteLength
                }
            };
        }
        
        // Handle ZIP file
        if (detectedType !== 'zip') {
            // Log first 20 bytes for debugging
            const view = new Uint8Array(buffer);
            const hexBytes = Array.from(view.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.error(`❌ Unknown file format. First 20 bytes: ${hexBytes}`);
            throw new Error('Downloaded file is not a valid ZIP archive or supported model file (GLB, FBX, OBJ, STL)');
        }

        // Phase 2b: Extract ZIP
        onProgress({ phase: 'extracting', percent: 0, message: 'Extracting ZIP...' });
        
        const zip = await JSZip.loadAsync(buffer);
        
        // Phase 3: Find model file (async now to handle nested ZIPs)
        onProgress({ phase: 'searching', percent: 50, message: 'Searching for 3D model...' });
        
        const modelFile = await findModelInZip(zip, preferredFormat);
        
        if (!modelFile) {
            throw new Error('No supported 3D model found in ZIP');
        }

        // Phase 4: Extract model file
        onProgress({ 
            phase: 'extracting', 
            percent: 75, 
            message: `Found ${modelFile.path}, extracting...` 
        });
        
        const modelBlob = await modelFile.entry.async('blob');
        const fileType = getFileType(modelFile.path);
        
        // Create a proper File object with the correct name
        const fileName = modelFile.path.split('/').pop();
        const file = new File([modelBlob], fileName, { 
            type: fileType === 'gltf' ? 'model/gltf-binary' : 
                  fileType === 'fbx' ? 'application/octet-stream' :
                  'application/octet-stream'
        });

        // Phase 5: Save to IndexedDB for import
        onProgress({ phase: 'saving', percent: 90, message: 'Preparing for import...' });
        
        await idbSet('lastModelFile', file);
        await idbSet('lastModelType', fileType);
        
        // Save model metadata if available
        if (modelInfo) {
            await idbSet('lastModelInfo', {
                name: modelInfo.name || fileName,
                description: modelInfo.description || '',
                author: modelInfo.user?.displayName || 'Unknown',
                source: 'Sketchfab',
                sourceUrl: modelInfo.viewerUrl || '',
                license: modelInfo.license?.label || 'Unknown',
                tags: modelInfo.tags?.map(t => t.name) || [],
                filename: fileName,
                type: fileType,
                fileSize: file.size,
                importedAt: new Date().toISOString()
            });
        }

        onProgress({ phase: 'complete', percent: 100, message: 'Ready to import!' });

        return {
            file,
            type: fileType,
            fileName,
            modelInfo: {
                name: modelInfo.name || fileName,
                description: modelInfo.description || '',
                source: 'Sketchfab',
                author: modelInfo.user?.displayName || 'Unknown'
            }
        };

    } catch (error) {
        onProgress({ phase: 'error', percent: 0, message: error.message });
        throw error;
    }
}

/**
 * Get available formats from download links
 */
export function getAvailableFormats(downloadLinks) {
    const formats = [];
    
    if (downloadLinks?.glb) {
        formats.push({ key: 'glb', label: 'GLB', ext: '.glb', size: downloadLinks.glb.size, url: downloadLinks.glb.url, recommended: true });
    }
    if (downloadLinks?.gltf) {
        formats.push({ key: 'gltf', label: 'GLTF', ext: '.gltf', size: downloadLinks.gltf.size, url: downloadLinks.gltf.url, warning: 'May not work (external files)' });
    }
    if (downloadLinks?.source) {
        formats.push({ key: 'source', label: 'Source', ext: null, size: downloadLinks.source.size, url: downloadLinks.source.url });
    }
    if (downloadLinks?.usdz) {
        formats.push({ key: 'usdz', label: 'USDZ', ext: '.usdz', size: downloadLinks.usdz.size, url: downloadLinks.usdz.url, warning: 'iOS only' });
    }
    
    return formats;
}
