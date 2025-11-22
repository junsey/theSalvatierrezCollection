const sectionArtLibrary: { matcher: RegExp; url: string }[] = [
  {
    matcher: /accion|aventura/i,
    url: 'https://images.unsplash.com/photo-1523821741446-edb2b68bb7a0?auto=format&fit=crop&w=1200&q=80',
  },
  {
    matcher: /fantasia/i,
    url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    matcher: /ciencia ficcion|ficcion/i,
    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1200&q=80',
  },
  {
    matcher: /terror|horror/i,
    url: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?auto=format&fit=crop&w=1200&q=80',
  },
  {
    matcher: /drama/i,
    url: 'https://images.unsplash.com/photo-1529101091764-c3526daf38fe?auto=format&fit=crop&w=1200&q=80',
  },
  {
    matcher: /animacion|animación/i,
    url: 'https://images.unsplash.com/photo-1522178129978-0d82f235010e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    matcher: /comedia/i,
    url: 'https://images.unsplash.com/photo-1532960400009-1ee5b7c7b144?auto=format&fit=crop&w=1200&q=80',
  },
  {
    matcher: /romance/i,
    url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    matcher: /biografia|historia/i,
    url: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
  },
];

const defaultArt = 'https://images.unsplash.com/photo-1502139214982-d0ad755818d8?auto=format&fit=crop&w=1200&q=80';

export const getSectionArt = (section: string) => {
  const entry = sectionArtLibrary.find(({ matcher }) => matcher.test(section));
  return entry ? entry.url : defaultArt;
};
