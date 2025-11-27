import { Suspense, useRef, useCallback, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { InteractiveModelPrimitive } from './InteractiveModelPrimitive';
import { DisassemblyUI } from './DisassemblyUI';
import { useLayerManager } from './LayerManager';
import { AnimationController } from './AnimationController';
import Three21Bot from './Three21Bot';
import { useModelInfo } from './ModelInfoContext';
import { Toast } from './Toast';
import { HighlightManager } from './HighlightManager';
import { ScreenshotManager } from './ScreenshotManager';
import { DEMO_CONFIG } from '@/pages/model';
import html2canvas from 'html2canvas';
import * as THREE from 'three';
// WebGPU detection and fallback
const isWebGPUAvailable = async () => {
    if (!navigator.gpu) {
        console.warn('WebGPU not available, falling back to WebGL');
        return false;
    }

    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            console.warn('WebGPU adapter not found, falling back to WebGL');
            return false;
        }
        console.log('✅ WebGPU is available');
        return true;
    } catch (error) {
        Toast('WebGPU initialization failed initialize it from edge://flags, chrome://flags, or about:config depending on your browser.');
        console.warn('WebGPU initialization failed:', error);
        return false;
    }
};

export default forwardRef(function AnyModelViewer({ url, type, isDemoMode = false, demoConfig = null, onModelLoad }, ref) {
    const modelRef = useRef();
    const canvasRef = useRef();
    const highlightManagerRef = useRef(null);
    const screenshotManagerRef = useRef(null);
    const orbitControlsRef = useRef();

    // WebGPU state
    const [useWebGPU, setUseWebGPU] = useState(false);
    const [rendererReady, setRendererReady] = useState(false);
    const [webGPUAvailable, setWebGPUAvailable] = useState(false);
    const [fps, setFps] = useState(60);
    const fpsRef = useRef({ lastTime: performance.now(), frames: 0 });

    // Separation distance state for disassembly
    const [separationDistance, setSeparationDistance] = useState(80);

    // Highlight settings state
    const [highlightColor, setHighlightColor] = useState('#0095ffff');
    const [highlightOpacity, setHighlightOpacity] = useState(0.8);

    // Auto-screenshot state
    const [autoScreenshotTaken, setAutoScreenshotTaken] = useState(false);

    // Model scale state - user controllable
    const [modelScale, setModelScale] = useState({
        originalSize: null,
        currentScale: 0.8,
        boundingBox: null,
        userScale: 0.8
    });

    // Scene tree analysis state
    const [sceneAnalysis, setSceneAnalysis] = useState({
        nodeCount: 0,
        childrenCount: 0,
        sceneTree: null
    });

    const { initializeLayers, currentLayer, isAnimating, totalLayers, updateAnimation } = useLayerManager(modelRef, separationDistance);

    // Toast state for object clicking
    const [toast, setToast] = useState({ message: '', isVisible: false });

    // Use optional chaining to prevent context errors
    const modelInfoContext = useModelInfo();
    const {
        modelInfo,
        isAIOpen,
        selectedPart,
        closeAI,
        setIsAIOpen,
        loadModelInfo,
        selectPart,
        extractModelStructure,
        demoConfig: contextDemoConfig
    } = modelInfoContext || {};

    // Use demo config from props or context
    const activeDemoConfig = demoConfig || contextDemoConfig;

    // Check WebGPU availability and load preference on mount
    useEffect(() => {
        const checkWebGPU = async () => {
            const available = await isWebGPUAvailable();
            setWebGPUAvailable(available);

            // Load user preference from localStorage
            const savedRenderer = localStorage.getItem('renderer_type');

            if (savedRenderer === 'webgpu' && available) {
                setUseWebGPU(true);
            } else if (savedRenderer === 'webgl' || !available) {
                setUseWebGPU(false);
            } else {
                // Default to WebGPU if available
                setUseWebGPU(available);
                localStorage.setItem('renderer_type', available ? 'webgpu' : 'webgl');
            }

            setRendererReady(true);

            if (available && (savedRenderer === 'webgpu' || !savedRenderer)) {
                setToast({
                    message: '🚀 WebGPU Renderer Active',
                    isVisible: true
                });
                setTimeout(() => setToast({ message: '', isVisible: false }), 3000);
            }
        };

        checkWebGPU();
    }, []);

    // FPS Counter
    useEffect(() => {
        let animationId;

        const updateFPS = () => {
            const now = performance.now();
            fpsRef.current.frames++;

            if (now >= fpsRef.current.lastTime + 1000) {
                setFps(Math.round((fpsRef.current.frames * 1000) / (now - fpsRef.current.lastTime)));
                fpsRef.current.frames = 0;
                fpsRef.current.lastTime = now;
            }

            animationId = requestAnimationFrame(updateFPS);
        };

        animationId = requestAnimationFrame(updateFPS);

        return () => {
            if (animationId) cancelAnimationFrame(animationId);
        };
    }, []);

    // Handle renderer switch
    const handleRendererSwitch = useCallback(() => {
        const newRenderer = !useWebGPU;
        setUseWebGPU(newRenderer);
        localStorage.setItem('renderer_type', newRenderer ? 'webgpu' : 'webgl');

        setToast({
            message: `Switched to ${newRenderer ? 'WebGPU' : 'WebGL'}`,
            isVisible: true
        });
        setTimeout(() => setToast({ message: '', isVisible: false }), 2000);

        // Reload page to apply renderer change
        setTimeout(() => window.location.reload(), 500);
    }, [useWebGPU]);

    // Expose functions to parent via ref
    useImperativeHandle(ref, () => ({
        expandModel: () => {
            console.log('🎯 AnyModelViewer: Expanding model');
            if (currentLayer < totalLayers - 1) {
                updateAnimation(currentLayer + 1);
                setToast({ message: 'Model expanded', isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        },
        assembleModel: () => {
            console.log('🎯 AnyModelViewer: Assembling model');
            if (currentLayer > 0) {
                updateAnimation(0);
                setToast({ message: 'Model assembled', isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        },
        rotateModel: () => {
            console.log('🎯 AnyModelViewer: Rotating model');
            if (orbitControlsRef.current) {
                orbitControlsRef.current.setAzimuthalAngle(orbitControlsRef.current.getAzimuthalAngle() + Math.PI / 4);
                orbitControlsRef.current.update();
                setToast({ message: 'Model rotated', isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        },
        zoomIn: () => {
            console.log('🎯 AnyModelViewer: Zooming in');
            if (orbitControlsRef.current) {
                orbitControlsRef.current.dollyIn(0.8);
                orbitControlsRef.current.update();
                setToast({ message: 'Zoomed in', isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        },
        zoomOut: () => {
            console.log('🎯 AnyModelViewer: Zooming out');
            if (orbitControlsRef.current) {
                orbitControlsRef.current.dollyOut(1.25);
                orbitControlsRef.current.update();
                setToast({ message: 'Zoomed out', isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        },
        resetView: () => {
            console.log('🎯 AnyModelViewer: Resetting view');
            if (orbitControlsRef.current) {
                orbitControlsRef.current.reset();
                setToast({ message: 'View reset', isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        },
        takeScreenshot: () => {
            console.log('🎯 AnyModelViewer: Taking screenshot');
            takeScreenshot();
        },
        getRendererType: () => useWebGPU ? 'WebGPU' : 'WebGL'
    }), [currentLayer, totalLayers, updateAnimation, useWebGPU]);

    // AI Voice Command Event Listeners (keeping all original event handlers)
    useEffect(() => {
        const handleModelExpand = (event) => {
            console.log('📢 AnyModelViewer: Received expand event');
            if (currentLayer < totalLayers - 1) {
                updateAnimation(currentLayer + 1);
                setToast({ message: 'Model expanded via voice', isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        };

        const handleModelAssemble = (event) => {
            console.log('📢 AnyModelViewer: Received assemble event');
            if (currentLayer > 0) {
                updateAnimation(0);
                setToast({ message: 'Model assembled via voice', isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        };

        const handleRotateModel = (event) => {
            console.log('📢 AnyModelViewer: Received rotate event');
            if (orbitControlsRef.current) {
                const direction = event.detail?.direction || 'right';
                const angle = direction === 'left' ? -Math.PI / 4 : Math.PI / 4;
                orbitControlsRef.current.setAzimuthalAngle(orbitControlsRef.current.getAzimuthalAngle() + angle);
                orbitControlsRef.current.update();
                setToast({ message: `Model rotated ${direction}`, isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        };

        const handleZoomIn = (event) => {
            console.log('📢 AnyModelViewer: Received zoom in event');
            if (orbitControlsRef.current) {
                orbitControlsRef.current.dollyIn(0.8);
                orbitControlsRef.current.update();
                setToast({ message: 'Zoomed in via voice', isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        };

        const handleZoomOut = (event) => {
            console.log('📢 AnyModelViewer: Received zoom out event');
            if (orbitControlsRef.current) {
                orbitControlsRef.current.dollyOut(1.25);
                orbitControlsRef.current.update();
                setToast({ message: 'Zoomed out via voice', isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        };

        const handleResetView = (event) => {
            console.log('📢 AnyModelViewer: Received reset view event');
            if (orbitControlsRef.current) {
                orbitControlsRef.current.reset();
                setToast({ message: 'View reset via voice', isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        };

        const handleTakeScreenshot = (event) => {
            console.log('📢 AnyModelViewer: Received screenshot event');
            takeScreenshot();
            setToast({ message: 'Screenshot taken via voice', isVisible: true });
            setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
        };

        const handleToggleChat = (event) => {
            console.log('📢 AnyModelViewer: Received toggle chat event');
            if (setIsAIOpen) {
                setIsAIOpen(!isAIOpen);
                setToast({ message: isAIOpen ? 'Chat closed' : 'Chat opened', isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        };

        const handleOpenChat = (event) => {
            console.log('📢 AnyModelViewer: Received open chat event');
            if (setIsAIOpen) {
                setIsAIOpen(true);
                setToast({ message: 'Chat opened via voice', isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        };

        const handleCloseChat = (event) => {
            console.log('📢 AnyModelViewer: Received close chat event');
            if (setIsAIOpen) {
                setIsAIOpen(false);
                setToast({ message: 'Chat closed via voice', isVisible: true });
                setTimeout(() => setToast({ message: '', isVisible: false }), 2000);
            }
        };

        // Listen for AI voice command events
        window.addEventListener('modelExpand', handleModelExpand);
        window.addEventListener('modelAssemble', handleModelAssemble);
        window.addEventListener('rotateModel', handleRotateModel);
        window.addEventListener('zoomIn', handleZoomIn);
        window.addEventListener('zoomOut', handleZoomOut);
        window.addEventListener('resetView', handleResetView);
        window.addEventListener('takeScreenshot', handleTakeScreenshot);
        window.addEventListener('toggleChat', handleToggleChat);
        window.addEventListener('openChat', handleOpenChat);
        window.addEventListener('closeChat', handleCloseChat);

        return () => {
            window.removeEventListener('modelExpand', handleModelExpand);
            window.removeEventListener('modelAssemble', handleModelAssemble);
            window.removeEventListener('rotateModel', handleRotateModel);
            window.removeEventListener('zoomIn', handleZoomIn);
            window.removeEventListener('zoomOut', handleZoomOut);
            window.removeEventListener('resetView', handleResetView);
            window.removeEventListener('takeScreenshot', handleTakeScreenshot);
            window.removeEventListener('toggleChat', handleToggleChat);
            window.removeEventListener('openChat', handleOpenChat);
            window.removeEventListener('closeChat', handleCloseChat);
        };
    }, [currentLayer, totalLayers, updateAnimation, isAIOpen, setIsAIOpen]);

    // Load model info when component mounts
    useEffect(() => {
        if (loadModelInfo && !isDemoMode) {
            loadModelInfo();
        }

        if (!highlightManagerRef.current) {
            highlightManagerRef.current = new HighlightManager();
        }

        if (!screenshotManagerRef.current) {
            screenshotManagerRef.current = new ScreenshotManager(canvasRef);
        }
    }, [loadModelInfo, isDemoMode]);

    // Update highlight settings
    useEffect(() => {
        if (highlightManagerRef.current) {
            highlightManagerRef.current.setHighlightProperties(
                highlightColor,
                highlightOpacity,
                1.0,
                true,
                2.0
            );
        }
    }, [highlightColor, highlightOpacity]);

    const handleModelLoad = useCallback((scene, scaleInfo) => {
        console.log('Model loaded, scene:', scene);
        console.log('Scale info:', scaleInfo);
        console.log('Renderer type:', useWebGPU ? 'WebGPU' : 'WebGL');

        if (scaleInfo) {
            setModelScale(prev => ({
                originalSize: scaleInfo.originalSize,
                currentScale: 1,
                boundingBox: scaleInfo.boundingBox,
                userScale: prev.userScale
            }));
        }
        if (modelRef.current) {
            setTimeout(() => {
                initializeLayers(modelRef.current);

                const analysis = analyzeScene(scene);
                setSceneAnalysis(analysis);
                console.log('Scene analysis:', analysis);

                if (extractModelStructure) {
                    const structure = extractModelStructure(scene);
                    console.log('Model structure extracted:', structure);

                    if (isDemoMode) {
                        console.log('Demo mode: Model structure ready for AI');
                    }
                }

                if (!autoScreenshotTaken && screenshotManagerRef.current) {
                    setTimeout(async () => {
                        try {
                            // Auto-screenshot with mobile-friendly defaults
                            const screenshot = await screenshotManagerRef.current.captureModelOnly();

                            if (screenshot) {
                                const sizeKB = (screenshot.length * 0.75) / 1024;
                                console.log('✅ Auto-screenshot captured for AI analysis:', {
                                    sizeKB: sizeKB.toFixed(2),
                                    renderer: useWebGPU ? 'WebGPU' : 'WebGL'
                                });
                                setAutoScreenshotTaken(true);
                            }
                        } catch (error) {
                            console.error('❌ Auto-screenshot failed:', error);
                        }
                    }, 2000);
                }
            }, 100);
        }

        if (onModelLoad) {
            onModelLoad(scene, scaleInfo);
        }
    }, [initializeLayers, isDemoMode, extractModelStructure, autoScreenshotTaken, modelInfo, setIsAIOpen, onModelLoad, useWebGPU]);

    const handleObjectClick = useCallback((objectName, clickedObject) => {
        console.log('Object clicked:', objectName, clickedObject);

        if (highlightManagerRef.current) {
            highlightManagerRef.current.clearAllHighlights();
        }

        if (clickedObject && highlightManagerRef.current) {
            const highlighted = highlightManagerRef.current.highlightObject(clickedObject);
            if (highlighted) {
                console.log('Object highlighted:', objectName);
            }
        }

        if (selectPart) {
            try {
                const partInfo = selectPart(objectName, clickedObject);
                console.log('Part selected:', partInfo);

                setToast({
                    message: `Selected: ${objectName}${isDemoMode && activeDemoConfig ? ' - AI chat opened!' : ''}`,
                    isVisible: true
                });

                setTimeout(() => {
                    setToast({ message: '', isVisible: false });
                }, 3000);

                return;
            } catch (error) {
                console.error('Error selecting part:', error);
            }
        }

        setToast({
            message: `Double-clicked: ${objectName}`,
            isVisible: true
        });

        setTimeout(() => {
            setToast({ message: '', isVisible: false });
        }, 2000);
    }, [isDemoMode, selectPart, activeDemoConfig]);

    // Animation loop for highlight updates
    useEffect(() => {
        let animationId;

        const animate = () => {
            if (highlightManagerRef.current) {
                highlightManagerRef.current.updateHighlights();
            }
            animationId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    }, []);

    const hideToast = useCallback(() => {
        setToast(prev => ({ ...prev, isVisible: false }));
    }, []);

    const analyzeScene = useCallback((scene) => {
        if (!scene) return { nodeCount: 0, childrenCount: 0, sceneTree: null };

        let nodeCount = 0;
        let childrenCount = 0;

        const buildTree = (object) => {
            nodeCount++;
            const children = object.children || [];
            childrenCount += children.length;

            let vertexCount = 0;
            let triangleCount = 0;

            if (object.type === 'Mesh' && object.geometry) {
                if (object.geometry.attributes && object.geometry.attributes.position) {
                    vertexCount = object.geometry.attributes.position.count;
                }
                if (object.geometry.index) {
                    triangleCount = object.geometry.index.count / 3;
                } else if (vertexCount > 0) {
                    triangleCount = vertexCount / 3;
                }
            }

            return {
                uuid: object.uuid,
                name: object.name || 'Unnamed',
                type: object.type,
                meshCount: object.type === 'Mesh' ? 1 : 0,
                childrenCount: children.length,
                vertexCount: vertexCount > 0 ? vertexCount : undefined,
                triangleCount: triangleCount > 0 ? Math.floor(triangleCount) : undefined,
                children: children.map(child => buildTree(child))
            };
        };

        const sceneTree = buildTree(scene);
        return { nodeCount, childrenCount, sceneTree };
    }, []);

    const handleScreenshot = useCallback(async () => {
        try {
            if (!screenshotManagerRef.current) {
                screenshotManagerRef.current = new ScreenshotManager(canvasRef);
            }

            // captureModelOnly now auto-detects mobile and adjusts settings
            const screenshot = await screenshotManagerRef.current.captureModelOnly();

            if (!screenshot) {
                throw new Error('Screenshot capture failed');
            }

            // Log final screenshot size
            const sizeKB = (screenshot.length * 0.75) / 1024;
            console.log('✅ Screenshot ready:', {
                sizeKB: sizeKB.toFixed(2),
                renderer: useWebGPU ? 'WebGPU' : 'WebGL',
                isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            });

            return screenshot;
        } catch (error) {
            console.error('Screenshot failed:', error);

            const canvas = canvasRef.current?.querySelector('canvas');
            if (!canvas) {
                throw new Error('Canvas not found');
            }

            // Fallback to html2canvas with mobile-friendly settings
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const screenshot = await html2canvas(canvasRef.current, {
                backgroundColor: null,
                allowTaint: true,
                useCORS: true,
                scale: isMobile ? 0.5 : 1,  // Reduce scale on mobile
                quality: isMobile ? 0.6 : 0.9
            });

            return screenshot.toDataURL('image/png');
        }
    }, []);

    const handleScaleChange = useCallback((newScale) => {
        setModelScale(prev => ({
            ...prev,
            userScale: newScale
        }));

        if (modelRef.current) {
            modelRef.current.scale.set(newScale, newScale, newScale);
        }
    }, []);

    const handleOpenAI = useCallback(() => {
        if (setIsAIOpen) {
            setIsAIOpen(true);
        }
    }, [setIsAIOpen]);

    // WebGPU-specific renderer configuration
    const getRendererConfig = useCallback(() => {
        const baseConfig = {
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            failIfMajorPerformanceCaveat: false,
            powerPreference: "high-performance"
        };

        if (useWebGPU) {
            return {
                ...baseConfig,
                // WebGPU-specific settings (placeholder for future)
                // Note: react-three-fiber doesn't fully support WebGPU yet
            };
        }

        // WebGL configuration
        return baseConfig;
    }, [useWebGPU]);


    // Don't render until renderer is ready
    if (!rendererReady) {
        return (
            <div className="dark-theme" style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(185, 185, 185, 0.8)',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px'
            }}>
                Initializing {useWebGPU ? 'WebGPU' : 'WebGL'} Renderer...
            </div>
        );
    }

    return (
        <div ref={canvasRef} className="dark-theme" style={{
            width: '100vw',
            height: '100vh',
            position: 'relative'
        }}>
            {/* Performance Panel */}
            <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(26, 26, 47, 0.95)',
                color: '#e0e0e0',
                padding: '12px 16px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '500',
                zIndex: 1000,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                minWidth: '180px'
            }}>
                {/* FPS Display */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <span style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>FPS</span>
                    <span style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: fps >= 55 ? '#00ff88' : fps >= 30 ? '#ffaa00' : '#ff4444',
                        textShadow: `0 0 10px ${fps >= 55 ? '#00ff8844' : fps >= 30 ? '#ffaa0044' : '#ff444444'}`
                    }}>
                        {fps}
                    </span>
                </div>

                {/* Renderer Switch */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                }}>
                    <span style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Renderer
                    </span>
                    <button
                        title={`${webGPUAvailable ? 'Switch Renderer' : 'WebGPU not available'}. This will restart the application.`}
                        onClick={handleRendererSwitch}
                        disabled={!webGPUAvailable}
                        style={{
                            background: useWebGPU
                                ? '#3374EE'
                                : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: webGPUAvailable ? 'pointer' : 'not-allowed',
                            opacity: webGPUAvailable ? 1 : 0.5,
                            transition: 'all 0.3s ease',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            boxShadow: webGPUAvailable ? '0 4px 12px rgba(0, 0, 0, 0.3)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                        onMouseEnter={(e) => {
                            if (webGPUAvailable) {
                                e.target.style.transform = 'scale(1.05)';
                                e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (webGPUAvailable) {
                                e.target.style.transform = 'scale(1)';
                                e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                            }
                        }}
                    >
                        <span>{useWebGPU ? 'WebGPU' : 'WebGL'}</span>
                    </button>

                </div>

                {/* WebGPU availability indicator */}
                {!webGPUAvailable && (
                    <div style={{
                        marginTop: '8px',
                        padding: '6px 8px',
                        background: 'rgba(255, 68, 68, 0.1)',
                        borderRadius: '6px',
                        fontSize: '10px',
                        color: '#ff8888',
                        textAlign: 'center',
                        border: '1px solid rgba(255, 68, 68, 0.2)'
                    }}>
                        WebGPU Unavailable
                    </div>
                )}
            </div>

            <Canvas
                camera={{ position: [0, 200, 400], fov: 60 }}
                shadows
                gl={getRendererConfig()}
                onCreated={({ gl }) => {
                    console.log(`Renderer created: ${useWebGPU ? 'WebGPU' : 'WebGL'}`);

                    // Apply dark bluish spotlight gradient background
                    const canvas = gl.domElement;
                    canvas.style.background = 'radial-gradient(ellipse at center, #27262fff 0%, #151515ff 70%, #000000 100%)';
                    canvas.style.backgroundRepeat = 'no-repeat';
                    canvas.style.backgroundSize = 'cover';

                    // Handle WebGL context loss (not applicable to WebGPU)
                    if (!useWebGPU) {
                        canvas.addEventListener('webglcontextlost', (event) => {
                            console.warn('WebGL context lost, preventing default behavior');
                            event.preventDefault();
                        }, false);

                        canvas.addEventListener('webglcontextrestored', (event) => {
                            console.log('WebGL context restored');
                        }, false);
                    }
                }}
            >


                {/* Enhanced lighting for maximum model visibility */}
                <ambientLight intensity={0.8} color="#ffffff" />
                <directionalLight
                    position={[10, 10, 5]}
                    intensity={1.5}
                    castShadow
                    color="#ffffff"
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                />
                <directionalLight
                    position={[-10, 10, 5]}
                    intensity={1.2}
                    color="#ffffff"
                />
                <directionalLight
                    position={[0, -10, 5]}
                    intensity={1.0}
                    color="#ffffff"
                />
                <directionalLight
                    position={[0, 0, -10]}
                    intensity={1.0}
                    color="#ffffff"
                />
                <pointLight
                    position={[0, 5, 10]}
                    intensity={1.5}
                    color="#ffffff"
                    distance={50}
                    decay={1}
                />
                <pointLight
                    position={[10, 0, 0]}
                    intensity={1.2}
                    color="#ffffff"
                    distance={100}
                    decay={1}
                />
                <pointLight
                    position={[-10, 0, 0]}
                    intensity={1.2}
                    color="#ffffff"
                    distance={100}
                    decay={1}
                />
                <pointLight
                    position={[0, -5, 0]}
                    intensity={1.0}
                    color="#ffffff"
                    distance={80}
                    decay={1}
                />
                <Suspense fallback={null}>
                    <InteractiveModelPrimitive
                        ref={modelRef}
                        url={url}
                        type={type}
                        userScale={modelScale.userScale}
                        enableAutoScale={false}
                        onModelLoad={handleModelLoad}
                        onObjectClick={handleObjectClick}
                    />
                </Suspense>
                <OrbitControls ref={orbitControlsRef} enableDamping dampingFactor={0.1} />
                <Environment preset="night" background={false} />
                <AnimationController updateAnimation={updateAnimation} />
            </Canvas>

            <DisassemblyUI
                currentLayer={currentLayer}
                totalLayers={totalLayers}
                isAnimating={isAnimating}
                onOpenAI={handleOpenAI}
                separationDistance={separationDistance}
                onSeparationDistanceChange={setSeparationDistance}
                highlightColor={highlightColor}
                highlightOpacity={highlightOpacity}
                onHighlightColorChange={setHighlightColor}
                onHighlightOpacityChange={setHighlightOpacity}
                modelScale={modelScale}
                onScaleChange={handleScaleChange}
                nodeCount={sceneAnalysis.nodeCount}
                childrenCount={sceneAnalysis.childrenCount}
                sceneTree={sceneAnalysis.sceneTree}
            />

            {isAIOpen && closeAI && (
                <Three21Bot
                    isOpen={isAIOpen}
                    onClose={closeAI}
                    modelInfo={modelInfo}
                    demoConfig={activeDemoConfig}
                    selectedPart={selectedPart}
                    onScreenshot={handleScreenshot}
                    sceneAnalysis={screenshotManagerRef.current?.analyzeScene ?
                        screenshotManagerRef.current.analyzeScene(modelRef.current) : null}
                    autoScreenshot={screenshotManagerRef.current?.getLastScreenshot()?.dataURL}
                />
            )}

            <Toast
                message={toast.message}
                isVisible={toast.isVisible}
                onHide={hideToast}
            />
        </div>
    );
});