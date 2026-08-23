import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, ShieldCheck, Eye, EyeOff, X, KeyRound, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

export const AdminLoginModal = ({ isOpen, onClose, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const usernameInputRef = useRef(null);

  // Reset and focus on open
  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPassword('');
      setErrorMessage('');
      setTimeout(() => usernameInputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Lockout countdown timer
  useEffect(() => {
    if (!isLocked || lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
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

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLocked) return;
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both administrator username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await api.login(username.trim(), password.trim());
      if (result && result.authenticated) {
        onSuccess();
      } else {
        setErrorMessage('Invalid credentials.');
      }
    } catch (err) {
      if (err.status === 429) {
        setIsLocked(true);
        setLockoutSeconds(err.data?.remainingSeconds || 60);
        setErrorMessage(err.message || 'Too many failed login attempts. Security lockout active.');
      } else if (err.status === 401) {
        setErrorMessage('Invalid credentials.');
      } else {
        setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
      }
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
              {isLocked ? <ShieldAlert size={20} className="text-crimson" /> : <KeyRound size={20} />}
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
        {isLocked ? (
          <div className="admin-lockout-banner">
            <AlertTriangle size={18} />
            <div>
              <strong>RATE LIMIT COOLDOWN ACTIVE</strong>
              <p>Too many failed attempts. Temporary lockout for {lockoutSeconds}s.</p>
            </div>
          </div>
        ) : null}

        {/* Form */}
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-input-group">
            <label htmlFor="admin-username-input" className="admin-input-label">
              <span>ADMINISTRATOR USERNAME</span>
            </label>
            <div className="admin-password-input-wrapper">
              <input
                id="admin-username-input"
                ref={usernameInputRef}
                type="text"
                value={username}
                disabled={isLocked || isLoading}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter administrator username..."
                className="admin-text-input"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="admin-input-group">
            <label htmlFor="admin-password-input" className="admin-input-label">
              <span>PASSWORD</span>
            </label>

            <div className="admin-password-input-wrapper">
              <input
                id="admin-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                disabled={isLocked || isLoading}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
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
              disabled={isLocked || isLoading || !username.trim() || !password.trim()}
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
            <span>Server-Side HttpOnly Session Authorization</span>
          </div>
        </div>
      </div>
    </div>
  );
};
