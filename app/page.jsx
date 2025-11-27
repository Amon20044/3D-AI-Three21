'use client';

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
      <style jsx>{`
        .demo-loading-placeholder {
          width: 100%;
          height: 100%;
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: rgba(255, 255, 255, 0.05);
          border-radius: 1rem;
        }
      `}</style>
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

          {/* 8. Stats Card - Wide */}
          <div className="card-feature">
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

        </BentoGrid>

        {/* Footer */}
        <footer className="footer">
          <p>Built with love by Avni & Amon with Three.js, Next.js, WebGPU and WebGL</p>
        </footer>

      </div>

      <style jsx>{`
        .page-container {
          min-height: 100vh;
          background-color: #050505;
          color: white;
          position: relative;
        }

        .vanta-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          opacity: 0.4;
          pointer-events: none;
        }

        .content-overlay {
          position: relative;
          z-index: 10;
          padding-top: 3rem;
          padding-bottom: 3rem;
        }

        @media (min-width: 768px) {
          .content-overlay {
            padding-top: 5rem;
            padding-bottom: 5rem;
          }
        }

        .header-section {
          width: 100%;
          max-width: 80rem;
          margin: 0 auto 4rem auto;
          padding: 0 1rem;
          text-align: center;
        }

        .btn-demo:focus-visible {
          outline: 2px solid var(--ring);
          outline-offset: 2px;
        }

        .main-title {
          font-size: 3rem;
          font-weight: 900;
          letter-spacing: -0.05em;
          margin-bottom: 1.5rem;
          background: linear-gradient(to bottom, #ffffff, rgba(255, 255, 255, 0.6));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        @media (min-width: 768px) {
          .main-title {
            font-size: 4.5rem;
          }
        }

        .main-subtitle {
          font-size: 1.25rem;
          color: #9ca3af;
          max-width: 42rem;
          margin: 0 auto;
          font-weight: 500;
          line-height: 1.625;
        }

        @media (min-width: 768px) {
          .main-subtitle {
            font-size: 1.5rem;
          }
        }

        /* Card Specific Styles */
        :global(.card-cta) {
          background-color: rgba(37, 99, 235, 0.1) !important;
          border-color: rgba(59, 130, 246, 0.2) !important;
        }

        @media (min-width: 768px) {
          :global(.card-cta) {
            grid-column: span 4;
            grid-row: span 4;
          }
        }

        .cta-buttons {
          margin-top: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        @media (min-width: 640px) {
          .cta-buttons {
            flex-direction: column;
          }
        }

        .cta-link {
          flex: 1;
        }

        .btn-primary {
          width: 100%;
          height: 3.5rem;
          background-color: #2563eb;
          color: white;
          font-weight: 700;
          border-radius: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
          border: none;
          cursor: pointer;
        }

        .btn-primary:hover {
          background-color: #3b82f6;
          transform: scale(1.02);
        }

        .btn-primary:active {
          transform: scale(0.98);
        }

        .btn-secondary {
          width: 100%;
          height: 3.5rem;
          background-color: rgba(255, 255, 255, 0.05);
          color: white;
          font-weight: 600;
          border-radius: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
          border: 1px solid rgba(255, 255, 255, 0.1);
          cursor: pointer;
        }

        .btn-secondary:hover {
          background-color: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }

        /* Demo Card Styles */
        .card-demo-wrapper {
          position: relative;
          overflow: hidden;
          background-color: #111;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          padding: 0.25rem;
          display: flex;
          flex-direction: column;
        }

        @media (min-width: 768px) {
          .card-demo-wrapper {
            grid-column: span 2;
            grid-row: span 1;
          }
        }

        .demo-badge {
          position: absolute;
          top: 1.5rem;
          left: 1.5rem;
          z-index: 20;
          pointer-events: none;
        }

        .badge-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background-color: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(12px);
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        :global(.badge-icon) {
          color: #60a5fa;
        }

        .badge-text {
          font-size: 0.875rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.9);
        }

        .demo-container {
          width: 100%;
          height: 100%;
          border-radius: 1.25rem;
          overflow: hidden;
          background-color: rgba(0, 0, 0, 0.2);
          min-height: 300px;
        }

        .demo-loading {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        :global(.spinner) {
          width: 2rem;
          height: 2rem;
          color: #3b82f6;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Tagline Card */
        .card-tagline {
          background-color: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          padding: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          backdrop-filter: blur(10px);
        }

        @media (min-width: 768px) {
          .card-tagline {
            grid-column: span 1;
            grid-row: span 1; /* Explicitly span 1 row */
          }
        }

        .tagline-text {
          font-size: 3rem;
          font-weight: 800;
          background: linear-gradient(to right, #ffffffff, #91aad0ff);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          line-height: 1.2;
        }

        /* Feature Cards */
        @media (min-width: 768px) {
          :global(.card-feature) {
            grid-column: span 1;
          }
        }

        .content-overlay {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          padding: 5rem 1rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* Stats Card */
        .card-stats {
          background-color: #111;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-around;
          gap: 2rem;
        }

        @media (min-width: 768px) {
          .card-stats {
            grid-column: span 4;
            flex-direction: row;
          }
        }

        .stat-item {
          text-align: center;
        }

        .stat-number {
          font-size: 2.25rem;
          font-weight: 900;
          margin-bottom: 0.25rem;
        }

        .text-white { color: white; }
        .text-blue { color: #3b82f6; }
        .text-green { color: #22c55e; }

        .stat-label {
          font-size: 0.875rem;
          color: #6b7280;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-divider {
          width: 100%;
          height: 1px;
          background-color: rgba(255, 255, 255, 0.1);
          display: block;
        }

        @media (min-width: 768px) {
          .stat-divider {
            width: 1px;
            height: 3rem;
            display: block;
          }
        }

        .footer {
          margin-top: 5rem;
          text-align: center;
          color: #4b5563;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .title-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.1em;        
          height: 1.1em;
          margin-right: 0.2em;
          vertical-align: middle;
          color: white;
        }
        
        .title-icon :global(svg) {
          width: 100%;
          height: 100%;
          fill: linear-gradient(to bottom, #ffffff, rgba(255, 255, 255, 0.6));
        }

        .card-tagline {
          position: relative;
          overflow: hidden;
        }

        .tagline-bg-icon {
          position: absolute;
          top: 50%;
          left: 0;
          transform: translateY(-50%) translateX(-20%);
          width: 60%;
          height: 120%;
          opacity: 0.05;
          pointer-events: none;
          z-index: 0;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tagline-bg-icon :global(svg) {
          width: 100%;
          height: 100%;
        }
        
        .tagline-text {
          position: relative;
          z-index: 10;
        }
      `}</style>
    </div>
  );
}
