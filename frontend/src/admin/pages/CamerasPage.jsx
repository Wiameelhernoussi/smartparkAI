import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import config from '../../config';

const CameraCard = ({ parking, adminFetch }) => {
  const [frameData, setFrameData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchFrame = useCallback(async () => {
    try {
      const response = await adminFetch(`${config.http}/admin/cameras/${parking.parking_id}/live`);
      if (response && response.ok) {
        const data = await response.json();
        setFrameData(data);
      }
    } catch (err) {
      console.error(`Failed to fetch live frame for ${parking.parking_id}`, err);
    } finally {
      setLoading(false);
    }
  }, [parking.parking_id, adminFetch]);


  useEffect(() => {
    fetchFrame();
    const interval = setInterval(fetchFrame, 10000);
    return () => clearInterval(interval);
  }, [fetchFrame]);

  return (
    <div className="camera-card glass">
      <div className="card-header">
        <div className="parking-info">
          <h3>{parking.parking_nom}</h3>
          <span className="status-badge online">🟢 En direct</span>
        </div>
        <button className="refresh-btn" onClick={fetchFrame}>🔄</button>
      </div>

      <div className="frame-container">
        {loading && !frameData ? (
          <div className="placeholder">Chargement...</div>
        ) : frameData?.image_base64 ? (
          <>
            <img src={`data:image/jpeg;base64,${frameData.image_base64}`} loading="lazy" alt="Analyse en direct" />
            <div className="frame-overlay live">
               <span className="live-dot">🔴</span> LIVE · {new Date(frameData.timestamp).toLocaleTimeString()}
            </div>
          </>
        ) : (
          <div className="placeholder empty">
            <span>📷</span>
            <p>Aucune frame disponible</p>
          </div>
        )}
      </div>

      <div className="card-footer">
        <div className="stat">
          <label>Inférence</label>
          <div className="val">{parking.avg_inference_ms}ms</div>
        </div>
        <div className="stat">
          <label>Frames</label>
          <div className="val">{parking.frames_analyzed_today}</div>
        </div>
        <div className="stat">
          <label>Source Vidéo</label>
          <div className="val video-name" title={parking.video}>{parking.video?.split('/').pop()}</div>
        </div>
      </div>

      <style jsx>{`
        .camera-card { padding: 1.25rem; }
        
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.25rem;
        }

        .parking-info h3 { margin: 0; font-size: 1.1rem; }
        .status-badge { font-size: 0.7rem; color: #10b981; font-weight: 600; }

        .refresh-btn {
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .refresh-btn:hover { background: rgba(255, 255, 255, 0.1); }

        .frame-container {
          width: 100%;
          aspect-ratio: 16/9;
          background: #000;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
        }

        .frame-container img { width: 100%; height: 100%; object-fit: cover; }

        .placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #4b5563;
        }

        .placeholder.empty { background: #1f2937; color: #94a3b8; }
        .placeholder.empty span { font-size: 2.5rem; margin-bottom: 0.5rem; }

        .frame-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: 10px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
          font-size: 0.75rem;
          color: rgba(255,255,255,0.8);
        }

        .frame-overlay.live {
          top: auto;
          bottom: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          color: white;
        }

        .live-dot {
          color: #ef4444;
          font-size: 10px;
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }

        .card-footer {
          margin-top: 1.25rem;
          display: grid;
          grid-template-columns: 1fr 1fr 1.5fr;
          gap: 1rem;
        }
        .video-name { 
          white-space: nowrap; 
          overflow: hidden; 
          text-overflow: ellipsis; 
          color: #3b82f6;
        }

        .stat label { display: block; font-size: 0.7rem; color: #64748b; margin-bottom: 2px; }
        .stat .val { font-size: 0.9rem; font-weight: 600; }
      `}</style>
    </div>
  );
};

const CamerasPage = () => {
  const { adminFetch } = useAdminAuth();
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchCameras = async () => {
    try {
      const response = await adminFetch(`${config.http}/admin/cameras`);
      if (response && response.ok) {
        const data = await response.json();
        setCameras(data.cameras);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error("Fetch cameras failed", err);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchCameras();
    const interval = setInterval(fetchCameras, 10000);
    return () => clearInterval(interval);
  }, [adminFetch]);

  if (loading && cameras.length === 0) return <div className="loading">Chargement des flux...</div>;

  return (
    <div className="cameras-container">
      <div className="camera-grid">
        {cameras.map(cam => (
          <CameraCard key={cam.parking_id} parking={cam} adminFetch={adminFetch} />
        ))}
      </div>

      <div className="vehicle-comparison glass" style={{ marginTop: '3rem', padding: '1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            🚗 Comparaison du Trafic (Temps Réel)
          </h2>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', display: 'block' }}>
            🔄 Mise à jour automatique toutes les 10s 
            {lastRefresh && ` — Dernière : ${lastRefresh.toLocaleTimeString()}`}
          </span>
        </div>
        
        <table className="admin-table">
          <thead>
            <tr>
              <th>Parking</th>
              <th>Voitures</th>
              <th>Motos</th>
              <th>Camions</th>
              <th>Bus</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {cameras.map(cam => {
              // Note: etat_parkings data comes through /admin/cameras as well
              // but let's assume cam has the vehicle counts if they were added to etat_parkings
              const v = cam.vehicles || { cars: 0, motorcycles: 0, trucks: 0, buses: 0 };
              const total = v.cars + v.motorcycles + v.trucks + v.buses;
              return (
                <tr key={cam.parking_id}>
                  <td style={{ fontWeight: 600 }}>{cam.parking_nom}</td>
                  <td>{v.cars}</td>
                  <td>{v.motorcycles}</td>
                  <td>{v.trucks}</td>
                  <td>{v.buses}</td>
                  <td style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {cameras.length > 0 && (
          <div className="traffic-insight" style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#94a3b8', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px' }}>
            💡 <b>Statistique intéressante :</b> {
              (() => {
                const totalMotos = cameras.reduce((acc, cam) => acc + (cam.vehicles?.motorcycles || 0), 0);
                const totalVehicles = cameras.reduce((acc, cam) => {
                  const v = cam.vehicles || { cars: 0, motorcycles: 0, trucks: 0, buses: 0 };
                  return acc + v.cars + v.motorcycles + v.trucks + v.buses;
                }, 0);
                const motoPercent = totalVehicles > 0 ? Math.round((totalMotos / totalVehicles) * 100) : 0;
                
                const topMotoParking = [...cameras].sort((a, b) => 
                  ((b.vehicles?.motorcycles || 0) / Math.max(1, (b.vehicles?.cars || 0) + (b.vehicles?.motorcycles || 0))) - 
                  ((a.vehicles?.motorcycles || 0) / Math.max(1, (a.vehicles?.cars || 0) + (a.vehicles?.motorcycles || 0)))
                )[0];

                return `Les motos représentent ${motoPercent}% du trafic total détecté. Le parking ${topMotoParking?.parking_nom} affiche la plus forte proportion de deux-roues.`;
              })()
            }
          </div>
        )}
      </div>

      <style jsx>{`
        .admin-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }
        .admin-table th {
          text-align: left;
          padding: 1rem;
          color: #64748b;
          font-weight: 500;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .admin-table td {
          padding: 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.02);
        }
        .admin-table tr:hover { background: rgba(255,255,255,0.01); }
      `}</style>

      <style jsx>{`
        .cameras-container { display: flex; flex-direction: column; }
        
        .camera-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          gap: 2rem;
        }

        .loading { text-align: center; padding: 3rem; color: #94a3b8; }
        
        .glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
        }
      `}</style>
    </div>
  );
};

export default CamerasPage;
