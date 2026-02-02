// frontend/src/utils/sessionManager.js - VERSIÓN SEGURA
class SessionManager {
  constructor(timeoutMinutes = 5) {
    this.timeout = timeoutMinutes * 60 * 1000;
    this.warningTime = 4 * 60 * 1000;
    this.checkInterval = 10 * 1000;
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
    this.lastActivity = Date.now();
    this.setupActivityListeners();
    this.checkTokenExpiry();
    this.startPeriodicCheck();
    this.startInactivityTimers();
    this.initialized = true;
    console.log('SessionManager inicializado correctamente');
  }

  setupActivityListeners() {
    // Eventos de actividad - MÉTODO SEGURO
    const activityEvents = [
      'mousemove', 'mousedown', 'mouseup', 'click', 'dblclick',
      'scroll', 'wheel', 'keydown', 'keypress', 'keyup',
      'touchstart', 'touchmove', 'touchend', 'input', 'change',
      'focus', 'blur'
    ];
    
    const throttledActivity = this.throttle(() => {
      this.handleUserActivity();
    }, 1000);
    
    activityEvents.forEach(event => {
      document.addEventListener(event, throttledActivity, { passive: true });
    });
    
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
    
    if (timeSinceLastActivity > 1000) {
      this.lastActivity = now;
      console.log(`Actividad detectada. Última actividad: ${Math.floor(timeSinceLastActivity/1000)}s atrás`);
      this.resetInactivityTimers();
      
      if (this.isModalShowing) {
        this.closeModal();
        this.showToast('✅ Actividad detectada, sesión extendida', 'success');
      }
    }
  }

