import { useEffect, useState, useCallback } from 'react';

export const useWebSocket = () => {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const socket = new WebSocket(`${protocol}//${host}`);

    socket.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
    };

    return () => {
      socket.close();
    };
  }, []);

  return { lastMessage, isConnected };
};
