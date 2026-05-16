import { useState, useEffect, useRef, useCallback } from 'react';

// Generic WebSocket hook with auto-reconnect every 5s
export function useWebSocket(url, onMessage) {
  const [connected, setConnected] = useState(false);
  const wsRef      = useRef(null);
  const timerRef   = useRef(null);
  const mountedRef = useRef(true);
  const onMsgRef   = useRef(onMessage);
  onMsgRef.current = onMessage;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      };

      ws.onmessage = (evt) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(evt.data);
          onMsgRef.current(data);
        } catch (e) {
          console.warn('[WS] parse error', e);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        timerRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      setConnected(false);
      timerRef.current = setTimeout(connect, 5000);
    }
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (wsRef.current)  wsRef.current.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [connect]);

  return connected;
}
