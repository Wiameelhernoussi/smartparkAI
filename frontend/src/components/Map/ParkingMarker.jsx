import React, { useRef, useEffect } from 'react';
import L from 'leaflet';
import { getOccupancyColor } from '../../utils/parkingUtils';

// Creates a custom divIcon marker for a parking
export function createParkingIcon(parking) {
  const color = getOccupancyColor(parking.taux_libre);
  
  const anomalyBadge = parking.hasAnomaly ? `
    <div style="position:absolute;top:-2px;right:-2px;width:14px;height:14px;background:#ef4444;border-radius:50%;border:2px solid white;box-shadow:0 0 10px rgba(239,68,68,0.5);z-index:10;"></div>
  ` : '';

  const html = `
    <div class="parking-marker-new" style="position:relative; width:48px; height:48px; display:flex; align-items:center; justify-content:center;">
      ${anomalyBadge}
      <div style="
        width: 100%; height: 100%; 
        background: white; border-radius: 50%;
        border: 4px solid ${color};
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        transition: transform 0.2s ease;
      " class="marker-inner">
        <span style="color:#0F1117; font-weight:800; font-size:1.1rem; line-height:1;">${parking.free}</span>
        <span style="color:#64748B; font-size:0.5rem; text-transform:uppercase; font-weight:700;">LIT</span>
      </div>
    </div>`;

  return L.divIcon({
    className: '',
    html,
    iconSize:   [48, 48],
    iconAnchor: [24, 24],
    popupAnchor:[0, -24],
  });
}

// Wrapper component — used inside MapContainer
export default function ParkingMarker({ parking, markerRef, onClick }) {
  const leafletMarkerRef = useRef(null);

  useEffect(() => {
    if (markerRef) markerRef.current = leafletMarkerRef.current;
  });

  // We render nothing directly — the parent ParkingMap creates Leaflet markers imperatively
  // to avoid react-leaflet v5 issues with dynamic divIcon updates
  return null;
}
