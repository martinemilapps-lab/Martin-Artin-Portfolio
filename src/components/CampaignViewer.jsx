import React from 'react';

export const CampaignViewer = ({ campaign, isActive, onMediaHover, onMediaLeave, onMediaClick }) => {
  if (!campaign) return null;

  const galleryCount = Array.isArray(campaign.gallery) ? campaign.gallery.length + 1 : 1;

  return (
    <div 
      className={`campaign-slide ${isActive ? 'active' : ''}`}
      style={{
        opacity: isActive ? 1 : 0,
        pointerEvents: isActive ? 'auto' : 'none',
        transition: 'opacity 0.8s cubic-bezier(0.25, 1, 0.5, 1)'
      }}
    >
      <div 
        className="campaign-media-wrapper"
        onMouseEnter={() => onMediaHover({ type: 'view', text: 'VIEW' })}
        onMouseLeave={onMediaLeave}
        onClick={onMediaClick}
      >
        <img 
          src={campaign.image} 
          alt={campaign.title}
          className="campaign-img"
          loading="eager"
          onError={(e) => { e.target.src = '/campaigns/c1.jpg'; }}
        />
        {galleryCount > 1 && (
          <div className="campaign-gallery-count-badge">
            {galleryCount} PHOTOS
          </div>
        )}
      </div>

      {/* Typographic Metadata Overlay */}
      <div className="campaign-meta-layer">
        <div className="campaign-status-badge">
          {campaign.client ? `${campaign.client.toUpperCase()} • ` : ''}{campaign.status} — {campaign.year}
        </div>

        <h2 className="campaign-title">
          {campaign.title}
        </h2>

        <p className="campaign-tagline">
          {campaign.role} / {campaign.tagline}
        </p>
      </div>
    </div>
  );
};


