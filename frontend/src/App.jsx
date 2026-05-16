import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import { useParkingWebSocket } from './hooks/useParkingWebSocket';
import './styles/globals.css';

const HomePage = lazy(() => import('./pages/HomePage'));
const ParkingDetailPage = lazy(() => import('./pages/ParkingDetailPage'));
const ImpactPage = lazy(() => import('./pages/ImpactPage'));

function AppInner() {
  const { connected } = useParkingWebSocket();
  const [darkMode, setDarkMode] = React.useState(true);

  return (
    <div className={darkMode ? 'dark-theme' : 'light-theme'}>
      <Header wsConnected={connected} darkMode={darkMode} setDarkMode={setDarkMode} />
      <Suspense fallback={<div style={{ background: darkMode ? '#0f172a' : '#f8fafc', height: '100vh' }} />}>
        <Routes>
          <Route path="/" element={<HomePage darkMode={darkMode} setDarkMode={setDarkMode} />} />
          <Route path="/parking/:id" element={<ParkingDetailPage darkMode={darkMode} />} />
          <Route path="/impact" element={<ImpactPage darkMode={darkMode} />} />
        </Routes>
      </Suspense>
      <style jsx global>{`
        body {
          background: ${darkMode ? 'var(--bg-gradient)' : '#f8fafc'} !important;
          color: ${darkMode ? '#f8fafc' : '#1e293b'} !important;
        }
      `}</style>
    </div>
  );
}

function App() {
  return <AppInner />;
}

export default App;
