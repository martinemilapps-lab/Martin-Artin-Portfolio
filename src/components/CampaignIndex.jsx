import React from 'react';

export const CampaignIndex = ({ campaigns, activeIndex, onSelectCampaign }) => {
  return (
    <div className="campaign-index-list">
      {campaigns.map((c, idx) => {
        const isActive = activeIndex === idx;
        return (
          <button
            key={c.id || idx}
            className={`index-item ${isActive ? 'active' : ''}`}
            onClick={() => onSelectCampaign(idx)}
            title={c.title}
          >
            {c.id}
          </button>
        );
      })}
    </div>
  );
};

