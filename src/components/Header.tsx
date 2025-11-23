import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/movies', label: 'All Movies' },
  { to: '/directors', label: 'Directores' },
  { to: '/sections', label: 'Sections' },
  { to: '/surprise', label: 'Surprise Night' },
  { to: '/settings', label: 'Configuración' }
];

export const Header: React.FC = () => {
  const [open, setOpen] = useState(false);

  const toggleMenu = () => setOpen((prev) => !prev);
  const closeMenu = () => setOpen(false);

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="logo">The Salvatierrez Collection</Link>
        <button className={`menu-toggle ${open ? 'open' : ''}`} onClick={toggleMenu} aria-label="Toggle navigation">
          <span />
          <span />
          <span />
        </button>
        <nav className={`nav-links ${open ? 'open' : ''}`}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeMenu}
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
      </div>
    </header>
  );
};
