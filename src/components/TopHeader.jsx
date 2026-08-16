import React from 'react';

export const TopHeader = ({ onBrandClick }) => {
  return (
    <header class="top-header">
      <div 
        class="header-brand" 
        onClick={onBrandClick} 
        style={{ cursor: 'pointer' }}
      >
        MARTIN EMIL ARTEEN
      </div>

      <div class="header-section">
        AD CAMPAIGNS
      </div>
    </header>
  );
};
