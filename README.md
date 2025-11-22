# The Salvatierrez Collection

Un SPA de React + TypeScript para recorrer "The Salvatierrez Collection": tu videoteca personal en vivo desde Google Sheets y enriquecida con datos de TMDb. El estilo visual mantiene la estética dungeon synth / dark fantasy con guiños de cine antiguo.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Configuration

Create a `.env` file (Vite style) in the project root with your API keys and sheet URL if you want to override defaults:

```
VITE_TMDB_API_KEY=your_tmdb_key_here
VITE_TMDB_BEARER=your_tmdb_bearer_here
VITE_SHEETS_CSV_URL=https://docs.google.com/spreadsheets/d/1_kDej_nXLnz1REls5jDyqjIZU5z_fsN4mHap60_uvCI/gviz/tq?tqx=out:csv
```

- **TMDb**: La app consulta TMDb. Puedes dejar las claves por defecto o definir `VITE_TMDB_API_KEY` y `VITE_TMDB_BEARER` si quieres usar tus propias credenciales.
- **Google Sheets**: La app probará en orden `VITE_SHEETS_CSV_URL` (si existe), `gviz/tq?tqx=out:csv`, `export?format=csv&gid=0` y `pub?output=csv` sobre la hoja compartida para esquivar 404/403. Los resultados se guardan en `localStorage` 24h para evitar reintentos y, si la red falla, se usa la copia guardada aunque esté expirada.
  - Incluye una copia embebida en `src/data/sheet-backup.csv` para que nunca quede en blanco; puedes reemplazarla con un export de la hoja.
  - En la sección **Configuración** hay un botón para regenerar manualmente el documento y forzar un fetch fresco.
- **Cache de TMDb**: Las respuestas de TMDb se guardan en `localStorage` (clave `salvatierrez-tmdb-cache-v1`) durante 6 meses para evitar reconsultas constantes. Si no hay red, se usa el último dato guardado. La configuración de imágenes se cachea en `salvatierrez-tmdb-config-v1`.
- **Cache de películas enriquecidas**: El listado completo ya enriquecido con TMDb se guarda 6 meses (`salvatierrez-movie-cache-v1`). Si todo está en caché, la app arranca al instante sin reconsultar TMDb; si quieres forzar actualización, usa el botón de **Configuración** que regenera el documento y borra esta caché.

## Deploy en Vercel (evitar 404 en recargas)

- Incluye un `vercel.json` con un rewrite global para que cualquier ruta (`/movies`, `/sections/...`, etc.) sirva `index.html`. Asegúrate de que el despliegue use este archivo; con eso las recargas profundas dejan de devolver el 404 de Vercel.

## Features

- Fetches movies from Google Sheets on load and overlays local overrides from `localStorage` (seen status, ratings, notes, view preferences). La columna **Vista** inicializa el estado, y la columna **Puntuacion** inicializa la nota personal.
- Enriquecimiento TMDb por película (poster, plot, rating, year, genres). Gracefully falls back when data is missing y usa caché de 6 meses.
- Two browsing modes: poster grid and compact table view, both with search, filtering (genre, section, seen), and sorting options.
- Detailed modal with poster, plot, TMDb/local metadata, seen toggle, personal star rating (1–10), and notes (all persisted locally).
- Director and section hubs plus dedicated pages to browse movies within each category.
- “Ritual of Random Cinema” surprise picker with genre/section filters and “exclude seen” safeguard.
- Settings page to ver la procedencia del documento, última sincronización, y regenerar manualmente el CSV.
- Responsive dark fantasy theme with neon-cinema accents, subtle grain textures, and hover glows.

## Project structure

```
src/
  components/    # UI building blocks (cards, tables, detail modal, filters, surprise picker)
  context/       # MovieProvider for shared data + mutations
  pages/         # Top-level views/routes
  services/      # Google Sheets fetcher, TMDb helper, localStorage persistence
  types/         # Shared TypeScript types
  styles/        # Global dungeon synth styling
```

## Notes

- Movie data uses the spreadsheet headers: **Seccion**, **Año**, **Saga**, **Titulo**, **Titulo Original**, **Genero**, **Director**, **Grupo**, **Vista**, **Doblaje**, **Formato**. La columna **Titulo Original** se usa como título preferido para las búsquedas en TMDb antes de intentar con **Titulo**.
- Local overrides are stored under the `salvatierrez-collection-state-v1` key in `localStorage`.
- Because TMDb enrichment is client-side, consider proxying `https://api.themoviedb.org/3` through your own backend if you want to hide keys or add caching.
- If alguna fusión deja la app "en blanco", basta con reinstalar dependencias (`npm install`) y correr `npm run dev`. Todo el tema, las rutas, el fetch de Sheets con caché de 24h y la caché de TMDb de 6 meses ya están en este repo: no hace falta rehacer nada, solo desplegar de nuevo.
