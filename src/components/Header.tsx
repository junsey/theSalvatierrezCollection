import React from 'react';
import { Link, NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/movies', label: 'All Movies' },
  { to: '/genres', label: 'Genres' },
  { to: '/sections', label: 'Sections' },
  { to: '/surprise', label: 'Surprise Night' },
  { to: '/settings', label: 'Configuración' }
];

export const Header: React.FC = () => {
  return (
    <header className="navbar">
      <Link to="/" className="logo" style={{ fontFamily: 'UnifrakturMaguntia, serif', color: 'var(--accent-2)', fontSize: 26 }}>
        The Salvatierrez Collection
      </Link>
      <nav className="nav-links">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
            style={({ isActive }) => ({
              color: isActive ? 'var(--accent)' : undefined,
              borderColor: isActive ? 'rgba(255, 54, 93, 0.5)' : undefined
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
};
