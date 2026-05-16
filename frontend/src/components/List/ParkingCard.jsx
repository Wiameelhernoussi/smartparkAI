import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistance, calculateTravelTime, formatTravelTime } from '../../utils/geolocation';
import { Navigation, Car, Timer, Footprints } from 'lucide-react';

const ParkingCard = ({ parking, distance }) => {
  let statusColor = 'var(--status-red)';
  let statusText = 'Plein';
  let badgeBg = 'rgba(239, 68, 68, 0.1)';

  if (parking.taux_libre > 30) {
    statusColor = 'var(--status-green)';
    statusText = 'Libre';
    badgeBg = 'rgba(0, 212, 170, 0.1)';
  } else if (parking.taux_libre >= 10) {
    statusColor = 'var(--status-orange)';
    statusText = 'Limité';
    badgeBg = 'rgba(245, 158, 11, 0.1)';
  }

  const occupancyRate = 100 - parking.taux_libre;

  return (
    <Link to={parking.id != null ? `/parking/${parking.id}` : '#'} className="parking-card-new" style={{
      display: 'block', background: 'var(--bg-surface)', borderRadius: 'var(--border-radius-sm)',
      padding: '1.25rem', marginBottom: '1rem', textDecoration: 'none', border: '1px solid var(--glass-border)',
      transition: 'var(--transition)', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'white', marginBottom: '0.25rem' }}>{parking.nom}</h3>
          {distance !== null && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Navigation size={10} /> {formatDistance(distance)}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Car size={10} /> {formatTravelTime(calculateTravelTime(distance, 'driving'))}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Footprints size={10} /> {formatTravelTime(calculateTravelTime(distance, 'walking'))}
              </span>
            </div>
          )}
        </div>
        <div style={{ 
          padding: '4px 10px', borderRadius: '6px', background: badgeBg, color: statusColor, 
          fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em'
        }}>
          {statusText}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'white' }}>{parking.free}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>/ {parking.total} places</span>
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: statusColor }}>{parking.taux_libre}%</span>
      </div>

      <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ 
          height: '100%', width: `${occupancyRate}%`, background: statusColor,
          borderRadius: '10px', transition: 'width 1s ease-out'
        }} />
      </div>

      <style jsx>{`
        .parking-card-new:hover {
          transform: translateY(-4px);
          border-color: var(--accent-primary);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          background: rgba(255,255,255,0.02);
        }
      `}</style>
    </Link>
  );
};

export default ParkingCard;
