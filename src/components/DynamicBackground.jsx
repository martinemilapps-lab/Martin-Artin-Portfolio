import React, { useEffect, useState } from 'react';

export const DynamicBackground = ({ activeIndex, mousePos }) => {
  // Compute subtle parallax offset based on mouse position
  const offsetX = (mousePos.x / (window.innerWidth || 1000) - 0.5) * 16;
  const opacityOffset = (mousePos.y / (window.innerHeight || 1000) - 0.5) * 0.1;

  // Grid orientation changes subtly per active campaign index
  const campaignAngles = [0, 45, -30, 90, 15, -45];
  const activeAngle = campaignAngles[activeIndex % campaignAngles.length] || 0;

  return (
    <div class="dynamic-background-container" aria-hidden="true">
      {/* Horizontal grid guide 1 */}
      <div 
        class="bg-line horizontal" 
        style={{ 
          top: '25%', 
          transform: `translate3d(0, ${offsetX * 0.5}px, 0)`,
          opacity: 0.7 + opacityOffset 
        }} 
      />
      {/* Horizontal grid guide 2 */}
      <div 
        class="bg-line horizontal" 
        style={{ 
          top: '75%', 
          transform: `translate3d(0, ${-offsetX * 0.5}px, 0)`,
          opacity: 0.5 - opacityOffset 
        }} 
      />

      {/* Vertical grid guide 1 */}
      <div 
        class="bg-line vertical" 
        style={{ 
          left: '20%', 
          transform: `translate3d(${offsetX}px, 0, 0)`,
          opacity: 0.6 
        }} 
      />
      {/* Vertical grid guide 2 */}
      <div 
        class="bg-line vertical" 
        style={{ 
          left: '80%', 
          transform: `translate3d(${-offsetX}px, 0, 0)`,
          opacity: 0.6 
        }} 
      />

      {/* Architectural Vector Grid Overlay */}
      <svg 
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          transition: 'transform 1.4s cubic-bezier(0.25, 1, 0.5, 1)',
          transform: `rotate(${activeAngle * 0.05}deg) scale(1.02)`
        }}
      >
        <defs>
          <pattern id="archGrid" width="120" height="120" patternUnits="userSpaceOnUse">
            <path d="M 120 0 L 0 0 0 120" fill="none" stroke="rgba(14, 14, 14, 0.035)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#archGrid)" />
        
        {/* Perimeter Axis Crosshairs */}
        <circle cx="20%" cy="25%" r="3" fill="none" stroke="rgba(200, 42, 30, 0.3)" strokeWidth="1" />
        <circle cx="80%" cy="75%" r="3" fill="none" stroke="rgba(200, 42, 30, 0.3)" strokeWidth="1" />
        
        <line x1="20%" y1="23%" x2="20%" y2="27%" stroke="rgba(200, 42, 30, 0.3)" strokeWidth="1" />
        <line x1="18%" y1="25%" x2="22%" y2="25%" stroke="rgba(200, 42, 30, 0.3)" strokeWidth="1" />
      </svg>
    </div>
  );
};
