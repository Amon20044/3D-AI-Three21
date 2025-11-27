'use client';
import { LocaleSwitcher } from "lingo.dev/react/client";
import BrandIcon from "./icons/BrandIcon";
export default function Header() {
  return (
    <header className="site-header">
      <div className="header-content">
        <div className="logo">
          <div className="logo-icon">
            <BrandIcon />
          </div>
          <span className="logo-subtitle">Where 3D Meets Intelligence</span>
        </div>

        <nav className="header-nav">
          <a href="#features">Features</a>
          <a href="#demo">Demo</a>
          <a href="#about">About</a>
        </nav>

        <div className="header-actions">
          <LocaleSwitcher
            locales={["en", "es", "fr", "de"]}
            className="locale-switcher"
          />
        </div>
      </div>

      <style jsx>{`
      .logo-icon{
      display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.1em;        
          height: 1.1em;
          margin-right: 0.2em;
          vertical-align: middle;
          color: white;
      }
        .site-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          background: rgba(10, 10, 10, 0.8);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .header-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 2rem;
        }

        .logo {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .logo-text {
          font-size: 1.25rem;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .logo-subtitle {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .header-nav {
          display: flex;
          gap: 2rem;
        }

        .header-nav a {
          color: rgba(255, 255, 255, 0.8);
          text-decoration: none;
          font-size: 0.9rem;
          transition: color 0.2s;
        }

        .header-nav a:hover {
          color: white;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        :global(.locale-switcher) {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 0.5rem 1rem;
          color: white;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        :global(.locale-switcher:hover) {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
        }

        @media (max-width: 768px) {
          .header-content {
            padding: 0.75rem 1rem;
          }

          .logo-text {
            font-size: 1rem;
          }

          .logo-subtitle {
            display: none;
          }

          .header-nav {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
