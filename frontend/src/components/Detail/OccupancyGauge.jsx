import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const OccupancyGauge = ({ free, busy, darkMode }) => {
  const data = {
    labels: ['Libres', 'Occupées'],
    datasets: [
      {
        data: [free, busy],
        backgroundColor: [
          '#10b981', // Green
          '#ef4444', // Red
        ],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: { 
        position: 'bottom', 
        labels: { 
          color: darkMode ? '#f8fafc' : '#000000',
          font: { family: 'Outfit', size: 12, weight: '600' }
        } 
      }
    }
  };

  return (
    <div className="glass-panel widget">
      <h3 className="widget-title">Occupation Actuelle</h3>
      <div className="chart-container" style={{ height: '200px' }}>
        <Doughnut data={data} options={options} />
      </div>
    </div>
  );
};

export default OccupancyGauge;
