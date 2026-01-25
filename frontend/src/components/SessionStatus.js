// src/components/SessionStatus.js
import React, { useState, useEffect } from 'react';
import { getSessionManager } from '../utils/sessionManager';

const SessionStatus = () => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const updateTimer = () => {
      const manager = getSessionManager();
      if (manager && manager.lastActivity) {
        const elapsed = Date.now() - manager.lastActivity;
        const remaining = Math.max(0, manager.timeout - elapsed);
        setTimeLeft(remaining);
      }
    };

    const interval = setInterval(updateTimer, 1000);
    updateTimer();

    return () => clearInterval(interval);
  }, []);

  if (!timeLeft || timeLeft > 25 * 60 * 1000) return null;

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: '#007bff',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      zIndex: 1000,
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
    }}>
      ⏱️ Sesión: {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  );
};

export default SessionStatus;