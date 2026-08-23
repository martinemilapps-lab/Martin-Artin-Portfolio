import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { loadCampaigns, saveCampaigns, syncCampaignsFromTurso } from './utils/projectStorage';
import { DynamicBackground } from './components/DynamicBackground';
import { ExhibitionCursor } from './components/ExhibitionCursor';
import { TopHeader } from './components/TopHeader';
import { HeroSequence } from './components/HeroSequence';
import { CampaignViewer } from './components/CampaignViewer';
import { CampaignCounter } from './components/CampaignCounter';
import { CampaignIndex } from './components/CampaignIndex';
import { CampaignInfoOverlay } from './components/CampaignInfoOverlay';
import { ToastNotification } from './components/ToastNotification';

// Dynamically lazy-load Admin Portal so all admin code is completely hidden from public inspection
const AdminPortal = lazy(() => import('./components/admin/AdminPortal'));

function checkIsAdminRoute() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);
  return path.startsWith('/admin') || searchParams.has('admin');
}

export function App() {
  const [isAdminRoute, setIsAdminRoute] = useState(() => checkIsAdminRoute());
  const [campaigns, setCampaigns] = useState(() => loadCampaigns());
  const [activeIndex, setActiveIndex] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [cursorState, setCursorState] = useState({ type: 'default', text: '' });
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [inHero, setInHero] = useState(true);
  const [toast, setToast] = useState(null);

  const lastWheelTime = useRef(0);
  const touchStartX = useRef(0);
  const totalCampaigns = campaigns.length;

  // Show Toast Helper
  const showToast = useCallback((toastData) => {
    setToast(toastData);
  }, []);

  // Listen to browser navigation popstate
  useEffect(() => {
    const handlePopState = () => {
      setIsAdminRoute(checkIsAdminRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync Campaigns from Server API on mount
  useEffect(() => {
    const initializePublicData = async () => {
      try {
        const res = await syncCampaignsFromTurso();
        if (res.success && Array.isArray(res.campaigns) && res.campaigns.length > 0) {
          setCampaigns(res.campaigns);
        }
      } catch (err) {
        console.warn('Initial server sync notice:', err);
      }
    };

    initializePublicData();
  }, []);

  // Safe activeIndex bounds check if campaigns change
  useEffect(() => {
    if (activeIndex >= campaigns.length) {
      setActiveIndex(Math.max(0, campaigns.length - 1));
    }
  }, [campaigns.length, activeIndex]);

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
    if (totalCampaigns === 0) return;
    setActiveIndex((prev) => (prev + 1) % totalCampaigns);
  }, [totalCampaigns]);

  const prevCampaign = useCallback(() => {
    if (totalCampaigns === 0) return;
    setActiveIndex((prev) => (prev - 1 + totalCampaigns) % totalCampaigns);
  }, [totalCampaigns]);

  // Wheel / Trackpad Gesture Handler
  useEffect(() => {
    if (inHero || isInfoOpen || isAdminRoute) return;

    const handleWheel = (e) => {
      const now = Date.now();
      if (now - lastWheelTime.current < 650) return;

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
  }, [inHero, isInfoOpen, isAdminRoute, nextCampaign, prevCampaign]);

  // Keyboard navigation for exhibition
  useEffect(() => {
    if (inHero || isInfoOpen || isAdminRoute) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        nextCampaign();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        prevCampaign();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inHero, isInfoOpen, isAdminRoute, nextCampaign, prevCampaign]);

  // Touch Swipe navigation
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (inHero || isInfoOpen || isAdminRoute) return;
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
    if (!isAutoplay || inHero || isInfoOpen || isAdminRoute) return;
    const timer = setInterval(() => {
      nextCampaign();
    }, 5000);
    return () => clearInterval(timer);
  }, [isAutoplay, inHero, isInfoOpen, isAdminRoute, nextCampaign]);

  // Admin Campaigns Update callback
  const handleUpdateCampaigns = (newCampaignsList) => {
    setCampaigns(newCampaignsList);
    saveCampaigns(newCampaignsList);
  };

  // Navigate to Public Exhibition
  const handleNavigateHome = useCallback(() => {
    window.history.pushState({}, '', '/');
    setIsAdminRoute(false);
  }, []);

  // If on /admin route, render code-split Admin Portal
  if (isAdminRoute) {
    return (
      <Suspense
        fallback={
          <div className="admin-portal-fullscreen-backdrop">
            <div className="admin-portal-loading-card">
              <div className="admin-portal-spinner" />
              <p className="admin-portal-loading-text">[ INITIALIZING SECURE ADMIN PORTAL... ]</p>
            </div>
          </div>
        }
      >
        <AdminPortal
          campaigns={campaigns}
          onUpdateCampaigns={handleUpdateCampaigns}
          onShowToast={showToast}
          onNavigateHome={handleNavigateHome}
        />
        <ToastNotification toast={toast} onClose={() => setToast(null)} />
      </Suspense>
    );
  }

  // Pure, Editorial Public Exhibition View (Zero Admin DOM / Code)
  return (
    <div 
      className="app-viewport"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Editorial Custom Cursor */}
      <ExhibitionCursor mousePos={mousePos} cursorState={cursorState} />

      {/* Vector Architectural Dynamic Background */}
      <DynamicBackground activeIndex={activeIndex} mousePos={mousePos} />

      {/* Header Bar */}
      <TopHeader 
        onBrandClick={() => setInHero(true)} 
      />

      {/* Hero Title Sequence Intro */}
      {inHero && (
        <HeroSequence onEnterExhibition={() => setInHero(false)} />
      )}

      {/* Main Campaign Exhibition Stage */}
      <main className="exhibition-stage">
        {campaigns.map((campaign, idx) => (
          <CampaignViewer
            key={campaign.id || idx}
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
        <footer className="bottom-controls">
          {/* Vertical Counter & +INFO toggle */}
          <CampaignCounter
            activeIndex={activeIndex}
            totalCount={totalCampaigns}
            onOpenInfo={() => setIsInfoOpen(true)}
          />

          {/* Minimal Numeric Index list */}
          <CampaignIndex
            campaigns={campaigns}
            activeIndex={activeIndex}
            onSelectCampaign={(idx) => setActiveIndex(idx)}
          />

          {/* Autoplay & Signature Progress Line */}
          <div className="right-controls">
            <button 
              className="autoplay-btn"
              onClick={() => setIsAutoplay(!isAutoplay)}
            >
              {isAutoplay ? '[ PAUSE REEL ]' : '[ PLAY REEL ]'}
            </button>

            <div className="signature-progress-track">
              <div 
                className="signature-progress-fill"
                style={{
                  width: `${totalCampaigns > 0 ? ((activeIndex + 1) / totalCampaigns) * 100 : 0}%`
                }}
              />
            </div>
          </div>
        </footer>
      )}

      {/* Exhibition Info Label Overlay */}
      {isInfoOpen && campaigns[activeIndex] && (
        <CampaignInfoOverlay
          campaign={campaigns[activeIndex]}
          onClose={() => setIsInfoOpen(false)}
        />
      )}

      {/* Global Architectural Toast Notifications */}
      <ToastNotification
        toast={toast}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

export default App;

