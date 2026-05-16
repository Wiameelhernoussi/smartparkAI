import React, { useMemo } from 'react';
import { getOccupancyColor } from '../../utils/parkingUtils';

function PredCard({ label, pred, total }) {
  const color = getOccupancyColor(pred.taux_libre);
  return (
    <div className="prediction-card">
      <div className="prediction-time">{label}</div>
      <div className="prediction-free" style={{ color }}>{pred.free}</div>
      <div className="prediction-total">places libres / {total}</div>
      <div className="prediction-range">
        fourchette : {Math.max(0, pred.min)} – {Math.min(total, pred.max)}
      </div>
    </div>
  );
}

export default function PredictionCards({ predictions, total }) {
  if (!predictions) return null;
  const { p15, p30, p60 } = predictions;

  const message = useMemo(() => {
    if (!p30 || !p60) return null;
    const pct30 = p30.taux_libre;
    const pct60 = p60.taux_libre;
    if (pct30 < 10)
      return { icon: '⚠️', text: 'Ce parking sera presque plein dans 30 minutes. Partez maintenant.', color: 'var(--accent-red)' };
    if (pct60 < 20)
      return { icon: '📈', text: 'Ce parking se remplit rapidement. Prévoyez votre trajet.', color: 'var(--accent-orange)' };
    return { icon: '✅', text: 'Bonne disponibilité prévue pour les 60 prochaines minutes.', color: 'var(--accent-green)' };
  }, [p30, p60]);

  return (
    <div className="prediction-section">
      <div className="section-title">
        <span>📊</span> Prédictions LSTM
      </div>
      <div className="prediction-cards-grid">
        <PredCard label="Dans 15 min" pred={p15} total={total} />
        <PredCard label="Dans 30 min" pred={p30} total={total} />
        <PredCard label="Dans 60 min" pred={p60} total={total} />
      </div>
      {message && (
        <div className="prediction-message" style={{ borderLeft: `3px solid ${message.color}`, color: 'var(--text-primary)' }}>
          {message.icon} {message.text}
        </div>
      )}
    </div>
  );
}
