import React from 'react';

// Un composant mock pour le plan du parking
const ParkingPlan = ({ parkingId }) => {
  // En situation réelle, on chargerait une image ou un SVG interactif
  // Ici on simule un plan avec des places stylisées
  
  const renderSpots = (count, start) => {
    return Array.from({ length: count }).map((_, i) => {
      // Simuler des places occupées/libres de manière pseudo-aléatoire mais fixe selon l'ID
      const isOccupied = (i + start * 3 + parkingId * 7) % 5 < 3;
      return (
        <div 
          key={i} 
          style={{
            width: '20px',
            height: '40px',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '2px',
            backgroundColor: isOccupied ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.6rem',
            color: 'rgba(255,255,255,0.5)'
          }}
        >
          {isOccupied ? '🚗' : ''}
        </div>
      );
    });
  };

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      minHeight: '200px',
      backgroundColor: 'rgba(0,0,0,0.2)',
      borderRadius: '8px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-around', gap: '4px' }}>
        {renderSpots(10, 0)}
      </div>
      
      {/* Route centrale */}
      <div style={{ 
        height: '40px', 
        width: '100%', 
        borderTop: '2px dashed rgba(255,255,255,0.2)', 
        borderBottom: '2px dashed rgba(255,255,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '4px' }}>
           ← ALLÉE PRINCIPALE →
        </span>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-around', gap: '4px' }}>
        {renderSpots(10, 10)}
      </div>
    </div>
  );
};

export default ParkingPlan;
