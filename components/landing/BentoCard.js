'use client';

import React from 'react';

const BentoCard = ({
    title,
    icon: Icon,
    description,
    className = '',
    children,
    onClick,
    href
}) => {
    const CardContent = () => (
        <div className={`bento-card ${className}`}>
            {/* Background Gradient Effect */}
            <div className="card-gradient" />

            {/* Background Icon (Left Half) */}
            {Icon && (
                <div className="card-bg-icon">
                    <Icon />
                </div>
            )}

            {/* Content Container */}
            <div className="card-content">
                {/* Header: Icon & Title */}
                <div className="card-header">
                    {Icon && (
                        <div className="card-icon">
                            <Icon size={24} />
                        </div>
                    )}

                    <h3 className="card-title">
                        {title}
                    </h3>
                </div>

                {/* Description */}
                {description && (
                    <div className="card-description-wrapper">
                        <p className="card-description">
                            {description}
                        </p>
                    </div>
                )}

                {/* Custom Children */}
                {children && (
                    <div className="card-children">
                        {children}
                    </div>
                )}
            </div>

            {/* Decorative Corner */}
            <div className="card-decoration" />

            <style jsx>{`
        .bento-card {
          position: relative;
          overflow: hidden;
          background-color: rgba(0, 0, 0, 0.4); /* Transparent background */
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          height: 100%;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px); /* Glassmorphism effect */
        }

        .bento-card:hover {
          border-color: rgba(255, 255, 255, 0.2);
          background-color: rgba(0, 0, 0, 0.6);
        }

        .card-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom right, rgba(59, 130, 246, 0.05), rgba(168, 85, 247, 0.05));
          opacity: 0;
          transition: opacity 0.5s ease;
        }

        .bento-card:hover .card-gradient {
          opacity: 1;
        }

        .card-bg-icon {
            position: absolute;
            top: 50%;
            left: 0;
            transform: translateY(-50%) translateX(-20%);
            width: 70%;
            height: 100%;
            opacity: 0.03;
            pointer-events: none;
            z-index: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }

        .card-bg-icon :global(svg) {
            width: 100%;
            height: 100%;
        }

        .card-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .card-header {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .card-icon {
          width: 3rem;
          height: 3rem;
          border-radius: 1rem;
          background-color: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.8);
          transition: all 0.3s ease;
          transform-origin: left;
        }

        .bento-card:hover .card-icon {
          color: white;
          background-color: rgba(59, 130, 246, 0.2);
          transform: scale(1.1);
        }

        .card-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: white;
          letter-spacing: -0.025em;
          transition: transform 0.3s ease;
          margin: 0;
        }

        .bento-card:hover .card-title {
          transform: translateX(4px);
        }

        .card-description-wrapper {
          margin-top: auto;
        }

        .card-description {
          color: #9ca3af;
          line-height: 1.625;
          font-size: 0.875rem;
          /* Removed hover reveal styles */
          margin: 0;
        }

        .card-children {
          flex-grow: 1;
          margin-top: 1rem;
        }

        .card-decoration {
          position: absolute;
          top: 1rem;
          right: 1rem;
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 9999px;
          background-color: rgba(255, 255, 255, 0.1);
          transition: background-color 0.3s ease;
        }

        .bento-card:hover .card-decoration {
          background-color: rgba(59, 130, 246, 0.5);
        }
      `}</style>
        </div>
    );

    if (href) {
        return (
            <a href={href} onClick={onClick} className="bento-card-link">
                <CardContent />
                <style jsx>{`
          .bento-card-link {
            display: block;
            height: 100%;
            outline: none;
            border-radius: 1.5rem;
          }
          .bento-card-link:focus-visible {
            box-shadow: 0 0 0 2px #3b82f6;
          }
        `}</style>
            </a>
        );
    }

    return (
        <div onClick={onClick} className={onClick ? 'cursor-pointer h-full' : 'h-full'}>
            <CardContent />
        </div>
    );
};

export default BentoCard;
