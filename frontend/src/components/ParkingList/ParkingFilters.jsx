import React from 'react';

const FILTERS = [
  { key: 'all',      label: 'Tous' },
  { key: 'available', label: 'Disponibles' },
  { key: 'almost',   label: 'Presque pleins' },
];

export default function ParkingFilters({ active, onChange }) {
  return (
    <div className="filter-buttons">
      {FILTERS.map(f => (
        <button
          key={f.key}
          className={`filter-btn${active === f.key ? ' active' : ''}`}
          onClick={() => onChange(f.key)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
