import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { weatherCodeToDisplay } from '../utils/parkingUtils';
import { usePushNotifications } from '../hooks/usePushNotifications';
import config from '../config';

export default function Header({ wsConnected, stale, darkMode, setDarkMode }) {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const fetchWeather = () => {
      fetch(`${config.http}/meteo`)
        .then(r => r.json())
        .then(d => setWeather(d))
        .catch(() => {
          setWeather({ temperature: 28, code_meteo: 0, pluie: 0 });
        });
    };
    fetchWeather();
    const id = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const w = weather ? weatherCodeToDisplay(weather.code_meteo ?? 0) : null;
  const { isSubscribed, subscribe, unsubscribe } = usePushNotifications();

  return (
    <header className={`app-header ${!darkMode ? 'light' : ''}`} style={{ 
      height: 'var(--header-height)', padding: '0 1.25rem',
      background: darkMode ? 'transparent' : 'white',
      borderBottom: darkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0'
    }}>
      <Link to="/" className="header-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <div className="header-logo-icon" style={{ 
          width: '32px', height: '32px', 
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))',
          borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1rem' }}>P</span>
        </div>
        <span className="header-logo-text hide-mobile" style={{ 
          fontSize: '1.1rem', fontWeight: '800', 
          color: darkMode ? 'white' : '#1e293b'
        }}>SmartPark</span>
      </Link>

      <div className="header-right" style={{ gap: '1.25rem', color: darkMode ? 'white' : '#1e293b' }}>
        {weather && (
          <div className="weather-widget hide-mobile" style={{ border: 'none', background: 'transparent', gap: '0.4rem', color: 'inherit' }}>
            <span style={{ fontSize: '1.2rem' }}>{w.icon}</span>
            <span style={{ fontWeight: '600', color: 'inherit' }}>{Math.round(weather.temperature)}°C</span>
          </div>
        )}

        <Link to="/impact" className="badge-pill" style={{ 
          background: 'rgba(0, 212, 170, 0.1)', 
          color: darkMode ? 'var(--accent-secondary)' : '#059669',
          padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600',
          border: `1px solid ${darkMode ? 'rgba(0, 212, 170, 0.2)' : '#10b981'}`,
          textDecoration: 'none'
        }}>
          🌿 <span className="hide-mobile">Impact</span>
        </Link>

        <button 
          onClick={async () => {
            if (isSubscribed) {
              unsubscribe();
            } else {
              const success = await subscribe();
              if (success) {
                new Notification('🔔 SmartPark Activé', {
                  body: 'Vous recevrez désormais des alertes en direct.',
                  icon: '/icons/icon-192.png'
                });
              }
            }
          }} 
          className={`badge-pill ${isSubscribed ? 'active' : ''}`}
          style={{ 
            background: isSubscribed ? 'rgba(108, 99, 255, 0.15)' : (darkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9'),
            color: isSubscribed ? 'var(--accent-primary)' : (darkMode ? 'var(--text-secondary)' : '#64748b'),
            border: `1px solid ${isSubscribed ? 'rgba(108, 99, 255, 0.3)' : (darkMode ? 'var(--glass-border)' : '#e2e8f0')}`,
            padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer'
          }}
        >
          {isSubscribed ? '🔔' : '🔕'} <span className="hide-mobile">Alertes</span>
        </button>

        <div className={`status-badge ${wsConnected ? 'online' : 'offline'}`} style={{ 
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '4px 12px', borderRadius: '999px',
          background: wsConnected ? 'rgba(0, 212, 170, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: wsConnected ? 'var(--status-green)' : 'var(--status-red)',
          border: `1px solid ${wsConnected ? 'rgba(0, 212, 170, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          fontSize: '0.8rem', fontWeight: '600'
        }}>
          <span style={{ 
            width: '6px', height: '6px', borderRadius: '50%', 
            background: 'currentColor', 
            boxShadow: wsConnected ? '0 0 8px var(--status-green)' : 'none'
          }} />
          {wsConnected ? 'En direct' : 'Déconnecté'}
        </div>
      </div>
    </header>
  );
}
