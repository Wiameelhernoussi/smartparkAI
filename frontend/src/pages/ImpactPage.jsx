import React, { useEffect, useState, useRef } from 'react';
import config from '../config';
import '../styles/ImpactPage.css';

const AnimatedCounter = ({ value, duration = 2000, decimals = 1 }) => {
  const [count, setCount] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    let animationFrameId;
    
    const updateCounter = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp;
      const progress = timestamp - startRef.current;
      
      if (progress < duration) {
        const nextValue = (progress / duration) * value;
        setCount(nextValue);
        animationFrameId = requestAnimationFrame(updateCounter);
      } else {
        setCount(value);
      }
    };
    
    startRef.current = null;
    animationFrameId = requestAnimationFrame(updateCounter);
    
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  const formattedCount = Number(count).toFixed(decimals);
  return <span>{decimals === 0 ? Math.round(count) : formattedCount}</span>;
};

export default function ImpactPage({ darkMode }) {
  const [impactData, setImpactData] = useState(null);

  // Activer le scroll vertical sur cette page
  useEffect(() => {
    document.body.classList.add('scrollable');
    document.getElementById('root')?.classList.add('scrollable');
    return () => {
      document.body.classList.remove('scrollable');
      document.getElementById('root')?.classList.remove('scrollable');
    };
  }, []);

  useEffect(() => {
    const fetchImpact = async () => {
      try {
        const res = await fetch(`${config.http}/api/impact`);
        if (!res.ok) throw new Error("API failed");
        const data = await res.json();
        setImpactData(data);
      } catch (e) {
        console.error("Failed to fetch impact data", e);
      }
    };
    
    fetchImpact();
    const interval = setInterval(fetchImpact, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!impactData) {
    return (
      <div className="impact-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  const { today, total, source } = impactData;

  const renderSection = (title, data) => (
    <div className="impact-section">
      <h2 className="impact-section-title">{title}</h2>
      <div className="impact-grid">
        <div className="impact-card">
          <div className="impact-icon">⏱</div>
          <div className="impact-value">
            {data.time_saved_minutes >= 60 ? (
              <>
                <AnimatedCounter value={Math.floor(data.time_saved_minutes / 60)} decimals={0} /><span style={{fontSize:'1.2rem', marginLeft:'2px', marginRight:'6px'}}>h</span>
                <AnimatedCounter value={data.time_saved_minutes % 60} decimals={0} /><span style={{fontSize:'1.2rem', marginLeft:'2px'}}>min</span>
              </>
            ) : (
              <><AnimatedCounter value={data.time_saved_minutes} decimals={0} /> <span style={{fontSize:'1.2rem', marginLeft:'4px'}}>min</span></>
            )}
          </div>
          <div className="impact-label">Temps économisé</div>
        </div>
        
        <div className="impact-card">
          <div className="impact-icon">🚗</div>
          <div className="impact-value">
            <AnimatedCounter value={data.km_avoided} decimals={1} /> <span style={{fontSize:'1.2rem', marginLeft:'4px'}}>km</span>
          </div>
          <div className="impact-label">Kilomètres évités</div>
        </div>

        <div className="impact-card">
          <div className="impact-icon">💨</div>
          <div className="impact-value">
            <AnimatedCounter value={data.co2_saved_kg} decimals={1} /> <span style={{fontSize:'1.2rem', marginLeft:'4px'}}>kg</span>
          </div>
          <div className="impact-label">CO₂ évité</div>
        </div>

        <div className="impact-card">
          <div className="impact-icon">🌳</div>
          <div className="impact-value">
            <AnimatedCounter value={data.trees_equivalent} decimals={1} />
          </div>
          <div className="impact-label">Équivalent arbres plantés</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`impact-container ${!darkMode ? 'light-theme' : ''}`}>
      <div className="impact-header">
        <h1>🌿 Impact Environnemental</h1>
        <p>Découvrez comment SmartPark contribue à réduire l'empreinte carbone à Marrakech en optimisant la recherche de stationnement.</p>
      </div>

      {renderSection("Aujourd'hui", today)}
      {renderSection("Impact cumulé depuis le lancement", total)}

      <div className="impact-context">
        <p>{source}</p>
        <p>SmartPark réduit le temps de recherche à moins de 2 minutes.</p>
      </div>
    </div>
  );
}
