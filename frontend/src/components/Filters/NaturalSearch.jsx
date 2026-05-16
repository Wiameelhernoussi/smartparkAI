import React, { useState } from 'react';
import config from '../../config';
import { Search, AlertCircle } from 'lucide-react';
import './NaturalSearch.css';

const NaturalSearch = ({ onSearchResults, parkings }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.http}/api/search/natural`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la recherche IA');
      }

      const data = await response.json();
      if (data) {
        onSearchResults(data);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Impossible de contacter l\'assistant IA. Vérifiez qu\'Ollama est lancé.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="natural-search-wrapper" style={{ width: '100%' }}>
      <form onSubmit={handleSearch} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }}>
          <Search size={18} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Où voulez-vous vous garer ?"
          style={{
            width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem',
            background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)',
            borderRadius: '999px', color: 'white', fontSize: '0.9rem', outline: 'none',
            transition: 'var(--transition)'
          }}
          className="search-input-new"
          disabled={loading}
        />
        <button 
          type="submit" 
          disabled={loading || !query.trim()}
          style={{
            position: 'absolute', right: '6px', top: '6px', bottom: '6px',
            background: 'var(--accent-primary)', color: 'white', border: 'none',
            borderRadius: '999px', padding: '0 1.25rem', fontSize: '0.8rem', fontWeight: '700',
            cursor: 'pointer', transition: 'var(--transition)', opacity: (loading || !query.trim()) ? 0.6 : 1
          }}
        >
          {loading ? 'IA...' : 'Go'}
        </button>
      </form>
      
      {error && (
        <div style={{ 
          marginTop: '0.75rem', padding: '0.6rem 1rem', background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px',
          color: '#ef4444', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <style jsx>{`
        .search-input-new:focus {
          border-color: var(--accent-primary);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 0 0 4px rgba(108, 99, 255, 0.1);
        }
      `}</style>
    </div>
  );
};

export default NaturalSearch;
