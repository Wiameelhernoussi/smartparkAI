import React, { useState, useEffect, useRef } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import config from '../../config';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LocationMarker = ({ position, setPosition }) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
};

const ParkingsManagementPage = () => {
  const { adminFetch } = useAdminAuth();
  const [parkings, setParkings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [isEditing, setIsEditing] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    nom: '',
    adresse: '',
    total_spots: 80,
    lat: 31.6295,
    lng: -8.0083,
    video: null
  });
  const [markerPos, setMarkerPos] = useState({ lat: 31.6295, lng: -8.0083 });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewFrame, setPreviewFrame] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // Video Management State
  const [videoModalParking, setVideoModalParking] = useState(null);
  const [newVideoFile, setNewVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fetchParkings = async () => {
    setLoading(true);
    try {
      const response = await adminFetch(`${config.http}/admin/parkings`);
      if (response && response.ok) {
        const data = await response.json();
        setParkings(data);
      }
    } catch (err) {
      console.error("Failed to fetch parkings", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParkings();
  }, []);

  const handleCreateOrUpdate = async () => {
    setIsCreating(true);
    try {
      if (isEditing) {
        // PUT
        const response = await adminFetch(`${config.http}/admin/parkings/${isEditing}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nom: formData.nom,
            adresse: formData.adresse,
            lat: markerPos.lat,
            lng: markerPos.lng,
            total_spots: parseInt(formData.total_spots),
            actif: true
          })
        });
        if (response.ok) {
          setShowModal(false);
          fetchParkings();
        }
      } else {
        // POST Multipart
        const fd = new FormData();
        fd.append('nom', formData.nom);
        fd.append('adresse', formData.adresse);
        fd.append('lat', markerPos.lat);
        fd.append('lng', markerPos.lng);
        fd.append('total_spots', formData.total_spots);
        fd.append('video', formData.video);

        const response = await fetch(`${config.http}/admin/parkings`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
          },
          body: fd
        });

        if (response.ok) {
          setShowModal(false);
          fetchParkings();
        } else {
            const errData = await response.json();
            alert(errData.detail || "Erreur lors de la création");
        }
      }
    } catch (err) {
      console.error("Operation failed", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleVideoUpload = async () => {
    if (!newVideoFile || !videoModalParking) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('video', newVideoFile);
    
    try {
      const token = localStorage.getItem('admin_token');
      
      // Simuler la progression (le fetch natif ne supporte pas onProgress sans XHR)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      const res = await fetch(
        `${config.http}/admin/parkings/${videoModalParking.id}/video`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        }
      );
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (res.ok) {
        setTimeout(() => {
          setVideoModalParking(null);
          setNewVideoFile(null);
          setUploadProgress(0);
          setUploading(false);
          alert('✅ Vidéo mise à jour ! Le simulateur redémarre avec le nouveau flux.');
          fetchParkings();
        }, 500);
      } else {
          const err = await res.json();
          alert("Erreur: " + (err.detail || "Upload échoué"));
          setUploading(false);
          setUploadProgress(0);
      }
    } catch (err) {
      console.error('Erreur upload vidéo:', err);
      setUploading(false);
      setUploadProgress(0);
      alert("Erreur réseau lors de l'upload");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Désactiver ce parking ? Les données historiques seront conservées.")) {
      try {
        const response = await adminFetch(`${config.http}/admin/parkings/${id}`, { method: 'DELETE' });
        if (response.ok) fetchParkings();
      } catch (err) {
        console.error("Delete failed", err);
      }
    }
  };

  const handleHardDelete = async (id) => {
    if (window.confirm("🚨 ATTENTION: Supprimer définitivement ce parking ? Toutes les données historiques, anomalies et annotations seront effacées. Cette action est irréversible.")) {
      try {
        const response = await adminFetch(`${config.http}/admin/parkings/${id}/hard`, { method: 'DELETE' });
        if (response.ok) fetchParkings();
      } catch (err) {
        console.error("Hard delete failed", err);
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.type === 'video/mp4' || file.name.endsWith('.mp4'))) {
      setFormData({ ...formData, video: file });
    } else {
      alert("Veuillez sélectionner un fichier .mp4");
    }
  };

  return (
    <div className="parkings-page">
      <div className="page-header">
        <h2>🏗️ Gestion des Parkings</h2>
        <button className="add-btn" onClick={() => {
            setIsEditing(null);
            setFormData({ nom: '', adresse: '', total_spots: 80, lat: 31.6295, lng: -8.0083, video: null });
            setMarkerPos({ lat: 31.6295, lng: -8.0083 });
            setStep(1);
            setShowModal(true);
        }}>
          <span>➕</span> Ajouter un parking
        </button>
      </div>

      <div className="table-container glass">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Adresse</th>
              <th>Places</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {parkings.map(p => (
              <tr key={p.id}>
                <td>{p.nom}</td>
                <td>{p.adresse}</td>
                <td>{p.total_spots}</td>
                <td>
                  <span className={`status-badge ${p.actif ? 'active' : 'inactive'}`}>
                    {p.actif ? '🟢 Actif' : '🔴 Inactif'}
                  </span>
                </td>
                <td className="actions">
                  <button className="edit-btn" title="Modifier infos" onClick={() => {
                      setIsEditing(p.id);
                      setFormData({ ...p });
                      setMarkerPos({ lat: p.lat, lng: p.lng });
                      setStep(1);
                      setShowModal(true);
                  }}>✏️</button>
                  <button className="video-btn" title="Changer vidéo" onClick={() => setVideoModalParking(p)}>📹</button>
                  <button className="delete-btn" title={p.actif ? "Désactiver" : "Déjà inactif"} onClick={() => handleDelete(p.id)} disabled={!p.actif}>⏸️</button>
                  <button className="hard-delete-btn" title="Supprimer définitivement" onClick={() => handleHardDelete(p.id)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {videoModalParking && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <div className="modal-header">
              <h3>📹 Changer la vidéo de surveillance</h3>
              <button className="close-btn" onClick={() => setVideoModalParking(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
                Parking : <strong>{videoModalParking.nom}</strong>
              </p>

              <div 
                className="upload-zone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file?.name.endsWith('.mp4')) {
                    setNewVideoFile(file);
                  } else {
                    alert("Seuls les fichiers .mp4 sont acceptés");
                  }
                }}
              >
                {newVideoFile ? (
                  <div className="file-info">
                    <span>✅ {newVideoFile.name}</span>
                    <small>{(newVideoFile.size / (1024 * 1024)).toFixed(2)} MB</small>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <span>📁</span>
                    <p>Glissez votre vidéo .mp4 ici ou</p>
                    <label style={{ color: '#6366f1', cursor: 'pointer', fontWeight: 600 }}>
                      parcourir les fichiers
                      <input 
                        type="file" 
                        accept=".mp4" 
                        hidden
                        onChange={(e) => setNewVideoFile(e.target.files[0])}
                      />
                    </label>
                  </div>
                )}
              </div>

              {uploadProgress > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <div className="progress-container" style={{ background: 'rgba(255,255,255,0.05)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${uploadProgress}%`, 
                        background: '#6366f1', 
                        height: '100%', 
                        transition: 'width 0.3s' 
                      }} 
                    />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#6366f1', marginTop: '4px' }}>
                    {uploadProgress}%
                  </div>
                </div>
              )}

              <div className="btn-group" style={{ marginTop: '2rem' }}>
                <button 
                  className="back-btn" 
                  onClick={() => {
                    setVideoModalParking(null);
                    setNewVideoFile(null);
                    setUploadProgress(0);
                  }}
                >
                  Annuler
                </button>
                <button
                  className="submit-btn"
                  disabled={!newVideoFile || uploading}
                  onClick={handleVideoUpload}
                >
                  {uploading ? '⏳ Téléchargement...' : '✅ Mettre à jour la vidéo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <div className="modal-header">
              <h3>{isEditing ? 'Modifier le parking' : 'Ajouter un nouveau parking'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="modal-steps">
              <div className={`step-dot ${step >= 1 ? 'active' : ''}`}>1</div>
              <div className="step-line"></div>
              <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
              <div className="step-line"></div>
              <div className={`step-dot ${step >= 3 ? 'active' : ''}`}>3</div>
            </div>

            <div className="modal-body">
              {step === 1 && (
                <div className="step-form">
                  <div className="form-group">
                    <label>Nom du parking *</label>
                    <input 
                      type="text" 
                      value={formData.nom} 
                      onChange={e => setFormData({...formData, nom: e.target.value})}
                      placeholder="Ex: Parking Guéliz"
                    />
                  </div>
                  <div className="form-group">
                    <label>Adresse</label>
                    <input 
                      type="text" 
                      value={formData.adresse} 
                      onChange={e => setFormData({...formData, adresse: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Capacité (places) *</label>
                    <input 
                      type="number" 
                      value={formData.total_spots} 
                      onChange={e => setFormData({...formData, total_spots: e.target.value})}
                    />
                  </div>
                  <button className="next-btn" onClick={() => setStep(2)}>Suivant →</button>
                </div>
              )}

              {step === 2 && (
                <div className="step-map">
                  <p>Cliquez sur la carte pour placer le parking</p>
                  <div className="mini-map">
                    <MapContainer center={[31.6295, -8.0083]} zoom={13} style={{ height: '300px', borderRadius: '12px' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <LocationMarker position={markerPos} setPosition={setMarkerPos} />
                    </MapContainer>
                  </div>
                  <div className="coords">
                    📍 {markerPos.lat.toFixed(4)}, {markerPos.lng.toFixed(4)}
                  </div>
                  <div className="btn-group">
                    <button className="back-btn" onClick={() => setStep(1)}>← Retour</button>
                    <button className="next-btn" onClick={() => setStep(3)}>Suivant →</button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="step-video">
                  {isEditing ? (
                    <p>La modification de vidéo est gérée séparément pour la sécurité.</p>
                  ) : (
                    <>
                      <p className="mandatory-label">📹 Vidéo de surveillance (.mp4) — <strong>Obligatoire</strong></p>
                      <div className="upload-zone" onClick={() => document.getElementById('video-input').click()}>
                        {formData.video ? (
                          <div className="file-info">
                            <span>✅ {formData.video.name}</span>
                            <small>{(formData.video.size / (1024 * 1024)).toFixed(2)} MB</small>
                          </div>
                        ) : (
                          <div className="upload-placeholder">
                            <span>📤</span>
                            <p>Cliquez pour sélectionner la vidéo (.mp4)</p>
                          </div>
                        )}
                        <input 
                          id="video-input" 
                          type="file" 
                          hidden 
                          accept=".mp4" 
                          onChange={handleFileChange}
                        />
                      </div>
                    </>
                  )}
                  <div className="btn-group">
                    <button className="back-btn" onClick={() => setStep(2)}>← Retour</button>
                    <button 
                        className="submit-btn" 
                        disabled={isCreating || (!isEditing && !formData.video)}
                        onClick={handleCreateOrUpdate}
                    >
                      {isCreating ? 'Création...' : (isEditing ? '✅ Enregistrer' : '✅ Créer le parking')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .parkings-page { animation: fadeIn 0.5s ease; }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .add-btn {
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: white; border: none; padding: 0.75rem 1.5rem;
          border-radius: 12px; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; gap: 0.5rem;
          transition: transform 0.2s;
        }
        .add-btn:hover { transform: translateY(-2px); }
        
        .glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
        }

        .table-container { padding: 1.5rem; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; color: #94a3b8; font-weight: 500; padding: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        td { padding: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        
        .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; }
        .status-badge.active { background: rgba(34, 197, 94, 0.1); color: #4ade80; }
        .status-badge.inactive { background: rgba(239, 68, 68, 0.1); color: #f87171; }
        
        .actions { display: flex; gap: 0.5rem; }
        .actions button {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white; padding: 0.5rem; border-radius: 8px; cursor: pointer;
        }
        .actions button:hover { background: rgba(255, 255, 255, 0.1); }

        /* Modal */
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.7); display: flex; align-items: center;
          justify-content: center; z-index: 1000;
        }
        .modal-content { width: 500px; padding: 2rem; position: relative; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .close-btn { background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer; }
        
        .modal-steps { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 2rem; }
        .step-dot {
          width: 30px; height: 30px; border-radius: 50%;
          background: rgba(255,255,255,0.1); display: flex;
          align-items: center; justify-content: center; font-size: 0.8rem;
        }
        .step-dot.active { background: #6366f1; color: white; box-shadow: 0 0 15px rgba(99, 102, 241, 0.5); }
        .step-line { width: 40px; height: 2px; background: rgba(255,255,255,0.1); }
        
        .form-group { margin-bottom: 1.25rem; }
        .form-group label { display: block; margin-bottom: 0.5rem; color: #94a3b8; font-size: 0.9rem; }
        input {
          width: 100%; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 0.75rem; color: white; outline: none;
        }
        input:focus { border-color: #6366f1; }
        
        .upload-zone {
          border: 2px dashed rgba(255,255,255,0.1); border-radius: 12px;
          padding: 2rem; text-align: center; cursor: pointer; transition: all 0.2s;
        }
        .upload-zone:hover { border-color: #6366f1; background: rgba(99,102,241,0.05); }
        .upload-placeholder span { font-size: 2rem; display: block; margin-bottom: 0.5rem; }
        
        .mandatory-label {
          margin-bottom: 1rem;
          font-size: 0.9rem;
          color: #94a3b8;
        }

        .mandatory-label strong {
          color: #f87171;
        }

        .btn-group { display: flex; gap: 1rem; margin-top: 1.5rem; }
        .next-btn, .submit-btn {
          flex: 1; background: #6366f1; color: white; border: none;
          padding: 0.85rem; border-radius: 10px; font-weight: 600; cursor: pointer;
        }
        .back-btn {
          background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1);
          padding: 0.85rem 1.5rem; border-radius: 10px; cursor: pointer;
        }
        
        .coords { text-align: center; margin-top: 1rem; font-family: monospace; color: #818cf8; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ParkingsManagementPage;
