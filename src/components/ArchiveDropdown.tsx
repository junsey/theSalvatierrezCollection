import React, { useEffect, useMemo, useRef, useState } from 'react';

export type ArchiveOption = {
  value: string;
  label: string;
};

interface Props {
  label: string;
  value: string;
  options: ArchiveOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export const ArchiveDropdown: React.FC<Props> = ({ label, value, options, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  const active = useMemo(() => options.find((option) => option.value === value), [options, value]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current || !(event.target instanceof Node)) return;
      if (!rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className={`archive-dropdown ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="archive-dropdown__trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="archive-dropdown__label">{label}</span>
        <span className="archive-dropdown__value">{active?.label ?? placeholder ?? 'Seleccionar'}</span>
      </button>
      {open && (
        <div className="archive-dropdown__menu" role="listbox">
          <input
            type="text"
            className="archive-dropdown__search"
            placeholder={`Buscar ${label.toLowerCase()}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="archive-dropdown__options">
            {filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`archive-dropdown__option ${option.value === value ? 'is-active' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
            {filtered.length === 0 && <div className="archive-dropdown__empty">Sin resultados</div>}
          </div>
        </div>
      )}
    </div>
  );
};
