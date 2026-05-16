import React from 'react';
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

const HistoryChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Chargement des données...</div>;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#f8fafc', font: { family: 'Outfit' } }
      },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#94a3b8', font: { family: 'Outfit' }, callback: (v) => v + '%' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { family: 'Outfit' }, maxTicksLimit: 10 }
      }
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
  };

  const chartData = {
    labels: data.map(d => {
      const date = new Date(d.timestamp);
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    }),
    datasets: [
      {
        fill: true,
        label: "Taux d'occupation (%)",
        data: data.map(d => 100 - d.taux_libre),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.4,
        pointRadius: 0,
        pointHitRadius: 10,
      }
    ]
  };

  return (
    <div className="chart-container">
      <Line options={options} data={chartData} />
    </div>
  );
};

export default HistoryChart;
