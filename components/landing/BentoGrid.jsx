'use client';

import React from 'react';
import './bento.css'
const BentoGrid = ({ children, className = '' }) => {
  return (
    <div className={`bento-grid ${className}`}>
      {children}
    </div>
  );
};

export default BentoGrid;
