import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from './context/AdminAuthContext';
import config from '../config';

const AdminDashboard = () => {
  const { logout, adminFetch } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [health, setHealth] = useState({ cpu_percent: 0, memory_mb: 0, active_threads: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const fetchAnomalies = async () => {
      try {
        const response = await adminFetch(`${config.http}/api/anomalies`);
        if (response && response.ok) {
          const data = await response.json();
          setAnomalyCount(data.length);
        }
      } catch (err) {
        console.error("Failed to fetch anomaly count", err);
      }
    };

    const fetchHealth = async () => {
      try {
        const response = await adminFetch(`${config.http}/admin/system/health`);
        if (response && response.ok) {
          const data = await response.json();
          setHealth(data);
        }
      } catch (err) {
        console.error("Failed to fetch health", err);
      }
    };

    fetchAnomalies();
    fetchHealth();
    const anomalyTimer = setInterval(fetchAnomalies, 30000);
    const healthTimer = setInterval(fetchHealth, 10000);


    return () => {
      clearInterval(timer);
      clearInterval(anomalyTimer);
      clearInterval(healthTimer);
    };
  }, [adminFetch]);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const getPageTitle = () => {
    const path = location.pathname.split('/').pop();
    switch (path) {
      case 'overview': return 'Vue Globale';
      case 'anomalies': return 'Gestion des Anomalies';
      case 'stats': return 'Statistiques & Analyses';
      case 'cameras': return 'Supervision Caméras';
      case 'parkings': return '🏗️ Gestion des Parkings';
      case 'explainability': return 'Explicabilité IA 🧠';
      default: return 'Dashboard';
    }
  };

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo-icon">🅿️</span>
          <span className="logo-text">SmartPark Admin</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="overview" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="icon">📊</span> Vue Globale
          </NavLink>
          <NavLink to="anomalies" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="icon">🚨</span> Anomalies
            {anomalyCount > 0 && <span className="badge">{anomalyCount}</span>}
          </NavLink>
          <NavLink to="stats" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="icon">📈</span> Statistiques
          </NavLink>
          <NavLink to="cameras" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="icon">📷</span> Caméras
          </NavLink>
          <NavLink to="parkings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="icon">🏗️</span> Parkings
          </NavLink>
          <NavLink to="active-learning" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="icon">🏷️</span> Active Learning
          </NavLink>
          <NavLink to="explainability" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span className="icon">🧠</span> Explicabilité IA
          </NavLink>
        </nav>

        <button onClick={handleLogout} className="logout-btn">
          <span className="icon">🚪</span> Déconnexion
        </button>
      </aside>

      <main className="main-content">
        <header className="content-header">
          <h1>{getPageTitle()}</h1>
          <div className="header-right">
            <div className="system-health">
              <span className="health-item">
                <span className="label">CPU</span>
                <span className="value">{health.cpu_percent}%</span>
              </span>
              <span className="health-item">
                <span className="label">RAM</span>
                <span className="value">{health.memory_mb}MB</span>
              </span>
              <span className="health-item">
                <span className="label">Threads</span>
                <span className="value">{health.active_threads}</span>
              </span>
            </div>
            <div className="current-time">
              {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="admin-profile">
              <div className="avatar">AD</div>
            </div>
          </div>
        </header>

        <div className="page-container">
          <Outlet />
        </div>
      </main>

      <style jsx>{`
        .admin-layout {
          display: flex;
          height: 100vh;
          width: 100vw;
          background: #0d0e17;
          color: white;
          overflow: hidden;
        }

        .sidebar {
          width: 260px;
          background: rgba(255, 255, 255, 0.03);
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          padding: 1.5rem;
          backdrop-filter: blur(10px);
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2.5rem;
          padding: 0.5rem;
        }

        .logo-icon { font-size: 1.5rem; }
        .logo-text { font-weight: 700; font-size: 1.1rem; }

        .sidebar-nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.85rem 1rem;
          border-radius: 12px;
          text-decoration: none;
          color: #94a3b8;
          transition: all 0.2s;
          position: relative;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }

        .nav-item.active {
          background: rgba(99, 102, 241, 0.15);
          color: #818cf8;
          font-weight: 600;
        }

        .nav-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 20%;
          bottom: 20%;
          width: 3px;
          background: #6366f1;
          border-radius: 0 4px 4px 0;
        }

        .badge {
          background: #ef4444;
          color: white;
          font-size: 0.7rem;
          padding: 2px 6px;
          border-radius: 10px;
          margin-left: auto;
          font-weight: 700;
        }

        .logout-btn {
          margin-top: auto;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.85rem 1rem;
          background: transparent;
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #ef4444;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .content-header {
          height: 70px;
          padding: 0 2.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(13, 14, 23, 0.8);
          backdrop-filter: blur(5px);
          z-index: 10;
        }

        .content-header h1 { font-size: 1.25rem; margin: 0; font-weight: 600; }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .system-health {
          display: flex;
          gap: 1rem;
          background: rgba(0, 0, 0, 0.3);
          padding: 0.4rem 1rem;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .health-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 45px;
        }

        .health-item .label {
          font-size: 0.6rem;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 700;
        }

        .health-item .value {
          font-size: 0.8rem;
          color: #818cf8;
          font-family: monospace;
          font-weight: 600;
        }

        .current-time {
          font-family: monospace;
          color: #94a3b8;
          background: rgba(0, 0, 0, 0.3);
          padding: 0.4rem 0.8rem;
          border-radius: 8px;
          font-size: 0.9rem;
        }

        .avatar {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .page-container {
          flex: 1;
          overflow-y: auto;
          padding: 2.5rem;
        }

        .page-container::-webkit-scrollbar {
          width: 6px;
        }

        .page-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
