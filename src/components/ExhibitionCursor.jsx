import React, { useEffect, useState } from 'react';

export const ExhibitionCursor = ({ mousePos, cursorState }) => {
  const [isFinePointer, setIsFinePointer] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(pointer: fine)');
    setIsFinePointer(media.matches);
    if (media.matches) {
      document.body.classList.add('custom-cursor-active');
    }
    return () => {
      document.body.classList.remove('custom-cursor-active');
    };
  }, []);

  if (!isFinePointer) return null;

  const isHover = cursorState && cursorState.type !== 'default';

  return (
    <div
      className={`exhibition-cursor ${isHover ? 'cursor-hover' : 'cursor-dot'}`}
      style={{
        left: `${mousePos.x}px`,
        top: `${mousePos.y}px`
      }}
    >
      {isHover && <span className="cursor-text">{cursorState.text}</span>}
    </div>
  );
};
