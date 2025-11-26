import express from 'express';

const normalizeSection = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const baseSectionQueries: Record<string, string> = {
  'Accion - Aventura': 'cinematic action adventure movie still dark',
  Belico: 'war movie battlefield cinematic moody',
  'Bio-Pic': 'dramatic portrait biopic movie still',
  'Ciencia Ficcion': 'sci fi neon city spaceship film still',
  'Clint Eastwood': 'western cowboy desert cinematic',
  Comedia: 'comedy movie people laughing warm light',
  Disney: 'fantasy castle magical night cinematic',
  Drama: 'dramatic movie scene strong emotions low key lighting',
  Horror: 'dark horror movie hallway fog shadows',
};

const sectionQueries: Record<string, string> = Object.fromEntries(
  Object.entries(baseSectionQueries).map(([key, value]) => [normalizeSection(key), value])
);

const sectionImageCache: Record<string, string> = {};
const DEFAULT_PEXELS_API_KEY = 'LWBTITAyhuA9AAKzlSyojkuer6ZfmqBOMmugcZzWAXQnsnK1Y3wvDOOa';

const app = express();

app.get('/api/section-image', async (req, res) => {
  const sectionParam = req.query.section;
  const section = typeof sectionParam === 'string' ? sectionParam.trim() : '';
  const normalizedSection = normalizeSection(section);

  if (!section) {
    return res.status(400).json({ error: 'El parámetro "section" es obligatorio.' });
  }

  const apiKey = process.env.PEXELS_API_KEY?.trim() || DEFAULT_PEXELS_API_KEY;

  if (sectionImageCache[normalizedSection]) {
    return res.json({ imageUrl: sectionImageCache[normalizedSection] });
  }

  const query = sectionQueries[normalizedSection] || `${section} cinematic movie still`;

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`,
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Pexels API responded with status ${response.status}`);
    }

    const data = (await response.json()) as { photos?: Array<{ src?: { landscape?: string; large?: string; original?: string } }> };
    const photo = data?.photos?.[0];
    const imageUrl = photo?.src?.landscape || photo?.src?.large || photo?.src?.original;

    if (!imageUrl) {
      throw new Error('No se encontró una imagen válida para la sección.');
    }

    sectionImageCache[normalizedSection] = imageUrl;
    return res.json({ imageUrl });
  } catch (error) {
    console.error('Error al obtener imagen de sección', error);
    return res.status(500).json({ error: 'No se pudo obtener la imagen de la sección.' });
  }
});

const port = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`API de imágenes de secciones escuchando en el puerto ${port}`);
  });
}

export default app;
