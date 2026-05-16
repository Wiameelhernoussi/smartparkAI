import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import config from '../../config';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const ActiveLearningPage = () => {
  const { adminFetch } = useAdminAuth();
  const [queue, setQueue] = useState([]);
  const [progress, setProgress] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [animating, setAnimating] = useState(false);

  const [retrainStatus, setRetrainStatus] = useState({
    is_training: false,
    started_at: null,
    version: null,
    last_result: null
  });

  const fetchData = async () => {
    try {
      const [queueRes, progressRes] = await Promise.all([
        adminFetch(`${config.http}/admin/annotations/queue`),
        adminFetch(`${config.http}/admin/annotations/progress`)
      ]);

      if (queueRes && queueRes.ok && progressRes && progressRes.ok) {
        const queueData = await queueRes.json();
        const progressData = await progressRes.json();
        setQueue(queueData.images);
        setProgress(progressData);
      }
    } catch (err) {
      console.error("Fetch AL data failed", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRetrainStatus = async () => {
    try {
      const res = await adminFetch(`${config.http}/admin/annotations/retrain/status`);
      if (res && res.ok) {
        const data = await res.json();
        
        // Détecter la fin de l'entraînement pour notifier et rafraîchir
        setRetrainStatus(prev => {
          if (prev.is_training && !data.is_training) {
            if (data.last_result && !data.last_result.error) {
              alert(`✅ Modèle v${data.last_result.version} entraîné — mAP ${(data.last_result.mAP * 100).toFixed(1)}%`);
              fetchData();
            } else if (data.last_result?.error) {
              alert(`❌ Erreur de re-entraînement : ${data.last_result.error}`);
            }
          }
          return data;
        });
      }
    } catch (err) {
      console.error("Fetch retrain status failed", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchRetrainStatus();
  }, [adminFetch]);

  useEffect(() => {
    let interval;
    if (retrainStatus.is_training) {
      interval = setInterval(fetchRetrainStatus, 5000);
    }
    return () => clearInterval(interval);
  }, [retrainStatus.is_training]);

  const handleSubmit = async (label) => {
    if (animating || queue.length === 0) return;
    
    const currentImage = queue[currentIndex];
    setAnimating(true);

    try {
      const response = await adminFetch(`${config.http}/admin/annotations/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: currentImage.filename, label })
      });

      if (response && response.ok) {
        // Update local progress count
        if (label !== 'ignore') {
          setProgress(prev => ({
            ...prev,
            annotations_count: (prev?.annotations_count || 0) + 1
          }));
        }

        // Wait for slide animation
        setTimeout(() => {
          const nextIndex = currentIndex < queue.length - 1 ? currentIndex : 0;
          setQueue(prev => prev.filter((_, i) => i !== currentIndex));
          setAnimating(false);
          // Adjust index if we removed the last element
          if (currentIndex >= queue.length - 1) {
            setCurrentIndex(0);
          }
        }, 300);
      } else {
        setAnimating(false);
      }
    } catch (err) {
      console.error("Submit failed", err);
      setAnimating(false);
    }
  };

  const handleRetrain = async () => {
    try {
      const response = await adminFetch(`${config.http}/admin/annotations/retrain`, {
        method: 'POST'
      });
      if (response && response.ok) {
        fetchRetrainStatus();
      }
    } catch (err) {
      console.error("Retrain trigger failed", err);
    }
  };


  if (loading) return <div className="loading">Chargement de l'Active Learning...</div>;

  const currentImage = queue[currentIndex];
  
  const chartData = {
    labels: progress?.model_versions.map(v => `v${v.version}`) || [],
    datasets: [
      {
        label: 'mAP (%)',
        data: progress?.model_versions.map(v => v.mAP * 100) || [],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4,
        pointRadius: 6,
        yAxisID: 'y',
      },
      {
        label: 'Images d\'entraînement',
        data: progress?.model_versions.reduce((acc, v, i) => {
          const prev = i > 0 ? acc[i-1] : 0;
          acc.push(prev + v.annotations_used);
          return acc;
        }, []) || [],
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 4,
        yAxisID: 'y1',
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      y: { 
        min: 95, 
        max: 100, 
        position: 'left',
        grid: { color: 'rgba(255,255,255,0.05)' }, 
        ticks: { color: '#94a3b8' },
        title: { display: true, text: 'mAP (%)', color: '#6366f1' }
      },
      y1: {
        position: 'right',
        grid: { display: false },
        ticks: { color: '#94a3b8' },
        title: { display: true, text: 'Nb images cumulées', color: '#22c55e' }
      },
      x: { 
        grid: { display: false }, 
        ticks: { color: '#94a3b8' } 
      }
    },
    plugins: {
      legend: { 
        display: true, 
        position: 'top',
        labels: { color: '#94a3b8', boxWidth: 12, usePointStyle: true }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1
      }
    }
  };

  const annotationsCount = progress?.annotations_count || 0;

  return (
    <div className="al-container">
      {/* SECTION 1 - PROGRESS */}
      <section className="al-section glass progress-section">
        <div className="progress-header">
          <div className="progress-info">
            <span>{annotationsCount} / 10 annotations minimum requises</span>
          </div>
          
          <div className="retrain-actions">
            {retrainStatus.is_training ? (
              <div className="training-status">
                <button className="retrain-btn training" disabled>
                  <span className="spinner">⏳</span> Entraînement en cours...
                </button>
                <div className="started-at">Démarré à {new Date(retrainStatus.started_at).toLocaleTimeString()}</div>
              </div>
            ) : (
              annotationsCount < 10 ? (
                <button className="retrain-btn disabled" disabled title="10 annotations minimum requises">
                  🔒 {annotationsCount}/10 annotations
                </button>
              ) : (
                <button className="retrain-btn active" onClick={handleRetrain}>
                  🚀 Lancer le re-entraînement ({annotationsCount} annotations)
                </button>
              )
            )}
          </div>
        </div>

        {retrainStatus.last_result && (
          <div className={`last-result ${retrainStatus.last_result.error ? 'error' : 'success'}`}>
            {retrainStatus.last_result.error ? (
              <>❌ Erreur : {retrainStatus.last_result.error}</>
            ) : (
              <>✅ Dernier entraînement : v{retrainStatus.last_result.version} — mAP {(retrainStatus.last_result.mAP * 100).toFixed(1)}%</>
            )}
          </div>
        )}

        <div className="al-progress-bg">
          <div 
            className="al-progress-fill" 
            style={{ width: `${Math.min(100, (annotationsCount / 10) * 100)}%` }}
          ></div>
        </div>
      </section>

      {/* SECTION 2 - ANNOTATION */}
      <section className="al-section glass annotation-section">
        {queue.length > 0 ? (
          <div className="annotation-wrapper">
            <div className="queue-info">Image {currentIndex + 1} / {queue.length}</div>
            <div className={`image-card ${animating ? 'slide-out' : 'slide-in'}`}>
              <img src={currentImage?.image_base64} loading="lazy" alt="Image à annoter" />
              <div className="img-overlay">ID: {currentImage?.parking_id} | {currentImage && new Date(currentImage.timestamp).toLocaleTimeString()}</div>
            </div>
            <div className="annotation-btns">
              <button className="btn free" onClick={() => handleSubmit('free')}>✅ LIBRE</button>
              <button className="btn occupied" onClick={() => handleSubmit('occupied')}>🚫 OCCUPÉE</button>
              <button className="btn ignore" onClick={() => handleSubmit('ignore')}>⏭️ IGNORER</button>
            </div>
          </div>
        ) : (
          <div className="empty-queue">
            <div className="success-icon">✅</div>
            <h2>Toutes les images ont été annotées !</h2>
            <p>Le modèle dispose maintenant de nouvelles données pour s'améliorer.</p>
            {progress?.annotations_count >= progress?.threshold && <div className="confetti-placeholder">✨ Re-entraînement prêt ! ✨</div>}
          </div>
        )}
      </section>

      {/* SECTION 3 - HISTORY & CHART */}
      <div className="history-grid">
        <section className="al-section glass history-table-section">
          <h3>Historique des versions</h3>
          <table className="al-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>mAP</th>
                <th>Annotations</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {[...(progress?.model_versions || [])].reverse().map(v => (
                <tr key={v.version}>
                  <td>v{v.version}</td>
                  <td>{(v.mAP * 100).toFixed(1)}%</td>
                  <td>{v.annotations_used} images</td>
                  <td>{new Date(v.trained_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="al-section glass chart-section">
          <h3>Progression de la précision du modèle</h3>
          <div className="chart-wrapper">
            <Line data={chartData} options={chartOptions} />
          </div>
        </section>
      </div>

      <style jsx>{`
        .al-container { display: flex; flex-direction: column; gap: 2rem; }
        .al-section { padding: 1.5rem; }
        .glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
        }

        /* SECTION 1 */
        .progress-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; font-weight: 600; }
        .al-progress-bg { height: 12px; background: rgba(0,0,0,0.3); border-radius: 6px; overflow: hidden; margin-top: 1rem; }
        .al-progress-fill { height: 100%; background: #10b981; transition: width 0.4s ease; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4); }

        .retrain-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }
        
        .retrain-btn {
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .retrain-btn.active { background: #10b981; }
        .retrain-btn.active:hover { background: #059669; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); }
        
        .retrain-btn.disabled { background: #334155; cursor: not-allowed; opacity: 0.7; }
        
        .retrain-btn.training { background: #6366f1; cursor: wait; animation: pulse 2s infinite; }

        .training-status { display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; }
        .started-at { font-size: 0.75rem; color: #94a3b8; font-weight: 400; }

        .last-result {
          margin: 1rem 0;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 500;
        }
        .last-result.success { background: rgba(16, 185, 129, 0.1); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); }
        .last-result.error { background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }

        .spinner { display: inline-block; animation: spin 2s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* SECTION 2 */
        .annotation-section { display: flex; justify-content: center; min-height: 500px; }
        .annotation-wrapper { width: 100%; max-width: 640px; text-align: center; }
        .queue-info { margin-bottom: 1rem; color: #94a3b8; font-size: 0.9rem; }

        .image-card {
          width: 100%;
          aspect-ratio: 16/9;
          background: #000;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          transition: all 0.3s ease;
        }

        .image-card img { width: 100%; height: 100%; object-fit: contain; }

        .slide-in { transform: translateX(0); opacity: 1; }
        .slide-out { transform: translateX(-100px); opacity: 0; }

        .img-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0,0,0,0.6);
          padding: 8px;
          font-size: 0.75rem;
          color: #cbd5e1;
        }

        .annotation-btns { display: flex; justify-content: center; gap: 1rem; margin-top: 2rem; }
        .btn { padding: 12px 24px; border-radius: 10px; border: none; color: white; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .btn:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .btn:active { transform: translateY(0); }

        .btn.free { background: #10b981; }
        .btn.occupied { background: #ef4444; }
        .btn.ignore { background: #4b5563; }

        .empty-queue { text-align: center; padding: 4rem 2rem; color: #94a3b8; }
        .success-icon { font-size: 4rem; margin-bottom: 1.5rem; }
        .confetti-placeholder { margin-top: 2rem; font-weight: 700; color: #10b981; animation: bounce 1s infinite; }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        /* SECTION 3 */
        .history-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
        .al-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        .al-table th { text-align: left; padding: 12px; color: #94a3b8; font-size: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .al-table td { padding: 12px; font-size: 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.02); }

        .chart-wrapper { height: 250px; margin-top: 1rem; }

        .loading { text-align: center; padding: 4rem; color: #94a3b8; }
      `}</style>
    </div>
  );
};

export default ActiveLearningPage;
