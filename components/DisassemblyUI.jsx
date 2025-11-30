'use client'
import { useState, useEffect, useCallback } from 'react';
import {
    Tool,
    HelpCircle,
    X,
    Zap,
    Eye,
    List,
    Maximize,
    BarChart,
    ChevronUp,
    ChevronDown,
    ChevronRight,
    Settings,
    Activity,
    Layers
} from 'react-feather';
import './disass.css'
function TreeNode({ node, depth = 0 }) {
    const [isExpanded, setIsExpanded] = useState(depth < 2);
    const hasChildren = node.children && node.children.length > 0;
    const indent = depth * 1.2;

    // Build tooltip info
    const tooltipInfo = [];
    if (node.childrenCount !== undefined && node.childrenCount > 0) tooltipInfo.push(`${node.childrenCount} children`);
    if (node.vertexCount !== undefined) tooltipInfo.push(`${node.vertexCount} vertices`);
    if (node.triangleCount !== undefined) tooltipInfo.push(`${node.triangleCount} triangles`);
    if (node.type) tooltipInfo.push(`Type: ${node.type}`);

    const tooltip = tooltipInfo.join(' • ');

    return (
        <div className="tree-node" style={{ paddingLeft: `${indent}rem` }}>
            <div className="tree-node-content" title={tooltip}>
                {hasChildren ? (
                    <button
                        className="tree-expand-btn"
                        onClick={() => setIsExpanded(!isExpanded)}
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                ) : (
                    <span className="tree-spacer" />
                )}
                <span className="tree-node-icon">
                    {node.type === 'Scene' ? ' ⭘ ' : node.type === 'Group' ? ' ⟐ ' : node.type === 'Mesh' ? ' ⬢ ' : ' • '}
                </span>
                <span className="tree-node-name">
                    {node.name || `<${node.type || 'Object'}>`}
                </span>
            </div>
            {hasChildren && isExpanded && (
                <div className="tree-node-children">
                    {node.children.map((child, idx) => (
                        <TreeNode key={child.uuid || `${child.name}-${idx}`} node={child} depth={depth + 1} />
                    ))}
                </div>
            )}

        </div>
    );
};

// Separate TreeNode component for proper state management

