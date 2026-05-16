import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
const ParkingMap = lazy(() => import('../components/Map/ParkingMap'));
import FilterBar from '../components/Filters/FilterBar';
import ParkingList from '../components/List/ParkingList';
import { useParkingWebSocket } from '../hooks/useParkingWebSocket';
import { getUserPosition, calculateDistance } from '../utils/geolocation';
import { useLocalNotifications } from '../hooks/useLocalNotifications';
import NaturalSearch from '../components/Filters/NaturalSearch';
import config from '../config';

const MapSkeleton = () => (
  <div className="map-skeleton glass-panel">
    <div className="skeleton-inner">
      <div className="spinner">⌛ Chargement de la carte...</div>
    </div>
    <style jsx>{`
      .map-skeleton {
        height: 500px;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(30, 41, 59, 0.5);
      }
      .skeleton-inner {
        text-align: center;
        color: var(--text-muted);
      }
      .spinner {
        animation: pulse 1.5s infinite;
      }
      @keyframes pulse {
        0% { opacity: 0.5; }
        50% { opacity: 1; }
        100% { opacity: 0.5; }
      }
    `}</style>
  </div>
);

const HomePage = ({ darkMode, setDarkMode }) => {

  const { parkings, connected } = useParkingWebSocket();
  useLocalNotifications(parkings);
  const [userLocation, setUserLocation] = useState(null);
  
  const [filterDistance, setFilterDistance] = useState(null);
  const [filterAvailability, setFilterAvailability] = useState('all');
  const [textSearch, setTextSearch] = useState('');
  
  const [anomalies, setAnomalies] = useState([]);
  const [aiSearchData, setAiSearchData] = useState(null);

  // Demander la géolocalisation au montage
  useEffect(() => {
    getUserPosition()
      .then(pos => setUserLocation(pos))
      .catch(err => {
        console.warn("Géolocalisation refusée ou indisponible", err);
      });
  }, []);

  // Fetch anomalies périodiquement
  useEffect(() => {
    const fetchAnomalies = () => {
      fetch(`${config.http}/anomalies`)
        .then(res => res.json())
        .then(data => setAnomalies(data))
        .catch(err => console.error("Erreur anomalies:", err));
    };
    
    fetchAnomalies(); // appel initial
    const interval = setInterval(fetchAnomalies, 60000);
    return () => clearInterval(interval);
  }, []);


  // Set des parking_id ayant une anomalie active
  const parkingsWithAnomalies = useMemo(() => {
    return new Set(anomalies.map(a => a.parking_id));
  }, [anomalies]);

  // Ajouter l'info anomalie dans les parkings
  const enrichedParkings = useMemo(() => {
    return parkings.map(p => ({
      ...p,
      hasAnomaly: parkingsWithAnomalies.has(p.id)
    }));
  }, [parkings, parkingsWithAnomalies]);

  // Calculer les distances pour tous les parkings
  const distances = useMemo(() => {
    const dists = {};
    if (userLocation && enrichedParkings) {
      enrichedParkings.forEach(p => {
        dists[p.id] = calculateDistance(userLocation.lat, userLocation.lng, p.lat, p.lng);
      });
    }
    return dists;
  }, [userLocation, enrichedParkings]);

  // Filtrer et trier les parkings
  const filteredParkings = useMemo(() => {
    let result = [...enrichedParkings];

    // Si on a des résultats de recherche IA, on filtre par IDs
    if (aiSearchData && aiSearchData.parking_ids) {
      result = result.filter(p => aiSearchData.parking_ids.includes(p.id));
    } else {
      // Sinon on applique les filtres manuels classiques
      // Filtre disponibilité
      if (filterAvailability === 'available') {
        result = result.filter(p => p.taux_libre >= 10);
      } else if (filterAvailability === 'full') {
        result = result.filter(p => p.taux_libre < 10);
      }

      // Filtre distance
      if (filterDistance !== null && userLocation) {
        result = result.filter(p => distances[p.id] <= filterDistance);
      }

      // Filtre texte (nom ou adresse)
      if (textSearch) {
        const query = textSearch.toLowerCase();
        result = result.filter(p => 
          p.nom.toLowerCase().includes(query) || 
          (p.address && p.address.toLowerCase().includes(query))
        );
      }
    }

    // Tri par distance (si connue)
    if (userLocation) {
      result.sort((a, b) => distances[a.id] - distances[b.id]);
    }

    return result;
  }, [enrichedParkings, filterAvailability, filterDistance, distances, userLocation, aiSearchData]);

  return (
    <div className={`home-layout ${!darkMode ? 'light-mode' : ''}`}>
      {/* Indicateur IA flottant avec animation pulse tech */}
      <div className="ai-indicator-floating">
        <div className="ai-pulse-dot" />
        <span style={{ fontSize: '0.8rem', fontWeight: '700', letterSpacing: '0.05em' }}>AI ENGINE ACTIVE</span>
      </div>

      <Suspense fallback={<MapSkeleton />}>
        <ParkingMap parkings={filteredParkings} userLocation={userLocation} darkMode={darkMode} />
      </Suspense>

      <div className="side-panel" style={{ width: 'var(--side-panel-width)' }}>
        <div className="side-panel-header" style={{ padding: '1.5rem', background: 'rgba(26, 29, 39, 0.4)' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'white' }}>Parkings</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Marrakech • Temps réel</p>
          </div>
          
          <NaturalSearch 
            parkings={enrichedParkings} 
            onSearchResults={(data) => setAiSearchData(data)} 
          />
        </div>

        <div className="side-panel-body" style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
          {aiSearchData && (
            <div className="ai-feedback" style={{ 
              marginBottom: '1.5rem', padding: '1rem', 
              background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.1), rgba(168, 85, 247, 0.1))',
              border: '1px solid rgba(108, 99, 255, 0.2)', borderRadius: 'var(--border-radius-sm)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                <span style={{ fontWeight: '800', color: 'var(--accent-primary)', display: 'block', marginBottom: '2px' }}>AI INSIGHT</span>
                <span style={{ color: 'var(--text-primary)' }}>{aiSearchData.reason}</span>
              </div>
              <button 
                onClick={() => setAiSearchData(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <FilterBar 
              filterDistance={filterDistance}
              setFilterDistance={setFilterDistance}
              filterAvailability={filterAvailability}
              setFilterAvailability={setFilterAvailability}
              userLocation={userLocation}
              textSearch={textSearch}
              setTextSearch={setTextSearch}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
            />
          </div>

          <ParkingList 
            parkings={filteredParkings} 
            userLocation={userLocation}
            distances={distances}
          />
        </div>
      </div>

      <style jsx>{`
        .ai-indicator-floating {
          position: fixed;
          bottom: 2rem;
          left: 2rem;
          z-index: 2000;
          background: rgba(26, 29, 39, 0.9);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(108, 99, 255, 0.3);
          padding: 8px 16px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: white;
          box-shadow: 0 8px 32px rgba(108, 99, 255, 0.2);
        }
        .ai-pulse-dot {
          width: 8px;
          height: 8px;
          background: var(--accent-primary);
          border-radius: 50%;
          box-shadow: 0 0 12px var(--accent-primary);
          animation: ai-pulse 2s infinite;
        }
        @keyframes ai-pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default HomePage;
