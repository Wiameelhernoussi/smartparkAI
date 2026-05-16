import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOccupancyColor, getOccupancyStatus } from '../../utils/parkingUtils';

export default function ParkingCard({ parking, index }) {
  const navigate  = useNavigate();
  const prevFree  = useRef(parking.free);
  const cardRef   = useRef(null);

  // Flash animation when free count changes
  useEffect(() => {
    if (prevFree.current !== parking.free && cardRef.current) {
      cardRef.current.classList.add('marker-flash');
      setTimeout(() => cardRef.current?.classList.remove('marker-flash'), 400);
    }
    prevFree.current = parking.free;
  }, [parking.free]);

  const color  = getOccupancyColor(parking.taux_libre);
  const status = getOccupancyStatus(parking.taux_libre);
  const pctOcc = Math.round(100 - parking.taux_libre);

  return (
    <div
      ref={cardRef}
      className="parking-card"
      style={{ animationDelay: `${index * 0.08}s` }}
      onClick={() => parking.id != null && navigate(`/parking/${parking.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && parking.id != null && navigate(`/parking/${parking.id}`)}
    >
      <div className="parking-card-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="parking-card-name">{parking.nom}</div>
          <div className="parking-card-address">{parking.address}</div>
        </div>
        <div className="parking-card-free">
          <div className="parking-card-free-count" style={{ color }}>
            {parking.free}
          </div>
          <div className="parking-card-free-label">libres</div>
        </div>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${pctOcc}%`, background: color }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className={`status-badge ${status.cls}`}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          {status.label}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {parking.free}/{parking.total} places
        </span>
      </div>
    </div>
  );
}
