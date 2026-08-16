import React from 'react';

export const CampaignCounter = ({ activeIndex, totalCount, onOpenInfo }) => {
  const currentFormatted = String(activeIndex + 1).padStart(2, '0');
  const totalFormatted = String(totalCount).padStart(2, '0');

  return (
    <div class="counter-box">
      <div class="counter-num-window">
        <div 
          class="counter-track"
          style={{
            transform: `translate3d(0, ${-activeIndex * 2}rem, 0)`
          }}
        >
          {Array.from({ length: totalCount }).map((_, idx) => (
            <span key={idx} class="counter-val">
              {String(idx + 1).padStart(2, '0')}
            </span>
          ))}
        </div>
      </div>

      <span class="counter-total">
        / {totalFormatted}
      </span>

      <button class="info-btn" onClick={onOpenInfo}>
        + INFO
      </button>
    </div>
  );
};
