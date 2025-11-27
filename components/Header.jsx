'use client';
import { useLingoLocale, setLingoLocale } from "lingo.dev/react/client";
import BrandIcon from "./icons/BrandIcon";
export default function Header() {
  const currentLocale = useLingoLocale();
  return (
    <header className="site-header">
      <div className="header-content">
        <div className="logo">
          <div className="logo-icon">
            <BrandIcon />
          </div>
          {/* <span className="logo-subtitle">Where 3D Meets Intelligence</span> */}
        </div>

        <select
          className="language-select"
          value={currentLocale}
          onChange={(e) => setLingoLocale(e.target.value)}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="de">Deutsch</option>
          <option value="fr">Français</option>
          <option value="hi">हिन्दी</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
          <option value="pt">Português</option>
          <option value="ru">Русский</option>
          <option value="zh">中文</option>
          <option value="ar">العربية</option>
          <option value="bn">বাংলা</option>
          <option value="id">Bahasa Indonesia</option>
          <option value="it">Italiano</option>
          <option value="th">ไทย</option>
          <option value="vi">Tiếng Việt</option>
        </select>
      </div>

      <style jsx>{`

      .language-select {
  background: #2b2b2b;            /* dark grey */
  color: #e5e5e5;                 /* light grey text */
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #3d3d3d;      /* subtle border */
  font-size: 15px;
  outline: none;
  cursor: pointer;
  appearance: none;               /* hides default arrow */
  width: 160px;

  /* internal shadow */
  box-shadow: inset 0 0 0 1px #3c3c3c;
}

/* Hover */
.language-select:hover {
  background: #343434;
}

/* Focus */
.language-select:focus {
  border-color: #6d6d6d;
  box-shadow:
    0 0 0 2px rgba(180, 180, 180, 0.25),
    inset 0 0 0 1px #6d6d6d;
}

/* Dropdown items */
.language-select option {
  background: #2d2d2d;
  color: #e5e5e5;
  border-radius: 8px;
}

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

        .locale-switcher {
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 10px;
          padding: 0.6rem 2.75rem 0.6rem 1.1rem;
          color: white;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='white' d='M1.41 0L6 4.58 10.59 0 12 1.41l-6 6-6-6z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.85rem center;
          background-size: 11px 7px;
          min-width: 160px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .locale-switcher:hover {
          background-color: rgba(255, 255, 255, 0.18);
          border-color: rgba(255, 255, 255, 0.35);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
          transform: translateY(-2px);
        }

        .locale-switcher:focus {
          background-color: rgba(255, 255, 255, 0.2);
          border-color: rgba(102, 126, 234, 0.7);
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.25), 0 4px 16px rgba(102, 126, 234, 0.3);
        }

        .locale-switcher option {
          background: #1a1a2e;
          color: white;
          padding: 0.75rem 1rem;
          font-weight: 500;
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
