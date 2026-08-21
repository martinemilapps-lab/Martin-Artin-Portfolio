import React, { useEffect, useRef } from 'react';

export const DynamicBackground = ({ activeIndex, mousePos }) => {
  const canvasRef = useRef(null);

  // Compute dynamic parallax offset based on mouse position
  const offsetX = (mousePos.x / (window.innerWidth || 1000) - 0.5) * 45;
  const offsetY = (mousePos.y / (window.innerHeight || 1000) - 0.5) * 45;
  const opacityOffset = (mousePos.y / (window.innerHeight || 1000) - 0.5) * 0.15;

  // Grid orientation changes subtly per active campaign index
  const campaignAngles = [0, 45, -30, 90, 15, -45];
  const activeAngle = campaignAngles[activeIndex % campaignAngles.length] || 0;

  // Canvas floating light motes & constellation network
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

    // Create high-clarity floating light particles
    const particleCount = 55;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 3.5 + 1.8,
      speedX: (Math.random() - 0.5) * 0.85,
      speedY: (Math.random() - 0.5) * 0.85,
      alpha: Math.random() * 0.5 + 0.3,
      pulseSpeed: Math.random() * 0.03 + 0.01,
      pulseFactor: Math.random() * Math.PI * 2,
      isAccent: Math.random() < 0.2, // Crimson accent light motes
      isBrightNode: Math.random() < 0.25, // Glowing halo nodes
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p, i) => {
        // Move particle
        p.x += p.speedX;
        p.y += p.speedY;

        // Wrap around canvas boundaries smoothly
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        p.pulseFactor += p.pulseSpeed;
        const currentAlpha = p.alpha + Math.sin(p.pulseFactor) * 0.25;
        const effectiveAlpha = Math.max(0.15, Math.min(0.95, currentAlpha));

        // Draw particle node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

        if (p.isAccent) {
          ctx.fillStyle = `rgba(229, 57, 53, ${effectiveAlpha * 0.9})`;
          ctx.shadowColor = 'rgba(229, 57, 53, 0.6)';
        } else {
          ctx.fillStyle = `rgba(24, 24, 27, ${effectiveAlpha * 0.65})`;
          ctx.shadowColor = 'rgba(24, 24, 27, 0.35)';
        }

        ctx.shadowBlur = p.radius * 3;
        ctx.fill();

        // Draw glowing halo around key nodes for high clarity
        if (p.isBrightNode) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 2.8, 0, Math.PI * 2);
          ctx.fillStyle = p.isAccent 
            ? `rgba(229, 57, 53, ${effectiveAlpha * 0.2})`
            : `rgba(24, 24, 27, ${effectiveAlpha * 0.12})`;
          ctx.shadowBlur = 0;
          ctx.fill();
        }

        // Draw crisp connecting hairlines between nearby motes
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 170) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const lineAlpha = (1 - dist / 170) * 0.28;
            ctx.strokeStyle = p.isAccent || p2.isAccent 
              ? `rgba(229, 57, 53, ${lineAlpha * 0.75})` 
              : `rgba(24, 24, 27, ${lineAlpha * 0.22})`;
            ctx.lineWidth = 1.0;
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
      {/* High-Clarity Floating Light Orbs */}
      <div className="light-orb orb-1" style={{ transform: `translate3d(${offsetX * 1.2}px, ${offsetY * 1.2}px, 0)` }} />
      <div className="light-orb orb-2" style={{ transform: `translate3d(${-offsetX * 0.9}px, ${-offsetY * 0.9}px, 0)` }} />
      <div className="light-orb orb-3" style={{ transform: `translate3d(${offsetX * 0.7}px, ${-offsetY * 0.7}px, 0)` }} />
      <div className="light-orb orb-4" style={{ transform: `translate3d(${-offsetX * 1.1}px, ${offsetY * 1.1}px, 0)` }} />

      {/* Dynamic Sweeping Light Beams */}
      <div className="light-beam beam-1" />
      <div className="light-beam beam-2" />
      <div className="light-beam beam-3" />

      {/* Canvas Constellation & Light Particle Layer */}
      <canvas ref={canvasRef} className="particles-canvas" />

      {/* Dynamic Grid Guide Lines */}
      <div 
        className="bg-line horizontal" 
        style={{ 
          top: '25%', 
          transform: `translate3d(0, ${offsetY * 0.7}px, 0)`,
          opacity: 0.85 + opacityOffset 
        }} 
      />
      <div 
        className="bg-line horizontal" 
        style={{ 
          top: '75%', 
          transform: `translate3d(0, ${-offsetY * 0.7}px, 0)`,
          opacity: 0.75 - opacityOffset 
        }} 
      />

      <div 
        className="bg-line vertical" 
        style={{ 
          left: '20%', 
          transform: `translate3d(${offsetX * 1.2}px, 0, 0)`,
          opacity: 0.8 
        }} 
      />
      <div 
        className="bg-line vertical" 
        style={{ 
          left: '80%', 
          transform: `translate3d(${-offsetX * 1.2}px, 0, 0)`,
          opacity: 0.8 
        }} 
      />

      {/* Architectural Vector Grid & Kinetic Crosshairs */}
      <svg 
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          transition: 'transform 1.2s cubic-bezier(0.25, 1, 0.5, 1)',
          transform: `rotate(${activeAngle * 0.08}deg) scale(1.04)`
        }}
      >
        <defs>
          <pattern id="archGrid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(0, 0, 0, 0.05)" strokeWidth="1.2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#archGrid)" />
        
        {/* Animated Perimeter Axis Crosshairs */}
        <g className="pulsing-crosshair">
          <circle cx="20%" cy="25%" r="4" fill="none" stroke="rgba(229, 57, 53, 0.8)" strokeWidth="1.5" />
          <line x1="20%" y1="22%" x2="20%" y2="28%" stroke="rgba(229, 57, 53, 0.8)" strokeWidth="1.5" />
          <line x1="17%" y1="25%" x2="23%" y2="25%" stroke="rgba(229, 57, 53, 0.8)" strokeWidth="1.5" />
        </g>

        <g className="pulsing-crosshair-alt">
          <circle cx="80%" cy="75%" r="4" fill="none" stroke="rgba(229, 57, 53, 0.8)" strokeWidth="1.5" />
          <line x1="80%" y1="72%" x2="80%" y2="78%" stroke="rgba(229, 57, 53, 0.8)" strokeWidth="1.5" />
          <line x1="77%" y1="75%" x2="83%" y2="75%" stroke="rgba(229, 57, 53, 0.8)" strokeWidth="1.5" />
        </g>
      </svg>
    </div>
  );
};


