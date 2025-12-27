'use client';

import Link from 'next/link';
import Header from '../components/Header';
import { Home, Search } from 'react-feather';

export default function NotFound() {
  return (
    <div className="not-found-page">
      <Header />
      
      <div className="not-found-content">
        <div className="error-code">404</div>
        <h1 className="error-title">Page Not Found</h1>
        <p className="error-description">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="error-actions">
          <Link href="/" className="error-btn primary">
            <Home size={18} />
            Go Home
          </Link>
          <Link href="/find-models" className="error-btn secondary">
            <Search size={18} />
            Find Models
          </Link>
        </div>
      </div>

      <style jsx>{`
        .not-found-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
          display: flex;
          flex-direction: column;
        }

        .not-found-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem;
          padding-top: 6rem;
        }

        .error-code {
          font-size: 8rem;
          font-weight: 900;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1;
          margin-bottom: 1rem;
        }

        .error-title {
          font-size: 2rem;
          font-weight: 700;
          color: white;
          margin-bottom: 0.75rem;
        }

        .error-description {
          font-size: 1.1rem;
          color: rgba(255, 255, 255, 0.6);
          max-width: 400px;
          margin-bottom: 2rem;
        }

        .error-actions {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          justify-content: center;
        }

        .error-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 1.5rem;
          border-radius: 0.75rem;
          font-weight: 600;
          font-size: 1rem;
          text-decoration: none;
          transition: all 0.3s;
        }

        .error-btn.primary {
          background: #3b82f6;
          color: white;
          box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
        }

        .error-btn.primary:hover {
          background: #2563eb;
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(59, 130, 246, 0.5);
        }

        .error-btn.secondary {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .error-btn.secondary:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }

        @media (max-width: 480px) {
          .error-code {
            font-size: 5rem;
          }

          .error-title {
            font-size: 1.5rem;
          }

          .error-description {
            font-size: 1rem;
          }

          .error-actions {
            flex-direction: column;
            width: 100%;
          }

          .error-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
