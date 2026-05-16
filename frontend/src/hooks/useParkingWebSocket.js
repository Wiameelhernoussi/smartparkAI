import { useState, useEffect } from 'react';
import config from '../config';

const WS_URL = `${config.ws}/ws/parkings`;

export const useParkingWebSocket = () => {
  const [parkings, setParkings] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws;
    let reconnectInterval;

    const connect = () => {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('Connecté au WebSocket des parkings');
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          // Normalisation défensive : garantit que chaque parking a un champ "id"
          const normalize = (p) => ({
            ...p,
            id: p.id ?? p.parking_id ?? null,
            nom: p.nom ?? p.name ?? '',
            free: p.free ?? p.free_spots ?? 0,
          });
          const data = Array.isArray(raw) ? raw.map(normalize) : raw;
          // Filtrer les parkings sans id valide pour éviter /parking/undefined
          const valid = Array.isArray(data) ? data.filter(p => p.id != null) : data;
          setParkings(valid);
        } catch (err) {
          console.error('Erreur parsing WebSocket', err);
        }
      };

      ws.onclose = () => {
        console.log('Déconnecté du WebSocket. Reconnexion...');
        setConnected(false);
        reconnectInterval = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('Erreur WebSocket', err);
        ws.close();
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectInterval);
    };
  }, []);

  return { parkings, connected };
};
