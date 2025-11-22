import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { MovieProvider } from './context/MovieContext';
import { HomePage } from './pages/HomePage';
import { AllMoviesPage } from './pages/AllMoviesPage';
import { GenrePage } from './pages/GenrePage';
import { SectionPage } from './pages/SectionPage';
import { SurpriseMovieNightPage } from './pages/SurpriseMovieNightPage';
import { GenresHub } from './pages/GenresHub';
import { SectionsHub } from './pages/SectionsHub';

const App: React.FC = () => {
  return (
    <MovieProvider>
      <div className="app-shell">
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/movies" element={<AllMoviesPage />} />
          <Route path="/genres" element={<GenresHub />} />
          <Route path="/genres/:name" element={<GenrePage />} />
          <Route path="/sections" element={<SectionsHub />} />
          <Route path="/sections/:name" element={<SectionPage />} />
          <Route path="/surprise" element={<SurpriseMovieNightPage />} />
        </Routes>
      </div>
    </MovieProvider>
  );
};

export default App;
