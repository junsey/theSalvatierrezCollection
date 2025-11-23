import React from 'react';

interface PawRatingProps {
  value: number;
  max?: number;
  readOnly?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const PawIcon: React.FC<{ filled: boolean; size?: 'small' | 'medium' | 'large' }> = ({ filled, size = 'medium' }) => {
  const sizeMap = {
    small: 16,
    medium: 20,
    large: 24
  } as const;
  const iconSize = sizeMap[size];

  return (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{
        color: filled ? 'var(--accent-2)' : 'var(--text-muted)',
        opacity: filled ? 1 : 0.35,
        transition: 'all 0.2s ease'
      }}
    >
      <path
        d="M12 14c-2.9 0-5 1.9-5 4.2 0 1.2.8 2.3 2 2.3 1.4 0 2.2-.7 2.8-1.5.2-.3.6-.3.8 0 .6.8 1.4 1.5 2.8 1.5 1.2 0 2-.9 2-2.2C17.5 15.9 14.9 14 12 14Z"
        fill="currentColor"
      />
      <circle cx="6.5" cy="9" r="2.2" fill="currentColor" />
      <circle cx="10.5" cy="6.5" r="2.2" fill="currentColor" />
      <circle cx="14.5" cy="6.5" r="2.2" fill="currentColor" />
      <circle cx="18.5" cy="9" r="2.2" fill="currentColor" />
    </svg>
  );
};

export const PawRating: React.FC<PawRatingProps> = ({ value, max = 10, readOnly = true, size = 'medium' }) => {
  const paws = Array.from({ length: max }, (_, i) => i + 1);
  const filledCount = Math.round(value);

  return (
    <div className="paw-rating">
      <div className="paw-rating__icons">
        {paws.map((paw) => (
          <PawIcon key={paw} filled={paw <= filledCount} size={size} />
        ))}
      </div>
      {value > 0 && <span className="paw-rating__value">{value.toFixed(1)}</span>}
    </div>
  );
};

