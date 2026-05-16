import React, { useMemo } from 'react';

export default function ParkingGrid({ free, total }) {
  const cols = 10;
  const rows = Math.ceil(total / cols);

  const spots = useMemo(() => {
    const arr = [];
    for (let i = 0; i < total; i++) {
      arr.push({ id: i, isFree: i < free });
    }
    return arr;
  }, [free, total]);

  return (
    <div className="grid-section">
      <div className="section-title"><span>🅿</span> Plan du parking</div>
      <div className="parking-grid-legend">
        <span><span className="legend-dot" style={{ background: 'rgba(34,197,94,0.6)' }} />Libre ({free})</span>
        <span><span className="legend-dot" style={{ background: 'rgba(239,68,68,0.5)' }} />Occupée ({total - free})</span>
      </div>
      <div
        className="parking-spots-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {spots.map(spot => (
          <div
            key={spot.id}
            className={`parking-spot ${spot.isFree ? 'free' : 'occupied'}`}
            title={spot.isFree ? 'Libre' : 'Occupée'}
          />
        ))}
      </div>
      <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Grille {cols}×{rows} — {total} places au total
      </div>
    </div>
  );
}
