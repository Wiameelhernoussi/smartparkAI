import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from './context/AdminAuthContext';
import config from '../config';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${config.http}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });


      if (response.ok) {
        const data = await response.json();
        login(data.access_token);
        navigate('/admin/dashboard/overview');
      } else {
        setError('Identifiants incorrects');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="glass-card login-card">
        <div className="login-header">
          <div className="logo-placeholder">🅿️</div>
          <h1>SmartPark Admin</h1>
          <p>Connectez-vous pour gérer le système</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input 
              id="email"
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="admin@smartpark.ma"
              required 
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Mot de passe</label>
            <input 
              id="password"
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••"
              required 
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .admin-login-container {
          height: 100vh;
          width: 100vw;
          display: flex;
          justify-content: center;
          align-items: center;
          background: radial-gradient(circle at center, #1a1c2c 0%, #0d0e17 100%);
          color: white;
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          padding: 2.5rem;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .logo-placeholder {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        h1 {
          font-size: 1.8rem;
          margin: 0;
          background: linear-gradient(to right, #6366f1, #a855f7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        p {
          color: #94a3b8;
          font-size: 0.9rem;
          margin-top: 0.5rem;
        }

        .input-group {
          margin-bottom: 1.5rem;
        }

        label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.85rem;
          color: #cbd5e1;
        }

        input {
          width: 100%;
          padding: 0.8rem 1rem;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          font-size: 1rem;
          transition: all 0.2s;
        }

        input:focus {
          outline: none;
          border-color: #6366f1;
          background: rgba(0, 0, 0, 0.3);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }

        .error-message {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          padding: 0.75rem;
          border-radius: 8px;
          font-size: 0.85rem;
          margin-bottom: 1.5rem;
          text-align: center;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .login-btn {
          width: 100%;
          padding: 0.9rem;
          border-radius: 10px;
          background: linear-gradient(to right, #6366f1, #4f46e5);
          color: white;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.4);
        }

        .login-btn:active {
          transform: translateY(0);
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default AdminLogin;
