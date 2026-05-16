import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import config from '../../config';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

const OccupancyChart24h = ({ parkingId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Guard : ne pas fetcher si parkingId est absent ou invalide
    if (parkingId == null || parkingId === 'undefined') return;

    fetch(`${config.http}/api/parkings/${parkingId}/history?hours=6`)
      .then(res => res.json())
      .then(data => {
        setHistory(data.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [parkingId]);


  const data = {
    labels: history.map(h => new Date(h.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    datasets: [
      {
        fill: true,
        label: 'Taux libre (%)',
        // Taux libre = 100 - occupancy_rate
        data: history.map(h => 100 - h.occupancy_rate),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `Libre: ${context.parsed.y.toFixed(1)}%`;
          }
        }
      }
    },
    scales: {
      y: { min: 0, max: 100, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.1)' } },
      x: { ticks: { color: '#94a3b8', maxTicksLimit: 10 }, grid: { display: false } }
    }
  };

  return (
    <div className="glass-panel widget" style={{ gridColumn: '1 / -1' }}>
      <h3 className="widget-title">Historique Récent (Taux de places libres)</h3>
      <div className="chart-container" style={{ height: '250px' }}>
        {loading ? (
          <p style={{color: 'var(--text-muted)'}}>Chargement...</p>
        ) : history.length > 0 ? (
          <Line data={data} options={options} />
        ) : (
          <p style={{color: 'var(--text-muted)'}}>Données insuffisantes...</p>
        )}
      </div>
      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
        Les données s'enrichissent au fil du temps
      </p>
    </div>
  );
};

export default OccupancyChart24h;
