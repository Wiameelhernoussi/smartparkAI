import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import config from '../../config';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const StatsPage = () => {
  const { adminFetch } = useAdminAuth();
  const [parkingId, setParkingId] = useState('1');
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lstmPerformance, setLstmPerformance] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await adminFetch(`${config.http}/admin/stats?parking_id=${parkingId}&period=${period}`);
      if (response && response.ok) {
        const result = await response.json();
        console.log('Stats data:', result);
        console.log('Heatmap:', result.heatmap);
        setData(result);
      }
    } catch (err) {
      console.error("Fetch stats failed", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLstmPerformance = async () => {
    try {
      const response = await adminFetch(`${config.http}/api/lstm/performance`);
      if (response && response.ok) {
        const result = await response.json();
        setLstmPerformance(result.models);
      }
    } catch (err) {
      console.error("Fetch LSTM performance failed", err);
    }
  };

  const [parkings, setParkings] = useState([]);

  const fetchParkings = async () => {
    try {
      const res = await adminFetch(`${config.http}/admin/parkings`);
      if (res && res.ok) {
        const data = await res.json();
        setParkings(data);
      }
    } catch (err) {
      console.error("Fetch parkings failed", err);
    }
  };

  useEffect(() => {
    fetchParkings();
  }, [adminFetch]);

  useEffect(() => {
    fetchStats();
    fetchLstmPerformance();
  }, [parkingId, period, adminFetch]);

  const handleExport = async () => {
    try {
      const response = await adminFetch(`${config.http}/admin/stats/export?parking_id=${parkingId}&period=${period}`);
      if (response && response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smartpark_export_${parkingId}_${period}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await adminFetch(`${config.http}/admin/stats/export-pdf?parking_id=${parkingId}&period=${period}`);
      if (response && response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rapport_SmartPark_${parkingId}_${period}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("PDF Export failed", err);
    }
  };


  const getHeatmapValue = (day, hour) => {
    if (!data?.heatmap) return null;
    const entry = data.heatmap.find(h => h.day.toLowerCase() === day.toLowerCase() && h.hour === hour);
    return entry ? entry.avg_occupancy : null;
  };

  const getCellColor = (value) => {
    if (value === null) return 'rgba(255, 255, 255, 0.05)'; // Gris foncé/neutre
    if (value < 30) return '#065f46'; // vert foncé
    if (value < 60) return '#d97706'; // orange
    if (value < 80) return '#ef4444'; // rouge clair
    return '#991b1b'; // rouge foncé
  };

  return (
    <div className="stats-container">
      <div className="stats-header glass">
        <div className="controls">
          <select value={parkingId} onChange={(e) => setParkingId(e.target.value)}>
            <option value="0">🌍 Tous les parkings</option>
            {parkings.map(p => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
          <div className="period-btns">
            <button className={period === 'today' ? 'active' : ''} onClick={() => setPeriod('today')}>Aujourd'hui</button>
            <button className={period === 'week' ? 'active' : ''} onClick={() => setPeriod('week')}>Semaine</button>
            <button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>Mois</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="export-btn csv" onClick={handleExport}>
            <span>📊</span> CSV
          </button>
          <button className="export-btn pdf" style={{ background: '#ef4444' }} onClick={handleExportPDF}>
            <span>📕</span> PDF
          </button>
        </div>
      </div>

      <div className="kpi-row">
        <div className="stat-box glass">
          <label>Occupation moyenne</label>
          <div className="val">{data?.avg_occupancy || 0}%</div>
        </div>
        <div className="stat-box glass">
          <label>Heure de pointe</label>
          <div className="val">{data?.peak_hour || '--:--'}</div>
        </div>
        <div className="stat-box glass">
          <label>Heure creuse</label>
          <div className="val">{data?.quietest_hour || '--:--'}</div>
        </div>
        <div className="stat-box glass">
          <label>Mesures totales</label>
          <div className="val">{data?.total_measurements?.toLocaleString() || 0}</div>
        </div>
      </div>

      <div className="heatmap-section glass">
        <h3>Carte de chaleur d'occupation (%)</h3>
        <div className="heatmap-grid">
          <div className="hour-labels">
            {HOURS.map(h => <div key={h} className="hour-label">{h}h</div>)}
          </div>
          <div className="days-container">
            {DAYS.map(day => (
              <div key={day} className="day-column">
                <div className="day-label">{day.substring(0, 3)}</div>
                {HOURS.map(hour => {
                  const val = getHeatmapValue(day, hour);
                  return (
                    <div 
                      key={hour} 
                      className="heatmap-cell"
                      style={{ backgroundColor: getCellColor(val) }}
                      title={val !== null ? `${day} ${hour}h : ${val}% d'occupation` : 'Pas de données'}
                    >
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="legend">
          <span>Faible</span>
          <div className="gradient"></div>
          <span>Élevée</span>
          <div className="no-data-box"></div>
          <span>Pas de données</span>
        </div>
      </div>

      <div className="lstm-section glass">
        <h3>📊 Performance du Modèle LSTM</h3>
        <p className="section-desc">Erreur Moyenne Absolue (MAE) par horizon de temps. Un score plus bas est meilleur.</p>
        
        {lstmPerformance ? (
          <div className="lstm-table-container">
            <table className="lstm-table">
              <thead>
                <tr>
                  <th>Parking</th>
                  <th>MAE 15min</th>
                  <th>MAE 30min</th>
                  <th>MAE 60min</th>
                  <th>Séquences</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {lstmPerformance.map(perf => {
                  const getStatus = (val) => {
                    if (val < 5) return { label: 'Excellent', color: '#10b981' };
                    if (val < 10) return { label: 'Bon', color: '#f59e0b' };
                    return { label: 'À améliorer', color: '#ef4444' };
                  };
                  const avgMae = (perf.mae_15min + perf.mae_30min + perf.mae_60min) / 3;
                  const status = getStatus(avgMae);

                  return (
                    <tr key={perf.parking_id}>
                      <td className="p-name">{perf.parking_nom}</td>
                      <td style={{ color: getStatus(perf.mae_15min).color }}>{perf.mae_15min.toFixed(2)}%</td>
                      <td style={{ color: getStatus(perf.mae_30min).color }}>{perf.mae_30min.toFixed(2)}%</td>
                      <td style={{ color: getStatus(perf.mae_60min).color }}>{perf.mae_60min.toFixed(2)}%</td>
                      <td>{perf.n_train}</td>
                      <td>
                        <span className="badge" style={{ backgroundColor: `${status.color}20`, color: status.color }}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-lstm">Aucun modèle entraîné disponible</div>
        )}
      </div>

      <style jsx>{`
        .stats-container { display: flex; flex-direction: column; gap: 2rem; }

        .stats-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem;
        }

        .controls { display: flex; gap: 1.5rem; align-items: center; }

        select {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 0.6rem 1.2rem;
          border-radius: 10px;
        }

        .period-btns {
          display: flex;
          background: rgba(0, 0, 0, 0.2);
          padding: 4px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .period-btns button {
          background: transparent;
          border: none;
          color: #94a3b8;
          padding: 6px 16px;
          border-radius: 8px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .period-btns button.active {
          background: rgba(99, 102, 241, 0.2);
          color: #818cf8;
          font-weight: 600;
        }

        .export-btn {
          background: #6366f1;
          color: white;
          border: none;
          padding: 0.7rem 1.5rem;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
        }

        .kpi-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
        }

        .stat-box { padding: 1.5rem; }
        .stat-box label { display: block; color: #94a3b8; font-size: 0.8rem; margin-bottom: 0.5rem; }
        .stat-box .val { font-size: 1.5rem; font-weight: 700; }

        .heatmap-section { padding: 2rem; }
        .heatmap-section h3 { margin: 0 0 2rem 0; font-size: 1.1rem; }

        .heatmap-grid {
          display: flex;
          gap: 1rem;
        }

        .hour-labels {
          display: flex;
          flex-direction: column;
          margin-top: 25px;
          gap: 0;
        }

        .hour-label {
          height: 20px;
          font-size: 0.7rem;
          color: #64748b;
          display: flex;
          align-items: center;
        }

        .days-container {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
        }

        .day-column {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .day-label {
          text-align: center;
          font-size: 0.75rem;
          color: #94a3b8;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .heatmap-cell {
          height: 20px;
          border-radius: 2px;
          cursor: pointer;
          transition: transform 0.1s;
        }

        .heatmap-cell:hover {
          transform: scale(1.2);
          z-index: 5;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }

        .legend {
          margin-top: 2rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .gradient {
          width: 200px;
          height: 10px;
          background: linear-gradient(to right, #065f46, #d97706, #ef4444, #991b1b);
          border-radius: 5px;
        }

        .no-data-box {
          width: 15px;
          height: 15px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
          margin-left: 1rem;
        }

        .lstm-section { padding: 2rem; margin-top: 2rem; }
        .section-desc { color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem; }
        
        .lstm-table-container { overflow-x: auto; }
        .lstm-table { width: 100%; border-collapse: collapse; text-align: left; }
        .lstm-table th { color: #94a3b8; font-size: 0.8rem; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .lstm-table td { padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.95rem; }
        .p-name { font-weight: 600; color: #e2e8f0; }
        
        .badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .no-lstm {
          padding: 2rem;
          text-align: center;
          color: #64748b;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default StatsPage;
