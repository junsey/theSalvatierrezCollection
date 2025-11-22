# Catacombs of Celluloid

A single-page React + TypeScript experience for browsing a personal movie collection sourced from Google Sheets and enriched with IMDb/OMDb data. The UI embraces a dark fantasy / dungeon synth aesthetic with cinematic touches.

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
VITE_SHEETS_CSV_URL=https://docs.google.com/spreadsheets/d/1_kDej_nXLnz1REls5jDyqjIZU5z_fsN4mHap60_uvCI/export?format=csv
```

- **IMDb/OMDb**: The app calls OMDb by default. Supply `VITE_OMDB_API_KEY` to pull posters, ratings, and plot text. Without a key, the app still works but skips enrichment.
- **Google Sheets**: The default URL points to the provided read-only sheet. Swap `VITE_SHEETS_CSV_URL` for a different sheet or CSV endpoint. The code also contains a tiny fallback dataset for offline demos.

## Features

- Fetches movies from Google Sheets on load and overlays local overrides from `localStorage` (seen status, ratings, notes, view preferences).
- Optional IMDb/OMDb enrichment per movie (poster, plot, rating, year, genres). Gracefully falls back when data is missing.
- Two browsing modes: poster grid and compact table view, both with search, filtering (genre, section, seen), and sorting options.
- Detailed modal with poster, plot, IMDb/local metadata, seen toggle, personal star rating (1–10), and notes (all persisted locally).
- Genre and section hubs plus dedicated pages to browse movies within each category.
- “Ritual of Random Cinema” surprise picker with genre/section filters and “exclude seen” safeguard.
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
- Local overrides are stored under the `catacombs-movie-state-v1` key in `localStorage`.
- Because IMDb enrichment is client-side, consider proxying `VITE_OMDB_URL` through your own backend if you want to hide keys or add caching.
