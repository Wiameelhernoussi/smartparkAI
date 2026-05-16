import { useState, useEffect } from 'react';

export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Géolocalisation non supportée');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError(err.message),
      { timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  return { location, error };
}
