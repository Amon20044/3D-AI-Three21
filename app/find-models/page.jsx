'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Sliders, Download, User, Eye, Heart, X, ExternalLink, MessageCircle, Calendar, Loader, ChevronDown } from 'react-feather';
import Header from '../../components/Header';
import './styles.css';
import './modal.css';

const ITEMS_PER_PAGE = 24;
const PREFETCH_THRESHOLD = 18; // Start prefetching when 6 items before end (24 - 6 = 18)

export default function FindModelsPage() {
    const [searchMode, setSearchMode] = useState('natural');
    const [naturalQuery, setNaturalQuery] = useState('');
    const [manualFilters, setManualFilters] = useState({
        q: '',
        tags: '',
        categories: '',
        file_format: '',
        license: '',
        sort_by: 'relevance'
    });
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [searchParams, setSearchParams] = useState(null);
    const [selectedModel, setSelectedModel] = useState(null);
    
    // Pagination state
    const [pagination, setPagination] = useState({
        hasNext: false,
        hasPrevious: false,
        nextCursor: null,
        previousCursor: null
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalLoaded, setTotalLoaded] = useState(0);
    
    // Refs for pagination control
    const lastSearchPayloadRef = useRef(null);
    const isPrefetchingRef = useRef(false);
    const observerRef = useRef(null);
    const loadMoreTriggerRef = useRef(null);
    
    // AI-generated info display
    const [aiInfo, setAiInfo] = useState(null);

    // Load Vanta.js fog background
    useEffect(() => {
        const loadVanta = () => {
            if (typeof window !== 'undefined' && window.VANTA && window.THREE) {
                try {
                    window.VANTA.FOG({
                        el: "#vanta-bg",
                        mouseControls: true,
                        touchControls: true,
                        gyroControls: false,
                        minHeight: 200.00,
                        minWidth: 200.00,
                        highlightColor: 0x5363,
                        midtoneColor: 0x20459d,
                        lowlightColor: 0x4021a4,
                        baseColor: 0x0,
                        blurFactor: 0.90,
                        speed: 3.70,
                        zoom: 0.40
                    });
                } catch (e) {
                    console.error("Vanta error:", e);
                }
            }
        };

        const threeScript = document.createElement('script');
        threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';
        threeScript.onload = () => {
            const vantaScript = document.createElement('script');
            vantaScript.src = 'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js';
            vantaScript.onload = loadVanta;
            document.head.appendChild(vantaScript);
        };
        document.head.appendChild(threeScript);
    }, []);

    // Fetch models (supports both initial search and pagination)
    const fetchModels = useCallback(async (cursor = null, append = false) => {
        if (!lastSearchPayloadRef.current && !cursor) return;
        
        const isInitialSearch = !cursor;
        
        if (isInitialSearch) {
            setLoading(true);
            setResults([]);
            setCurrentPage(1);
            setTotalLoaded(0);
            setAiInfo(null);
        } else {
            setLoadingMore(true);
        }
        
        setError(null);

        try {
            const payload = {
                ...lastSearchPayloadRef.current,
                cursor: cursor,
                count: ITEMS_PER_PAGE
            };

            console.log('🔍 Fetching models:', { cursor, append, page: currentPage });

            const response = await fetch('/api/search-models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Search failed');
            }

            const newModels = data.models || [];
            
            if (append) {
                // Append to existing results, avoiding duplicates
                setResults(prev => {
                    const existingUids = new Set(prev.map(m => m.uid));
                    const uniqueNewModels = newModels.filter(m => !existingUids.has(m.uid));
                    return [...prev, ...uniqueNewModels];
                });
                setCurrentPage(prev => prev + 1);
                setTotalLoaded(prev => prev + newModels.length);
            } else {
                setResults(newModels);
                setTotalLoaded(newModels.length);
            }
            
            setSearchParams(data.searchParams);
            setPagination(data.pagination || {
                hasNext: false,
                hasPrevious: false,
                nextCursor: null,
                previousCursor: null
            });
            
            // Store AI info if available
            if (data.aiEnabled && data.generatedQuery) {
                setAiInfo({
                    originalQuery: data.originalQuery,
                    generatedQuery: data.generatedQuery,
                    generatedTags: data.generatedTags
                });
            }

            console.log('✅ Fetched:', newModels.length, 'models. Pagination:', data.pagination);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setLoadingMore(false);
            isPrefetchingRef.current = false;
        }
    }, [currentPage]);

    // Initial search handler
    const handleSearch = async () => {
        const payload = {
            mode: searchMode,
            ...(searchMode === 'natural'
                ? { query: naturalQuery }
                : {
                    manualFilters: {
                        ...manualFilters,
                        tags: manualFilters.tags.split(',').map(t => t.trim()).filter(Boolean),
                        categories: manualFilters.categories.split(',').map(c => c.trim()).filter(Boolean)
                    }
                }
            )
        };

        lastSearchPayloadRef.current = payload;
        await fetchModels(null, false);
    };

    // Load more handler
    const loadMore = useCallback(async () => {
        if (!pagination.hasNext || !pagination.nextCursor || loadingMore || isPrefetchingRef.current) {
            return;
        }
        
        isPrefetchingRef.current = true;
        await fetchModels(pagination.nextCursor, true);
    }, [pagination, loadingMore, fetchModels]);

    // Smart prefetch: trigger when scrolling to 18th item (6 before end)
    const checkPrefetchTrigger = useCallback((visibleIndex) => {
        const currentPageStart = (currentPage - 1) * ITEMS_PER_PAGE;
        const prefetchPoint = currentPageStart + PREFETCH_THRESHOLD;
        
        // If we've scrolled past the prefetch threshold and have more pages
        if (visibleIndex >= prefetchPoint && pagination.hasNext && !isPrefetchingRef.current && !loadingMore) {
            console.log(`📄 Prefetch triggered at index ${visibleIndex} (threshold: ${prefetchPoint})`);
            loadMore();
        }
    }, [currentPage, pagination.hasNext, loadMore, loadingMore]);

    // Intersection Observer for infinite scroll
    useEffect(() => {
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry.isIntersecting && pagination.hasNext && !loadingMore) {
                    loadMore();
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        if (loadMoreTriggerRef.current) {
            observerRef.current.observe(loadMoreTriggerRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [pagination.hasNext, loadMore, loadingMore]);

    // Track scroll position to trigger prefetch at 18th item
    const handleModelVisible = useCallback((index) => {
        checkPrefetchTrigger(index);
    }, [checkPrefetchTrigger]);

    return (
        <div className="find-models-page">
            {/* Vanta Fog Background */}
            <div id="vanta-bg" className="vanta-bg"></div>

            {/* Use existing Header component */}
            <Header />

            {/* Content */}
            <div className="content-wrapper">
                <main className="main-content">
                    {/* Page Title */}
                    <div className="page-title-section">
                        <h1 className="page-title">Find 3D Models</h1>
                        <p className="page-subtitle">Discover thousands of models from Sketchfab, powered by AI</p>
                    </div>

                    {/* Search Mode Toggle */}
                    <div className="mode-toggle">
                        <button
                            onClick={() => setSearchMode('natural')}
                            className={`mode-btn ${searchMode === 'natural' ? 'active' : ''}`}
                        >
                            <Search size={20} />
                            Natural Language
                        </button>
                        <button
                            onClick={() => setSearchMode('manual')}
                            className={`mode-btn ${searchMode === 'manual' ? 'active' : ''}`}
                        >
                            <Sliders size={20} />
                            Manual Search
                        </button>
                    </div>

                    {/* Natural Language Search */}
                    {searchMode === 'natural' && (
                        <div className="search-box">
                            <label className="search-label">What are you looking for?</label>
                            <div className="search-input-group">
                                <input
                                    type="text"
                                    value={naturalQuery}
                                    onChange={(e) => setNaturalQuery(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="E.g., 'mechanical gears', 'downloadable robot GLB', 'sci-fi vehicles'..."
                                    className="search-input"
                                />
                                <button
                                    onClick={handleSearch}
                                    disabled={loading || !naturalQuery.trim()}
                                    className="search-btn"
                                >
                                    {loading ? (
                                        <>
                                            <div className="spinner" />
                                            Searching...
                                        </>
                                    ) : (
                                        <>
                                            <Search size={20} />
                                            Search
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className="search-hint">
                                💡 <strong>AI-Powered:</strong> Describe what you want in plain English
                            </p>
                        </div>
                    )}

                    {/* Manual Filters */}
                    {searchMode === 'manual' && (
                        <div className="filters-box">
                            <div className="filters-grid">
                                <div className="filter-item">
                                    <label>Keywords</label>
                                    <input
                                        type="text"
                                        value={manualFilters.q}
                                        onChange={(e) => setManualFilters({ ...manualFilters, q: e.target.value })}
                                        placeholder="gear, robot, car..."
                                    />
                                </div>
                                <div className="filter-item">
                                    <label>Tags (comma-separated)</label>
                                    <input
                                        type="text"
                                        value={manualFilters.tags}
                                        onChange={(e) => setManualFilters({ ...manualFilters, tags: e.target.value })}
                                        placeholder="mechanical, low-poly..."
                                    />
                                </div>
                                <div className="filter-item">
                                    <label>Categories</label>
                                    <input
                                        type="text"
                                        value={manualFilters.categories}
                                        onChange={(e) => setManualFilters({ ...manualFilters, categories: e.target.value })}
                                        placeholder="vehicles-transports..."
                                    />
                                </div>
                                <div className="filter-item">
                                    <label>File Format</label>
                                    <select
                                        value={manualFilters.file_format}
                                        onChange={(e) => setManualFilters({ ...manualFilters, file_format: e.target.value })}
                                    >
                                        <option value="">Any</option>
                                        <option value="glb">GLB</option>
                                        <option value="gltf">GLTF</option>
                                        <option value="fbx">FBX</option>
                                        <option value="obj">OBJ</option>
                                    </select>
                                </div>
                                <div className="filter-item">
                                    <label>License</label>
                                    <select
                                        value={manualFilters.license}
                                        onChange={(e) => setManualFilters({ ...manualFilters, license: e.target.value })}
                                    >
                                        <option value="">Any</option>
                                        <option value="CC0">CC0 Public Domain</option>
                                        <option value="CC-BY">CC Attribution</option>
                                        <option value="CC-BY-SA">CC Attribution-ShareAlike</option>
                                        <option value="CC-BY-NC">CC Attribution-NonCommercial</option>
                                    </select>
                                </div>
                                <div className="filter-item">
                                    <label>Sort By</label>
                                    <select
                                        value={manualFilters.sort_by}
                                        onChange={(e) => setManualFilters({ ...manualFilters, sort_by: e.target.value })}
                                    >
                                        <option value="relevance">Relevance</option>
                                        <option value="likes">Most Liked</option>
                                        <option value="views">Most Viewed</option>
                                        <option value="publishedAt">Recent</option>
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleSearch} disabled={loading} className="search-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
                                {loading ? (
                                    <>
                                        <div className="spinner" />
                                        Searching...
                                    </>
                                ) : (
                                    <>
                                        <Search size={20} />
                                        Search Models
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="error-box">❌ {error}</div>
                    )}

                    {/* Results */}
                    {results.length > 0 && (
                        <>
                            <div className="results-header">
                                <h2>Found {totalLoaded}+ models</h2>
                                {pagination.hasNext && (
                                    <span className="pagination-info">
                                        Page {currentPage} • Scroll for more
                                    </span>
                                )}
                            </div>

                            {/* AI Info Banner */}
                            {aiInfo && (
                                <div className="ai-info-banner">
                                    <div className="ai-badge">AI-Powered Search</div>
                                    <div className="ai-details">
                                        {aiInfo.generatedTags?.length > 0 && (
                                            <span><strong>Tags:</strong> {aiInfo.generatedTags.join(', ')}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="results-grid">
                                {results.map((model, index) => (
                                    <ModelCard
                                        key={model.uid}
                                        model={model}
                                        index={index}
                                        onClick={() => setSelectedModel(model)}
                                        onVisible={handleModelVisible}
                                    />
                                ))}
                            </div>

                            {/* Load More Trigger / Infinite Scroll Sentinel */}
                            {pagination.hasNext && (
                                <div 
                                    ref={loadMoreTriggerRef} 
                                    className="load-more-section"
                                >
                                    {loadingMore ? (
                                        <div className="loading-more">
                                            <Loader className="spin" size={24} />
                                            <span>Loading more models...</span>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={loadMore}
                                            className="load-more-btn"
                                            disabled={loadingMore}
                                        >
                                            <ChevronDown size={20} />
                                            Load More Models
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* End of Results */}
                            {!pagination.hasNext && results.length > 0 && (
                                <div className="end-of-results">
                                    <p>🎉 You've seen all {totalLoaded} models!</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* Empty State */}
                    {!loading && results.length === 0 && !error && searchParams && (
                        <div className="empty-state">
                            <Search size={64} className="empty-icon" />
                            <p>No models found. Try adjusting your search.</p>
                        </div>
                    )}

                    {/* Attribution Footer */}
                    <footer className="footer">
                        <p>
                            Models by <a href="https://sketchfab.com" target="_blank" rel="noopener noreferrer">Sketchfab</a>
                        </p>
                        <p>
                            Search by <a href="https://apify.com" target="_blank" rel="noopener noreferrer">Apify</a>
                        </p>
                        <p className="footer-legal">
                            All models are property of their respective creators. Please respect licenses.
                        </p>
                    </footer>
                </main>
            </div>

            {/* PREMIUM Modal */}
            {selectedModel && (
                <ModelDetailsModal
                    model={selectedModel}
                    onClose={() => setSelectedModel(null)}
                />
            )}
        </div>
    );
}

function ModelCard({ model, index, onClick, onVisible }) {
    const cardRef = useRef(null);
    const hasTriggeredRef = useRef(false);
    const thumbnail = model.thumbnails?.images?.[1]?.url || model.thumbnails?.images?.[0]?.url;

    // Track when this card becomes visible for prefetch logic
    useEffect(() => {
        if (!cardRef.current || !onVisible) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry.isIntersecting && !hasTriggeredRef.current) {
                    hasTriggeredRef.current = true;
                    onVisible(index);
                }
            },
            { threshold: 0.5 }
        );

        observer.observe(cardRef.current);

        return () => observer.disconnect();
    }, [index, onVisible]);

    return (
        <div className="model-card" onClick={onClick} ref={cardRef} data-index={index}>
            {/* Thumbnail Image */}
            <div className="model-thumbnail">
                {thumbnail ? (
                    <img
                        src={thumbnail}
                        alt={model.name}
                        className="thumbnail-image"
                        loading="lazy"
                    />
                ) : (
                    <div className="no-thumbnail">
                        No preview available
                    </div>
                )}
                {model.isDownloadable && (
                    <div className="download-badge">
                        <Download size={14} />
                        Downloadable
                    </div>
                )}
            </div>

            {/* Model Info */}
            <div className="model-info">
                <h3 className="model-title">{model.name}</h3>

                {/*  Creator */}
                <div className="model-creator">
                    {model.user.avatar?.images?.[0]?.url ? (
                        <img
                            src={model.user.avatar.images[0].url}
                            alt={model.user.displayName}
                            className="creator-avatar"
                        />
                    ) : (
                        <User size={16} />
                    )}
                    <span>{model.user.displayName}</span>
                </div>

                {/* Stats */}
                <div className="model-stats">
                    <span>
                        <Eye size={14} />
                        {model.viewCount?.toLocaleString() || 0}
                    </span>
                    <span>
                        <Heart size={14} />
                        {model.likeCount?.toLocaleString() || 0}
                    </span>
                </div>

                {/* Tags */}
                {model.tags?.length > 0 && (
                    <div className="model-tags">
                        {model.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="tag">
                                {tag.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// 🔥🔥🔥 THE MOST PREMIUM MODAL EVER! 🔥🔥🔥
function ModelDetailsModal({ model, onClose }) {
    const allThumbnails = model.thumbnails?.images || [];
    const [selectedThumb, setSelectedThumb] = useState(allThumbnails[allThumbnails.length - 1] || allThumbnails[0]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button className="modal-close" onClick={onClose}>
                    <X size={28} />
                </button>

                {/* Modal Content */}
                <div className="modal-content">
                    {/* Left Side: 3D Viewer */}
                    <div className="modal-left">
                        <div className="iframe-viewer">
                            <iframe
                                src={`${model.embedUrl}?autostart=1&ui_theme=dark`}
                                allow="autoplay; fullscreen; xr-spatial-tracking"
                                allowFullScreen
                                title={model.name}
                            />
                        </div>

                        {/* Thumbnail Gallery */}
                        {allThumbnails.length > 0 && (
                            <div className="thumbnail-gallery">
                                {allThumbnails.map((thumb, idx) => (
                                    <img
                                        key={idx}
                                        src={thumb.url}
                                        alt={`Preview ${idx + 1}`}
                                        className={`gallery-thumb ${selectedThumb?.url === thumb.url ? 'active' : ''}`}
                                        onClick={() => setSelectedThumb(thumb)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Side: All Data */}
                    <div className="modal-right">
                        {/* Title */}
                        <h1 className="modal-title">{model.name}</h1>

                        {/* Creator Info */}
                        <div className="creator-section">
                            <div className="creator-info">
                                {model.user.avatar?.images?.[0]?.url ? (
                                    <img
                                        src={model.user.avatar.images[0].url}
                                        alt={model.user.displayName}
                                        className="creator-avatar-large"
                                    />
                                ) : (
                                    <div className="creator-avatar-placeholder">
                                        <User size={32} />
                                    </div>
                                )}
                                <div>
                                    <p className="creator-name">{model.user.displayName}</p>
                                    <p className="creator-username">@{model.user.username}</p>
                                </div>
                            </div>
                            <a
                                href={model.user.profileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="view-profile-btn"
                            >
                                View Profile
                            </a>
                        </div>

                        {/* Stats Grid */}
                        <div className="stats-grid">
                            <div className="stat-box">
                                <Eye size={20} />
                                <span className="stat-value">{model.viewCount?.toLocaleString() || 0}</span>
                                <span className="stat-label">Views</span>
                            </div>
                            <div className="stat-box">
                                <Heart size={20} />
                                <span className="stat-value">{model.likeCount?.toLocaleString() || 0}</span>
                                <span className="stat-label">Likes</span>
                            </div>
                            <div className="stat-box">
                                <MessageCircle size={20} />
                                <span className="stat-value">{model.commentCount?.toLocaleString() || 0}</span>
                                <span className="stat-label">Comments</span>
                            </div>
                            {model.animationCount > 0 && (
                                <div className="stat-box">
                                    <span className="stat-value">{model.animationCount}</span>
                                    <span className="stat-label">Animations</span>
                                </div>
                            )}
                        </div>

                        {/* Metadata */}
                        <div className="metadata-section">
                            <div className="metadata-item">
                                <Calendar size={16} />
                                <span>Published: {new Date(model.publishedAt).toLocaleDateString()}</span>
                            </div>
                            <div className="metadata-item">
                                <Download size={16} />
                                <span>{model.isDownloadable ? 'Downloadable ✓' : 'View Only'}</span>
                            </div>
                            {model.license && (
                                <div className="metadata-item">
                                    <span>📜 License: {model.license.label || model.license}</span>
                                </div>
                            )}
                        </div>

                        {/* File Formats */}
                        {model.archives && (
                            <div className="formats-section">
                                <h3>Available Formats</h3>
                                <div className="formats-grid">
                                    {model.archives.glb && (
                                        <div className="format-card">
                                            <h4>GLB</h4>
                                            <p>Faces: {model.archives.glb.faceCount?.toLocaleString()}</p>
                                            <p>Vertices: {model.archives.glb.vertexCount?.toLocaleString()}</p>
                                            <p>Size: {(model.archives.glb.size / 1024 / 1024).toFixed(2)} MB</p>
                                            <p>Textures: {model.archives.glb.textureCount}</p>
                                        </div>
                                    )}
                                    {model.archives.gltf && (
                                        <div className="format-card">
                                            <h4>GLTF</h4>
                                            <p>Faces: {model.archives.gltf.faceCount?.toLocaleString()}</p>
                                            <p>Vertices: {model.archives.gltf.vertexCount?.toLocaleString()}</p>
                                            <p>Size: {(model.archives.gltf.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                    )}
                                    {model.archives.usdz && (
                                        <div className="format-card">
                                            <h4>USDZ</h4>
                                            <p>Faces: {model.archives.usdz.faceCount?.toLocaleString()}</p>
                                            <p>Size: {(model.archives.usdz.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                    )}
                                    {model.archives.source && (
                                        <div className="format-card">
                                            <h4>Source</h4>
                                            <p>Faces: {model.archives.source.faceCount?.toLocaleString()}</p>
                                            <p>Vertices: {model.archives.source.vertexCount?.toLocaleString()}</p>
                                            <p>Size: {(model.archives.source.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tags */}
                        {model.tags?.length > 0 && (
                            <div className="tags-section">
                                <h3>Tags</h3>
                                <div className="tags-list">
                                    {model.tags.map((tag, idx) => (
                                        <span key={idx} className="tag-badge">
                                            {tag.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="action-buttons">
                            <a
                                href={model.viewerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="action-btn primary"
                            >
                                <ExternalLink size={18} />
                                View on Sketchfab
                            </a>
                            {model.isDownloadable && (
                                <a
                                    href={model.viewerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="action-btn secondary"
                                >
                                    <Download size={18} />
                                    Download Model
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


