import React from 'react';

export const CampaignCounter = ({ activeIndex, totalCount, onOpenInfo }) => {
  const totalFormatted = String(totalCount).padStart(2, '0');

  return (
    <div className="counter-box">
      <div className="counter-num-window">
        <div 
          className="counter-track"
          style={{
            transform: `translate3d(0, ${-activeIndex * 2}rem, 0)`
          }}
        >
          {Array.from({ length: totalCount }).map((_, idx) => (
            <span key={idx} className="counter-val">
              {String(idx + 1).padStart(2, '0')}
            </span>
          ))}
        </div>
      </div>

      <span className="counter-total">
        / {totalFormatted}
      </span>

      <button className="info-btn" onClick={onOpenInfo}>
        + INFO
      </button>
    </div>
  );
};

