import { useState, useEffect } from 'react'
import config from '../config'

export function usePushNotifications() {
  const [permission, setPermission] = useState(Notification.permission)
  const [isSubscribed, setIsSubscribed] = useState(localStorage.getItem('notifications_enabled') === 'true')
  
  const subscribe = async (parkingIds = [1, 2, 3]) => {
    try {
      // Demander la permission native
      const perm = await Notification.requestPermission()
      setPermission(perm)
      
      if (perm !== 'granted') return false
      
      // Activer localement
      localStorage.setItem('notifications_enabled', 'true')
      setIsSubscribed(true)
      
      // Optionnel : Envoyer au backend pour garder une trace des "abonnés" (statistiques)
      try {
        await fetch(`${config.http}/api/push/subscribe`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            subscription: { endpoint: 'local-notification', keys: {} },
            parking_ids: parkingIds
          })
        })
      } catch (e) {
        console.warn("Could not sync subscription with backend, but local notifications will work.")
      }
      
      return true
    } catch (err) {
      console.error('Local notification activation failed:', err)
      return false
    }
  }
  
  const unsubscribe = async () => {
    localStorage.removeItem('notifications_enabled')
    setIsSubscribed(false)
  }
  
  return { permission, isSubscribed, subscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
