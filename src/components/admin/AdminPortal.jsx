import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  KeyRound, 
  AlertTriangle,
  Lock
} from 'lucide-react';
import { api } from '../../services/api';
import { AdminModal } from '../AdminModal';

export const AdminPortal = ({ 
  campaigns, 
  onUpdateCampaigns, 
  onShowToast, 
  onNavigateHome 
}) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [passkey, setPasskey] = useState('');
  const [showPasskey, setShowPasskey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const passkeyInputRef = useRef(null);

  // Check initial session & single-use access link tokens on mount
  useEffect(() => {
    let isMounted = true;

    const verifyInitialAuth = async () => {
      setIsCheckingSession(true);

      // 1. Check for single-use access link in URL
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('access_token') || urlParams.get('token');

      if (token) {
        try {
          const consumeRes = await api.consumeAccessLink(token);
          if (consumeRes && consumeRes.authenticated) {
            if (isMounted) {
              setIsAdmin(true);
              onShowToast?.({
                type: 'success',
                title: 'Access Link Verified',
                message: 'Authenticated via single-use cryptographic access link.'
              });
            }
          }
        } catch (err) {
          if (isMounted) {
            onShowToast?.({
              type: 'error',
              title: 'Access Link Invalid',
              message: err.message || 'The access link is invalid or has expired.'
            });
          }
        } finally {
          // Sanitize URL params
          urlParams.delete('access_token');
          urlParams.delete('token');
          urlParams.delete('key');
          const cleanSearch = urlParams.toString() ? `?${urlParams.toString()}` : '';
          const cleanUrl = `${window.location.pathname}${cleanSearch}${window.location.hash}`;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      } else {
        // 2. Check active server session cookie
        try {
          const sessionRes = await api.getSession();
          if (sessionRes && sessionRes.authenticated) {
            if (isMounted) setIsAdmin(true);
          } else {
            if (isMounted) setIsAdmin(false);
          }
        } catch {
          if (isMounted) setIsAdmin(false);
        }
      }

      if (isMounted) {
        setIsCheckingSession(false);
        setTimeout(() => passkeyInputRef.current?.focus(), 150);
      }
    };

    verifyInitialAuth();

    return () => {
      isMounted = false;
    };
  }, [onShowToast]);

  // Lockout countdown timer
  useEffect(() => {
    if (!isLocked || lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsLocked(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLocked, lockoutSeconds]);

  // Passkey Login Submission
  const handlePasskeySubmit = async (e) => {
    e.preventDefault();
    if (isLocked) return;
    if (!passkey.trim()) {
      setErrorMessage('Please enter the administrative passkey.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await api.loginWithPasskey(passkey.trim());
      if (result && result.authenticated) {
        setIsAdmin(true);
        setPasskey('');
        onShowToast?.({
          type: 'success',
          title: 'Authentication Successful',
          message: 'Secure HttpOnly administrative session established.'
        });
      } else {
        setErrorMessage('Invalid administrative passkey.');
      }
    } catch (err) {
      if (err.status === 429) {
        setIsLocked(true);
        setLockoutSeconds(err.data?.remainingSeconds || 60);
        setErrorMessage(err.message || 'Security lockout active due to repeated failed attempts.');
      } else if (err.status === 401) {
        setErrorMessage('Invalid passkey.');
      } else {
        setErrorMessage(err.message || 'Authentication verification failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Revoke session / logout handler
  const handleRevokeSession = useCallback(async () => {
    try {
      await api.logout();
    } catch (err) {
      console.warn('Logout notice:', err);
    }
    setIsAdmin(false);
    onShowToast?.({
      type: 'info',
      title: 'Session Revoked',
      message: 'Logged out of Administrative Mode.'
    });
    if (onNavigateHome) {
      onNavigateHome();
    }
  }, [onShowToast, onNavigateHome]);

  if (isCheckingSession) {
    return (
      <div className="admin-portal-fullscreen-backdrop">
        <div className="admin-portal-loading-card">
          <div className="admin-portal-spinner" />
          <p className="admin-portal-loading-text">[ VERIFYING ENCRYPTED SESSION ]</p>
        </div>
      </div>
    );
  }

  // If authenticated, render full Admin Control Panel
  if (isAdmin) {
    return (
      <div className="admin-portal-authenticated-wrapper">
        <AdminModal
          isOpen={true}
          onClose={onNavigateHome}
          campaigns={campaigns}
          onUpdateCampaigns={onUpdateCampaigns}
          onRevokeSession={handleRevokeSession}
          onShowToast={onShowToast}
        />
      </div>
    );
  }

  // Unauthenticated: Render dedicated Admin Passkey Authentication Portal
  return (
    <div className="admin-portal-fullscreen-backdrop">
      <div className="admin-portal-auth-card" role="dialog" aria-modal="true" aria-labelledby="admin-portal-title">
        {/* Brand Top Header */}
        <div className="admin-portal-card-header">
          <div className="admin-portal-badge">
            <Lock size={13} />
            <span>SECURE ACCESS GATEWAY</span>
          </div>

          <h1 id="admin-portal-title" className="admin-portal-title">
            ADMINISTRATIVE CONTROL
          </h1>
          <p className="admin-portal-subtitle">
            MARTIN EMIL ARTEEN &bull; PORTFOLIO ARCHITECTURE
          </p>
        </div>

        {/* Lockout Banner */}
        {isLocked && (
          <div className="admin-lockout-banner" role="alert">
            <AlertTriangle size={18} />
            <div>
              <strong>RATE LIMIT COOLDOWN ACTIVE</strong>
              <p>Security lockout in effect for {lockoutSeconds}s.</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handlePasskeySubmit} className="admin-portal-form">
          <div className="admin-input-group">
            <label htmlFor="admin-passkey-input" className="admin-input-label">
              <span>ADMINISTRATIVE PASSKEY</span>
            </label>
            <div className="admin-password-input-wrapper">
              <input
                id="admin-passkey-input"
                ref={passkeyInputRef}
                type={showPasskey ? 'text' : 'password'}
                value={passkey}
                disabled={isLocked || isLoading}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="Enter passkey..."
                className="admin-text-input"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="admin-password-toggle-btn"
                onClick={() => setShowPasskey(!showPasskey)}
                tabIndex={-1}
                aria-label={showPasskey ? 'Hide passkey' : 'Show passkey'}
              >
                {showPasskey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="admin-form-error-msg" role="alert">
              <ShieldAlert size={14} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="admin-portal-actions">
            <button
              type="button"
              className="admin-portal-back-btn"
              onClick={onNavigateHome}
            >
              <ArrowLeft size={14} />
              <span>RETURN TO EXHIBITION</span>
            </button>

            <button
              type="submit"
              disabled={isLocked || isLoading || !passkey.trim()}
              className="admin-portal-submit-btn"
            >
              <KeyRound size={14} />
              <span>{isLoading ? 'VERIFYING...' : 'AUTHENTICATE'}</span>
            </button>
          </div>
        </form>

        {/* Security Footer Details */}
        <div className="admin-portal-card-footer">
          <div className="admin-security-feature-item">
            <ShieldCheck size={13} />
            <span>PBKDF2 SHA-256 Constant-Time Verification</span>
          </div>
          <div className="admin-security-feature-item">
            <ShieldCheck size={13} />
            <span>HttpOnly SameSite Session Authorization</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
