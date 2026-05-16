import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { normalizeParking } from '../utils/parkingUtils';
import config from '../config';

// Mock data — shown immediately before any fetch resolves
const MOCK_PARKINGS = [
  { id: 1, nom: 'Parking Guéliz Centre', address: 'Avenue Mohammed V, Guéliz, Marrakech', lat: 31.6295, lng: -8.0086, free: 34, busy: 46, total: 80,  taux_libre: 42.5, confiance: 91 },
  { id: 2, nom: 'Parking Jemaa el-Fna', address: 'Place Jemaa el-Fna, Medina, Marrakech', lat: 31.6252, lng: -7.9892, free: 12, busy: 48, total: 60,  taux_libre: 20.0, confiance: 85 },
  { id: 3, nom: 'Jardin Majorelle',      address: 'Rue Yves Saint Laurent, Marrakech',     lat: 31.6388, lng: -8.0137, free: 45, busy: 55, total: 100, taux_libre: 45.0, confiance: 88 },
];

export function useParkingData() {
  // ← initialized with mock data immediately
  const [parkings, setParkings]   = useState(MOCK_PARKINGS);
  const [stale,    setStale]      = useState(false);

  // Normalize and merge incoming array from WS
  const handleWsMessage = useCallback((data) => {
    if (!Array.isArray(data)) return;
    setParkings(data.map(normalizeParking));
    setStale(false);
  }, []);

  const wsConnected = useWebSocket(`${config.ws}/ws/parkings`, handleWsMessage);

  // Initial REST fetch — merges with mock if fails
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${config.http}/parkings`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('http error'); return r.json(); })
      .then(data => {
        if (Array.isArray(data)) setParkings(data.map(normalizeParking));
      })
      .catch(() => setStale(true));   // keep mock data, mark stale
    return () => controller.abort();
  }, []);

  return { parkings, wsConnected, stale };
}
