'use client';
import './home.css'
import Link from "next/link";
import { Suspense, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Upload,
  Smile,
  ArrowRight,
  Zap,
  Eye,
  Image,
  Loader,
  Box,
  Layers,
  Cpu
} from 'react-feather';
import BentoGrid from '../components/landing/BentoGrid';
import BentoCard from '../components/landing/BentoCard';
import BrandIcon from '../components/icons/BrandIcon';
import Header from '../components/Header';

// Dynamic import for the embedded demo viewer
const EmbeddedDemoViewer = dynamic(() => import('../components/EmbeddedDemoViewer'), {
  ssr: false,
  loading: () => (
    <div className="demo-loading-placeholder">
      <div className="loading-spinner">
        <Loader className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    </div>
  )
});

export default function Home() {
  const [isAssembled, setIsAssembled] = useState(true);

  useEffect(() => {
    // Load Vanta.js scripts
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

    // Add Three.js script
    const threeScript = document.createElement('script');
    threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';
    threeScript.onload = () => {
      // Add Vanta fog script after Three.js loads
      const vantaScript = document.createElement('script');
      vantaScript.src = 'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js';
      vantaScript.onload = loadVanta;
      document.head.appendChild(vantaScript);
    };
    document.head.appendChild(threeScript);
  }, []);

  return (
    <div className="page-container">
      {/* Vanta Fog Background */}
      <div id="vanta-bg" className="vanta-bg"></div>

      {/* Header */}
      <Header />

      {/* Content Overlay */}
      <div className="content-overlay">

        {/* Header Section */}
        <div className="header-section">
          <h1 className="main-title">
            <div className="title-icon"><BrandIcon /></div> Three21
          </h1>
          <p className="main-subtitle">
            Advanced 3D model visualization and analysis platform.
          </p>
        </div>

        {/* Bento Grid Layout */}
        <BentoGrid>

          {/* 1. Main CTA - Large Card (Left Column, Spans 3 Rows) */}
          <BentoCard
            title="Start Your Journey"
            icon={Upload}
            description="Begin by uploading your 3D model. We support GLB, GLTF, FBX, and more, instantly preparing them for deep analysis."
            className="card-cta"
          >
            <div className="cta-buttons">
              <Link href="/import-model" className="cta-link">
                <button className="btn-primary">
                  <Upload size={20} />
                  <span>Upload Model</span>
                  <ArrowRight size={20} />
                </button>
              </Link>
              <Link href="/model?type=demo" className="cta-link">
                <button className="btn-secondary">
                  <Smile size={20} />
                  <span>Try Demo</span>
                </button>
              </Link>
            </div>
          </BentoCard>

          {/* 2. Demo Viewer - Large Card (Right Column, Spans 2 Rows) */}
          <div className="card-demo-wrapper">
            <div className="demo-badge">
              <div className="badge-content">
                <Box size={16} className="badge-icon" />
                <span className="badge-text">Interactive Demo</span>
              </div>
            </div>
            <div className="demo-container">
              <Suspense fallback={
                <div className="demo-loading">
                  <Loader className="spinner" />
                </div>
              }>
                <EmbeddedDemoViewer
                  isAssembled={isAssembled}
                  onAssembleChange={setIsAssembled}
                />
              </Suspense>
            </div>
          </div>

          {/* 3. Tagline Block (Right Column, Under Demo, Spans 1 Row) */}
          <div className="card-tagline">
            <div className="tagline-bg-icon"><BrandIcon /></div>
            <h2 className="tagline-text">Where 3D meets Intelligence</h2>
          </div>

          {/* 4. Feature: Visualization */}
          <BentoCard
            title="Crystal Clear Visualization"
            icon={Zap}
            description="Experience your models in high-fidelity. Our advanced rendering engine reveals every detail, texture, and nuance."
            className="card-feature"
          />

          {/* 5. Feature: Dissection */}
          <BentoCard
            title="Reverse Engineering"
            icon={Layers}
            description="Break it down. Disassemble models layer by layer to understand their internal structure and assembly."
            className="card-feature"
          />

          {/* 6. Feature: Insights */}
          <BentoCard
            title="Intelligent Insights"
            icon={Cpu}
            description="Learn with Gemini 2.5 Flash and observe. AI-powered analysis provides deep insights into geometry, materials, and optimization."
            className="card-feature"
          />

          {/* 7. Feature: Compatibility */}
          <BentoCard
            title="Universal Compatibility"
            icon={Image}
            description="Seamlessly work with industry-standard formats. From CAD to game assets, we handle it all."
            className="card-feature"
          />

        </BentoGrid>
        {/* 8. Stats Card - Wide */}
        <div className="card-feature-bottom">
          <div className="stat-item">
            <div className="stat-number text-white">2+</div>
            <div className="stat-label">Formats</div>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <div className="stat-number text-blue">Real-time</div>
            <div className="stat-label">Rendering</div>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <div className="stat-number text-green">AI</div>
            <div className="stat-label">Analysis</div>
          </div>
        </div>
        {/* Footer */}
        <footer className="footer">
          <p>Built with love by Avni & Amon with Three.js, Next.js, WebGPU and WebGL</p>
        </footer>

      </div>
    </div>
  );
}
