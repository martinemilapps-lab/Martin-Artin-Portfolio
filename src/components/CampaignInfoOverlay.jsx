import React, { useState, useEffect } from 'react';
import { ExternalLink, Globe, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';

export const CampaignInfoOverlay = ({ campaign, onClose }) => {
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!campaign) return null;

  // Prepare full gallery list including primary image
  const primaryItem = { url: campaign.image, caption: 'Primary Exhibition Photograph' };
  const additionalItems = Array.isArray(campaign.gallery)
    ? campaign.gallery.map((g, idx) => typeof g === 'string' ? { url: g, caption: `Exhibition Angle ${idx + 2}` } : g)
    : [];
  const fullGallery = [primaryItem, ...additionalItems];

  const activeDisplayPhoto = selectedPhoto || primaryItem;

  return (
    <div className="info-overlay" onClick={onClose}>
      <div className="info-plaque" onClick={(e) => e.stopPropagation()}>
        <button className="close-info-btn" onClick={onClose} aria-label="Close details overlay">
          [ CLOSE ]
        </button>

        <div className="plaque-header">
          <p className="plaque-category">
            {campaign.category} — {campaign.status}
          </p>
          <h3 className="plaque-title">
            {campaign.title}
          </h3>
          <p className="plaque-tagline">
            {campaign.tagline}
          </p>
        </div>

        {/* Dynamic Photo Gallery Showcase if more than 1 image */}
        {fullGallery.length > 1 && (
          <div className="plaque-gallery-showcase">
            <div className="plaque-gallery-preview-frame">
              <img 
                src={activeDisplayPhoto.url} 
                alt={activeDisplayPhoto.caption || campaign.title}
                className="plaque-active-gallery-img"
                onError={(e) => { e.target.src = '/campaigns/c1.jpg'; }}
              />
              {activeDisplayPhoto.caption && (
                <div className="plaque-gallery-caption-bar">
                  <ImageIcon size={12} />
                  <span>{activeDisplayPhoto.caption}</span>
                </div>
              )}
            </div>

            <div className="plaque-gallery-thumbs-track">
              {fullGallery.map((photo, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  className={`plaque-gallery-thumb-btn ${activeDisplayPhoto.url === photo.url ? 'active' : ''}`}
                  onClick={() => setSelectedPhoto(photo)}
                  title={photo.caption || `View Photograph #${pIdx + 1}`}
                >
                  <img 
                    src={photo.url} 
                    alt={`Thumb ${pIdx + 1}`} 
                    onError={(e) => { e.target.src = '/campaigns/c1.jpg'; }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="plaque-grid">
          <div>
            <div className="plaque-field-label">ROLE & DISCIPLINES</div>
            <div className="plaque-field-val" style={{ marginBottom: '1.5rem' }}>
              {campaign.role}
            </div>

            {campaign.client && (
              <>
                <div className="plaque-field-label">COMMISSION / CLIENT</div>
                <div className="plaque-field-val" style={{ marginBottom: '1.5rem', fontWeight: 600 }}>
                  {campaign.client}
                </div>
              </>
            )}

            <div className="plaque-field-label">YEAR</div>
            <div className="plaque-field-val" style={{ marginBottom: '1.5rem' }}>
              {campaign.year}
            </div>

            <div className="plaque-field-label">CLASSIFICATION</div>
            <div className="plaque-field-val" style={{ color: 'var(--accent-red)', fontWeight: 700 }}>
              {campaign.status}
            </div>
          </div>

          <div>
            <div className="plaque-field-label">EXHIBITION NOTES</div>
            <p className="plaque-description" style={{ marginBottom: '1.5rem' }}>
              {campaign.description}
            </p>

            <div className="plaque-field-label">CREDITS & PRODUCTION</div>
            <div className="plaque-field-val" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {campaign.credits}
            </div>

            {/* Hyperlinks Action Section */}
            {(campaign.link || campaign.case_study_link || campaign.client_link) && (
              <div className="plaque-links-section">
                <div className="plaque-field-label">EXTERNAL LINKS & DESTINATIONS</div>
                <div className="plaque-links-row">
                  {campaign.link && (
                    <a 
                      href={campaign.link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="plaque-link-btn primary"
                      title="Open Live Project in new tab"
                    >
                      <Globe size={13} />
                      <span>VISIT LIVE PROJECT</span>
                      <ExternalLink size={12} />
                    </a>
                  )}

                  {campaign.case_study_link && (
                    <a 
                      href={campaign.case_study_link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="plaque-link-btn"
                      title="Open Case Study / Video in new tab"
                    >
                      <LinkIcon size={13} />
                      <span>CASE STUDY</span>
                      <ExternalLink size={12} />
                    </a>
                  )}

                  {campaign.client_link && (
                    <a 
                      href={campaign.client_link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="plaque-link-btn"
                      title="Open Client Website in new tab"
                    >
                      <Globe size={13} />
                      <span>CLIENT SITE</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="plaque-footer-identity">
          <span className="plaque-identity-name">MARTIN EMIL ARTEEN</span>
          <span className="plaque-identity-role">ART / CREATIVE DIRECTOR</span>
        </div>
      </div>
    </div>
  );
};


