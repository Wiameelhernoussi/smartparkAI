import React, { useRef, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function toLocalHour(isoStr) {
  // Marrakech = UTC+1 (WAT)
  const d = new Date(isoStr);
  const h = new String(d.getUTCHours() + 1).padStart(2, '0');
  return `${h}h`;
}

export default function HistoryChart({ history }) {
  const chartRef = useRef(null);

  const labels = history.map(r => toLocalHour(r.timestamp));
  // Use occupation rate (100 - taux_libre)
  const values = history.map(r =>
    r.occupation != null ? r.occupation : Math.round(100 - (r.taux_libre ?? 0))
  );

  const getGradient = (ctx, chartArea) => {
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0,   '#ef4444cc');   // red at top (high occupation)
    gradient.addColorStop(0.5, '#f97316aa');   // orange middle
    gradient.addColorStop(1,   '#22c55e88');   // green bottom (low occupation)
    return gradient;
  };

  const data = {
    labels,
    datasets: [{
      label: "Taux d'occupation (%)",
      data: values,
      borderWidth: 2.5,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 5,
      fill: true,
      borderColor: (ctx) => {
        const chart = ctx.chart;
        const { ctx: canvasCtx, chartArea } = chart;
        if (!chartArea) return '#f97316';
        return getGradient(canvasCtx, chartArea);
      },
      backgroundColor: 'rgba(249,115,22,0.08)',
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 800 },
    scales: {
      x: {
        grid:   { color: 'rgba(255,255,255,0.04)', drawBorder: false },
        ticks:  { color: '#64748b', font: { size: 11 }, maxTicksLimit: 12 },
      },
      y: {
        min: 0,
        max: 100,
        grid:   { color: 'rgba(255,255,255,0.06)', drawBorder: false },
        ticks:  { color: '#64748b', font: { size: 11 }, callback: v => `${v}%` },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(10,10,20,0.92)',
        titleColor: '#f1f5f9',
        bodyColor:  '#94a3b8',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        callbacks: { label: ctx => ` Occupation : ${ctx.raw}%` },
      },
    },
  };

  return (
    <div className="chart-section">
      <div className="section-title"><span>📈</span> Historique 24h</div>
      <div className="chart-container">
        <Line ref={chartRef} data={data} options={options} />
      </div>
    </div>
  );
}
