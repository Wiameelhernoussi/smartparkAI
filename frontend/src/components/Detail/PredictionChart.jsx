import React, { useMemo } from 'react';
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
import { Line } from 'react-chartjs-2';

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

const PredictionChart = ({ currentHistory }) => {
  // Simuler des prédictions LSTM pour les 60 prochaines minutes
  const predictionData = useMemo(() => {
    if (!currentHistory || currentHistory.length === 0) return null;
    
    const lastValue = 100 - currentHistory[currentHistory.length - 1].taux_libre;
    const now = new Date();
    
    const labels = [];
    const values = [];
    const boundsLower = [];
    const boundsUpper = [];
    
    let currentValue = lastValue;
    
    for (let i = 0; i <= 6; i++) { // 6 points = 60 minutes par pas de 10 min
      const t = new Date(now.getTime() + i * 10 * 60000);
      labels.push(`${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`);
      
      // Simuler une tendance (ex: ça se remplit le matin, se vide le soir)
      const hour = t.getHours();
      let trend = 0;
      if (hour >= 8 && hour <= 11) trend = 5;
      else if (hour >= 17 && hour <= 19) trend = -5;
      else trend = (Math.random() - 0.5) * 4;
      
      if (i > 0) {
        currentValue = Math.max(0, Math.min(100, currentValue + trend + (Math.random() - 0.5) * 5));
      }
      
      values.push(currentValue);
      // Intervalle de confiance qui s'élargit avec le temps
      const uncertainty = i * 2.5; 
      boundsLower.push(Math.max(0, currentValue - uncertainty));
      boundsUpper.push(Math.min(100, currentValue + uncertainty));
    }
    
    return { labels, values, boundsLower, boundsUpper };
  }, [currentHistory]);

  if (!predictionData) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>En attente de données pour la prédiction LSTM...</div>;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#f8fafc', font: { family: 'Outfit' } } },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      y: { min: 0, max: 100, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#94a3b8', font: { family: 'Outfit' }, callback: (v) => v + '%' } },
      x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Outfit' } } }
    }
  };

  const chartData = {
    labels: predictionData.labels,
    datasets: [
      {
        label: 'Prédiction (LSTM)',
        data: predictionData.values,
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
        pointBackgroundColor: '#f59e0b',
        order: 1
      },
      {
        label: 'Marge (+)',
        data: predictionData.boundsUpper,
        borderColor: 'transparent',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: '+1',
        tension: 0.4,
        pointRadius: 0,
        order: 2
      },
      {
        label: 'Marge (-)',
        data: predictionData.boundsLower,
        borderColor: 'transparent',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        order: 3
      }
    ]
  };

  return (
    <div className="chart-container">
      <Line options={options} data={chartData} />
    </div>
  );
};

export default PredictionChart;
