'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Smartphone, Camera, RotateCcw, ZoomIn, ZoomOut, Move, AlertCircle } from 'react-feather';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import './ARViewer.css';

// Check WebXR AR support
const checkARSupport = async () => {
    if (!navigator.xr) {
        return { supported: false, reason: 'WebXR not available in this browser' };
    }
    
    try {
        const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
        if (isSupported) {
            return { supported: true, reason: null };
        }
        return { supported: false, reason: 'AR not supported on this device' };
    } catch (error) {
        return { supported: false, reason: error.message };
    }
};

// Get loader based on file type
const getLoader = (type) => {
    switch (type?.toLowerCase()) {
        case 'fbx': return new FBXLoader();
        case 'obj': return new OBJLoader();
        case 'stl': return new STLLoader();
        case 'gltf':
        case 'glb':
        default: return new GLTFLoader();
    }
};

export default function ARViewer({ url, type, isOpen, onClose, modelName = 'Model' }) {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const modelRef = useRef(null);
    const xrSessionRef = useRef(null);
    const hitTestSourceRef = useRef(null);
    const reticleRef = useRef(null);
    const placedModelRef = useRef(null);
    
    const [arSupported, setArSupported] = useState(null);
    const [arReason, setArReason] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isARActive, setIsARActive] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [modelPlaced, setModelPlaced] = useState(false);
    const [error, setError] = useState(null);
    const [modelScale, setModelScale] = useState(1);
    const [instructions, setInstructions] = useState('Loading AR...');

    // Check AR support on mount
    useEffect(() => {
        if (isOpen) {
            checkARSupport().then(({ supported, reason }) => {
                setArSupported(supported);
                setArReason(reason);
                if (!supported) {
                    setInstructions(reason || 'AR not available');
                }
            });
        }
    }, [isOpen]);

    // Initialize Three.js scene
    const initScene = useCallback(() => {
        if (!containerRef.current) return;

        // Create scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Create camera
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
        cameraRef.current = camera;

        // Create renderer with WebXR support
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        rendererRef.current = renderer;

        // Add canvas to container
        if (containerRef.current) {
            containerRef.current.appendChild(renderer.domElement);
            canvasRef.current = renderer.domElement;
        }

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(5, 10, 7);
        scene.add(directionalLight);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight2.position.set(-5, 5, -5);
        scene.add(directionalLight2);

        // Create reticle (placement indicator)
        const reticleGeometry = new THREE.RingGeometry(0.1, 0.12, 32);
        reticleGeometry.rotateX(-Math.PI / 2);
        const reticleMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            side: THREE.DoubleSide
        });
        const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
        reticle.visible = false;
        reticle.matrixAutoUpdate = false;
        scene.add(reticle);
        reticleRef.current = reticle;

        return { scene, camera, renderer };
    }, []);

    // Load 3D model
    const loadModel = useCallback(async () => {
        if (!url) return;

        setIsLoading(true);
        setInstructions('Loading 3D model...');

        try {
            const loader = getLoader(type);
            
            const loadedObject = await new Promise((resolve, reject) => {
                loader.load(
                    url,
                    (result) => resolve(result),
                    (progress) => {
                        const percent = (progress.loaded / progress.total * 100).toFixed(0);
                        setInstructions(`Loading model... ${percent}%`);
                    },
                    (error) => reject(error)
                );
            });

            // Get the scene/object based on type
            let model;
            if (type === 'fbx' || type === 'obj') {
                model = loadedObject;
            } else if (type === 'stl') {
                const material = new THREE.MeshStandardMaterial({ 
                    color: 0x808080, 
                    metalness: 0.5, 
                    roughness: 0.5 
                });
                model = new THREE.Mesh(loadedObject, material);
            } else {
                model = loadedObject.scene || loadedObject;
            }

            // Calculate bounding box and normalize size
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            
            // Scale model to fit in ~0.5m cube for AR
            const targetSize = 0.5;
            const scale = targetSize / maxDim;
            model.scale.set(scale, scale, scale);

            // Center the model
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center.multiplyScalar(scale));

            // Store model reference
            modelRef.current = model;
            setModelLoaded(true);
            setIsLoading(false);
            setInstructions('Tap to place model');

            console.log('✅ AR Model loaded:', { maxDim, scale });

        } catch (err) {
            console.error('❌ AR Model load error:', err);
            setError(`Failed to load model: ${err.message}`);
            setIsLoading(false);
        }
    }, [url, type]);

    // Start AR session
    const startARSession = useCallback(async () => {
        if (!arSupported || !rendererRef.current) {
            setError('AR not supported on this device');
            return;
        }

        try {
            setInstructions('Starting AR camera...');

            const session = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['hit-test', 'local-floor'],
                optionalFeatures: ['dom-overlay'],
                domOverlay: containerRef.current ? { root: containerRef.current } : undefined
            });

            xrSessionRef.current = session;
            rendererRef.current.xr.setReferenceSpaceType('local-floor');
            await rendererRef.current.xr.setSession(session);

            // Get hit test source
            const referenceSpace = await session.requestReferenceSpace('viewer');
            const hitTestSource = await session.requestHitTestSource({ space: referenceSpace });
            hitTestSourceRef.current = hitTestSource;

            setIsARActive(true);
            setInstructions('Point camera at floor and tap to place model');

            // Handle session end
            session.addEventListener('end', () => {
                setIsARActive(false);
                setModelPlaced(false);
                xrSessionRef.current = null;
                hitTestSourceRef.current = null;
            });

            // Start render loop
            rendererRef.current.setAnimationLoop((timestamp, frame) => {
                if (frame && hitTestSourceRef.current && reticleRef.current && !modelPlaced) {
                    const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current);
                    
                    if (hitTestResults.length > 0) {
                        const hit = hitTestResults[0];
                        const pose = hit.getPose(rendererRef.current.xr.getReferenceSpace());
                        
                        if (pose) {
                            reticleRef.current.visible = true;
                            reticleRef.current.matrix.fromArray(pose.transform.matrix);
                        }
                    } else {
                        reticleRef.current.visible = false;
                    }
                }

                rendererRef.current.render(sceneRef.current, cameraRef.current);
            });

            // Handle tap to place
            session.addEventListener('select', () => {
                if (modelRef.current && reticleRef.current?.visible && !modelPlaced) {
                    placeModel();
                }
            });

        } catch (err) {
            console.error('❌ AR session error:', err);
            setError(`Failed to start AR: ${err.message}`);
        }
    }, [arSupported, modelPlaced]);

    // Place model at reticle position
    const placeModel = useCallback(() => {
        if (!modelRef.current || !reticleRef.current || !sceneRef.current) return;

        // Clone model and place at reticle position
        const placedModel = modelRef.current.clone();
        placedModel.position.setFromMatrixPosition(reticleRef.current.matrix);
        placedModel.scale.multiplyScalar(modelScale);
        
        sceneRef.current.add(placedModel);
        placedModelRef.current = placedModel;
        
        // Hide reticle
        reticleRef.current.visible = false;
        
        setModelPlaced(true);
        setInstructions('Model placed! Use controls to adjust');

        console.log('✅ Model placed in AR');
    }, [modelScale]);

    // Scale controls
    const handleScaleUp = () => {
        if (placedModelRef.current) {
            placedModelRef.current.scale.multiplyScalar(1.2);
            setModelScale(prev => prev * 1.2);
        }
    };

    const handleScaleDown = () => {
        if (placedModelRef.current) {
            placedModelRef.current.scale.multiplyScalar(0.8);
            setModelScale(prev => prev * 0.8);
        }
    };

    // Reset placement
    const handleReset = () => {
        if (placedModelRef.current && sceneRef.current) {
            sceneRef.current.remove(placedModelRef.current);
            placedModelRef.current = null;
        }
        setModelPlaced(false);
        setModelScale(1);
        if (reticleRef.current) {
            reticleRef.current.visible = true;
        }
        setInstructions('Tap to place model');
    };

    // End AR session
    const endARSession = useCallback(() => {
        if (xrSessionRef.current) {
            xrSessionRef.current.end();
        }
        if (rendererRef.current) {
            rendererRef.current.setAnimationLoop(null);
        }
        setIsARActive(false);
        setModelPlaced(false);
    }, []);

    // Close handler
    const handleClose = useCallback(() => {
        endARSession();
        
        // Cleanup
        if (rendererRef.current && containerRef.current) {
            containerRef.current.removeChild(rendererRef.current.domElement);
        }
        if (rendererRef.current) {
            rendererRef.current.dispose();
        }
        
        onClose();
    }, [endARSession, onClose]);

    // Initialize on open
    useEffect(() => {
        if (isOpen && arSupported) {
            initScene();
            loadModel();
        }

        return () => {
            endARSession();
        };
    }, [isOpen, arSupported, initScene, loadModel, endARSession]);

    if (!isOpen) return null;

    return (
        <div className="ar-viewer-overlay">
            <div className="ar-viewer-container" ref={containerRef}>
                
                {/* Header */}
                <div className="ar-header">
                    <div className="ar-title">
                        <Smartphone size={20} />
                        <span>AR View: {modelName}</span>
                    </div>
                    <button className="ar-close-btn" onClick={handleClose}>
                        <X size={24} />
                    </button>
                </div>

                {/* Instructions */}
                <div className="ar-instructions">
                    {error ? (
                        <div className="ar-error">
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    ) : (
                        <span>{instructions}</span>
                    )}
                </div>

                {/* AR Not Supported Message */}
                {arSupported === false && (
                    <div className="ar-not-supported">
                        <div className="ar-not-supported-content">
                            <AlertCircle size={48} />
                            <h3>AR Not Available</h3>
                            <p>{arReason}</p>
                            <div className="ar-requirements">
                                <h4>Requirements:</h4>
                                <ul>
                                    <li>📱 Mobile device with camera</li>
                                    <li>🌐 Chrome 79+ on Android or Safari on iOS 15+</li>
                                    <li>🔐 HTTPS connection required</li>
                                    <li>📍 Camera permission enabled</li>
                                </ul>
                            </div>
                            <button className="ar-fallback-btn" onClick={handleClose}>
                                Return to 3D View
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && arSupported && (
                    <div className="ar-loading">
                        <div className="ar-spinner"></div>
                        <span>Loading model for AR...</span>
                    </div>
                )}

                {/* Start AR Button */}
                {arSupported && modelLoaded && !isARActive && !isLoading && (
                    <div className="ar-start-container">
                        <button className="ar-start-btn" onClick={startARSession}>
                            <Camera size={24} />
                            <span>Start AR Camera</span>
                        </button>
                        <p className="ar-hint">
                            Point your camera at a flat surface like a floor or table
                        </p>
                    </div>
                )}

                {/* AR Controls */}
                {isARActive && (
                    <div className="ar-controls">
                        <button 
                            className="ar-control-btn" 
                            onClick={handleScaleDown}
                            disabled={!modelPlaced}
                            title="Scale Down"
                        >
                            <ZoomOut size={20} />
                        </button>
                        <button 
                            className="ar-control-btn" 
                            onClick={handleReset}
                            disabled={!modelPlaced}
                            title="Reset"
                        >
                            <RotateCcw size={20} />
                        </button>
                        <button 
                            className="ar-control-btn" 
                            onClick={handleScaleUp}
                            disabled={!modelPlaced}
                            title="Scale Up"
                        >
                            <ZoomIn size={20} />
                        </button>
                    </div>
                )}

                {/* Touch hint for placing */}
                {isARActive && !modelPlaced && (
                    <div className="ar-tap-hint">
                        <Move size={24} />
                        <span>Tap on the green circle to place model</span>
                    </div>
                )}

            </div>
        </div>
    );
}
