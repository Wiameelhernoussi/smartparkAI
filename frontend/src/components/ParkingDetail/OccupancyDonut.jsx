import React, { useRef, useEffect } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

// Plugin to draw center text
const centerTextPlugin = {
  id: 'centerText',
  beforeDraw(chart) {
    const { ctx, data, chartArea } = chart;
    if (!chartArea) return;
    const free  = data.datasets[0].data[0];
    const total = data.datasets[0].data[0] + data.datasets[0].data[1];
    const cx = (chartArea.left + chartArea.right)  / 2;
    const cy = (chartArea.top  + chartArea.bottom) / 2;

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Big number
    ctx.font         = '700 2rem "Syne", sans-serif';
    ctx.fillStyle    = '#f1f5f9';
    ctx.fillText(`${free} / ${total}`, cx, cy - 10);

    // Label
    ctx.font         = '400 0.65rem "DM Sans", sans-serif';
    ctx.fillStyle    = '#94a3b8';
    ctx.fillText('places libres', cx, cy + 18);

    ctx.restore();
  },
};

ChartJS.register(centerTextPlugin);

export default function OccupancyDonut({ free, total }) {
  const occupied = Math.max(0, total - free);

  const data = {
    datasets: [{
      data: [Math.max(0, free), occupied],
      backgroundColor: ['rgba(34,197,94,0.85)', 'rgba(239,68,68,0.6)'],
      borderColor:     ['#22c55e', '#ef4444'],
      borderWidth: 2,
      hoverOffset: 4,
    }],
    labels: ['Libres', 'Occupées'],
  };

  const options = {
    cutout: '72%',
    responsive: true,
    maintainAspectRatio: true,
    animation: { animateRotate: true, duration: 600 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.label}: ${ctx.raw} places`,
        },
        backgroundColor: 'rgba(10,10,20,0.9)',
        titleColor: '#f1f5f9',
        bodyColor:  '#94a3b8',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
      },
    },
  };

  return (
    <div className="donut-wrapper">
      <Doughnut data={data} options={options} />
    </div>
  );
}
