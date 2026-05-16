import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import config from '../../config';

const AnomaliesPage = () => {
  const { adminFetch } = useAdminAuth();
  const [anomalies, setAnomalies] = useState([]);
  const [filterParking, setFilterParking] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);

  const fetchAnomalies = async () => {
    try {
      const response = await adminFetch(`${config.http}/anomalies`);
      if (response && response.ok) {
        const data = await response.json();
        setAnomalies(data);
      }
    } catch (err) {
      console.error("Fetch anomalies failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
    const interval = setInterval(fetchAnomalies, 30000);
    return () => clearInterval(interval);
  }, [adminFetch]);

  const handleResolve = async (id) => {
    setResolvingId(id);
    try {
      const response = await adminFetch(`${config.http}/anomalies/${id}/resolve`, {
        method: 'POST'
      });

      if (response && response.ok) {
        // Animation fake delay
        setTimeout(() => {
          setAnomalies(prev => prev.filter(a => a.id !== id));
          setResolvingId(null);
        }, 500);
      }
    } catch (err) {
      console.error("Resolve anomaly failed", err);
      setResolvingId(null);
    }
  };

  const getParkingName = (id) => {
    const names = { 1: 'Guéliz', 2: 'Jemaa el-Fna', 3: 'Majorelle' };
    return names[id] || `Parking ${id}`;
  };

  const getTypeLabel = (type) => {
    const labels = {
      "sudden_change": "Changement brutal",
      "prolonged_saturation": "Saturation prolongée",
      "unusual_empty": "Vide inhabituel"
    };
    return labels[type] || type;
  };

  const filtered = anomalies.filter(a => {
    const pMatch = filterParking === 'all' || a.parking_id.toString() === filterParking;
    const sMatch = filterSeverity === 'all' || a.severity === filterSeverity;
    return pMatch && sMatch;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date inconnue';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        const date2 = new Date(dateStr.replace(' ', 'T'));
        if (isNaN(date2.getTime())) return 'Date inconnue';
        return date2.toLocaleString('fr-FR');
      }
      return date.toLocaleString('fr-FR');
    } catch {
      return 'Date inconnue';
    }
  };

  return (
    <div className="anomalies-container">
      <div className="filter-bar glass">
        <div className="filter-group">
          <label>Parking</label>
          <select value={filterParking} onChange={(e) => setFilterParking(e.target.value)}>
            <option value="all">Tous les parkings</option>
            <option value="1">Parking Guéliz</option>
            <option value="2">Parking Jemaa el-Fna</option>
            <option value="3">Parking Majorelle</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Sévérité</label>
          <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
            <option value="all">Toutes</option>
            <option value="high">Haute</option>
            <option value="medium">Moyenne</option>
            <option value="low">Basse</option>
          </select>
        </div>
      </div>

      <div className="table-container glass">
        {loading ? (
          <div className="loading">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="icon">✅</span>
            <p>Aucune anomalie active</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Parking</th>
                <th>Type</th>
                <th>Sévérité</th>
                <th>Détecté à</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(anomaly => (
                <tr 
                  key={anomaly.id} 
                  className={`anomaly-row ${anomaly.severity} ${resolvingId === anomaly.id ? 'resolving' : ''}`}
                >
                  <td className="parking-cell">{getParkingName(anomaly.parking_id)}</td>
                  <td>{getTypeLabel(anomaly.type)}</td>
                  <td>
                    <span className={`severity-tag ${anomaly.severity}`}>
                      {anomaly.severity === 'high' ? 'Haute' : anomaly.severity === 'medium' ? 'Moyenne' : 'Basse'}
                    </span>
                  </td>
                  <td className="time-cell">{formatDate(anomaly.timestamp)}</td>
                  <td><span className="status-tag active">En cours</span></td>
                  <td>
                    <button 
                      className="resolve-btn"
                      onClick={() => handleResolve(anomaly.id)}
                      disabled={resolvingId === anomaly.id}
                    >
                      {resolvingId === anomaly.id ? '...' : 'Résoudre'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style jsx>{`
        .anomalies-container { display: flex; flex-direction: column; gap: 1.5rem; }

        .filter-bar {
          padding: 1.25rem;
          display: flex;
          gap: 2rem;
          border-radius: 12px;
        }

        .filter-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .filter-group label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }

        select {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          min-width: 180px;
        }

        .glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
        }

        .table-container { padding: 1rem; min-height: 400px; }

        .admin-table { width: 100%; border-collapse: collapse; text-align: left; }
        .admin-table th { padding: 1rem; color: #94a3b8; font-size: 0.8rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        .admin-table td { padding: 1.2rem 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.02); }

        .anomaly-row.high { border-left: 4px solid #ef4444; }
        .anomaly-row.medium { border-left: 4px solid #f59e0b; }
        .anomaly-row.low { border-left: 4px solid #3b82f6; }

        .anomaly-row.resolving {
          opacity: 0;
          transform: translateX(20px);
          transition: all 0.5s ease;
        }

        .severity-tag {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
        }
        .severity-tag.high { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .severity-tag.medium { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .severity-tag.low { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

        .status-tag.active { color: #f59e0b; font-size: 0.8rem; }

        .resolve-btn {
          background: #10b981;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .resolve-btn:hover:not(:disabled) { background: #059669; }
        .resolve-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: #94a3b8;
        }
        .empty-state .icon { font-size: 3rem; margin-bottom: 1rem; }

        .loading { text-align: center; padding: 3rem; color: #94a3b8; }
      `}</style>
    </div>
  );
};

export default AnomaliesPage;
