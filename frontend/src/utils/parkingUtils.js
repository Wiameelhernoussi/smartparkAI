// ============================================================
// Parking data normalization — handles both real backend format
// and spec format transparently
// Real backend: { id, nom, free, busy, total, taux_libre, confiance, lat, lng }
// ============================================================

const PARKING_META = {
  1: { address: 'Avenue Mohammed V, Guéliz, Marrakech' },
  2: { address: 'Place Jemaa el-Fna, Medina, Marrakech' },
  3: { address: 'Rue Yves Saint Laurent, Marrakech' },
};

export function normalizeParking(raw) {
  const id = raw.id;
  const meta = PARKING_META[id] || {};

  const free  = raw.free  ?? raw.free_spots  ?? 0;
  const total = raw.total ?? raw.total_spots ?? 1;
  const taux_libre = raw.taux_libre != null
    ? raw.taux_libre
    : raw.occupancy_rate != null
      ? 100 - raw.occupancy_rate
      : Math.round((free / total) * 100);

  return {
    id,
    nom:        raw.nom || raw.name || `Parking ${id}`,
    address:    raw.address || meta.address || '',
    lat:        raw.lat ?? 31.6295,
    lng:        raw.lng ?? -8.0086,
    free,
    total,
    busy:       raw.busy ?? (total - free),
    taux_libre: Math.max(0, Math.min(100, taux_libre)),
    confiance:  raw.confiance ?? raw.confidence ?? 0,
  };
}

// ============================================================
// Mock predictions — coherent with current taux_libre
// ============================================================
export function generatePredictions(parking) {
  const { taux_libre, total } = parking;

  const variant = (minV, maxV) => {
    const mag = minV + Math.random() * (maxV - minV);
    const dir = Math.random() > 0.45 ? 1 : -1;
    const newTaux = Math.max(0, Math.min(100, taux_libre + dir * mag));
    const newFree = Math.round((newTaux / 100) * total);
    const margin  = Math.round((minV / 100) * total);
    return {
      taux_libre: newTaux,
      free: Math.max(0, Math.min(total, newFree)),
      min:  Math.max(0, newFree - margin),
      max:  Math.min(total, newFree + margin),
    };
  };

  return {
    p15: variant(2, 5),
    p30: variant(5, 10),
    p60: variant(10, 15),
  };
}

// ============================================================
// Weather code → icon + description
// ============================================================
export function weatherCodeToDisplay(code) {
  if (code === 0)              return { icon: '☀️', desc: 'Ciel dégagé' };
  if (code <= 3)               return { icon: '⛅', desc: 'Partiellement nuageux' };
  if (code <= 48)              return { icon: '🌫️', desc: 'Brouillard' };
  if (code <= 57)              return { icon: '🌦️', desc: 'Bruine' };
  if (code <= 67)              return { icon: '🌧️', desc: 'Pluie' };
  if (code <= 77)              return { icon: '🌨️', desc: 'Neige' };
  if (code <= 82)              return { icon: '🌧️', desc: 'Averses' };
  if (code >= 95)              return { icon: '⛈️', desc: 'Orage' };
  return { icon: '🌤️', desc: 'Variable' };
}

// ============================================================
// Mock history for when backend is unavailable
// ============================================================
export function generateMockHistory(taux_libre) {
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => {
    const hoursAgo = 23 - i;
    const t = new Date(now - hoursAgo * 3600000);
    const hour = t.getHours();
    // Simulate realistic daily pattern
    const peak = hour >= 8 && hour <= 12 ? 15 : hour >= 17 && hour <= 20 ? 20 : 0;
    const base = 100 - taux_libre;
    const noise = (Math.random() - 0.5) * 10;
    const occ = Math.max(0, Math.min(100, base + peak + noise));
    return { timestamp: t.toISOString(), taux_libre: Math.round(100 - occ), occupation: Math.round(occ) };
  });
}

// ============================================================
// Color helpers
// ============================================================
export function getOccupancyColor(taux_libre) {
  if (taux_libre > 70) return '#22c55e';
  if (taux_libre > 30) return '#f97316';
  return '#ef4444';
}

export function getOccupancyStatus(taux_libre) {
  if (taux_libre > 70) return { label: 'Disponible', cls: 'green' };
  if (taux_libre > 30) return { label: 'Modéré', cls: 'orange' };
  return { label: 'Presque plein', cls: 'red' };
}
