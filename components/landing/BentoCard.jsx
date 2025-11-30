'use client';
import './bento.css'
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
    </div>
  );

  if (href) {
    return (
      <a href={href} onClick={onClick} className="bento-card-link">
        <CardContent />

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
