import React from 'react';

export const TopHeader = ({ onBrandClick }) => {
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
      </div>
    </header>
  );
};
