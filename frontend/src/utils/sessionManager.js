// src/utils/sessionManager.js - VERSIÓN CORREGIDA
class SessionManager {
  constructor(timeoutMinutes = 5) {
    this.timeout = timeoutMinutes * 60 * 1000; // 5 minutos
    this.warningTime = 4 * 60 * 1000; // 4 minutos para advertencia
    this.checkInterval = 10 * 1000; // Verificar cada 10 segundos
    this.timer = null;
    this.warningTimer = null;
    this.checkTimer = null;
    this.lastActivity = Date.now();
    this.isModalShowing = false;
    this.initialized = false;
    
    console.log(`SessionManager configurado para ${timeoutMinutes} minutos de inactividad`);
  }

  init() {
    if (this.initialized) {
      console.log('SessionManager ya está inicializado');
      return;
    }
    
    console.log('Inicializando SessionManager...');
    
    // Reiniciar lastActivity al momento de inicialización
    this.lastActivity = Date.now();
    
    // Eventos de actividad - usar throttle para mejor performance
    this.setupActivityListeners();
    
    // Verificar token inmediatamente
    this.checkTokenExpiry();
    
    // Iniciar verificación periódica
    this.startPeriodicCheck();
    
    // Iniciar timers de inactividad
    this.startInactivityTimers();
    
    this.initialized = true;
    console.log('SessionManager inicializado correctamente');
  }

  setupActivityListeners() {
    // Lista completa de eventos de actividad
    const activityEvents = [
      'mousemove', 'mousedown', 'mouseup', 'click', 'dblclick',
      'scroll', 'wheel', 'keydown', 'keypress', 'keyup',
      'touchstart', 'touchmove', 'touchend', 'input', 'change',
      'focus', 'blur', 'drag', 'drop'
    ];
    
    // Usar throttle para evitar demasiadas llamadas
    const throttledActivity = this.throttle(() => {
      this.handleUserActivity();
    }, 1000);
    
    activityEvents.forEach(event => {
      document.addEventListener(event, throttledActivity, { passive: true });
    });
    
    // Guardar referencia para cleanup
    this.activityHandler = throttledActivity;
    this.activityEvents = activityEvents;
  }

  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  handleUserActivity() {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivity;
    
    // Solo registrar actividad si ha pasado al menos 1 segundo desde la última
    if (timeSinceLastActivity > 1000) {
      this.lastActivity = now;
      console.log(`Actividad detectada. Última actividad: ${Math.floor(timeSinceLastActivity/1000)}s atrás`);
      
      // Reiniciar timers
      this.resetInactivityTimers();
      
      // Cerrar modal de advertencia si está abierto
      if (this.isModalShowing) {
        this.closeModal();
        this.showToast('✅ Actividad detectada, sesión extendida', 'success');
      }
    }
  }

  startPeriodicCheck() {
    // Verificar token periódicamente
    this.checkTimer = setInterval(() => {
      this.checkTokenExpiry();
    }, this.checkInterval);
  }

  checkTokenExpiry() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No hay token en localStorage');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      const timeLeft = expiresAt - Date.now();
      