export function DisassemblyUI({
    currentLayer,
    totalLayers,
    isAnimating,
    onOpenAI,
    isOpenAI,
    separationDistance = 0.2,
    onSeparationDistanceChange,
    highlightColor = '#00ffff',
    highlightOpacity = 0.7,
    onHighlightColorChange,
    onHighlightOpacityChange,
    modelScale = null,
    onScaleChange,
    nodeCount = 0,
    childrenCount = 0,
    sceneTree = null
}) {
    const [showInstructions, setShowInstructions] = useState(true);
    const [showStatus, setShowStatus] = useState(true);
    const [showObjectTree, setShowObjectTree] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isTouch, setIsTouch] = useState(false);
    const [gapInput, setGapInput] = useState(String(separationDistance ?? '0'));
    const [sizeInput, setSizeInput] = useState(modelScale?.userScale != null ? String(modelScale.userScale) : '1');
    const [glowInput, setGlowInput] = useState(String((highlightOpacity * 100).toFixed(2)));

    // Calculate total triangles and vertices from scene tree
    const calculateSceneTotals = useCallback((tree) => {
        if (!tree) return { totalTriangles: 0, totalVertices: 0 };

        let totalTriangles = 0;
        let totalVertices = 0;

        const traverse = (node) => {
            if (node.triangleCount) totalTriangles += node.triangleCount;
            if (node.vertexCount) totalVertices += node.vertexCount;
            if (node.children) {
                node.children.forEach(child => traverse(child));
            }
        };

        traverse(tree);
        return { totalTriangles, totalVertices };
    }, []);

    const { totalTriangles, totalVertices } = calculateSceneTotals(sceneTree);

    useEffect(() => {
        // Detect device type - prioritize desktop detection
        const checkDevice = () => {
            const userAgent = navigator.userAgent.toLowerCase();

            // Check for mobile devices in user agent
            const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

            // Check for touch capability
            const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

            // Desktop operating systems
            const isDesktopOS = /windows nt|mac os x|linux/i.test(userAgent) && !/android|iphone|ipad/i.test(userAgent);

            // Consider it touch-only if:
            // 1. It's a mobile device OR
            // 2. It has touch AND is not a desktop OS (e.g., not a touchscreen laptop)
            const isTouchDevice = isMobileDevice || (hasTouchScreen && !isDesktopOS);

            // Screen size check
            const isSmallScreen = window.innerWidth < 400;

            setIsMobile(isMobileDevice || isSmallScreen);
            setIsTouch(isTouchDevice);

            // Debug log
            console.log('Device Detection:', {
                userAgent: userAgent.substring(0, 50),
                isMobileDevice,
                hasTouchScreen,
                isDesktopOS,
                isTouchDevice,
                screenWidth: window.innerWidth
            });
        };

        checkDevice();
        window.addEventListener('resize', checkDevice);

        // Auto-hide instructions after 10 seconds
        const timer = setTimeout(() => {
            setShowInstructions(false);
        }, 10000);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', checkDevice);
        };
    }, []);

    // Handle manual disassemble/assemble button clicks
    const handleDisassemble = useCallback(() => {
        // Simulate pressing 'E' key
        const event = new KeyboardEvent('keydown', { key: 'e' });
        window.dispatchEvent(event);
    }, []);

    const handleAssemble = useCallback(() => {
        // Simulate pressing 'Q' key
        const event = new KeyboardEvent('keydown', { key: 'q' });
        window.dispatchEvent(event);
    }, []);

    console.log('DisassemblyUI rendering:', { currentLayer, totalLayers, isAnimating, showInstructions });

    // Sync local input states when props change
    useEffect(() => {
        setGapInput(separationDistance != null ? Number(separationDistance).toFixed(2) : '0.00');
    }, [separationDistance]);

    useEffect(() => {
        if (modelScale && modelScale.userScale != null) {
            setSizeInput(Number(modelScale.userScale).toFixed(2));
        }
    }, [modelScale?.userScale]);

    useEffect(() => {
        setGlowInput((highlightOpacity * 100).toFixed(2));
    }, [highlightOpacity]);

    return (
        <>
            {/* Instructions Overlay */}
            {showInstructions && (
                <div className="disassembly-instructions" role="dialog" aria-labelledby="instructions-title" aria-describedby="instructions-content">
                    <div className="instructions-header">
                        <div className="instructions-icon" aria-hidden="true">
                            {isTouch ? <Activity size={20} /> : <Tool size={20} />}
                        </div>
                        <h3 id="instructions-title">
                            {isTouch ? 'Touch Controls' : 'Keyboard & Mouse'}
                        </h3>
                    </div>
                    <button
                        onClick={() => setShowInstructions(false)}
                        className="instructions-close-btn"
                        aria-label="Hide instructions"
                        type="button"
                    >
                        <X size={14} />
                        <span>Got it</span>
                    </button>
                    <div className="instructions-content" id="instructions-content">
                        {!isTouch ? (
                            // Desktop controls
                            <>
                                <div className="control-section">

                                    <div className="section-title">Disassembly</div>
                                    <div className="control-item">
                                        <kbd className="key-badge" aria-label="E key">E</kbd>
                                        <span>Disassemble layer</span>
                                    </div>
                                    <div className="control-item">
                                        <kbd className="key-badge" aria-label="Q key">Q</kbd>
                                        <span>Reassemble layer</span>
                                    </div>
                                </div>

                                <div className="control-section">
                                    <div className="section-title">Camera</div>
                                    <div className="control-item">
                                        <div className="mouse-icon">
                                            <Activity size={14} />
                                        </div>
                                        <span>Drag to rotate</span>
                                    </div>
                                    <div className="control-item">
                                        <div className="mouse-icon">
                                            <Activity size={14} />
                                        </div>
                                        <span>Right-drag to pan</span>
                                    </div>
                                    <div className="control-item">
                                        <div className="mouse-icon">
                                            <Activity size={14} />
                                        </div>
                                        <span>Scroll to zoom</span>
                                    </div>
                                </div>

                                <div className="control-section">
                                    <div className="section-title">Selection</div>
                                    <div className="control-item">
                                        <div className="mouse-icon">
                                            <Activity size={14} />
                                        </div>
                                        <span>Double-click part to highlight</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            // Mobile/Touch controls
                            <>
                                <div className="control-section">
                                    <div className="section-title">Disassembly</div>
                                    <div className="control-item">
                                        <div className="touch-icon">👆</div>
                                        <span>Tap buttons below</span>
                                    </div>
                                </div>

                                <div className="control-section">
                                    <div className="section-title">Camera</div>
                                    <div className="control-item">
                                        <div className="touch-icon">☝️</div>
                                        <span>1 finger: rotate</span>
                                    </div>
                                    <div className="control-item">
                                        <div className="touch-icon">✌️</div>
                                        <span>2 fingers: pan</span>
                                    </div>
                                    <div className="control-item">
                                        <div className="touch-icon">🤏</div>
                                        <span>Pinch: zoom</span>
                                    </div>
                                </div>

                                <div className="control-section">
                                    <div className="section-title">Selection</div>
                                    <div className="control-item">
                                        <div className="touch-icon">👆</div>
                                        <span>Double-tap part to highlight</span>
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="instructions-note" role="note">
                            {isTouch
                                ? 'Use sliders in status panel to adjust separation and highlight effects.'
                                : 'Adjust separation distance and highlight color in status panel. Layers disassemble outward from parent centers.'}
                        </div>
                    </div>


                </div>
            )}

            {/* AI Assistant Button */}
            <button
                onClick={onOpenAI}
                className="ai-assistant-btn"
                aria-label="Open Three21Bot AI Assistant"
                type="button"
            >
                <div className="ai-btn-icon" aria-hidden="true">
                    <Zap size={18} />
                </div>
                <span>Three21Bot AI</span>
            </button>

            {/* Status Indicator */}
            {showStatus && (
                <div className="status-indicator" role="region" aria-labelledby="status-title">
                    <div className="status-header">
                        <h3 id="status-title" className="status-title">
                            <Layers size={16} aria-hidden="true" />
                            Layer {currentLayer}/{totalLayers}
                            {(nodeCount > 0 || childrenCount > 0) && (
                                <span className="node-count">
                                    • {nodeCount} nodes • {childrenCount} children
                                </span>
                            )}
                        </h3>
                        <button
                            onClick={() => setShowStatus(false)}
                            className="status-close-btn"
                            aria-label="Hide status"
                            type="button"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Progress Bar */}
                    {totalLayers > 0 && (
                        <div className="progress-container">
                            <div className="progress-bar" role="progressbar" aria-valuenow={currentLayer} aria-valuemin="0" aria-valuemax={totalLayers} aria-label="Progress">
                                <div
                                    className="progress-fill"
                                    style={{
                                        width: `${(currentLayer / totalLayers) * 100}%`
                                    }}
                                />
                            </div>
                            <span className="progress-text" aria-hidden="true">{Math.round((currentLayer / totalLayers) * 100)}%</span>
                        </div>
                    )}

                    {/* Separation Control */}
                    <div className="control-row">
                        <span className="control-label">
                            <Maximize size={12} aria-hidden="true" />
                            Gap
                        </span>
                        <div className="slider-control">
                            <input
                                type="range"
                                min="0"
                                max="1000"
                                step="0.01"
                                value={separationDistance}
                                onChange={(e) => onSeparationDistanceChange && onSeparationDistanceChange(parseFloat(e.target.value))}
                                className="slider"
                                disabled={isAnimating}
                                aria-label={`Gap: ${Number(separationDistance).toFixed(1)}`}
                            />
                            <input
                                className="value-input"
                                type="number"
                                min="0"
                                max="1000"
                                step="0.01"
                                value={gapInput}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    // allow empty while editing
                                    if (v === '' || /^\d{0,4}(?:\.\d{0,2})?$/.test(v)) {
                                        setGapInput(v);
                                        if (v !== '') {
                                            let n = parseFloat(v);
                                            if (Number.isNaN(n)) n = 0;
                                            n = Math.min(1000, Math.max(0, Math.round(n * 100) / 100));
                                            onSeparationDistanceChange && onSeparationDistanceChange(n);
                                        }
                                    }
                                }}
                                onBlur={() => {
                                    if (gapInput === '') {
                                        setGapInput(Number(separationDistance || 0).toFixed(2));
                                    } else {
                                        setGapInput((val) => Number(Number(val).toFixed(2)).toFixed(2));
                                    }
                                }}
                                aria-label="Gap value"
                            />
                        </div>
                    </div>

                    {/* Highlight Control */}
                    <div className="control-row">
                        <span className="control-label">
                            <Eye size={12} aria-hidden="true" />
                            Glow
                        </span>
                        <div className="slider-control">
                            <input
                                type="color"
                                value={highlightColor}
                                onChange={(e) => onHighlightColorChange && onHighlightColorChange(e.target.value)}
                                className="color-input"
                                disabled={isAnimating}
                                aria-label="Glow color"
                            />
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={highlightOpacity}
                                onChange={(e) => onHighlightOpacityChange && onHighlightOpacityChange(parseFloat(e.target.value))}
                                className="slider opacity-slider"
                                disabled={isAnimating}
                                aria-label={`Glow: ${(highlightOpacity * 100).toFixed(0)}%`}
                            />
                            <input
                                className="value-input"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={glowInput}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    // allow empty while editing
                                    if (v === '' || /^\d{0,3}(?:\.\d{0,2})?$/.test(v)) {
                                        setGlowInput(v);
                                        if (v !== '') {
                                            let n = parseFloat(v);
                                            if (Number.isNaN(n)) n = 0;
                                            n = Math.min(100, Math.max(0, Math.round(n * 100) / 100));
                                            onHighlightOpacityChange && onHighlightOpacityChange(n / 100);
                                        }
                                    }
                                }}
                                onBlur={() => {
                                    if (glowInput === '') {
                                        setGlowInput((highlightOpacity * 100).toFixed(2));
                                    } else {
                                        setGlowInput((val) => Number(Number(val).toFixed(2)).toFixed(2));
                                    }
                                }}
                                aria-label="Glow opacity percentage"
                            />
                            <span className="value-display">{(highlightOpacity * 100).toFixed(0)}%</span>
                        </div>
                    </div>

                    {/* Scale Control */}
                    {modelScale && modelScale.originalSize && (
                        <div className="control-row">
                            <span className="control-label">
                                <BarChart size={12} aria-hidden="true" />
                                Size
                            </span>
                            <div className="slider-control">
                                <input
                                    type="range"
                                    min="0.01"
                                    max="1000"
                                    step="0.01"
                                    value={modelScale?.userScale != null ? modelScale.userScale : 1}
                                    onChange={(e) => {
                                        const n = Math.min(1000, Math.max(0, Math.round(parseFloat(e.target.value) * 100) / 100));
                                        onScaleChange && onScaleChange(n);
                                    }}
                                    className="slider"
                                    disabled={isAnimating}
                                    aria-label={`Size: ${modelScale?.userScale || 1}x`}
                                />
                                <input
                                    className="value-input"
                                    type="number"
                                    min="0"
                                    max="1000"
                                    step="0.01"
                                    value={sizeInput}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === '' || /^\d{0,4}(?:\.\d{0,2})?$/.test(v)) {
                                            setSizeInput(v);
                                            if (v !== '') {
                                                let n = parseFloat(v);
                                                if (Number.isNaN(n)) n = 1;
                                                n = Math.min(1000, Math.max(0, Math.round(n * 100) / 100));
                                                onScaleChange && onScaleChange(n);
                                            }
                                        }
                                    }}
                                    onBlur={() => {
                                        if (sizeInput === '') {
                                            setSizeInput(Number(modelScale?.userScale || 1).toFixed(2));
                                        } else {
                                            setSizeInput((val) => Number(Number(val).toFixed(2)).toFixed(2));
                                        }
                                    }}
                                    aria-label="Size multiplier"
                                />
                                <span className="value-display">{modelScale?.userScale != null ? Number(modelScale.userScale).toFixed(2) : '1.00'}x</span>
                            </div>
                        </div>
                    )}

                    {/* Status Indicator */}
                    <div className="status-row">
                        {isAnimating ? (
                            <div className="status-badge animating">
                                <div className="status-spinner" aria-hidden="true"></div>
                                <span>Animating</span>
                            </div>
                        ) : (
                            <div className="status-badge ready">
                                <div className="status-dot" aria-hidden="true"></div>
                                <span>Ready</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Assemble/Disassemble Control Buttons */}

            <div className='control-div'>
                <div className="control-buttons" role="group" aria-label="Disassembly controls">
                    <button
                        className={`btn-control ${currentLayer <= 0 ? 'btn-control-active' : 'btn-control-secondary'}`}
                        onClick={handleAssemble}
                        disabled={currentLayer <= 0 || isAnimating}
                        aria-label="Assemble model"
                        type="button"
                    >
                        <ChevronUp className="btn-icon" size={16} />
                        <span className="btn-text">Assemble</span>
                    </button>
                    <button
                        className={`btn-control ${currentLayer >= totalLayers ? 'btn-control-secondary' : 'btn-control-active'}`}
                        onClick={handleDisassemble}
                        disabled={currentLayer >= totalLayers || isAnimating}
                        aria-label="Disassemble model"
                        type="button"
                    >
                        <ChevronDown className="btn-icon" size={16} />
                        <span className="btn-text">Disassemble</span>
                    </button>
                </div>
            </div>


            {/* Show/Hide Instructions Button */}
            {!isOpenAI && !showInstructions && (
                <button
                    onClick={() => setShowInstructions(true)}
                    className="show-controls-btn"
                    aria-label="Show disassembly controls"
                    type="button"
                >
                    <HelpCircle size={16} />
                    <span>Show Controls</span>
                </button>
            )}

            {/* Show/Hide Status Button */}
            {!showStatus && (
                <button
                    onClick={() => setShowStatus(true)}
                    className="show-status-btn"
                    aria-label="Show status panel"
                    type="button"
                >
                    <Settings size={16} />
                    <span>Model Preferences</span>
                </button>
            )}

            {/* Object Tree Panel - Figma Style (Top-Left) */}
            {showObjectTree && sceneTree && (
                <div className="object-tree-panel" role="region" aria-labelledby="tree-title">
                    <div className="tree-header">
                        <div className="tree-header-left">
                            <h3 id="tree-title" className="tree-title">
                                <Layers size={16} aria-hidden="true" />
                                Layers
                            </h3>
                        </div>
                        <div className="tree-header-right">

                            <button
                                onClick={() => setShowObjectTree(false)}
                                className="tree-close-btn"
                                aria-label="Close layers panel"
                                type="button"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="tree-stats">
                        <span className="tree-header-stat">nodes {nodeCount}</span>
                        <span className="tree-stat-separator">•</span>
                        <span className="tree-header-stat">children {childrenCount}</span>
                        <span className="tree-stat-separator">•</span>
                        {totalTriangles > 0 && (
                            <span className="tree-header-stat" title="Total Triangles">
                                △ {totalTriangles.toLocaleString()} Triangles
                            </span>
                        )}
                        <span className="tree-stat-separator">•</span>
                        {totalVertices > 0 && (
                            <span className="tree-header-stat" title="Total Vertices">
                                ◯ {totalVertices.toLocaleString()} Vertices
                            </span>
                        )}
                    </div>
                    <div className="tree-content">
                        <TreeNode node={sceneTree} depth={0} />
                    </div>
                </div>
            )}

            {/* Tree Toggle Button (Top-Left Arrow) */}
            {!showObjectTree && (
                <button
                    onClick={() => setShowObjectTree(true)}
                    className="tree-toggle-btn"
                    aria-label="Show layers panel"
                    type="button"
                >
                    <ChevronRight size={16} />
                </button>
            )}

        </>
    );
}
