import { Search, Moon, Sun, MapPin } from 'lucide-react';

const FilterBar = ({ 
  filterDistance, setFilterDistance, 
  filterAvailability, setFilterAvailability, 
  userLocation, onSimulate,
  textSearch, setTextSearch,
  darkMode, setDarkMode
}) => {
  return (
    <div className={`glass-panel filter-bar ${!darkMode ? 'light' : ''}`}>
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: darkMode ? 'white' : '#1e293b' }}>Filtres & Recherche</h3>
        <button 
          onClick={() => setDarkMode(!darkMode)}
          style={{ 
            background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', 
            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: darkMode ? 'white' : '#64748b'
          }}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Barre de recherche classique */}
      <div className="search-input-wrapper">
        <Search className="search-icon" size={16} />
        <input 
          type="text" 
          placeholder="Rechercher par nom ou adresse..." 
          value={textSearch}
          onChange={(e) => setTextSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', width: '100%', gap: '1rem', marginTop: '1rem' }}>
        <div className="filter-group">
          <label>Distance</label>
          <div className="btn-group">
            <button className={`filter-btn ${filterDistance === null ? 'active' : ''}`} onClick={() => setFilterDistance(null)}>Tous</button>
            <button className={`filter-btn ${filterDistance === 500 ? 'active' : ''}`} onClick={() => setFilterDistance(500)} disabled={!userLocation}>&lt; 500m</button>
            <button className={`filter-btn ${filterDistance === 1000 ? 'active' : ''}`} onClick={() => setFilterDistance(1000)} disabled={!userLocation}>&lt; 1km</button>
          </div>
        </div>

        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          <label>État</label>
          <div className="btn-group">
            <button className={`filter-btn ${filterAvailability === 'all' ? 'active' : ''}`} onClick={() => setFilterAvailability('all')}>Tous</button>
            <button className={`filter-btn ${filterAvailability === 'available' ? 'active' : ''}`} onClick={() => setFilterAvailability('available')}>Libre</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .filter-bar { padding: 1.25rem; }
        .filter-bar.light { background: white; border-color: #e2e8f0; }
        
        .search-input-wrapper {
          position: relative;
          width: 100%;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }
        .search-input {
          width: 100%;
          padding: 10px 12px 10px 40px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: white;
          font-size: 0.85rem;
          outline: none;
          transition: all 0.2s;
        }
        .filter-bar.light .search-input {
          background: #f1f5f9;
          border-color: #e2e8f0;
          color: #1e293b;
        }
        .search-input:focus { border-color: var(--accent-primary); box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.2); }

        .filter-group label {
          display: block;
          font-size: 0.7rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }
        .btn-group { display: flex; gap: 4px; }
        .filter-btn {
          padding: 6px 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 6px;
          color: #94a3b8;
          font-size: 0.75rem;
          cursor: pointer;
        }
        .filter-bar.light .filter-btn { background: #f8fafc; border-color: #e2e8f0; color: #64748b; }
        .filter-btn.active { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }
      `}</style>
    </div>
  );
};

export default FilterBar;
