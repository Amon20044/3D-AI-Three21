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
            {!showInstructions && (
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

            <style jsx>{`
                /* Mobile-first responsive design with a11y focus */
                .disassembly-instructions {
                    position: fixed;
                    top: 0.75rem;
                    left: 0.75rem;
                    right: 0.75rem;
                    background: var(--card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 1rem;
                    z-index: 9999;
                    box-shadow: 
                        0 16px 32px rgba(0, 0, 0, 0.15),
                        0 0 0 1px rgba(255, 255, 255, 0.08);
                    backdrop-filter: blur(20px);
                    animation: slideInLeft 0.5s ease-out;
                    max-height: calc(100vh - 1.5rem);
                    overflow-y: auto;
                }

                @media (min-width: 768px) {
                    .disassembly-instructions {
                        top: 1.5rem;
                        left: 1.5rem;
                        right: auto;
                        max-width: 360px;
                        padding: 1.5rem;
                        border-radius: 16px;
                    }
                }

                .instructions-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                }

                @media (min-width: 768px) {
                    .instructions-header {
                        gap: 1rem;
                        margin-bottom: 1.5rem;
                    }
                }

                .instructions-icon {
                    width: 2.5rem;
                    height: 2.5rem;
                    background: var(--gradient-primary);
                    color: var(--primary-foreground);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    box-shadow: 0 8px 16px var(--primary-shadow);
                }

                @media (min-width: 768px) {
                    .instructions-icon {
                        width: 3rem;
                        height: 3rem;
                        border-radius: 14px;
                        box-shadow: 0 12px 24px var(--primary-shadow);
                    }
                }

                .instructions-header h3 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--foreground);
                }

                @media (min-width: 768px) {
                    .instructions-header h3 {
                        font-size: 1.125rem;
                        background: var(--gradient-primary);
                        -webkit-background-clip: text;
                        background-clip: text;
                        -webkit-text-fill-color: transparent;
                    }
                }

                .instructions-content {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                }

                @media (min-width: 768px) {
                    .instructions-content {
                        gap: 1rem;
                        margin-bottom: 1.5rem;
                    }
                }

                .control-section {
                    margin-bottom: 0.75rem;
                }

                .control-section:last-of-type {
                    margin-bottom: 0;
                }

                .section-title {
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: var(--primary-accent);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 0.5rem;
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                }

                @media (min-width: 768px) {
                    .section-title {
                        font-size: 0.75rem;
                    }
                }

                .touch-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 2rem;
                    height: 2rem;
                    background: var(--card);
                    border: 2px solid var(--border);
                    border-radius: 6px;
                    font-size: 1.125rem;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                @media (min-width: 768px) {
                    .touch-icon {
                        width: 2.5rem;
                        height: 2.5rem;
                        border-radius: 10px;
                        font-size: 1.25rem;
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
                    }
                }

                .mouse-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 2rem;
                    height: 2rem;
                    background: var(--card);
                    border: 2px solid var(--border);
                    border-radius: 6px;
                    color: var(--primary-accent);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                @media (min-width: 768px) {
                    .mouse-icon {
                        width: 2.5rem;
                        height: 2.5rem;
                        border-radius: 10px;
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
                    }
                }

                .control-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    border-radius: 8px;
                    transition: all 0.3s ease;
                }

                @media (min-width: 768px) {
                    .control-item {
                        gap: 1.25rem;
                        padding: 1rem;
                        border-radius: 12px;
                    }
                }

                .control-item:hover {
                    background: rgba(var(--primary-rgb), 0.1);
                }

                .key-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 2rem;
                    height: 2rem;
                    background: var(--card);
                    border: 2px solid var(--border);
                    border-radius: 6px;
                    font-size: 0.875rem;
                    font-weight: 700;
                    color: var(--foreground);
                    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                @media (min-width: 768px) {
                    .key-badge {
                        width: 2.5rem;
                        height: 2.5rem;
                        border-radius: 10px;
                        font-size: 1rem;
                        font-weight: 800;
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
                    }
                }

                .control-item span {
                    font-size: 0.8rem;
                    color: var(--muted-foreground);
                    line-height: 1.4;
                    font-weight: 500;
                }

                @media (min-width: 768px) {
                    .control-item span {
                        font-size: 0.9rem;
                        line-height: 1.5;
                    }
                }

                .instructions-note {
                    font-size: 0.75rem;
                    color: var(--muted-foreground);
                    line-height: 1.5;
                    padding: 0.75rem;
                    background: var(--muted);
                    border-radius: 8px;
                    border-left: 3px solid var(--primary-accent);
                }

                @media (min-width: 768px) {
                    .instructions-note {
                        font-size: 0.8rem;
                        line-height: 1.6;
                        padding: 1rem;
                        border-radius: 10px;
                        border-left-width: 4px;
                    }
                }

                .instructions-close-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: transparent;
                    border: 2px solid var(--border);
                    color: var(--muted-foreground);
                    padding: 0.625rem 0.875rem;
                    border-radius: 6px;
                    margin-bottom: 2rem;
                    cursor: pointer;
                    font-size: 0.75rem;
                    font-weight: 600;
                    transition: all 0.3s ease;
                    outline: none;
                }

                @media (min-width: 768px) {
                    .instructions-close-btn {
                        padding: 0.75rem 1rem;
                        margin-bottom: 2rem;
                        border-radius: 8px;
                        font-size: 0.8rem;
                    }
                }

                .instructions-close-btn:hover {
                    color: var(--foreground);
                    border-color: var(--primary-accent);
                    background: var(--muted);
                }

                .instructions-close-btn:focus-visible {
                    outline: 2px solid var(--primary-accent);
                    outline-offset: 2px;
                }

                .ai-assistant-btn {
                    position: fixed;
                    top: 0.75rem;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--gradient-primary);
                    border: none;
                    color: white;
                    padding: 0.75rem 1.25rem;
                    border-radius: 16px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    font-weight: 600;
                    z-index: 9999;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 16px var(--primary-shadow);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    outline: none;
                    white-space: nowrap;
                    min-width: fit-content;
                }

                @media (min-width: 768px) {
                    .ai-assistant-btn {
                        top: 1.5rem;
                        padding: 0.875rem 1.75rem;
                        border-radius: 25px;
                        font-size: 0.875rem;
                        gap: 0.625rem;
                        box-shadow: 0 8px 25px var(--primary-shadow);
                    }
                }

                .ai-assistant-btn:hover {
                    transform: translateX(-50%) translateY(-1px);
                    box-shadow: 0 8px 25px var(--primary-shadow);
                }

                @media (min-width: 768px) {
                    .ai-assistant-btn:hover {
                        transform: translateX(-50%) translateY(-2px);
                        box-shadow: 0 12px 35px var(--primary-shadow);
                    }
                }

                .ai-assistant-btn:focus-visible {
                    outline: 2px solid var(--primary-foreground);
                    outline-offset: 2px;
                }

                .ai-btn-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .status-indicator {
                    position: fixed;
                    top: 0.75rem;
                    right: 0.75rem;
                    background: var(--card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 1rem;
                    z-index: 9999;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
                    backdrop-filter: blur(20px);
                    min-width: 220px;
                    max-width: calc(100vw - 1.5rem);
                    animation: slideInRight 0.5s ease-out;
                }

                @media (min-width: 768px) {
                    .status-indicator {
                        top: 1.5rem;
                        right: 1.5rem;
                        border-radius: 16px;
                        padding: 1.25rem;
                        min-width: 260px;
                        max-width: 320px;
                    }
                }

                .status-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 1rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid var(--border);
                }

                .status-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0;
                    font-size: 0.875rem;
                    font-weight: 700;
                    color: var(--foreground);
                }

                @media (min-width: 768px) {
                    .status-title {
                        font-size: 1rem;
                    }
                }

                .status-close-btn {
                    background: transparent;
                    border: 1px solid var(--border);
                    color: var(--muted-foreground);
                    padding: 0.5rem;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    outline: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .status-close-btn:hover {
                    color: var(--foreground);
                    border-color: var(--primary-accent);
                    background: var(--muted);
                }

                .status-close-btn:focus-visible {
                    outline: 2px solid var(--primary-accent);
                    outline-offset: 2px;
                }

                .control-row {
                    max-width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.75rem;
                    margin-bottom: 0.875rem;
                }

                .control-row:last-of-type {
                    margin-bottom: 0;
                }

                .control-label {
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: var(--muted-foreground);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    flex-shrink: 0;
                    min-width: 3.5rem;
                }

                @media (min-width: 768px) {
                    .control-label {
                        font-size: 0.75rem;
                    }
                }

                .slider-control {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex: 1;
                    min-width: 0;
                }

                .slider {
                    flex: 1;
                    height: 3px;
                    background: var(--muted);
                    border-radius: 2px;
                    outline: none;
                    cursor: pointer;
                    min-width: 60px;
                }

                @media (min-width: 768px) {
                    .slider {
                        height: 4px;
                        min-width: 100px;
                    }
                }

                .slider::-webkit-slider-thumb {
                    appearance: none;
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: var(--primary-accent);
                    cursor: pointer;
                    border: 2px solid var(--card);
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
                    transition: all 0.2s ease;
                }

                @media (min-width: 768px) {
                    .slider::-webkit-slider-thumb {
                        width: 16px;
                        height: 16px;
                    }
                }

                .slider::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                    box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.4);
                }

                .value-display {
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: var(--primary-accent);
                    min-width: 2.5rem;
                    text-align: right;
                    background: rgba(var(--primary-rgb), 0.1);
                    padding: 0.2rem 0.4rem;
                    border-radius: 4px;
                }

                @media (min-width: 768px) {
                    .value-display {
                        font-size: 0.75rem;
                    }
                }

                .color-input {
                    width: 28px;
                    height: 22px;
                    border: 1px solid var(--border);
                    border-radius: 4px;
                    cursor: pointer;
                    background: none;
                    padding: 0;
                    flex-shrink: 0;
                }

                @media (min-width: 768px) {
                    .color-input {
                        width: 32px;
                        height: 24px;
                    }
                }

                .color-input::-webkit-color-swatch-wrapper {
                    padding: 0;
                    border: none;
                    border-radius: inherit;
                }

                .color-input::-webkit-color-swatch {
                    border: none;
                    border-radius: inherit;
                }

                .opacity-slider {
                    flex: 0.8;
                }

                .progress-container {
                    margin-bottom: 0.875rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .progress-bar {
                    flex: 1;
                    height: 6px;
                    background: var(--muted);
                    border-radius: 3px;
                    overflow: hidden;
                    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
                }

                @media (min-width: 768px) {
                    .progress-bar {
                        height: 8px;
                        border-radius: 4px;
                    }
                }

                .progress-fill {
                    height: 100%;
                    background: var(--gradient-primary);
                    border-radius: inherit;
                    transition: width 0.8s ease;
                    box-shadow: 0 0 8px rgba(var(--primary-rgb), 0.5);
                }

                .progress-text {
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: var(--primary-accent);
                    min-width: 2.5rem;
                    text-align: center;
                }

                @media (min-width: 768px) {
                    .progress-text {
                        font-size: 0.75rem;
                    }
                }

                .status-row {
                    display: flex;
                    justify-content: center;
                    padding-top: 0.75rem;
                    border-top: 1px solid var(--border);
                    margin-top: 0.875rem;
                }

                .status-badge {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0.875rem;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .status-badge.ready {
                    background: rgba(34, 197, 94, 0.1);
                    color: var(--success);
                    border: 1px solid rgba(34, 197, 94, 0.3);
                }

                .status-badge.animating {
                    background: rgba(59, 130, 246, 0.1);
                    color: var(--primary-accent);
                    border: 1px solid rgba(59, 130, 246, 0.3);
                }

                .status-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: var(--success);
                    animation: pulse 2s ease-in-out infinite;
                    box-shadow: 0 0 8px var(--success);
                }

                @media (min-width: 768px) {
                    .status-dot {
                        width: 8px;
                        height: 8px;
                    }
                }

                .status-spinner {
                    width: 10px;
                    height: 10px;
                    border: 2px solid rgba(59, 130, 246, 0.3);
                    border-top: 2px solid var(--primary-accent);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @media (min-width: 768px) {
                    .status-spinner {
                        width: 12px;
                        height: 12px;
                    }
                }

                @media (min-width: 768px) {
                    .status-indicator {
                        top: 1.5rem;
                        right: 1.5rem;
                        border-radius: 16px;
                        padding: 1.5rem;
                        min-width: 280px;
                        max-width: 360px;
                    }
                }

                .status-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 1rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid var(--border);
                }

                .status-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0;
                    font-size: 0.875rem;
                    font-weight: 700;
                    color: var(--foreground);
                }

                @media (min-width: 768px) {
                    .status-title {
                        font-size: 1rem;
                    }
                }

                .status-close-btn {
                    background: transparent;
                    border: 1px solid var(--border);
                    color: var(--muted-foreground);
                    padding: 0.5rem;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    outline: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .status-close-btn:hover {
                    color: var(--foreground);
                    border-color: var(--primary-accent);
                    background: var(--muted);
                }

                .status-close-btn:focus-visible {
                    outline: 2px solid var(--primary-accent);
                    outline-offset: 2px;
                }

                .show-controls-btn, .show-status-btn {
                    position: fixed;
                    background:  var(--gradient-primary);
                    border: 2px solid var(--border);
                    color: var(--foreground);
                    padding: 0.75rem 1rem;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 0.75rem;
                    font-weight: 600;
                    z-index: 9999;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    outline: none;
                    animation: slideInUp 0.5s ease-out;
                    white-space: nowrap;
                }

                @media (min-width: 768px) {
                    .show-controls-btn, .show-status-btn {
                        padding: 1rem 1.25rem;
                        border-radius: 25px;
                        font-size: 0.8rem;
                        gap: 0.75rem;
                        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
                    }
                }

                .show-controls-btn {
                    bottom: 1rem;
                    left: 1rem;
                }

                @media (min-width: 768px) {
                    .show-controls-btn {
                        bottom: 1.5rem;
                        left: 1.5rem;
                    }
                }

                .show-status-btn {
                    bottom: 1rem;
                    right: 1rem;
                }

                @media (min-width: 768px) {
                    .show-status-btn {
                        bottom: 1.5rem;
                        right: 1.5rem;
                    }
                }

                .show-controls-btn:hover, .show-status-btn:hover {
                    color: var(--foreground);
                    border-color: var(--primary-accent);
                    background: var(--card);
                    box-shadow: 0 8px 25px rgba(var(--primary-rgb), 0.3);
                    transform: translateY(-2px);
                }

                .show-controls-btn:focus-visible, .show-status-btn:focus-visible {
                    outline: 2px solid var(--primary-accent);
                    outline-offset: 2px;
                }

                /* Control Buttons */
                .control-buttons {
                    position: fixed;
                    bottom: 1rem;
                    left: 50%;
                    transform: translateX(-50%);
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.75rem;
                    padding: 0.875rem;
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                    z-index: 100;
                    min-width: 240px;
                    max-width: calc(100vw - 2rem);
                }

                @media (min-width: 768px) {
                    .control-buttons {
                        bottom: 2rem;
                        gap: 1rem;
                        padding: 1rem;
                        border-radius: 16px;
                        min-width: 280px;
                        max-width: none;
                    }
                }

                .btn-control {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.375rem;
                    height: 2.5rem;
                    padding: 0 0.75rem;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    background: rgba(255, 255, 255, 0.1);
                    color: #fafafa;
                    border-radius: 10px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    font-family: inherit;
                    text-decoration: none;
                    outline: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    overflow: hidden;
                    user-select: none;
                    white-space: nowrap;
                    width: 100%;
                }

                @media (min-width: 768px) {
                    .btn-control {
                        height: 2.75rem;
                        padding: 0 1rem;
                        border-radius: 12px;
                        font-size: 0.875rem;
                        gap: 0.5rem;
                    }
                }

                .btn-control:focus-visible {
                    outline: 2px solid var(--primary-accent);
                    outline-offset: 2px;
                }

                .btn-control:hover:not(:disabled) {
                    background: rgba(59, 130, 246, 0.8);
                    color: #ffffff;
                    border-color: #3b82f6;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
                }

                .btn-control-active {
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: #ffffff;
                    border-color: #3b82f6;
                    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
                    transform: translateY(-1px);
                }

                .btn-control-active:hover:not(:disabled) {
                    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
                    transform: translateY(-2px);
                }

                .btn-control-secondary {
                    background: rgba(100, 116, 139, 0.8);
                    color: #cbd5e1;
                    border-color: rgba(100, 116, 139, 0.5);
                }

                .btn-control-secondary:hover:not(:disabled) {
                    background: rgba(59, 130, 246, 0.8);
                    color: #ffffff;
                    border-color: #3b82f6;
                    box-shadow: 0 4px 14px rgba(59, 130, 246, 0.25);
                }

                .btn-control:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    background: rgba(100, 116, 139, 0.3);
                    color: rgba(203, 213, 225, 0.6);
                    border-color: rgba(100, 116, 139, 0.3);
                    transform: none;
                    box-shadow: none;
                    pointer-events: none;
                }

                .btn-control .btn-icon {
                    flex-shrink: 0;
                }

                .btn-control .btn-text {
                    font-weight: 600;
                    letter-spacing: 0.025em;
                }

                /* Animations */
                @keyframes slideInLeft {
                    from {
                        opacity: 0;
                        transform: translateX(-30px) scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                }

                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(30px) scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                }

                @keyframes slideInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                @keyframes pulse {
                    0%, 100% { 
                        opacity: 1; 
                        transform: scale(1);
                    }
                    50% { 
                        opacity: 0.7;
                        transform: scale(1.1);
                    }
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* Responsive adjustments for very small screens */
                @media (max-width: 480px) {
                    .disassembly-instructions {
                        top: 0.5rem;
                        left: 0.5rem;
                        right: 0.5rem;
                        padding: 0.875rem;
                        border-radius: 10px;
                    }

                    .status-indicator {
                        top: auto;
                        bottom: calc(80px);
                        left: .5rem;
                        right: .5rem;
                        padding: 1rem;
                        border-radius: 10px;
                        min-width: 100%;
                    }

                    .ai-assistant-btn {
                        top: 0.5rem;
                        font-size: 0.75rem;
                        padding: 0.625rem 1rem;
                        border-radius: 14px;
                    }
                    
                    .control-buttons {
                        bottom: 0.5rem;
                        left: 0.5rem;
                        right: 0.5rem;
                        transform: none;
                        gap: 0.5rem;
                        // padding: 0.75rem;
                        border-radius: 10px;
                        min-width: calc(100vw - 1rem);
                    }

                    .btn-control {
                        height: 2.25rem;
                        font-size: 0.75rem;
                        gap: 0.25rem;
                        padding: 0 0.5rem;
                        border-radius: 8px;
                    }

                    .show-controls-btn, .show-status-btn {
                        bottom: 5rem;
                        padding: 0.625rem 0.875rem;
                        font-size: 0.7rem;
                        border-radius: 16px;
                    }

                    .show-controls-btn {
                        left: 0.5rem;
                    }

                    .show-status-btn {
                        right: 0.5rem;
                    }

                    .status-label {
                        font-size: 0.65rem;
                    }

                    .status-value {
                        font-size: 0.7rem;
                    }

                    .distance-number-input {
                        width: 50px;
                        height: 18px;
                        font-size: 0.65rem;
                    }

                    .distance-value, .opacity-value {
                        font-size: 0.6rem;
                        min-width: 1.75rem;
                    }

                    .color-picker {
                        width: 24px;
                        height: 18px;
                    }
                }

                /* High contrast mode support */
                @media (prefers-contrast: high) {
                    .disassembly-instructions,
                    .status-indicator {
                        border-width: 2px;
                        box-shadow: none;
                    }

                    .btn-control {
                        border-width: 2px;
                    }

                    .instructions-close-btn,
                    .status-close-btn,
                    .show-controls-btn,
                    .show-status-btn {
                        border-width: 2px;
                    }
                }

                /* Reduced motion support */
                @media (prefers-reduced-motion: reduce) {
                    * {
                        animation-duration: 0.01ms !important;
                        animation-iteration-count: 1 !important;
                        transition-duration: 0.01ms !important;
                    }
                }

                /* Print styles */
                @media print {
                    .disassembly-instructions,
                    .status-indicator,
                    .ai-assistant-btn,
                    .control-buttons,
                    .show-controls-btn,
                    .show-status-btn {
                        display: none !important;
                    }
                }

                /* Value input for editable numbers */
                .value-input {
                    width: 3.5rem;
                    height: 1.75rem;
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: var(--foreground);
                    background: var(--card);
                    border: 1px solid var(--border);
                    border-radius: 4px;
                    padding: 0 0.25rem;
                    text-align: center;
                    outline: none;
                    transition: all 0.2s ease;
                }

                .value-input:focus {
                    border-color: var(--primary-accent);
                    box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
                }

                .value-input:hover {
                    border-color: var(--muted-foreground);
                }

                @media (min-width: 768px) {
                    .value-input {
                        width: 4rem;
                        height: 2rem;
                        font-size: 0.75rem;
                    }
                }

                /* Node count in status header */
                .node-count {
                    font-size: 0.7rem;
                    font-weight: 500;
                    color: var(--muted-foreground);
                    opacity: 0.8;
                }

                @media (min-width: 768px) {
                    .node-count {
                        font-size: 0.75rem;
                    }
                }

                /* Tree toggle button (compact arrow at top-left) */
                .tree-toggle-btn {
                    position: fixed;
                    top: 0.75rem;
                    left: 0.75rem;
                    background: var(--card);
                    border: 1px solid var(--border);
                    color: var(--foreground);
                    padding: 0.5rem;
                    border-radius: 8px;
                    cursor: pointer;
                    z-index: 40;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    outline: none;
                    width: 2.5rem;
                    height: 2.5rem;
                }

                @media (min-width: 768px) {
                    .tree-toggle-btn {
                        top: 1.5rem;
                        left: 1.5rem;
                        width: 2.75rem;
                        height: 2.75rem;
                        border-radius: 10px;
                    }
                }

                .tree-toggle-btn:hover {
                    background: var(--muted);
                    border-color: var(--primary-accent);
                    transform: translateX(2px);
                }

                .tree-toggle-btn:focus-visible {
                    outline: 2px solid var(--primary-accent);
                    outline-offset: 2px;
                }

                /* Object Tree Panel - Figma style */
                .object-tree-panel {
                    position: fixed;
                    top: 0.75rem;
                    left: 0.75rem;
                    bottom: 0.75rem;
                    width: calc(100% - 1.5rem);
                    max-width: 280px;
                    background: var(--card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
                    backdrop-filter: blur(20px);
                    z-index: 40;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: slideInLeft 0.3s ease-out;
                }

                @keyframes slideInLeft {
                    from {
                        opacity: 0;
                        transform: translateX(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @media (min-width: 768px) {
                    .object-tree-panel {
                        top: 1.5rem;
                        left: 1.5rem;
                        bottom: 1.5rem;
                        max-width: 320px;
                        border-radius: 16px;
                    }
                }

                .tree-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.875rem 1rem;
                    border-bottom: 1px solid var(--border);
                    background: var(--muted);
                    flex-shrink: 0;
                    gap: 0.5rem;
                }

                .tree-header-left {
                    display: flex;
                    align-items: center;
                    flex: 1;
                    min-width: 0;
                }

                .tree-header-right {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-shrink: 0;
                }

                .tree-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0;
                    font-size: 0.875rem;
                    font-weight: 700;
                    color: var(--foreground);
                }

                @media (min-width: 768px) {
                    .tree-title {
                        font-size: 1rem;
                    }
                }

                .tree-header-stat {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    margin: 0.2rem;
                    font-size: 0.5rem;
                    font-weight: 600;
                    color: var(--muted-foreground);
                    background: var(--card);
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    border: 1px solid var(--border);
                    white-space: nowrap;
                }

                @media (min-width: 768px) {
                    .tree-header-stat {
                        font-size: 0.75rem;
                        padding: 0.3rem 0.6rem;
                    }
                }

                .tree-close-btn {
                    background: transparent;
                    border: 1px solid var(--border);
                    color: var(--muted-foreground);
                    padding: 0.5rem;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    outline: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .tree-close-btn:hover {
                    color: var(--foreground);
                    border-color: var(--primary-accent);
                    background: var(--card);
                }

                .tree-close-btn:focus-visible {
                    outline: 2px solid var(--primary-accent);
                    outline-offset: 2px;
                }

                .tree-stats {
                
                    display: flex-wrap;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1rem;
                    background: rgba(var(--primary-rgb), 0.05);
                    border-bottom: 1px solid var(--border);
                    font-size: 0.7rem;
                    color: var(--muted-foreground);
                    flex-shrink: 0;
                }

                .tree-stat {
                    font-weight: 600;
                }

                .tree-stat-separator {
                    opacity: 0.5;
                }

                .tree-content {
                    flex: 1;
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding: 0.5rem;
                }

                .tree-content::-webkit-scrollbar {
                    width: 8px;
                }

                .tree-content::-webkit-scrollbar-track {
                    background: var(--muted);
                    border-radius: 4px;
                }

                .tree-content::-webkit-scrollbar-thumb {
                    background: var(--border);
                    border-radius: 4px;
                }

                .tree-content::-webkit-scrollbar-thumb:hover {
                    background: var(--muted-foreground);
                }

                .tree-node {
                    margin-bottom: 0.25rem;
                }

                .tree-node-content {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.375rem 0.5rem;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    font-size: 0.5rem;
                    color: var(--foreground);
                }

                .tree-node-content:hover {
                    background: var(--muted);
                }

                .tree-expand-btn {
                    background: transparent;
                    border: none;
                    color: var(--muted-foreground);
                    padding: 0;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 16px;
                    height: 14px;
                    flex-shrink: 0;
                    outline: none;
                    transition: transform 0.2s ease;
                }

                .tree-expand-btn:hover {
                    color: var(--foreground);
                }

                .tree-spacer {
                    width: 16px;
                    height: 16px;
                    flex-shrink: 0;
                }

                .tree-node-icon {
                    font-size: 0.35rem;
                    opacity: 0.7;
                }

                .tree-node-name {
                    font-size: 0.35rem;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-weight: 500;
                }

                .tree-node-badge {
                    background: rgba(var(--primary-rgb), 0.15);
                    color: var(--primary-accent);
                    padding: 0.125rem 0.375rem;
                    border-radius: 4px;
                    font-size: 0.35rem;
                    font-weight: 700;
                    flex-shrink: 0;
                }

                .tree-node-children {
                    margin-left: 1rem;
                }

                    z-index: 9999 !important;
                    pointer-events: auto !important;
                    display: block !important;
                    visibility: visible !important;
                        }
            `}</style>
        </>
    );
}
