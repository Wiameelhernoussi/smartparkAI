import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { createParkingIcon } from './ParkingMarker';

// Inner component to access map instance
function MapController({ userLocation, parkings }) {
  const map = useMap();
  const markersRef = useRef({});
  const navigate   = useNavigate();

  // Fly to user location
  useEffect(() => {
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 15, { duration: 1.5 });
    }
  }, [userLocation, map]);

  // Manage markers imperatively for smooth updates
  useEffect(() => {
    const currentIds = new Set(parkings.map(p => p.id));

    // Remove stale markers
    Object.keys(markersRef.current).forEach(id => {
      if (!currentIds.has(Number(id))) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add / update markers
    parkings.forEach(parking => {
      const icon = createParkingIcon(parking);
      if (markersRef.current[parking.id]) {
        markersRef.current[parking.id].setIcon(icon);
      } else {
        const marker = L.marker([parking.lat, parking.lng], { icon })
          .addTo(map)
          .on('click', () => parking.id != null && navigate(`/parking/${parking.id}`));

        // Popup
        const vehicles = parking.vehicles ? `
          <div style="margin-top:8px; display:flex; gap:10px; font-size:0.75rem; color:#94a3b8; border-top:1px solid rgba(255,255,255,0.05); padding-top:6px;">
            <span>🚗 ${parking.vehicles.cars}</span>
            <span>🏍️ ${parking.vehicles.motorcycles}</span>
            <span>🚛 ${parking.vehicles.trucks}</span>
          </div>
        ` : '';

        marker.bindPopup(`
          <div style="font-family:'DM Sans',sans-serif;padding:4px 0">
            <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.95rem;margin-bottom:4px">${parking.nom}</div>
            <div style="font-size:0.8rem;color:#94a3b8;margin-bottom:6px">${parking.address || ''}</div>
            <div style="font-size:1.1rem;font-weight:700;color:#22c55e">${parking.free} <span style="font-size:0.75rem;color:#94a3b8">places libres / ${parking.total}</span></div>
            ${vehicles}
          </div>
        `);

        markersRef.current[parking.id] = marker;
      }
    });
  }, [parkings, map, navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(markersRef.current).forEach(m => m.remove());
    };
  }, []);

  return null;
}

const CARTO_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const CARTO_LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

export default function ParkingMap({ parkings, userLocation, darkMode }) {
  return (
    <MapContainer
      center={[31.6295, -8.0086]}
      zoom={14}
      className="parking-map"
      zoomControl={true}
      attributionControl={false}
      whenReady={(e) => {
        setTimeout(() => {
          e.target.invalidateSize();
        }, 100);
      }}
    >
      <TileLayer url={darkMode ? CARTO_DARK : CARTO_LIGHT} attribution={CARTO_ATTR} maxZoom={19} />
      <MapController parkings={parkings} userLocation={userLocation} />
    </MapContainer>
  );
}
