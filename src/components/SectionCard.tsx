import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getSectionArt } from '../data/sectionArt';

interface SectionCardProps {
  name: string;
  total: number;
  seen: number;
  backgroundUrl?: string | null;
  featured?: boolean;
}

const DEFAULT_SECTION_BG = '/assets/sections/default.jpg';

export const SectionCard: React.FC<SectionCardProps> = ({
  name,
  total,
  seen,
  backgroundUrl,
  featured = false
}) => {
  const fallbackArt = useMemo(() => getSectionArt(name) || DEFAULT_SECTION_BG, [name]);
  const ratio = total > 0 ? seen / total : 0;
  const progressValue = seen > 0 ? Math.max(1, Math.round(ratio * 100)) : 0;
  const progressClass =
    ratio >= 1
      ? 'section-card--complete'
      : ratio >= 0.75
      ? 'section-card--strong'
      : ratio >= 0.5
      ? 'section-card--soft'
      : 'section-card--neutral';
  const badgeLabel = progressValue >= 100 ? 'Completo' : `${progressValue}%`;
  const resolvedBackground = backgroundUrl || fallbackArt || DEFAULT_SECTION_BG;

  return (
    <Link
      to={`/sections/${encodeURIComponent(name)}`}
      className={['section-card', featured ? 'section-card--featured' : '', progressClass].filter(Boolean).join(' ')}
    >
      <div className="section-card__bg" style={{ backgroundImage: `url(${resolvedBackground})` }} aria-hidden="true" />
      <div className="section-card__overlay" aria-hidden="true" />
      <span className="section-card__badge">{badgeLabel}</span>
      <div className="section-card__content">
        <div className="section-card__title">{name}</div>
        <div className="section-card__meta">
          {seen} / {total} vistas
        </div>
      </div>
    </Link>
  );
};
