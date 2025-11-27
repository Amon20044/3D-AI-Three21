'use client';

import React from 'react';

const BentoGrid = ({ children, className = '' }) => {
    return (
        <div className={`bento-grid ${className}`}>
            {children}
            <style jsx>{`
        .bento-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          width: 100%;
          max-width: 80rem; /* max-w-7xl */
          margin-left: auto;
          margin-right: auto;
          padding-left: 1rem;
          padding-right: 1rem;
          grid-auto-rows: minmax(180px, auto);
        }

        @media (min-width: 640px) {
          .bento-grid {
            padding-left: 1.5rem;
            padding-right: 1.5rem;
          }
        }

        @media (min-width: 768px) {
          .bento-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1024px) {
          .bento-grid {
            grid-template-columns: repeat(4, 1fr);
            padding-left: 2rem;
            padding-right: 2rem;
          }
        }
      `}</style>
        </div>
    );
};

export default BentoGrid;
