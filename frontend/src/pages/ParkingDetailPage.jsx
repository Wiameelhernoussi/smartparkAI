import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, DollarSign } from 'lucide-react';
import { useParkingWebSocket } from '../hooks/useParkingWebSocket';
import OccupancyGauge from '../components/Detail/OccupancyGauge';
import OccupancyChart24h from '../components/Detail/OccupancyChart24h';
import PredictionWidget from '../components/Detail/PredictionWidget';
import ParkingPlan from '../components/Detail/ParkingPlan';
import VehicleComposition from '../components/Detail/VehicleComposition';
import config from '../config';

const ParkingDetailPage = ({ darkMode }) => {
  const { id } = useParams();
  const { parkings } = useParkingWebSocket();
  const [parking, setParking] = useState(null);

  useEffect(() => {
    document.body.classList.add('scrollable');
    document.getElementById('root')?.classList.add('scrollable');
    return () => {
      document.body.classList.remove('scrollable');
      document.getElementById('root')?.classList.remove('scrollable');
    };
  }, []);

  useEffect(() => {
    if (!id || id === 'undefined') return;
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) return;

    const found = parkings.find(p => p.id === parsedId);
    if (found) {
      setParking(found);
    } else {
      fetch(`${config.http}/parkings/${parsedId}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) setParking(data);
        })
        .catch(err => console.error('Erreur API Parking: ', err));
    }
  }, [id, parkings]);

  if (!parking) return null;

  const tauxLibre = parking.taux_libre ?? (parking.total > 0 ? Math.round((parking.free / parking.total) * 100) : 0);
  const statusColor = tauxLibre > 30
    ? 'var(--accent-green)'
    : tauxLibre > 10
    ? 'var(--accent-orange)'
    : 'var(--accent-red)';

  return (
    <div className={`detail-page ${!darkMode ? 'light-theme' : ''}`}>
      <style jsx>{`
        .light-theme.detail-page {
          background: #ffffff !important;
          color: #000000 !important;
        }
        .light-theme h1, 
        .light-theme h2,
        .light-theme h3,
        .light-theme .parking-title {
          color: #000000 !important;
        }
        .light-theme .text-secondary,
        .light-theme span,
        .light-theme div,
        .light-theme p {
          color: #000000 !important;
        }
        .light-theme .back-btn {
          color: #000000 !important;
        }
        .light-theme .back-btn:hover {
          color: var(--accent-primary) !important;
        }
        .light-theme .glass-panel {
          background: white !important;
          border-color: #e2e8f0 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
        }
      `}</style>
      <div className="detail-content">
        {/* Retour */}
        <Link to="/" className="back-btn">
          <ArrowLeft size={18} /> Retour à la carte
        </Link>

        {/* Hero */}
        <div className="hero-section">
          <div className="hero-info">
            <h1>{parking.nom}</h1>
            <div className="hero-address">
              <MapPin size={15} />
              <span>{parking.address || "Adresse non disponible"}</span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--accent-orange)' }}>
                <DollarSign size={14} /> <b>Tarif :</b> {parking.tarif || "N/A"}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--accent-green)' }}>
                <Clock size={14} /> <b>Horaires :</b> {parking.horaires || "N/A"}
              </div>
            </div>
            <div style={{ marginTop: '1.25rem' }}>
              <a 
                href={`https://www.openstreetmap.org/directions?to=${parking.lat},${parking.lng}`}
                target="_blank" 
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'var(--accent-primary)',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}
              >
                🧭 Itinéraire
              </a>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '3.5rem', fontWeight: '800', color: statusColor, fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>
              {parking.free}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.3rem' }}>
              places libres sur {parking.total}
            </div>
          </div>
        </div>

        {/* Widgets */}
        <OccupancyGauge free={parking.free} busy={parking.busy} darkMode={darkMode} />
        <VehicleComposition parkingId={parking.id} />
        <PredictionWidget parkingId={parking.id} currentTaux={tauxLibre} />
        <OccupancyChart24h parkingId={parking.id} />
        
        {/* Plan du parking */}
        <div className="glass-panel widget" style={{ gridColumn: '1 / -1' }}>
          <h3 className="widget-title">Plan Schématique</h3>
          <ParkingPlan parkingId={parking.id} />
        </div>
      </div>
    </div>
  );
};

export default ParkingDetailPage;

