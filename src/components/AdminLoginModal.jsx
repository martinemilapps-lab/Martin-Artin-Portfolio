import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, ShieldCheck, Eye, EyeOff, X, KeyRound, AlertTriangle } from 'lucide-react';
import { verifyPasskey, checkRateLimit } from '../utils/security';

export const AdminLoginModal = ({ isOpen, onClose, onSuccess }) => {
  const [passkey, setPasskey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [rateStatus, setRateStatus] = useState({ locked: false, remainingAttempts: 5, remainingSeconds: 0 });
  const inputRef = useRef(null);

  // Check rate limit state when opened
  useEffect(() => {
    if (isOpen) {
      const status = checkRateLimit();
      setRateStatus(status);
      setErrorMessage(status.locked ? `Security lockout active (${status.remainingSeconds}s)` : '');
      setPasskey('');
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Lockout countdown timer
  useEffect(() => {
    if (!rateStatus.locked || rateStatus.remainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setRateStatus(prev => {
        if (prev.remainingSeconds <= 1) {
          clearInterval(timer);
          return { locked: false, remainingAttempts: 5, remainingSeconds: 0 };
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [rateStatus.locked, rateStatus.remainingSeconds]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rateStatus.locked) return;
    if (!passkey.trim()) {
      setErrorMessage('Please enter the Master Passkey.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await verifyPasskey(passkey);
      if (result.valid) {
        onSuccess();
      } else {
        setRateStatus({
          locked: result.locked,
          remainingAttempts: result.remainingAttempts,
          remainingSeconds: result.remainingSeconds || 0
        });
        setErrorMessage(result.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      setErrorMessage(`Authentication error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div 
        className="admin-login-modal-box" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        {/* Header */}
        <div className="admin-login-header">
          <div className="admin-login-title-row">
            <div className="admin-security-shield-icon">
              {rateStatus.locked ? <ShieldAlert size={20} className="text-crimson" /> : <KeyRound size={20} />}
            </div>
            <div>
              <h2 id="login-modal-title" className="admin-login-title">ADMIN AUTHENTICATION</h2>
              <p className="admin-login-subtitle">EXHIBITION ARCHITECTURE & PROJECT CONTROL</p>
            </div>
          </div>
          <button className="admin-modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Security Alert if locked */}
        {rateStatus.locked ? (
          <div className="admin-lockout-banner">
            <AlertTriangle size={18} />
            <div>
              <strong>RATE LIMIT COOLDOWN ACTIVE</strong>
              <p>Too many failed attempts. Unlock in {rateStatus.remainingSeconds}s.</p>
            </div>
          </div>
        ) : null}

        {/* Form */}
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-input-group">
            <label htmlFor="admin-passkey-input" className="admin-input-label">
              <span>MASTER PASSKEY</span>
              <span className="admin-attempt-badge">
                {rateStatus.remainingAttempts} / 5 attempts remaining
              </span>
            </label>

            <div className="admin-password-input-wrapper">
              <input
                id="admin-passkey-input"
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={passkey}
                disabled={rateStatus.locked || isLoading}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="Enter admin passkey..."
                className="admin-text-input"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="admin-password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="admin-form-error-msg" role="alert">
              <ShieldAlert size={14} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="admin-login-actions">
            <button
              type="button"
              className="admin-btn-secondary"
              onClick={onClose}
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={rateStatus.locked || isLoading || !passkey.trim()}
              className="admin-btn-primary"
            >
              {isLoading ? 'VERIFYING...' : 'AUTHENTICATE'}
            </button>
          </div>
        </form>

        {/* Security Footer Notice */}
        <div className="admin-login-footer">
          <div className="admin-security-feature-item">
            <ShieldCheck size={14} />
            <span>Constant-Time SHA-256 WebCrypto Verification</span>
          </div>
          <div className="admin-default-passkey-hint">
            <span>Default Passkey: </span>
            <code>Arteen@2026!Admin</code>
          </div>
        </div>
      </div>
    </div>
  );
};
