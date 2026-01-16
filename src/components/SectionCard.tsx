import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSectionArt } from '../data/sectionArt';

interface SectionCardProps {
  name: string;
  total: number;
  seen: number;
  featured?: boolean;
}

const DEFAULT_SECTION_BG = '/assets/sections/default.jpg';

export const SectionCard: React.FC<SectionCardProps> = ({ name, total, seen, featured = false }) => {
  const fallbackArt = useMemo(() => getSectionArt(name) || DEFAULT_SECTION_BG, [name]);
  const [backgroundUrl, setBackgroundUrl] = useState<string>(fallbackArt ?? DEFAULT_SECTION_BG);
  const ratio = total > 0 ? seen / total : 0;
  const progressBucket = ratio >= 1 ? 100 : ratio >= 0.75 ? 75 : ratio >= 0.5 ? 50 : ratio >= 0.25 ? 25 : 0;
  const progressClass =
    ratio >= 1
      ? 'section-card--complete'
      : ratio >= 0.75
      ? 'section-card--strong'
      : ratio >= 0.5
      ? 'section-card--soft'
      : 'section-card--neutral';
  const badgeLabel = progressBucket === 100 ? 'Completo' : `${progressBucket}%`;

  useEffect(() => {
    let isMounted = true;

    const loadBackground = async () => {
      try {
        const response = await fetch(`/api/section-image?section=${encodeURIComponent(name)}`);
        if (!response.ok) {
          throw new Error('La solicitud de imagen falló');
        }
        const data = (await response.json()) as { imageUrl?: string };
        if (data?.imageUrl && isMounted) {
          setBackgroundUrl(data.imageUrl);
        } else if (isMounted) {
          setBackgroundUrl(fallbackArt);
        }
      } catch (error) {
        if (isMounted) {
          setBackgroundUrl(fallbackArt);
        }
      }
    };

    loadBackground();

    return () => {
      isMounted = false;
    };
  }, [name, fallbackArt]);

  return (
    <Link
      to={`/sections/${encodeURIComponent(name)}`}
      className={['section-card', featured ? 'section-card--featured' : '', progressClass].filter(Boolean).join(' ')}
    >
      <div className="section-card__bg" style={{ backgroundImage: `url(${backgroundUrl})` }} aria-hidden="true" />
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
