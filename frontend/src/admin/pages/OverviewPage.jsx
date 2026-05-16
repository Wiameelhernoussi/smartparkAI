import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import config from '../../config';

const OverviewPage = () => {
  const { adminFetch } = useAdminAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const response = await adminFetch(`${config.http}/admin/overview`);
      if (response && response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (err) {
      console.error("Fetch overview failed", err);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [adminFetch]);

  if (loading && !data) return <div className="loading">Chargement...</div>;

  return (
    <div className="overview-container">
      <div className="kpi-grid">
        <div className="kpi-card glass">
          <div className="kpi-label">Places libres</div>
          <div className="kpi-value green">{data?.total_free_spots || 0}</div>
          <div className="kpi-icon">🚗</div>
        </div>
        <div className="kpi-card glass">
          <div className="kpi-label">Parkings saturés</div>
          <div className="kpi-value red">{data?.saturated_parkings || 0}</div>
          <div className="kpi-icon">⚠️</div>
        </div>
        <div className="kpi-card glass">
          <div className="kpi-label">Anomalies actives</div>
          <div className="kpi-value orange">{data?.active_anomalies || 0}</div>
          <div className="kpi-icon">🚨</div>
        </div>
        <div className="kpi-card glass">
          <div className="kpi-label">Frames à annoter</div>
          <div className="kpi-value blue">{data?.pending_annotations || 0}</div>
          <div className="kpi-icon">📸</div>
        </div>
      </div>

      <div className="section-title">État des Parkings</div>
      
      <div className="table-container glass">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Parking</th>
              <th>Taux libre</th>
              <th>Places</th>
              <th>Caméra</th>
              <th>Anomalies</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.parkings.map(parking => (
              <tr key={parking.id}>
                <td className="parking-name">{parking.nom}</td>
                <td>
                  <div className="progress-container">
                    <div 
                      className={`progress-bar ${parking.taux_libre < 10 ? 'critical' : parking.taux_libre < 30 ? 'warning' : 'ok'}`} 
                      style={{ width: `${parking.taux_libre}%` }}
                    ></div>
                    <span className="progress-text">{parking.taux_libre}%</span>
                  </div>
                </td>
                <td><span className="count">{parking.free}</span> / {parking.total}</td>
                <td><span className="status-badge online">Online</span></td>
                <td>
                  {parking.active_anomalies > 0 ? (
                    <span className="anomaly-badge">{parking.active_anomalies}</span>
                  ) : '—'}
                </td>
                <td>
                  <button 
                    className="action-btn"
                    onClick={() => window.open(`/parking/${parking.id}`, '_blank')}
                  >
                    Voir détail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .overview-container { display: flex; flex-direction: column; gap: 2rem; }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
        }

        .kpi-card {
          padding: 1.5rem;
          border-radius: 16px;
          position: relative;
          overflow: hidden;
        }

        .kpi-label { color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.5rem; }
        .kpi-value { font-size: 2rem; font-weight: 700; }
        .kpi-icon { position: absolute; right: 1rem; top: 1rem; opacity: 0.2; font-size: 2rem; }

        .green { color: #10b981; }
        .red { color: #ef4444; }
        .orange { color: #f59e0b; }
        .blue { color: #3b82f6; }

        .section-title { font-size: 1.1rem; font-weight: 600; margin-top: 1rem; }

        .glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
        }

        .table-container { padding: 1rem; }

        .admin-table { width: 100%; border-collapse: collapse; text-align: left; }
        .admin-table th { padding: 1rem; color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        .admin-table td { padding: 1.2rem 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.02); }

        .parking-name { font-weight: 600; }

        .progress-container {
          width: 140px;
          height: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          position: relative;
          display: flex;
          align-items: center;
        }

        .progress-bar { height: 100%; border-radius: 4px; transition: width 0.5s ease-out; }
        .progress-bar.ok { background: #10b981; }
        .progress-bar.warning { background: #f59e0b; }
        .progress-bar.critical { background: #ef4444; }

        .progress-text { position: absolute; right: -40px; font-size: 0.75rem; color: #cbd5e1; }

        .status-badge {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-badge.online { background: rgba(16, 185, 129, 0.1); color: #10b981; }

        .anomaly-badge {
          background: #ef4444;
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .action-btn {
          background: rgba(99, 102, 241, 0.1);
          color: #818cf8;
          border: 1px solid rgba(99, 102, 241, 0.2);
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .action-btn:hover { background: rgba(99, 102, 241, 0.2); }

        .loading { text-align: center; padding: 3rem; color: #94a3b8; }
      `}</style>
    </div>
  );
};

export default OverviewPage;
