import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSectionArt } from '../data/sectionArt';

interface SectionCardProps {
  name: string;
  total: number;
  seen: number;
}

const DEFAULT_SECTION_BG = '/assets/sections/default.jpg';

export const SectionCard: React.FC<SectionCardProps> = ({ name, total, seen }) => {
  const fallbackArt = useMemo(() => getSectionArt(name) || DEFAULT_SECTION_BG, [name]);
  const [backgroundUrl, setBackgroundUrl] = useState<string>(fallbackArt ?? DEFAULT_SECTION_BG);

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
    <Link to={`/sections/${encodeURIComponent(name)}`} className="section-card">
      <div className="section-card__bg" style={{ backgroundImage: `url(${backgroundUrl})` }} aria-hidden="true" />
      <div className="section-card__overlay" aria-hidden="true" />
      <div className="section-card__content">
        <div className="section-card__title">{name}</div>
        <div className="section-card__meta">
          {total} películas • {seen} vistas
        </div>
      </div>
    </Link>
  );
};
