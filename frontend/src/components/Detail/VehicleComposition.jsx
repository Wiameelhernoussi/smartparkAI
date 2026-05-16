import React, { useState, useEffect } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Car, Bike, Truck, Bus, Info, AlertTriangle } from 'lucide-react';
import config from '../../config';

ChartJS.register(ArcElement, Tooltip, Legend);

const VehicleComposition = ({ parkingId }) => {
  const [data, setData] = useState({
    composition: { car: 0, motorcycle: 0, truck: 0, bus: 0 },
    vehicle_counts: { car: 0, motorcycle: 0, truck: 0, bus: 0 },
    total_vehicles: 0,
    insights: [],
    note: "",
    equivalent_cars: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchVehicleStats = async () => {
    try {
      const response = await fetch(`${config.http}/api/parkings/${parkingId}/vehicles`);
      if (!response.ok) return;
      
      const result = await response.json();
      if (result && (result.composition || result.vehicle_counts)) {
        setData(result);
      }
    } catch (err) {
      console.error("Erreur fetch vehicle stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchVehicleStats();
    const interval = setInterval(fetchVehicleStats, 10000);
    return () => clearInterval(interval);
  }, [parkingId]);

  if (loading && !data.total_vehicles) {
    return (
      <div className="glass-panel widget vehicle-composition">
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
          Chargement de la composition du trafic...
        </p>
      </div>
    );
  }

  // Destructuring sécurisé (priorité à composition, fallback sur vehicle_counts)
  const stats = data.composition || data.vehicle_counts || {};
  const { 
    car = 0, 
    motorcycle = 0, 
    truck = 0, 
    bus = 0 
  } = stats;

  const chartData = {
    labels: ['Voitures', 'Motos', 'Camionnettes', 'Bus'],
    datasets: [
      {
        data: [car, motorcycle, truck, bus],
        backgroundColor: [
          '#3b82f6', // bleu
          '#f97316', // orange
          '#ef4444', // rouge
          '#8b5cf6'  // violet
        ],
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 2,
        hoverOffset: 10,
      },
    ],
  };

  const chartOptions = {
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.label}: ${context.raw}`
        }
      }
    },
    maintainAspectRatio: false
  };

  return (
    <div className="glass-panel widget vehicle-composition">
      <h3 className="widget-title">🚗 Composition du trafic</h3>
      
      <div className="vehicle-layout">
        <div className="chart-container">
          <div style={{ height: '180px', position: 'relative' }}>
            <Doughnut data={chartData} options={chartOptions} />
            <div className="chart-center">
              <span className="total-num">{data.total_vehicles || 0}</span>
              <span className="total-label">véhicules</span>
            </div>
          </div>
          
          {data.note && (
            <p style={{
              fontSize: '11px', 
              color: '#94a3b8', 
              fontStyle: 'italic', 
              marginTop: '12px',
              textAlign: 'center',
              width: '100%',
              opacity: 0.8
            }}>
              ℹ️ {data.note}
            </p>
          )}

          <div className="vehicle-legend">
            <div className="legend-item"><Car size={14} color="#3b82f6" /> <span>Voitures: <b>{car}</b></span></div>
            <div className="legend-item"><Bike size={14} color="#f97316" /> <span>Motos: <b>{motorcycle}</b></span></div>
            <div className="legend-item"><Truck size={14} color="#ef4444" /> <span>Camions: <b>{truck}</b></span></div>
            <div className="legend-item"><Bus size={14} color="#8b5cf6" /> <span>Bus: <b>{bus}</b></span></div>
          </div>
        </div>

        <div className="insights-container">
          {(data.insights || []).map((msg, idx) => (
            <div key={idx} className="insight-card glass">
              <div className="insight-icon">
                {msg.includes("moto") ? <Info size={16} color="#f97316" /> : <AlertTriangle size={16} color="#ef4444" />}
              </div>
              <div className="insight-text">{msg}</div>
            </div>
          ))}
          
          <div className="equivalent-stat">
            Charge équivalente : <b>{data.equivalent_cars || 0}</b> voitures
          </div>
        </div>
      </div>

      <style jsx>{`
        .vehicle-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-top: 1rem;
        }

        .chart-container {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .chart-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          pointer-events: none;
        }

        .total-num {
          display: block;
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1;
        }

        .total-label {
          font-size: 0.65rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .vehicle-legend {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem 1rem;
          margin-top: 1rem;
          width: 100%;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .legend-item b { color: var(--text-primary); }

        .insights-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .insight-card {
          padding: 0.75rem;
          border-radius: 10px;
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          font-size: 0.8rem;
          line-height: 1.4;
          background: rgba(255, 255, 255, 0.02);
        }

        .insight-icon { margin-top: 2px; }
        .insight-text { color: var(--text-secondary); }

        .equivalent-stat {
          margin-top: auto;
          font-size: 0.75rem;
          color: var(--text-secondary);
          padding-top: 0.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        @media (max-width: 768px) {
          .vehicle-layout { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default VehicleComposition;
