import { useEffect, useRef } from 'react';

/**
 * Hook pour gérer les notifications locales basées sur les changements de données
 * @param {Array} parkingsData - Liste des parkings avec leur état actuel
 */
export function useLocalNotifications(parkingsData) {
  const prevDataRef = useRef({});

  useEffect(() => {
    // Vérifier si les notifications sont activées et autorisées
    if (!parkingsData || 
        Notification.permission !== 'granted' || 
        !localStorage.getItem('notifications_enabled')) {
      return;
    }

    parkingsData.forEach(parking => {
      // Normaliser les données (gérer les différents formats possibles p.ex via WS ou API)
      const id = parking.id || parking.parking_id;
      const nom = parking.nom || parking.name || `Parking ${id}`;
      const free = parking.free_spots !== undefined ? parking.free_spots : (parking.free !== undefined ? parking.free : 0);
      const total = parking.total_spots || parking.total || 80;
      
      const prev = prevDataRef.current[id];

      // Initialisation au premier passage pour ce parking
      if (!prev) {
        prevDataRef.current[id] = { free, total };
        return;
      }

      const prevFree = prev.free;
      const currRate = (free / total) * 100;
      const prevRate = (prevFree / total) * 100;

      // --- LOGIQUE DES DÉCLENCHEURS ---

      // DÉCLENCHEUR 1 : Places libérées
      // Le parking était très plein (< 15% libre) et passe à un seuil plus confortable (> 25% libre)
      if (prevRate < 15 && currRate >= 25) {
        new Notification(`🟢 ${nom}`, {
          body: `${free} places viennent de se libérer ! C'est le moment d'y aller.`,
          icon: '/icons/icon-192.png',
          tag: `free-${id}`
        });
      }

      // DÉCLENCHEUR 2 : Alerte saturation imminente
      // On augmente la sensibilité : alerte dès qu'on passe sous les 20% de places libres
      if (prevRate >= 20 && currRate < 20 && free > 0) {
        new Notification(`⚠️ ${nom}`, {
          body: `Plus que ${free} places disponibles ! Le parking est presque saturé.`,
          icon: '/icons/icon-192.png',
          tag: `soon-full-${id}`
        });
      }

      // DÉCLENCHEUR 3 : Parking complet
      if (prevFree > 0 && free === 0) {
        new Notification(`🔴 ${nom}`, {
          body: 'Parking complet. Nous vous conseillons de chercher une alternative.',
          icon: '/icons/icon-192.png',
          tag: `full-${id}`
        });
      }

      // Mettre à jour la référence pour la prochaine comparaison
      prevDataRef.current[id] = { free, total };
    });
  }, [parkingsData]);
}
