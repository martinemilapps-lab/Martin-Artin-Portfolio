import React, { useState } from 'react';

export const CampaignIndex = ({ campaigns, activeIndex, onSelectCampaign }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  return (
    <div class="campaign-index-list">
      {campaigns.map((c, idx) => {
        const isActive = activeIndex === idx;
        return (
          <button
            key={c.id}
            class={`index-item ${isActive ? 'active' : ''}`}
            onClick={() => onSelectCampaign(idx)}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            title={c.title}
          >
            {c.id}
          </button>
        );
      })}
    </div>
  );
};
