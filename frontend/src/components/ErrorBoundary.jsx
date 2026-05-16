import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <div className="error-card">
            <span className="error-icon">⚠️</span>
            <h2>Oups ! Une erreur est survenue</h2>
            <p>Impossible de charger ce module. Cela peut arriver après une mise à jour ou à cause d'un problème réseau.</p>
            <button 
              onClick={() => window.location.reload()}
              className="retry-btn"
            >
              Actualiser la page
            </button>
            {process.env.NODE_ENV === 'development' && (
              <pre className="error-detail">
                {this.state.error?.message}
              </pre>
            )}
          </div>

          <style jsx>{`
            .error-fallback {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 400px;
              width: 100%;
              color: white;
            }
            .error-card {
              background: rgba(255, 255, 255, 0.05);
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255, 255, 255, 0.1);
              padding: 2.5rem;
              border-radius: 20px;
              text-align: center;
              max-width: 500px;
              box-shadow: 0 20px 50px rgba(0,0,0,0.3);
            }
            .error-icon {
              font-size: 3rem;
              display: block;
              margin-bottom: 1rem;
            }
            h2 {
              margin-bottom: 1rem;
              font-weight: 600;
              background: linear-gradient(to right, #ff4d4d, #f9cb28);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            p {
              color: #94a3b8;
              margin-bottom: 2rem;
              line-height: 1.6;
            }
            .retry-btn {
              background: linear-gradient(135deg, #6366f1, #a855f7);
              color: white;
              border: none;
              padding: 0.8rem 1.5rem;
              border-radius: 12px;
              font-weight: 600;
              cursor: pointer;
              transition: transform 0.2s;
            }
            .retry-btn:hover {
              transform: translateY(-2px);
              filter: brightness(1.1);
            }
            .error-detail {
              margin-top: 2rem;
              background: rgba(0,0,0,0.3);
              padding: 1rem;
              border-radius: 8px;
              font-size: 0.8rem;
              color: #ef4444;
              text-align: left;
              overflow-x: auto;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
