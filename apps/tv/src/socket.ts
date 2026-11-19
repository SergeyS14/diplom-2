import { io } from 'socket.io-client';

export const socket = io(import.meta.env.VITE_API_URL || window.location.protocol + '//' + window.location.hostname + ':3000', {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});