      // Convertir a minutos y segundos para logging
      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);
      
      console.log(`Token expira en: ${minutes}:${seconds.toString().padStart(2, '0')}`);
      
      // Mostrar advertencia visual cuando queden 2 minutos
      if (timeLeft < 2 * 60 * 1000 && timeLeft > 0) {
        if (!this.isModalShowing) {
          this.showTokenExpiryWarning(timeLeft);
        }
      }
      
    } catch (err) {
      console.error('Error verificando token:', err);
    }
  }

  startInactivityTimers() {
    // Limpiar timers anteriores
    this.clearInactivityTimers();
    
    // Timer para advertencia (4 minutos de inactividad)
    this.warningTimer = setTimeout(() => {
      this.showInactivityWarning();
    }, this.timeout - this.warningTime);
    
    // Timer para logout (5 minutos de inactividad)
    this.timer = setTimeout(() => {
      this.logoutDueToInactivity();
    }, this.timeout);
    
    console.log(`Timers iniciados: Advertencia en ${(this.timeout - this.warningTime)/1000}s, Logout en ${this.timeout/1000}s`);
  }

  resetInactivityTimers() {
    console.log('Reiniciando timers de inactividad');
    this.startInactivityTimers();
  }

  clearInactivityTimers() {
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.timer) clearTimeout(this.timer);
  }

  showTokenExpiryWarning(timeLeft) {
    // Solo mostrar si no hay otro modal
    if (this.isModalShowing) return;
    
    this.isModalShowing = true;
    
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    
    const modal = document.createElement('div');
    modal.id = 'tokenExpiryModal';
    modal.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 8px;
      padding: 15px;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 350px;
      animation: slideInRight 0.3s ease;
    `;
    
    modal.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 10px;">
        <span style="font-size: 24px;">⏰</span>
        <div>
          <strong style="color: #856404;">Token por expirar</strong>
          <p style="margin: 5px 0 0 0; color: #856404; font-size: 14px;">
            Tu token de sesión expira en ${minutes}:${seconds.toString().padStart(2, '0')}
          </p>
          <p style="margin: 5px 0 0 0; color: #856404; font-size: 12px;">
            Realiza alguna acción para renovarlo automáticamente
          </p>
        </div>
      </div>
      <style>
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-remover después de 10 segundos
    setTimeout(() => {
      this.closeModal();
    }, 10000);
  }

  showInactivityWarning() {
    if (this.isModalShowing) return;
    
    this.isModalShowing = true;
    
    const modal = document.createElement('div');
    modal.id = 'inactivityWarningModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.85);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 99999;
    `;
    
    let countdown = 60; // 60 segundos para responder
    
    modal.innerHTML = `
      <div style="
        background: white;
        padding: 40px;
        border-radius: 15px;
        max-width: 500px;
        width: 90%;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      ">
        <div style="font-size: 60px; margin-bottom: 20px;">⚠️</div>
        <h3 style="color: #dc3545; margin-bottom: 15px;">¡Inactividad detectada!</h3>
        <p style="font-size: 16px; color: #666; margin-bottom: 10px;">
          Has estado inactivo por 4 minutos.
        </p>
        <p style="font-size: 16px; color: #666; margin-bottom: 25px;">
          La sesión se cerrará en <strong id="countdown" style="color: #dc3545; font-size: 20px;">${countdown}</strong> segundos.
        </p>
        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
          <button id="continueSessionBtn" style="
            padding: 12px 30px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            min-width: 200px;
          ">
            🖱️ Continuar sesión
          </button>
          <button id="logoutNowBtn" style="
            padding: 12px 30px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            min-width: 200px;
          ">
            👋 Cerrar sesión ahora
          </button>
        </div>
        <p style="font-size: 14px; color: #999; margin-top: 25px;">
          Mueve el mouse o presiona una tecla para mantenerte conectado
        </p>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Contador regresivo
    const countdownElement = document.getElementById('countdown');
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdownElement) {
        countdownElement.textContent = countdown;
        
        // Cambiar color cuando quedan 10 segundos
        if (countdown <= 10) {
          countdownElement.style.color = '#ff0000';
          countdownElement.style.fontWeight = 'bold';
        }
      }
      
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        this.forceLogout('Sesión cerrada por inactividad');
      }
    }, 1000);
    
    // Botón para continuar sesión
    document.getElementById('continueSessionBtn').onclick = () => {
      clearInterval(countdownInterval);
      this.handleUserActivity();
      this.showToast('✅ Sesión extendida', 'success');
    };
    
    // Botón para cerrar sesión
    document.getElementById('logoutNowBtn').onclick = () => {
      clearInterval(countdownInterval);
      this.forceLogout('Sesión cerrada manualmente');
    };
    
    // También cerrar con cualquier actividad
    const handleActivity = () => {
      clearInterval(countdownInterval);
      this.handleUserActivity();
      this.showToast('✅ Sesión extendida', 'success');
    };
    
    document.addEventListener('mousemove', handleActivity, { once: true });
    document.addEventListener('keydown', handleActivity, { once: true });
  }

  closeModal() {
    const modals = ['inactivityWarningModal', 'tokenExpiryModal'];
    
    modals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal && document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
    });
    
    this.isModalShowing = false;
  }

  showToast(message, type = 'info') {
    // Eliminar toast anterior si existe
    const existingToast = document.getElementById('sessionToast');
    if (existingToast) {
      document.body.removeChild(existingToast);
    }
    
    const toast = document.createElement('div');
    toast.id = 'sessionToast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
      color: ${type === 'success' ? '#155724' : '#721c24'};
      border: 1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    
    toast.innerHTML = `
      <span style="font-size: 20px;">${type === 'success' ? '✅' : '❌'}</span>
      <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remover después de 3 segundos
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 3000);
  }

  logoutDueToInactivity() {
    this.forceLogout('Sesión cerrada por inactividad (4+ minutos sin actividad)');
  }

  forceLogout(reason = 'Sesión finalizada') {
    console.log('Forzando logout:', reason);
    
    // Guardar razón
    sessionStorage.setItem('logoutReason', reason);
    
    // Limpiar
    localStorage.removeItem('token');
    localStorage.removeItem('sessionID');
    
    // Cerrar modales
    this.closeModal();
    
    // Limpiar timers
    this.clearInactivityTimers();
    if (this.checkTimer) clearInterval(this.checkTimer);
    
    // Remover event listeners
    if (this.activityHandler && this.activityEvents) {
      this.activityEvents.forEach(event => {
        document.removeEventListener(event, this.activityHandler);
      });
    }
    
    // Redirigir
    setTimeout(() => {
      window.location.href = `/login?reason=${encodeURIComponent(reason)}`;
    }, 500);
  }

  destroy() {
    console.log('Destruyendo SessionManager');
    this.forceLogout('Sesión cerrada');
  }
}

// Singleton para asegurar una sola instancia
let sessionManagerInstance = null;

export const initSessionManager = (timeoutMinutes = 5) => {
  // Solo inicializar si está autenticado
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('No hay token, no se inicializa SessionManager');
    return null;
  }
  
  // Solo crear una instancia
  if (!sessionManagerInstance) {
    console.log('Creando nueva instancia de SessionManager');
    sessionManagerInstance = new SessionManager(timeoutMinutes);
    sessionManagerInstance.init();
  } else if (!sessionManagerInstance.initialized) {
    console.log('Reinicializando SessionManager existente');
    sessionManagerInstance.init();
  }
  
  return sessionManagerInstance;
};

export const getSessionManager = () => {
  return sessionManagerInstance;
};

export const destroySessionManager = () => {
  if (sessionManagerInstance) {
    sessionManagerInstance.destroy();
    sessionManagerInstance = null;
  }
};