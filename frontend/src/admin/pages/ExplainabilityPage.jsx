import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Bar } from 'react-chartjs-2';
import config from '../../config';

// ... (existing chart imports)
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const ExplainabilityPage = () => {
  const { adminFetch } = useAdminAuth();
  const [selectedParking, setSelectedParking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [parkingsList, setParkingsList] = useState([]);

  useEffect(() => {
    const fetchParkings = async () => {
      try {
        const res = await adminFetch(`${config.http}/admin/parkings`);
        if (res && res.ok) {
          const data = await res.json();
          setParkingsList(data);
          if (data.length > 0) {
            setSelectedParking(data[0].id);
          }
        }
      } catch (err) {
        console.error("Fetch parkings failed", err);
      }
    };
    fetchParkings();
  }, [adminFetch]);

  const fetchData = async () => {
    if (!selectedParking) return;
    setLoading(true);
    setError(null);
    try {
      const response = await adminFetch(`${config.http}/admin/explainability/${selectedParking}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erreur lors du chargement des données');
      }
      const result = await response.json();
      setData(result);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedParking) {
      fetchData();
    }
  }, [selectedParking]);

  const getShapChartData = () => {
    if (!data || !data.shap) return null;

    const labels = data.shap.features.map(f => f.feature);
    const values = data.shap.features.map(f => f.shap_value);
    const backgroundColors = values.map(v => v > 0 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(34, 197, 94, 0.7)');
    const borderColors = values.map(v => v > 0 ? '#ef4444' : '#22c55e');

    return {
      labels,
      datasets: [
        {
          label: 'Impact sur l\'occupation (%)',
          data: values,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  };

  const chartOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.raw > 0 ? '+' : ''}${context.raw.toFixed(1)}%`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#94a3b8' }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#e2e8f0', font: { size: 12 } }
      }
    }
  };

  const getNaturalLanguageExplanation = () => {
    if (!data || !data.shap) return "";
    
    const sortedFeatures = [...data.shap.features].sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value));
    const topFeature = sortedFeatures[0];
    
    if (topFeature.feature === "Heure de la journée") {
      return `À cette heure de la journée (${data.current_context.hour}h), ce parking est historiquement ${topFeature.shap_value > 0 ? 'plus' : 'moins'} chargé que la moyenne.`;
    }
    if (topFeature.feature === "Jour de la semaine") {
      return `Le ${data.current_context.day_name}, ce parking est ${topFeature.shap_value > 0 ? 'plus' : 'moins'} fréquenté que les autres jours.`;
    }
    
    const rainFeature = data.shap.features.find(f => f.feature === "Pluie");
    if (rainFeature && rainFeature.shap_value > 0.5) {
      return "La pluie augmente la demande de stationnement, car les usagers préfèrent éviter les trajets à pied.";
    }
    
    if (data.current_context.temperature > 35) {
      return "La forte chaleur pousse les gens à privilégier leurs véhicules climatisés, augmentant l'occupation.";
    }

    return data.shap.description;
  };

  return (
    <div className="explainability-page">
      <div className="controls-row">
        <div className="parking-selector">
          <label>Parking :</label>
          <select value={selectedParking || ''} onChange={(e) => setSelectedParking(Number(e.target.value))}>
            {parkingsList.map(p => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </div>
        <div className="refresh-container">
          <button className="refresh-btn" onClick={fetchData} disabled={loading}>
            {loading ? '⌛ Analyse en cours...' : '🔄 Actualiser l\'analyse'}
          </button>
          {!loading && (
            <span className="last-refresh">
              Dernière analyse : il y a {Math.floor((new Date() - lastRefresh) / 60000)} min
            </span>
          )}
        </div>
      </div>

      {error ? (
        <div className="error-card">
          <div className="error-icon">📊</div>
          <h3>Données en cours de collecte</h3>
          <p>
            {error.includes("historiques") 
              ? "Ce parking a été ajouté récemment. L'IA a besoin d'au moins 20 minutes de données historiques pour générer une analyse d'explicativité (SHAP)."
              : error}
          </p>
          <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#64748b' }}>
            Revenez dans quelques minutes pour voir l'analyse complète.
          </div>
        </div>
      ) : (
        <div className="analysis-grid">
          {/* GRAD-CAM SECTION */}
          <div className="analysis-card">
            <div className="card-header">
              <h2>Ce que l'IA regarde (Grad-CAM)</h2>
              <span className="info-icon" title="Grad-CAM montre les zones de l'image qui ont le plus influencé la détection.">ℹ️</span>
            </div>
            
            <div className="image-container">
              {loading ? (
                <div className="skeleton-image"></div>
              ) : data?.gradcam?.image_base64 ? (
                <>
                  <img 
                    src={`data:image/jpeg;base64,${data.gradcam.image_base64}`} 
                    loading="lazy"
                    alt="Carte d'attention Grad-CAM" 
                  />
                  <div className="timestamp-overlay">
                    Analysé à {new Date(data.timestamp).toLocaleTimeString()}
                  </div>
                </>
              ) : (
                <div className="no-image">Aucune image disponible</div>
              )}
            </div>

            <div className="cam-legend">
              <div className="legend-gradient"></div>
              <div className="legend-labels">
                <span>Peu regardé</span>
                <span>Très regardé</span>
              </div>
            </div>

            <p className="description-text">
              <i>{data?.gradcam?.description || "Les zones chaudes (rouge/orange) montrent les places que le modèle a analysées pour sa décision."}</i>
            </p>
          </div>

          {/* SHAP SECTION */}
          <div className="analysis-card">
            <div className="card-header">
              <h2>Pourquoi cette prédiction ? (SHAP)</h2>
              <span className="info-icon" title="SHAP explique l'impact de chaque facteur sur le taux d'occupation prédit.">ℹ️</span>
            </div>

            {loading ? (
              <div className="skeleton-chart">
                {[1,2,3,4,5].map(i => <div key={i} className="skeleton-bar"></div>)}
              </div>
            ) : data?.shap ? (
              <div className="shap-content">
                <div className="prediction-summary">
                  <div className="stat-item">
                    <span className="stat-label">Prédiction</span>
                    <span className="stat-value highlight">{data.shap.predicted_value.toFixed(1)}%</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Base (moyenne)</span>
                    <span className="stat-value">{data.shap.base_value.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="chart-container">
                  <Bar data={getShapChartData()} options={chartOptions} />
                </div>

                <div className="explanation-box">
                  <p>{getNaturalLanguageExplanation()}</p>
                </div>

                <div className="context-tags">
                  <div className="tag">🕒 {data.current_context.hour}h</div>
                  <div className="tag">📅 {data.current_context.day_name}</div>
                  <div className="tag">🌡️ {data.current_context.temperature}°C</div>
                  <div className="tag">🌧️ {data.current_context.rain}mm</div>
                </div>
              </div>
            ) : (
              <div className="no-data">Données SHAP indisponibles</div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .explainability-page {
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .controls-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          background: rgba(255, 255, 255, 0.03);
          padding: 1.25rem;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .parking-selector {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .parking-selector label {
          font-weight: 600;
          color: #94a3b8;
        }

        .parking-selector select {
          background: #1e293b;
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.6rem 1rem;
          border-radius: 10px;
          outline: none;
          cursor: pointer;
          font-size: 0.95rem;
        }

        .refresh-container {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
        }

        .refresh-btn {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        }

        .refresh-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
        }

        .refresh-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          background: #475569;
        }

        .last-refresh {
          font-size: 0.75rem;
          color: #64748b;
        }

        .analysis-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        .analysis-card {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .card-header h2 {
          font-size: 1.15rem;
          margin: 0;
          font-weight: 600;
          color: #e2e8f0;
        }

        .info-icon {
          cursor: help;
          font-size: 1.1rem;
          opacity: 0.6;
        }

        /* Grad-CAM Styles */
        .image-container {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: #0f172a;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .image-container img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .timestamp-overlay {
          position: absolute;
          bottom: 12px;
          right: 12px;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          color: white;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.75rem;
        }

        .cam-legend {
          margin: 1rem 0;
        }

        .legend-gradient {
          height: 10px;
          width: 100%;
          border-radius: 5px;
          background: linear-gradient(to right, #0000ff, #00ff00, #ffff00, #ff0000);
          margin-bottom: 0.5rem;
        }

        .legend-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .description-text {
          font-size: 0.9rem;
          line-height: 1.5;
          color: #cbd5e1;
          margin-top: auto;
        }

        /* SHAP Styles */
        .prediction-summary {
          display: flex;
          gap: 2rem;
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 0.75rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }

        .stat-value {
          font-size: 1.25rem;
          font-weight: 700;
        }

        .stat-value.highlight {
          color: #818cf8;
        }

        .chart-container {
          height: 250px;
          margin-bottom: 1.5rem;
        }

        .explanation-box {
          background: rgba(99, 102, 241, 0.05);
          border-left: 3px solid #6366f1;
          padding: 1rem;
          border-radius: 0 8px 8px 0;
          margin-bottom: 1.5rem;
        }

        .explanation-box p {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.6;
          color: #e2e8f0;
        }

        .context-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: auto;
        }

        .tag {
          background: rgba(255, 255, 255, 0.05);
          padding: 0.4rem 0.8rem;
          border-radius: 8px;
          font-size: 0.8rem;
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        /* Skeletons */
        .skeleton-image {
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite;
        }

        .skeleton-chart {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          height: 250px;
        }

        .skeleton-bar {
          height: 30px;
          width: 100%;
          background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite;
          border-radius: 6px;
        }

        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .error-card {
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.1);
          border-radius: 20px;
          padding: 3rem;
          text-align: center;
          max-width: 600px;
          margin: 4rem auto;
        }

        .error-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .error-card h3 {
          margin-bottom: 1rem;
          color: #ef4444;
        }

        .error-card p {
          color: #94a3b8;
        }

        .no-image, .no-data {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #475569;
          font-style: italic;
        }

        @media (max-width: 1100px) {
          .analysis-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default ExplainabilityPage;
