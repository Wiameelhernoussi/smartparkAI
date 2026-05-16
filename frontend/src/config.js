// Configuration centralisée pour l'API Backend
const getBackendUrl = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol; // 'http:' or 'https:'
  
  // On utilise l'hostname actuel du navigateur. 
  // Si c'est localhost, on reste sur localhost pour éviter les problèmes d'IP qui change.
  const baseIp = (hostname === 'localhost' || hostname === '127.0.0.1')
    ? 'localhost' 
    : hostname;

  // Détection du protocole : si le frontend est en https, on tente https, sinon http
  const isHttps = protocol === 'https:';
  const httpProto = isHttps ? 'https' : 'http';
  const wsProto = isHttps ? 'wss' : 'ws';

  return {
    http: `${httpProto}://${baseIp}:8000`,
    ws: `${wsProto}://${baseIp}:8000`
  };
};


const config = getBackendUrl();

export default config;

