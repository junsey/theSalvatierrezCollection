import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { MovieProvider } from './context/MovieContext';
import { HomePage } from './pages/HomePage';
import { AllMoviesPage } from './pages/AllMoviesPage';
import { DirectorPage } from './pages/DirectorPage';
import { SectionPage } from './pages/SectionPage';
import { SurpriseMovieNightPage } from './pages/SurpriseMovieNightPage';
import { DirectorsHub } from './pages/DirectorsHub';
import { SectionsHub } from './pages/SectionsHub';
import { SeriesSectionsHub } from './pages/SeriesSectionsHub';
import { SagasHub } from './pages/SagasHub';
import { SettingsPage } from './pages/SettingsPage';
import { DamagedMoviesPage } from './pages/DamagedMoviesPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { EditMoviePage } from './pages/EditMoviePage';
import { SeriesSectionPage } from './pages/SeriesSectionPage';

const App: React.FC = () => {
  return (
    <MovieProvider>
      <Header />
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/movies" element={<AllMoviesPage />} />
          <Route path="/directors" element={<DirectorsHub />} />
          <Route path="/directors/:name" element={<DirectorPage />} />
          <Route path="/sections" element={<SectionsHub />} />
          <Route path="/sections/:name" element={<SectionPage />} />
          <Route path="/sections-series" element={<SeriesSectionsHub />} />
          <Route path="/sections-series/:name" element={<SeriesSectionPage />} />
          <Route path="/sagas" element={<SagasHub />} />
          <Route path="/surprise" element={<SurpriseMovieNightPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/damaged" element={<DamagedMoviesPage />} />
          <Route path="/admin/movies/:id/edit" element={<EditMoviePage />} />
        </Routes>
      </div>
    </MovieProvider>
  );
};

export default App;
