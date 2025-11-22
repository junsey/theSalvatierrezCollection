# The Salvatierrez Collection

Un SPA de React + TypeScript para recorrer "The Salvatierrez Collection": tu videoteca personal en vivo desde Google Sheets y enriquecida con datos de IMDb/OMDb. El estilo visual mantiene la estética dungeon synth / dark fantasy con guiños de cine antiguo.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Configuration

Create a `.env` file (Vite style) in the project root with your API keys and sheet URL if you want to override defaults:

```
VITE_OMDB_API_KEY=your_omdb_key_here
VITE_OMDB_URL=https://www.omdbapi.com/
VITE_SHEETS_CSV_URL=https://docs.google.com/spreadsheets/d/1_kDej_nXLnz1REls5jDyqjIZU5z_fsN4mHap60_uvCI/gviz/tq?tqx=out:csv
```

- **IMDb/OMDb**: La app llama a OMDb. Puedes poner `VITE_OMDB_API_KEY` para usar tu propia clave; incluye un fallback (fd2b1d69)
  para que las portadas/ratings carguen de inmediato.
- **Google Sheets**: La app probará en orden `VITE_SHEETS_CSV_URL` (si existe), `gviz/tq?tqx=out:csv`, `export?format=csv&gid=0` y `pub?output=csv` sobre la hoja compartida para esquivar 404/403. Los resultados se guardan en `localStorage` 24h para evitar reintentos.
 - **Cache de IMDb**: Las respuestas de OMDb se guardan en `localStorage` (clave `salvatierrez-imdb-cache-v1`) durante 6 meses para evitar reconsultas constantes. Si no hay red, se usa el último dato guardado.

## Features

- Fetches movies from Google Sheets on load and overlays local overrides from `localStorage` (seen status, ratings, notes, view preferences). La columna **Vista** inicializa el estado, y la columna **Puntuacion** inicializa la nota personal.
- Optional IMDb/OMDb enrichment per movie (poster, plot, rating, year, genres). Gracefully falls back when data is missing o si falta la API key.
- Two browsing modes: poster grid and compact table view, both with search, filtering (genre, section, seen), and sorting options.
- Detailed modal with poster, plot, IMDb/local metadata, seen toggle, personal star rating (1–10), and notes (all persisted locally).
- Genre and section hubs plus dedicated pages to browse movies within each category.
- “Ritual of Random Cinema” surprise picker with section filter and “exclude seen” safeguard.
- Responsive dark fantasy theme with neon-cinema accents, subtle grain textures, and hover glows.

## Project structure

```
src/
  components/    # UI building blocks (cards, tables, detail modal, filters, surprise picker)
  context/       # MovieProvider for shared data + mutations
  pages/         # Top-level views/routes
  services/      # Google Sheets fetcher, OMDb helper, localStorage persistence
  types/         # Shared TypeScript types
  styles/        # Global dungeon synth styling
```

## Notes

- Movie data uses the spreadsheet headers: **Seccion**, **Año**, **Saga**, **Titulo**, **Genero**, **Director**, **Grupo**, **Vista**, **Doblaje**, **Formato**.
- Local overrides are stored under the `salvatierrez-collection-state-v1` key in `localStorage`.
- Because IMDb enrichment is client-side, consider proxying `VITE_OMDB_URL` through your own backend if you want to hide keys or add caching.
- If alguna fusión deja la app "en blanco", basta con reinstalar dependencias (`npm install`) y correr `npm run dev`. Todo el tema, las rutas, el fetch de Sheets con caché de 24h y la caché de IMDb de 6 meses ya están en este repo: no hace falta rehacer nada, solo desplegar de nuevo.
