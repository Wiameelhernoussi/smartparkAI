import React from 'react';
import ParkingCard from './ParkingCard';

const ParkingList = ({ parkings, userLocation, distances }) => {
  if (parkings.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Aucun parking ne correspond à vos critères.
      </div>
    );
  }

  return (
    <div className="parking-grid">
      {parkings.map(parking => (
        <ParkingCard 
          key={parking.id} 
          parking={parking} 
          distance={distances[parking.id] ?? null}
        />
      ))}
    </div>
  );
};

export default ParkingList;