  // MÉTODO SEGURO: Crear elementos DOM sin innerHTML
  createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    // Atributos seguros
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        element.addEventListener(key.substring(2).toLowerCase(), value);
      } else if (key === 'className') {
        element.className = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (value !== null && value !== undefined) {
        element.setAttribute(key, value);
      }
    });
    
    // Hijos seguros
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    });
    
    return element;
  }

  showTokenExpiryWarning(timeLeft) {
    if (this.isModalShowing) return;
    
    this.isModalShowing = true;
    
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    
    // CREACIÓN SEGURA DEL MODAL - Sin innerHTML
    const modal = this.createElement('div', {
      id: 'tokenExpiryModal',
      style: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '8px',
        padding: '15px',
        zIndex: '9999',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxWidth: '350px',
        animation: 'slideInRight 0.3s ease'
      }
    });
    
    const icon = this.createElement('span', {
      style: {
        fontSize: '24px',
        marginRight: '10px'
      },
      textContent: '⏰'
    });
    
    const content = this.createElement('div');
    
    const title = this.createElement('strong', {
      style: { color: '#856404' },
      textContent: 'Token por expirar'
    });
    
    const message1 = this.createElement('p', {
      style: {
        margin: '5px 0 0 0',
        color: '#856404',
        fontSize: '14px'
      },
      textContent: `Tu token de sesión expira en ${minutes}:${seconds.toString().padStart(2, '0')}`
    });
    
    const message2 = this.createElement('p', {
      style: {
        margin: '5px 0 0 0',
        color: '#856404',
        fontSize: '12px'
      },
      textContent: 'Realiza alguna acción para renovarlo automáticamente'
    });
    
    content.appendChild(title);
    content.appendChild(message1);
    content.appendChild(message2);
    
    const container = this.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px'
      }
    }, [icon, content]);
    
    modal.appendChild(container);
    
    // Añadir estilos CSS de forma segura
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(modal);
    
    // Auto-remover después de 10 segundos
    setTimeout(() => {
      this.closeModal();
    }, 10000);
  }

  showInactivityWarning() {
    if (this.isModalShowing) return;
    
    this.isModalShowing = true;
    
    // Crear overlay de fondo
    const overlay = this.createElement('div', {
      id: 'inactivityWarningOverlay',
      style: {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: '99999'
      }
    });
    
    // Crear modal principal
    const modal = this.createElement('div', {
      style: {
        background: 'white',
        padding: '40px',
        borderRadius: '15px',
        maxWidth: '500px',
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
      }
    });
    
    // Icono
    const icon = this.createElement('div', {
      style: {
        fontSize: '60px',
        marginBottom: '20px'
      },
      textContent: '⚠️'
    });
    
    // Título
    const title = this.createElement('h3', {
      style: {
        color: '#dc3545',
        marginBottom: '15px'
      },
      textContent: '¡Inactividad detectada!'
    });
    
    // Mensajes
    const message1 = this.createElement('p', {
      style: {
        fontSize: '16px',
        color: '#666',
        marginBottom: '10px'
      },
      textContent: 'Has estado inactivo por 4 minutos.'
    });
    
    const countdownText = this.createElement('p', {
      style: {
        fontSize: '16px',
        color: '#666',
        marginBottom: '25px'
      }
    });
    
    const countdownSpan = this.createElement('strong', {
      id: 'countdown',
      style: {
        color: '#dc3545',
        fontSize: '20px'
      },
      textContent: '60'
    });
    
    countdownText.appendChild(document.createTextNode('La sesión se cerrará en '));
    countdownText.appendChild(countdownSpan);
    countdownText.appendChild(document.createTextNode(' segundos.'));
    
    // Botones - CREADOS DE FORMA SEGURA
    const buttonContainer = this.createElement('div', {
      style: {
        display: 'flex',
        gap: '15px',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }
    });
    
    const continueButton = this.createElement('button', {
      id: 'continueSessionBtn',
      style: {
        padding: '12px 30px',
        background: '#28a745',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        minWidth: '200px'
      },
      textContent: '🖱️ Continuar sesión'
    });
    
    const logoutButton = this.createElement('button', {
      id: 'logoutNowBtn',
      style: {
        padding: '12px 30px',
        background: '#6c757d',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '16px',
        minWidth: '200px'
      },
      textContent: '👋 Cerrar sesión ahora'
    });
    
    const footerMessage = this.createElement('p', {
      style: {
        fontSize: '14px',
        color: '#999',
        marginTop: '25px'
      },
      textContent: 'Mueve el mouse o presiona una tecla para mantenerte conectado'
    });
    
    // Ensamblar modal
    buttonContainer.appendChild(continueButton);
    buttonContainer.appendChild(logoutButton);
    
    modal.appendChild(icon);
    modal.appendChild(title);
    modal.appendChild(message1);
    modal.appendChild(countdownText);
    modal.appendChild(buttonContainer);
    modal.appendChild(footerMessage);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Contador regresivo - MANEJO SEGURO
    let countdown = 60;
    const countdownInterval = setInterval(() => {
      countdown--;
      countdownSpan.textContent = countdown.toString();
      
      if (countdown <= 10) {
        countdownSpan.style.color = '#ff0000';
        countdownSpan.style.fontWeight = 'bold';
      }
      
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        this.forceLogout('Sesión cerrada por inactividad');
      }
    }, 1000);
    
    // Event listeners seguros
    continueButton.addEventListener('click', () => {
      clearInterval(countdownInterval);
      this.handleUserActivity();
      this.showToast('✅ Sesión extendida', 'success');
    });
    
    logoutButton.addEventListener('click', () => {
      clearInterval(countdownInterval);
      this.forceLogout('Sesión cerrada manualmente');
    });
    
    // También cerrar con cualquier actividad
    const handleActivity = () => {
      clearInterval(countdownInterval);
      this.handleUserActivity();
      this.showToast('✅ Sesión extendida', 'success');
    };
    
    document.addEventListener('mousemove', handleActivity, { once: true });
    document.addEventListener('keydown', handleActivity, { once: true });
  }

  showToast(message, type = 'info') {
    // Eliminar toast anterior si existe
    const existingToast = document.getElementById('sessionToast');
    if (existingToast) {
      document.body.removeChild(existingToast);
    }
    
    // Crear toast de forma segura
    const toast = this.createElement('div', {
      id: 'sessionToast',
      style: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: type === 'success' ? '#d4edda' : '#f8d7da',
        color: type === 'success' ? '#155724' : '#721c24',
        border: `1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
        padding: '12px 20px',
        borderRadius: '8px',
        zIndex: '9999',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }
    });
    
    const icon = this.createElement('span', {
      style: { fontSize: '20px' },
      textContent: type === 'success' ? '✅' : '❌'
    });
    
    const text = this.createElement('span', {
      textContent: message
    });
    
    toast.appendChild(icon);
    toast.appendChild(text);
    document.body.appendChild(toast);
    
    // Auto-remover después de 3 segundos
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 3000);
  }

  closeModal() {
    // Método seguro para cerrar modales
    const modals = ['inactivityWarningOverlay', 'tokenExpiryModal'];
    
    modals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal && document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
    });
    
    // También limpiar por clase si existe
    const modalElements = document.querySelectorAll('[id^="inactivity"], [id^="token"]');
    modalElements.forEach(el => {
      if (document.body.contains(el)) {
        document.body.removeChild(el);
      }
    });
    
    this.isModalShowing = false;
  }

  startPeriodicCheck() {
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
      
      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);
      
      console.log(`Token expira en: ${minutes}:${seconds.toString().padStart(2, '0')}`);
      
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
    this.clearInactivityTimers();
    
    this.warningTimer = setTimeout(() => {
      this.showInactivityWarning();
    }, this.timeout - this.warningTime);
    
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
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('No hay token, no se inicializa SessionManager');
    return null;
  }
  
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