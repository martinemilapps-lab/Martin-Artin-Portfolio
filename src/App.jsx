import React, { useState, useEffect, useRef, useCallback } from 'react';
import { campaignsData } from './data/campaignsData';
import { DynamicBackground } from './components/DynamicBackground';
import { ExhibitionCursor } from './components/ExhibitionCursor';
import { TopHeader } from './components/TopHeader';
import { HeroSequence } from './components/HeroSequence';
import { CampaignViewer } from './components/CampaignViewer';
import { CampaignCounter } from './components/CampaignCounter';
import { CampaignIndex } from './components/CampaignIndex';
import { CampaignInfoOverlay } from './components/CampaignInfoOverlay';

export function App() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [cursorState, setCursorState] = useState({ type: 'default', text: '' });
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [inHero, setInHero] = useState(true);

  const lastWheelTime = useRef(0);
  const touchStartX = useRef(0);
  const totalCampaigns = campaignsData.length;

  // Track mouse movement
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Campaign Navigation helper
  const nextCampaign = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % totalCampaigns);
  }, [totalCampaigns]);

  const prevCampaign = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + totalCampaigns) % totalCampaigns);
  }, [totalCampaigns]);

  // Wheel / Trackpad Gesture Handler
  useEffect(() => {
    if (inHero || isInfoOpen) return;

    const handleWheel = (e) => {
      const now = Date.now();
      if (now - lastWheelTime.current < 650) return; // 650ms cooldown

      if (Math.abs(e.deltaY) > 20 || Math.abs(e.deltaX) > 20) {
        if (e.deltaY > 0 || e.deltaX > 0) {
          nextCampaign();
        } else {
          prevCampaign();
        }
        lastWheelTime.current = now;
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [inHero, isInfoOpen, nextCampaign, prevCampaign]);

  // Keyboard navigation
  useEffect(() => {
    if (inHero || isInfoOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        nextCampaign();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        prevCampaign();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inHero, isInfoOpen, nextCampaign, prevCampaign]);

  // Touch Swipe navigation
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (inHero || isInfoOpen) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        nextCampaign();
      } else {
        prevCampaign();
      }
    }
  };

  // Autoplay Reel timer
  useEffect(() => {
    if (!isAutoplay || inHero || isInfoOpen) return;
    const timer = setInterval(() => {
      nextCampaign();
    }, 5000);
    return () => clearInterval(timer);
  }, [isAutoplay, inHero, isInfoOpen, nextCampaign]);

  return (
    <div 
      class="app-viewport"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Editorial Custom Cursor */}
      <ExhibitionCursor mousePos={mousePos} cursorState={cursorState} />

      {/* Vector Architectural Dynamic Background */}
      <DynamicBackground activeIndex={activeIndex} mousePos={mousePos} />

      {/* Header Bar */}
      <TopHeader onBrandClick={() => setInHero(true)} />

      {/* Hero Title Sequence Intro */}
      {inHero && (
        <HeroSequence onEnterExhibition={() => setInHero(false)} />
      )}

      {/* Main Campaign Exhibition Stage */}
      <main class="exhibition-stage">
        {campaignsData.map((campaign, idx) => (
          <CampaignViewer
            key={campaign.id}
            campaign={campaign}
            isActive={activeIndex === idx}
            onMediaHover={(state) => setCursorState(state)}
            onMediaLeave={() => setCursorState({ type: 'default', text: '' })}
            onMediaClick={() => setIsInfoOpen(true)}
          />
        ))}
      </main>

      {/* Persistent Bottom Controls */}
      {!inHero && (
        <footer class="bottom-controls">
          {/* Vertical Counter & +INFO toggle */}
          <CampaignCounter
            activeIndex={activeIndex}
            totalCount={totalCampaigns}
            onOpenInfo={() => setIsInfoOpen(true)}
          />

          {/* Minimal Numeric Index list */}
          <CampaignIndex
            campaigns={campaignsData}
            activeIndex={activeIndex}
            onSelectCampaign={(idx) => setActiveIndex(idx)}
          />

          {/* Autoplay & Signature Progress Line */}
          <div class="right-controls">
            <button 
              class="autoplay-btn"
              onClick={() => setIsAutoplay(!isAutoplay)}
            >
              {isAutoplay ? '[ PAUSE REEL ]' : '[ PLAY REEL ]'}
            </button>

            <div class="signature-progress-track">
              <div 
                class="signature-progress-fill"
                style={{
                  width: `${((activeIndex + 1) / totalCampaigns) * 100}%`
                }}
              />
            </div>
          </div>
        </footer>
      )}

      {/* Exhibition Info Label Overlay */}
      {isInfoOpen && (
        <CampaignInfoOverlay
          campaign={campaignsData[activeIndex]}
          onClose={() => setIsInfoOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
