const sectionArtLibrary: { matcher: RegExp; url: string }[] = [
  {
    matcher: /accion|aventura/i,
    url: 'https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?auto=format&fit=crop&w=1400&q=80',
  },
  {
    matcher: /fantasia/i,
    url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80',
  },
  {
    matcher: /ciencia ficcion|ficcion/i,
    url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1400&q=80',
  },
  {
    matcher: /terror|horror/i,
    url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1400&q=80',
  },
  {
    matcher: /drama/i,
    url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80',
  },
  {
    matcher: /animacion|animación/i,
    url: 'https://images.unsplash.com/photo-1451933335233-c6b65bd26113?auto=format&fit=crop&w=1400&q=80',
  },
  {
    matcher: /comedia/i,
    url: 'https://images.unsplash.com/photo-1505685296765-3a2736de412f?auto=format&fit=crop&w=1400&q=80',
  },
  {
    matcher: /romance/i,
    url: 'https://images.unsplash.com/photo-1525859331226-4ff030c35c66?auto=format&fit=crop&w=1400&q=80',
  },
  {
    matcher: /biografia|historia/i,
    url: 'https://images.unsplash.com/photo-1462212210333-335063b676d4?auto=format&fit=crop&w=1400&q=80',
  },
];

const defaultArt = 'https://images.unsplash.com/photo-1502139214982-d0ad755818d8?auto=format&fit=crop&w=1200&q=80';

export const getSectionArt = (section: string) => {
  const entry = sectionArtLibrary.find(({ matcher }) => matcher.test(section));
  return entry ? entry.url : defaultArt;
};
