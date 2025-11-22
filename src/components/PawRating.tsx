import React from 'react';

interface PawRatingProps {
  value: number;
  max?: number;
  readOnly?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const PawIcon: React.FC<{ filled: boolean; size?: 'small' | 'medium' | 'large' }> = ({ filled, size = 'medium' }) => {
  const sizeMap = {
    small: '16px',
    medium: '20px',
    large: '24px'
  };
  const iconSize = sizeMap[size];

  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: iconSize,
        color: filled ? 'var(--accent-2)' : 'var(--text-muted)',
        opacity: filled ? 1 : 0.4,
        transition: 'all 0.2s ease',
        cursor: 'default'
      }}
      aria-hidden="true"
    >
      🐾
    </span>
  );
};

export const PawRating: React.FC<PawRatingProps> = ({ value, max = 10, readOnly = true, size = 'medium' }) => {
  const paws = Array.from({ length: max }, (_, i) => i + 1);
  const filledCount = Math.round(value);

  return (
    <div className="paw-rating" style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
      {paws.map((paw) => (
        <PawIcon key={paw} filled={paw <= filledCount} size={size} />
      ))}
      {value > 0 && (
        <span style={{ marginLeft: '6px', fontSize: '0.9em', color: 'var(--text-muted)' }}>
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
};

