import React, { useState, useEffect } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import config from '../../config';

const PredictionWidget = ({ parkingId, currentTaux }) => {
  const [predictionData, setPredictionData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Guard : ne pas fetcher si parkingId est absent ou invalide
    if (parkingId == null || parkingId === 'undefined') return;

    fetch(`${config.http}/api/parkings/${parkingId}/predictions`)
      .then(res => res.json())
      .then(data => {
        setPredictionData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erreur lors de la récupération des prédictions :", err);
        setLoading(false);
      });
  }, [parkingId, currentTaux]); // Refresh si currentTaux change


  if (loading || !predictionData) {
    return (
      <div className="glass-panel widget">
        <h3 className="widget-title">Prédictions IA (LSTM)</h3>
        <p style={{ color: 'var(--text-muted)' }}>Chargement des prédictions...</p>
      </div>
    );
  }

  const getTrendIcon = (trend) => {
    if (trend === 'filling') return <TrendingDown size={18} color="var(--status-red)" />;
    if (trend === 'emptying') return <TrendingUp size={18} color="var(--status-green)" />;
    return <Minus size={18} color="var(--status-orange)" />;
  };

  return (
    <div className="glass-panel widget">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 className="widget-title" style={{ margin: 0 }}>Prédictions IA (LSTM)</h3>
        {getTrendIcon(predictionData.trend)}
      </div>
      
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', fontStyle: 'italic' }}>
        {predictionData.message}
      </p>

      <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {predictionData.predictions && predictionData.predictions.map((pred, index) => {
          const colorVar = pred.predicted_free > 30 ? 'var(--status-green)' : (pred.predicted_free > 10 ? 'var(--status-orange)' : 'var(--status-red)');
          return (
            <div key={index} style={{ 
              flex: 1, 
              minWidth: '100px',
              background: 'rgba(255, 255, 255, 0.05)', 
              border: '1px solid rgba(255, 255, 255, 0.1)', 
              borderRadius: '8px', 
              padding: '1rem', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Clock size={14} />
                <span>Dans {pred.minutes} min</span>
              </div>
              <div style={{ fontWeight: '700', fontSize: '1.5rem', color: colorVar }}>
                {pred.predicted_free}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                ± {pred.confidence_high - pred.predicted_free}%
              </div>
            </div>
          );
        })}
        {!predictionData.predictions && (
          <p style={{color: 'var(--status-red)'}}>Erreur de chargement des prédictions.</p>
        )}
      </div>
    </div>
  );
};

export default PredictionWidget;
