'use client';

import { useState, useEffect } from 'react';
import { Search, Sliders, Download, User, Eye, Heart } from 'react-feather';
import Header from '../../components/Header';
import './styles.css';

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
    const [error, setError] = useState(null);
    const [searchParams, setSearchParams] = useState(null);

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

    const handleSearch = async () => {
        setLoading(true);
        setError(null);
        setResults([]);

        try {
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

            const response = await fetch('/api/search-models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Search failed');
            }

            setResults(data.models || []);
            setSearchParams(data.searchParams);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

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
                            Manual Filters
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
                                <h2>Found {results.length} models</h2>
                            </div>

                            <div className="results-grid">
                                {results.map((model) => (
                                    <ModelCard
                                        key={model.uid}
                                        model={model}
                                    />
                                ))}
                            </div>
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
        </div>
    );
}

function ModelCard({ model }) {
    const thumbnail = model.thumbnails?.images?.[1]?.url || model.thumbnails?.images?.[0]?.url;

    return (
        <a
            href={model.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="model-card"
        >
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

                {/* Creator */}
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
        </a>
    );
}
