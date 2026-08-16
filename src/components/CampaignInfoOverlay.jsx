import React from 'react';

export const CampaignInfoOverlay = ({ campaign, onClose }) => {
  if (!campaign) return null;

  return (
    <div class="info-overlay" onClick={onClose}>
      <div class="info-plaque" onClick={(e) => e.stopPropagation()}>
        <button class="close-info-btn" onClick={onClose}>
          [ CLOSE ]
        </button>

        <div class="plaque-header">
          <p class="plaque-category">
            {campaign.category} — {campaign.status}
          </p>
          <h3 class="plaque-title">
            {campaign.title}
          </h3>
        </div>

        <div class="plaque-grid">
          <div>
            <div class="plaque-field-label">ROLE</div>
            <div class="plaque-field-val" style={{ marginBottom: '1.5rem' }}>
              {campaign.role}
            </div>

            <div class="plaque-field-label">YEAR</div>
            <div class="plaque-field-val" style={{ marginBottom: '1.5rem' }}>
              {campaign.year}
            </div>

            <div class="plaque-field-label">CLASSIFICATION</div>
            <div class="plaque-field-val" style={{ color: 'var(--accent-red)', fontWeight: 700 }}>
              {campaign.status}
            </div>
          </div>

          <div>
            <div class="plaque-field-label">EXHIBITION NOTES</div>
            <p class="plaque-description" style={{ marginBottom: '2rem' }}>
              {campaign.description}
            </p>

            <div class="plaque-field-label">CREDITS & PRODUCTION</div>
            <div class="plaque-field-val" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {campaign.credits}
            </div>
          </div>
        </div>

        <div class="plaque-footer-identity">
          <span class="plaque-identity-name">MARTIN EMIL ARTEEN</span>
          <span class="plaque-identity-role">ART / CREATIVE DIRECTOR</span>
        </div>
      </div>
    </div>
  );
};
