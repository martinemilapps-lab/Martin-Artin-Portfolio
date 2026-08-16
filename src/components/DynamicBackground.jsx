import React, { useEffect, useRef } from 'react';

export const DynamicBackground = ({ activeIndex, mousePos }) => {
  const canvasRef = useRef(null);

  // Compute subtle parallax offset based on mouse position
  const offsetX = (mousePos.x / (window.innerWidth || 1000) - 0.5) * 20;
  const offsetY = (mousePos.y / (window.innerHeight || 1000) - 0.5) * 20;
  const opacityOffset = (mousePos.y / (window.innerHeight || 1000) - 0.5) * 0.1;

  // Grid orientation changes subtly per active campaign index
  const campaignAngles = [0, 45, -30, 90, 15, -45];
  const activeAngle = campaignAngles[activeIndex % campaignAngles.length] || 0;

  // Canvas floating light motes / ambient dust particles loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Create elegant light particles
    const particleCount = 35;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 0.8,
      speedX: (Math.random() - 0.5) * 0.35,
      speedY: (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.45 + 0.15,
      pulseSpeed: Math.random() * 0.015 + 0.005,
      pulseFactor: 0,
      isAccent: Math.random() < 0.12, // subtle crimson accent light particle
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p, i) => {
        // Move particle
        p.x += p.speedX;
        p.y += p.speedY;

        // Wrap around boundaries
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        p.pulseFactor += p.pulseSpeed;
        const currentAlpha = p.alpha + Math.sin(p.pulseFactor) * 0.15;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        if (p.isAccent) {
          ctx.fillStyle = `rgba(200, 42, 30, ${Math.max(0.05, currentAlpha * 0.4)})`;
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, currentAlpha * 0.95)})`;
        }
        ctx.shadowColor = p.isAccent ? 'rgba(200, 42, 30, 0.3)' : 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = p.radius * 3;
        ctx.fill();

        // Draw elegant light connecting hairlines between nearby motes
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const lineAlpha = (1 - dist / 130) * 0.12;
            ctx.strokeStyle = `rgba(14, 14, 14, ${lineAlpha})`;
            ctx.lineWidth = 0.6;
            ctx.shadowBlur = 0;
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="dynamic-background-container" aria-hidden="true">
      {/* Animated Floating Light Orbs */}
      <div className="light-orb orb-1" style={{ transform: `translate3d(${offsetX * 0.8}px, ${offsetY * 0.8}px, 0)` }} />
      <div className="light-orb orb-2" style={{ transform: `translate3d(${-offsetX * 0.6}px, ${-offsetY * 0.6}px, 0)` }} />
      <div className="light-orb orb-3" style={{ transform: `translate3d(${offsetX * 0.4}px, ${-offsetY * 0.4}px, 0)` }} />

      {/* Moving Light Beams / Shimmer */}
      <div className="light-beam beam-1" />
      <div className="light-beam beam-2" />

      {/* Canvas Particle Layer for subtle light motes */}
      <canvas ref={canvasRef} className="particles-canvas" />

      {/* Horizontal grid guide 1 */}
      <div 
        className="bg-line horizontal" 
        style={{ 
          top: '25%', 
          transform: `translate3d(0, ${offsetY * 0.5}px, 0)`,
          opacity: 0.7 + opacityOffset 
        }} 
      />
      {/* Horizontal grid guide 2 */}
      <div 
        className="bg-line horizontal" 
        style={{ 
          top: '75%', 
          transform: `translate3d(0, ${-offsetY * 0.5}px, 0)`,
          opacity: 0.5 - opacityOffset 
        }} 
      />

      {/* Vertical grid guide 1 */}
      <div 
        className="bg-line vertical" 
        style={{ 
          left: '20%', 
          transform: `translate3d(${offsetX}px, 0, 0)`,
          opacity: 0.6 
        }} 
      />
      {/* Vertical grid guide 2 */}
      <div 
        className="bg-line vertical" 
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

