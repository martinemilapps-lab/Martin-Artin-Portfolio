import React, { useEffect, useState } from 'react';

export const HeroSequence = ({ onEnterExhibition }) => {
  const [phase, setPhase] = useState(0); // 0: Name, 1: Subtitle, 2: Shifting out
  const [exited, setExited] = useState(false);

  useEffect(() => {
    // Step 1: Reveal Subtitle after 800ms
    const t1 = setTimeout(() => {
      setPhase(1);
    }, 800);

    // Step 2: Begin title sequence shift after 2400ms
    const t2 = setTimeout(() => {
      setPhase(2);
    }, 2400);

    // Step 3: Complete transition into Campaign 01 after 3600ms
    const t3 = setTimeout(() => {
      setExited(true);
      onEnterExhibition();
    }, 3600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onEnterExhibition]);

  if (exited) return null;

  return (
    <div className={`hero-sequence ${phase === 2 ? 'exit-sequence' : ''}`}>
      <div 
        style={{
          transition: 'transform 1s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.8s ease',
          transform: phase === 2 ? 'translate3d(-10vw, 0, 0)' : 'translate3d(0, 0, 0)',
        }}
      >
        <h1 className="hero-title">
          MARTIN EMIL ARTEEN
        </h1>

        <div className="hero-subtitle-bar">
          <span 
            className="hero-subtitle"
            style={{
              opacity: phase >= 1 ? 1 : 0,
              transform: phase >= 1 ? 'translateY(0)' : 'translateY(10px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            ART / CREATIVE DIRECTOR
          </span>
        </div>
      </div>

      <button 
        className="hero-trigger-btn"
        onClick={() => {
          setPhase(2);
          setTimeout(() => {
            setExited(true);
            onEnterExhibition();
          }, 800);
        }}
      >
        ENTER EXHIBITION — AD CAMPAIGNS
      </button>
    </div>
  );
};
