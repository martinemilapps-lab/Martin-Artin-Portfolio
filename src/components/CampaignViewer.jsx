import React from 'react';

export const CampaignViewer = ({ campaign, isPrev, isNext, isActive, onMediaHover, onMediaLeave, onMediaClick }) => {
  if (!campaign) return null;

  return (
    <div 
      class={`campaign-slide ${isActive ? 'active' : ''}`}
      style={{
        opacity: isActive ? 1 : 0,
        pointerEvents: isActive ? 'auto' : 'none',
        transition: 'opacity 0.8s cubic-bezier(0.25, 1, 0.5, 1)'
      }}
    >
      <div 
        class="campaign-media-wrapper"
        onMouseEnter={() => onMediaHover({ type: 'view', text: 'VIEW' })}
        onMouseLeave={onMediaLeave}
        onClick={onMediaClick}
      >
        <img 
          src={campaign.image} 
          alt={campaign.title}
          class="campaign-img"
          loading="eager"
        />
      </div>

      {/* Typographic Metadata Overlay */}
      <div class="campaign-meta-layer">
        <div class="campaign-status-badge">
          {campaign.status} — {campaign.year}
        </div>

        <h2 class="campaign-title">
          {campaign.title}
        </h2>

        <p class="campaign-tagline">
          {campaign.role} / {campaign.tagline}
        </p>
      </div>
    </div>
  );
};
