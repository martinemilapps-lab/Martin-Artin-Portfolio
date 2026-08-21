import React, { useState, useEffect, useRef, useCallback } from 'react';
import { loadCampaigns, saveCampaigns, syncCampaignsFromTurso } from './utils/projectStorage';
import { 
  createAdminSession, 
  revokeAdminSession, 
  isSessionValid, 
  verifyAccessToken, 
  subscribeToSession,
  syncSecurityConfigWithTurso
} from './utils/security';
import { DynamicBackground } from './components/DynamicBackground';
import { ExhibitionCursor } from './components/ExhibitionCursor';
import { TopHeader } from './components/TopHeader';
import { HeroSequence } from './components/HeroSequence';
import { CampaignViewer } from './components/CampaignViewer';
import { CampaignCounter } from './components/CampaignCounter';
import { CampaignIndex } from './components/CampaignIndex';
import { CampaignInfoOverlay } from './components/CampaignInfoOverlay';
import { AdminModal } from './components/AdminModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { ToastNotification } from './components/ToastNotification';

export function App() {
  const [campaigns, setCampaigns] = useState(() => loadCampaigns());
  const [activeIndex, setActiveIndex] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [cursorState, setCursorState] = useState({ type: 'default', text: '' });
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [inHero, setInHero] = useState(true);

  // Admin Mode & Security State
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const lastWheelTime = useRef(0);
  const touchStartX = useRef(0);
  const totalCampaigns = campaigns.length;

  // Background Cloud Sync with Turso on mount
  useEffect(() => {
    const syncCloudData = async () => {
      try {
        const res = await syncCampaignsFromTurso();
        if (res.success && Array.isArray(res.campaigns) && res.campaigns.length > 0) {
          setCampaigns(res.campaigns);
        }
        await syncSecurityConfigWithTurso();
      } catch (err) {
        console.warn('Initial cloud sync notice:', err);
      }
    };
    syncCloudData();
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

  // Show Toast Helper
  const showToast = useCallback((toastData) => {
    setToast(toastData);
  }, []);

  // Subscribe to Security Session Changes
  useEffect(() => {
    const unsubscribe = subscribeToSession((authenticated) => {
      setIsAdmin(authenticated);
      if (!authenticated) {
        setIsAdminModalOpen(false);
      }
    });
    return unsubscribe;
  }, []);

  // -------------------------------------------------------------
  // PARAMETERIZED LINK & ROUTE SECURITY PROCESSOR
  // -------------------------------------------------------------
  useEffect(() => {
    const processUrlParameters = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash || '';
      const pathname = window.location.pathname || '';

      const isAdminQuery = urlParams.get('admin') === 'true' || urlParams.get('admin') === '1';
      const tokenParam = urlParams.get('token') || urlParams.get('key');
      const isPathAdmin = pathname.endsWith('/admin') || pathname.endsWith('/admin/');
      const isHashAdmin = hash.startsWith('#admin');

      if (tokenParam) {
        // Authenticate via Parameterized Access Token
        const isValid = await verifyAccessToken(tokenParam);
        if (isValid) {
          createAdminSession();
          setIsAdmin(true);
          setIsAdminModalOpen(true);
          showToast({ 
            type: 'success', 
            title: 'Authenticated via Access Link', 
            message: 'Admin session established securely.' 
          });

          // SANITIZE URL: Strip sensitive token parameter from browser address & history
          urlParams.delete('token');
          urlParams.delete('key');
          const cleanSearch = urlParams.toString() ? `?${urlParams.toString()}` : '';
          const cleanUrl = `${window.location.pathname}${cleanSearch}${window.location.hash}`;
          window.history.replaceState({}, document.title, cleanUrl);
        } else {
          showToast({ 
            type: 'error', 
            title: 'Access Token Invalid', 
            message: 'The parameterized link token is invalid or has expired.' 
          });
          setIsLoginModalOpen(true);
        }
      } else if (isAdminQuery || isPathAdmin || isHashAdmin) {
        // Requested admin without direct token
        if (isSessionValid()) {
          setIsAdminModalOpen(true);
        } else {
          setIsLoginModalOpen(true);
        }
      }
    };

    processUrlParameters();
  }, [showToast]);

  // -------------------------------------------------------------
  // KEYBOARD SHORTCUT (Ctrl+Shift+A or Cmd+Shift+A)
  // -------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (isSessionValid()) {
          setIsAdminModalOpen(prev => !prev);
        } else {
          setIsLoginModalOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    if (inHero || isInfoOpen || isAdminModalOpen || isLoginModalOpen) return;

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
  }, [inHero, isInfoOpen, isAdminModalOpen, isLoginModalOpen, nextCampaign, prevCampaign]);

  // Keyboard navigation for exhibition
  useEffect(() => {
    if (inHero || isInfoOpen || isAdminModalOpen || isLoginModalOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        nextCampaign();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        prevCampaign();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inHero, isInfoOpen, isAdminModalOpen, isLoginModalOpen, nextCampaign, prevCampaign]);

  // Touch Swipe navigation
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (inHero || isInfoOpen || isAdminModalOpen || isLoginModalOpen) return;
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
    if (!isAutoplay || inHero || isInfoOpen || isAdminModalOpen || isLoginModalOpen) return;
    const timer = setInterval(() => {
      nextCampaign();
    }, 5000);
    return () => clearInterval(timer);
  }, [isAutoplay, inHero, isInfoOpen, isAdminModalOpen, isLoginModalOpen, nextCampaign]);

  // Admin Campaigns Update
  const handleUpdateCampaigns = (newCampaignsList) => {
    setCampaigns(newCampaignsList);
    saveCampaigns(newCampaignsList);
  };

  // Admin Login Success
  const handleLoginSuccess = () => {
    createAdminSession();
    setIsLoginModalOpen(false);
    setIsAdminModalOpen(true);
    showToast({ 
      type: 'success', 
      title: 'Authentication Successful', 
      message: 'Admin session established.' 
    });
  };

  // Session Revocation
  const handleRevokeSession = () => {
    revokeAdminSession();
    setIsAdminModalOpen(false);
    showToast({ 
      type: 'info', 
      title: 'Session Revoked', 
      message: 'Logged out of Admin Mode.' 
    });
  };

  // Open Admin Handler
  const handleOpenAdminTrigger = () => {
    if (isSessionValid()) {
      setIsAdminModalOpen(true);
    } else {
      setIsLoginModalOpen(true);
    }
  };

  return (
    <div 
      className="app-viewport"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Editorial Custom Cursor */}
      {!isAdminModalOpen && !isLoginModalOpen && (
        <ExhibitionCursor mousePos={mousePos} cursorState={cursorState} />
      )}

      {/* Vector Architectural Dynamic Background */}
      <DynamicBackground activeIndex={activeIndex} mousePos={mousePos} />

      {/* Header Bar */}
      <TopHeader 
        onBrandClick={() => setInHero(true)} 
        isAdmin={isAdmin}
        onOpenAdmin={handleOpenAdminTrigger}
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

      {/* Admin Login Verification Challenge Modal */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* Admin Control Panel Dashboard Modal */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        campaigns={campaigns}
        onUpdateCampaigns={handleUpdateCampaigns}
        onRevokeSession={handleRevokeSession}
        onShowToast={showToast}
      />

      {/* Global Architectural Toast Notifications */}
      <ToastNotification
        toast={toast}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

export default App;
