import html2canvas from 'html2canvas';
import * as THREE from 'three';

/**
 * Advanced screenshot manager for 3D model capture
 * Focuses on model analysis, excludes UI elements
 */
export class ScreenshotManager {
    constructor(canvasRef, rendererRef) {
        this.canvasRef = canvasRef;
        this.rendererRef = rendererRef;
        this.lastScreenshot = null;
        this.autoScreenshotEnabled = true;
    }

    /**
     * Capture clean model screenshot without UI elements
     */
    async captureModelOnly(options = {}) {
        // Detect mobile device for adaptive sizing
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

        const {
            width = 1920,
            height = 1080,
            quality = 0.65, // WebP sweet spot for compression vs quality
            format = 'image/webp' // WebP provides ~30% better compression than JPEG
        } = options;

        try {
            // Get the Three.js canvas directly
            const canvas = this.canvasRef.current?.querySelector('canvas');
            if (!canvas) {
                throw new Error('3D Canvas not found');
            }

            console.log('📸 Capturing model screenshot...');

            // Use html2canvas on the specific canvas element
            // This captures the CSS background + WebGL content correctly
            const capturedCanvas = await html2canvas(canvas, {
                backgroundColor: null, // Preserve CSS background
                logging: false,
                scale: 1, // Optimize scale
                useCORS: true,
                allowTaint: true,
                ignoreElements: (element) => {
                    // Ignore any UI elements that might be inside the canvas container (unlikely but safe)
                    return element.classList.contains('ui-layer');
                }
            });

            // Resize if needed (optional, but good for token efficiency)
            let finalCanvas = capturedCanvas;
            if (capturedCanvas.width > width || capturedCanvas.height > height) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const ctx = tempCanvas.getContext('2d');

                // Draw scaled
                ctx.drawImage(capturedCanvas, 0, 0, width, height);
                finalCanvas = tempCanvas;
            }

            const dataURL = finalCanvas.toDataURL(format, quality);

            // Calculate size
            const sizeKB = (dataURL.length * 0.75) / 1024;
            console.log(`📊 Screenshot size: ${sizeKB.toFixed(2)} KB`);

            this.lastScreenshot = {
                dataURL,
                timestamp: Date.now(),
                metadata: { width, height, format, quality, sizeKB: sizeKB.toFixed(2) }
            };

            return dataURL;

        } catch (error) {
            console.error('Failed to capture model screenshot:', error);

            // Fallback to direct dataURL if html2canvas fails
            try {
                const canvas = this.canvasRef.current?.querySelector('canvas');
                if (canvas) {
                    console.log('⚠️ Falling back to direct canvas capture');
                    return canvas.toDataURL(format, quality);
                }
            } catch (e) {
                console.error('Fallback capture failed:', e);
            }
            return null;
        }
    }

    /**
     * Capture screenshot with specific camera angle and settings
     */
    async captureWithCameraSetup(camera, scene, renderer, options = {}) {
        const {
            width = 1920,
            height = 1080,
            backgroundColor = '#000000'
        } = options;

        try {
            // Create off-screen renderer for clean capture
            const offScreenRenderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                preserveDrawingBuffer: true
            });
            offScreenRenderer.setSize(width, height);
            offScreenRenderer.setClearColor(backgroundColor, 1);

            // Render the scene
            offScreenRenderer.render(scene, camera);

            // Get the canvas and convert to data URL (WebP for better compression)
            const dataURL = offScreenRenderer.domElement.toDataURL('image/webp', 0.75);

            // Clean up
            offScreenRenderer.dispose();

            this.lastScreenshot = {
                dataURL,
                timestamp: Date.now(),
                metadata: {
                    width,
                    height,
                    captureType: 'camera-setup',
                    cameraPosition: camera.position.toArray(),
                    cameraRotation: camera.rotation.toArray()
                }
            };

            return dataURL;
        } catch (error) {
            console.error('Failed to capture with camera setup:', error);
            return null;
        }
    }

    /**
     * Auto-capture screenshot when model loads (for AI reference)
     */
    async autoCapture(scene, camera, options = {}) {
        if (!this.autoScreenshotEnabled) return null;

        try {
            // Calculate optimal camera position for full model view
            const box = new THREE.Box3().setFromObject(scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            // Position camera to frame the entire model
            const maxDim = Math.max(size.x, size.y, size.z);
            const distance = maxDim * 2;

            // Save current camera state
            const originalPosition = camera.position.clone();
            const originalTarget = camera.target ? camera.target.clone() : center.clone();

            // Set optimal viewing angle
            camera.position.set(
                center.x + distance * 0.7,
                center.y + distance * 0.5,
                center.z + distance * 0.7
            );
            camera.lookAt(center);
            camera.updateMatrixWorld();

            // Capture screenshot with WebP compression
            const screenshot = await this.captureModelOnly({
                ...options,
                width: 1024,
                height: 768,
                format: 'image/webp',
                quality: 0.75
            });

            // Restore camera position
            camera.position.copy(originalPosition);
            if (camera.target) {
                camera.target.copy(originalTarget);
            }
            camera.updateMatrixWorld();

            return screenshot;
        } catch (error) {
            console.error('Auto-capture failed:', error);
            return null;
        }
    }

    /**
     * Capture multiple angles for comprehensive analysis
     */
    async captureMultipleAngles(scene, camera, options = {}) {
        const screenshots = [];

        try {
            const box = new THREE.Box3().setFromObject(scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const distance = maxDim * 2;

            // Save original camera state
            const originalPosition = camera.position.clone();
            const originalTarget = camera.target ? camera.target.clone() : center.clone();

            // Define viewing angles
            const angles = [
                { name: 'front', position: [0, 0, distance] },
                { name: 'back', position: [0, 0, -distance] },
                { name: 'left', position: [-distance, 0, 0] },
                { name: 'right', position: [distance, 0, 0] },
                { name: 'top', position: [0, distance, 0] },
                { name: 'bottom', position: [0, -distance, 0] },
                { name: 'isometric', position: [distance * 0.7, distance * 0.7, distance * 0.7] }
            ];

            for (const angle of angles) {
                camera.position.set(
                    center.x + angle.position[0],
                    center.y + angle.position[1],
                    center.z + angle.position[2]
                );
                camera.lookAt(center);
                camera.updateMatrixWorld();

                const screenshot = await this.captureModelOnly({
                    ...options,
                    width: 512,
                    height: 512,
                    format: 'image/webp',
                    quality: 0.75
                });

                if (screenshot) {
                    screenshots.push({
                        angle: angle.name,
                        dataURL: screenshot,
                        timestamp: Date.now()
                    });
                }
            }

            // Restore camera
            camera.position.copy(originalPosition);
            if (camera.target) {
                camera.target.copy(originalTarget);
            }
            camera.updateMatrixWorld();

            return screenshots;
        } catch (error) {
            console.error('Multi-angle capture failed:', error);
            return [];
        }
    }

    /**
     * Generate analysis metadata for AI processing
     */
    generateAnalysisMetadata(scene, modelInfo, selectedPart = null) {
        const metadata = {
            captureTime: new Date().toISOString(),
            modelInfo: {
                filename: modelInfo?.filename || 'Unknown',
                description: modelInfo?.description || '',
                type: modelInfo?.type || 'Unknown',
                fileSize: modelInfo?.fileSize || 0,
                category: modelInfo?.category || '',
                tags: modelInfo?.tags || [],
                manufacturer: modelInfo?.manufacturer || '',
                material: modelInfo?.material || '',
                purpose: modelInfo?.purpose || '',
                complexity: modelInfo?.complexity || 'medium'
            },
            sceneAnalysis: this.analyzeScene(scene),
            selectedPart: selectedPart ? {
                name: selectedPart.name || 'Unknown',
                type: selectedPart.type || 'Component',
                position: selectedPart.position || null,
                boundingBox: selectedPart.boundingBox || null,
                material: selectedPart.material || null
            } : null,
            captureSettings: {
                excludeUIElements: true,
                focusOnModel: true,
                highQuality: true,
                purpose: 'AI_analysis'
            }
        };

        return metadata;
    }

    /**
     * Analyze scene for AI context
     */
    analyzeScene(scene) {
        const analysis = {
            totalObjects: 0,
            meshCount: 0,
            materialCount: 0,
            lightCount: 0,
            complexityScore: 0,
            boundingBox: null,
            components: []
        };

        if (!scene) {
            return analysis;
        }

        const materials = new Set();
        const box = new THREE.Box3();

        scene.traverse((object) => {
            analysis.totalObjects++;

            if (object.isMesh) {
                analysis.meshCount++;

                // Collect materials
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(mat => materials.add(mat.uuid));
                    } else {
                        materials.add(object.material.uuid);
                    }
                }

                // Add to bounding box
                box.expandByObject(object);

                // Component analysis
                if (object.name && !object.name.includes('_highlight') && !object.name.includes('_wireframe')) {
                    analysis.components.push({
                        name: object.name,
                        type: object.type,
                        visible: object.visible,
                        vertexCount: object.geometry?.attributes?.position?.count || 0
                    });
                }
            }

            if (object.isLight) {
                analysis.lightCount++;
            }
        });

        analysis.materialCount = materials.size;
        analysis.boundingBox = {
            min: box.min.toArray(),
            max: box.max.toArray(),
            center: box.getCenter(new THREE.Vector3()).toArray(),
            size: box.getSize(new THREE.Vector3()).toArray()
        };

        // Calculate complexity score
        analysis.complexityScore = Math.min(10,
            (analysis.meshCount * 0.1) +
            (analysis.materialCount * 0.2) +
            (analysis.components.length * 0.3)
        );

        // Sort components by complexity (vertex count) and keep top 50 to prevent payload issues
        analysis.components.sort((a, b) => b.vertexCount - a.vertexCount);
        if (analysis.components.length > 50) {
            analysis.components = analysis.components.slice(0, 50);
        }

        return analysis;
    }

    /**
     * Get last captured screenshot
     */
    getLastScreenshot() {
        return this.lastScreenshot;
    }

    /**
     * Enable/disable auto-screenshot
     */
    setAutoScreenshot(enabled) {
        this.autoScreenshotEnabled = enabled;
    }
}

export default ScreenshotManager;
