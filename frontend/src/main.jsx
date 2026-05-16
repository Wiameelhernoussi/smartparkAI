import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './styles/globals.css';
import App from './App.jsx';
import AdminApp from './admin/AdminApp.jsx';

const GlobalError = () => {
  return (
    <div style={{ 
      height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', 
      justifyContent: 'center', background: '#0f172a', color: 'white', fontFamily: 'sans-serif', padding: '2rem', textAlign: 'center' 
    }}>
      <h2 style={{ color: '#f87171' }}>⚠️ Mise à jour détectée</h2>
      <p style={{ color: '#94a3b8', maxWidth: '400px' }}>
        L'application a été mise à jour. Veuillez rafraîchir la page pour charger la dernière version.
      </p>
      <button 
        onClick={() => window.location.reload()}
        style={{ 
          background: '#6366f1', color: 'white', border: 'none', padding: '12px 24px', 
          borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '1rem' 
        }}
      >
        🔄 Rafraîchir la page
      </button>
    </div>
  );
};

const router = createBrowserRouter([
  {
    path: "/admin/*",
    element: <AdminApp />,
    errorElement: <GlobalError />
  },
  {
    path: "/*",
    element: <App />,
    errorElement: <GlobalError />
  }
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW enregistré:', reg.scope))
      .catch(err => console.log('SW échec:', err))
  })
}
