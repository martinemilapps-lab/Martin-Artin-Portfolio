import React from 'react';
import { ShieldCheck, Settings } from 'lucide-react';

export const TopHeader = ({ onBrandClick, isAdmin, onOpenAdmin }) => {
  return (
    <header className="top-header">
      <div 
        className="header-brand" 
        onClick={onBrandClick} 
        style={{ cursor: 'pointer' }}
        title="Return to Introduction"
      >
        MARTIN EMIL ARTEEN
      </div>

      <div className="header-right-group">
        <div className="header-section">
          AD CAMPAIGNS
        </div>

        {/* Discreet Admin Trigger / Status Badge */}
        <button 
          className={`header-admin-pill ${isAdmin ? 'admin-active' : ''}`}
          onClick={onOpenAdmin}
          title={isAdmin ? 'Open Admin Control Panel' : 'Authenticate Admin Mode (or press Ctrl+Shift+A)'}
          aria-label="Admin Control"
        >
          {isAdmin ? (
            <>
              <ShieldCheck size={13} className="admin-status-dot active" />
              <span>ADMIN MODE</span>
            </>
          ) : (
            <>
              <Settings size={13} className="admin-status-dot" />
              <span>ADMIN</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
