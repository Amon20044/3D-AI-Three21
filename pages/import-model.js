import { useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { set as idbSet } from 'idb-keyval';
import { ModelInfoCollector } from '../components/ModelInfoCollector';
import { useModelInfo } from '../components/ModelInfoContext';

export default function ImportModelPage() {
    const fileInputRef = useRef();
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showInfoCollector, setShowInfoCollector] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const router = useRouter();
    
    const modelInfoContext = useModelInfo();
    const { saveModelInfo } = modelInfoContext || {};

    const handleFileChange = async (file) => {
        if (file && (file.name.endsWith('.glb') || file.name.endsWith('.fbx') || file.name.endsWith('.gltf'))) {
            setSelectedFile(file);
            setShowInfoCollector(true);
        }
    };

    const handleInputChange = (e) => {
        const file = e.target.files[0];
        handleFileChange(file);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileChange(e.dataTransfer.files[0]);
        }
    };

    const handleModelInfoSubmit = async (modelInfo) => {
        setLoading(true);
        try {
            const type = selectedFile.name.endsWith('.fbx') ? 'fbx' : 'gltf';
            
            await idbSet('lastModelFile', selectedFile);
            await idbSet('lastModelType', type);
            
            if (saveModelInfo) {
                await saveModelInfo({
                    ...modelInfo,
                    filename: selectedFile.name,
                    type,
                    fileSize: selectedFile.size
                });
            }
            
            router.push(`/model?type=${type}`);
        } catch (error) {
            console.error('Failed to save model:', error);
            setLoading(false);
        }
    };

    const handleSkipInfo = async (basicInfo) => {
        setLoading(true);
        try {
            const type = selectedFile.name.endsWith('.fbx') ? 'fbx' : 'gltf';
            
            await idbSet('lastModelFile', selectedFile);
            await idbSet('lastModelType', type);
            
            if (saveModelInfo) {
                await saveModelInfo({
                    ...basicInfo,
                    filename: selectedFile.name,
                    type,
                    fileSize: selectedFile.size
                });
            }
            
            router.push(`/model?type=${type}`);
        } catch (error) {
            console.error('Failed to save model:', error);
            setLoading(false);
        }
    };

    if (showInfoCollector && selectedFile) {
        return (
            <ModelInfoCollector
                fileName={selectedFile.name}
                fileType={selectedFile.name.endsWith('.fbx') ? 'fbx' : 'gltf'}
                onSubmit={handleModelInfoSubmit}
                onSkip={handleSkipInfo}
                isLoading={loading}
            />
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-16">
                {/* Header */}
                <header className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-primary mb-4">
                        Import Your Model
                    </h1>
                    <p className="text-lg text-secondary max-w-2xl mx-auto">
                        Upload your 3D models and start exploring with advanced visualization tools. 
                        Supports GLB, GLTF, and FBX formats.
                    </p>
                </header>

                {loading ? (
                    <div className="flex justify-center">
                        <div className="card p-8 text-center max-w-md">
                            <div className="flex justify-center mb-6">
                                <div className="loading-spinner">
                                    <svg className="w-12 h-12 text-accent" viewBox="0 0 24 24">
                                        <circle 
                                            cx="12" 
                                            cy="12" 
                                            r="10" 
                                            stroke="currentColor" 
                                            strokeWidth="4" 
                                            fill="none" 
                                            strokeLinecap="round"
                                            strokeDasharray="31.416"
                                            strokeDashoffset="31.416"
                                        >
                                            <animate 
                                                attributeName="stroke-dasharray" 
                                                dur="2s" 
                                                values="0 31.416;15.708 15.708;0 31.416;0 31.416" 
                                                repeatCount="indefinite"
                                            />
                                            <animate 
                                                attributeName="stroke-dashoffset" 
                                                dur="2s" 
                                                values="0;-15.708;-31.416;-31.416" 
                                                repeatCount="indefinite"
                                            />
                                        </circle>
                                    </svg>
                                </div>
                            </div>
                            <h3 className="text-xl font-semibold text-primary mb-2">Processing Model</h3>
                            <p className="text-secondary">
                                Analyzing your 3D model and preparing for visualization...
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto">
                        {/* Main Upload Area */}
                        <div className="card p-8 mb-8">
                            <div 
                                className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="upload-content">
                                    <div className="upload-icon mb-6">
                                        <svg className="w-16 h-16 text-accent mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                        </svg>
                                    </div>
                                    
                                    <h3 className="text-2xl font-bold text-primary mb-4">
                                        Drop your model here
                                    </h3>
                                    
                                    <p className="text-secondary mb-6">
                                        Or click to browse and select your file
                                    </p>
                                    
                                    <div className="btn btn-primary btn-lg cursor-pointer">
                                        Choose File
                                    </div>
                                    
                                    <div className="supported-formats">
                                        <p className="text-sm text-secondary mb-3">Supported formats:</p>
                                        <div className="flex justify-center gap-4">
                                            <span className="format-badge">GLB</span>
                                            <span className="format-badge">GLTF</span>
                                            <span className="format-badge">FBX</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Hidden file input */}
                            <input
                                type="file"
                                accept=".glb,.gltf,.fbx"
                                ref={fileInputRef}
                                onChange={handleInputChange}
                                className="hidden"
                            />
                        </div>

                        {/* Features & Help Bento Grid */}
                        <div className="bento-features-grid mb-12">
                            {/* Main Help Section - Takes up 2 columns */}
                            <div className="bento-help-main card p-8">
                                <h3 className="text-2xl font-bold text-primary mb-6">Getting Started</h3>
                                <div className="help-steps-grid">
                                    <div className="help-step">
                                        <div className="step-number">1</div>
                                        <div className="help-step-content">
                                            <h4>Choose Your Model</h4>
                                            <p>
                                                Select a GLB, GLTF, or FBX file from your device. File size limit is 100MB.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="help-step">
                                        <div className="step-number">2</div>
                                        <div className="help-step-content">
                                            <h4>Add Information</h4>
                                            <p>
                                                Optionally add metadata and description for better organization.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="help-step">
                                        <div className="step-number">3</div>
                                        <div className="help-step-content">
                                            <h4>Start Exploring</h4>
                                            <p>
                                                Use our advanced tools to analyze, dissect, and visualize your 3D model.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="help-step">
                                        <div className="step-number">4</div>
                                        <div className="help-step-content">
                                            <h4>AI Analysis</h4>
                                            <p>
                                                Get intelligent insights and recommendations from Three21Bot AI.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Feature Cards - Vertical stack */}
                            <div className="bento-features-stack">
                                <div className="card p-6 mb-4">
                                    <div className="flex items-start gap-4">
                                        <div className="feature-icon feature-icon-primary">
                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-primary mb-2">Real-time Preview</h4>
                                            <p className="text-sm text-secondary">
                                                Instant visualization with advanced WebGL rendering and lighting effects.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="card p-6 mb-4">
                                    <div className="flex items-start gap-4">
                                        <div className="feature-icon feature-icon-secondary">
                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-primary mb-2">AI Analysis</h4>
                                            <p className="text-sm text-secondary">
                                                Intelligent model analysis and optimization suggestions powered by AI.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="card p-6">
                                    <div className="flex items-start gap-4">
                                        <div className="feature-icon feature-icon-success">
                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-primary mb-2">Secure Upload</h4>
                                            <p className="text-sm text-secondary">
                                                Your models are processed locally and securely with no server uploads.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
