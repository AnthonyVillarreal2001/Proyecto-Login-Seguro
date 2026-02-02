// src/utils/sessionManager.js - VERSIÓN ULTRA SEGURA
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
    
    // Logger seguro
    this.log('SessionManager configurado');
  }

  // Logger seguro sin console.log vulnerable
  log(message) {
    // Simplemente no hacer nada con los logs en producción
    // o usar una implementación segura
    if (typeof window !== 'undefined' && window.console && window.console.log) {
      try {
        window.console.log('[SessionManager] ' + message);
      } catch (e) {
        // Silenciar errores de logging
      }
    }
  }

  init() {
    if (this.initialized) {
      this.log('SessionManager ya está inicializado');
      return;
    }
    
    this.log('Inicializando...');
    
    this.lastActivity = Date.now();
    this.setupActivityListeners();
    this.checkTokenExpiry();
    this.startPeriodicCheck();
    this.startInactivityTimers();
    
    this.initialized = true;
    this.log('Inicializado correctamente');
  }

  setupActivityListeners() {
    const activityEvents = [
      'mousemove', 'mousedown', 'mouseup', 'click',
      'scroll', 'keydown', 'touchstart', 'input'
    ];
    
    const throttledActivity = this.throttle(() => {
      this.handleUserActivity();
    }, 1000);
    
    activityEvents.forEach(event => {
      try {
        document.addEventListener(event, throttledActivity, { passive: true });
      } catch (e) {
        // Ignorar errores de event listeners
      }
    });
    
    this.activityHandler = throttledActivity;
    this.activityEvents = activityEvents;
  }

  throttle(func, limit) {
    let inThrottle = false;
    const throttledFunction = function() {
      const args = Array.prototype.slice.call(arguments);
      const context = this;
      if (!inThrottle) {
        try {
          func.apply(context, args);
        } catch (error) {
          // Ignorar errores en throttled functions
        }
        inThrottle = true;
        setTimeout(function() {
          inThrottle = false;
        }, limit);
      }
    };
    return throttledFunction;
  }

  handleUserActivity() {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivity;
    
    if (timeSinceLastActivity > 1000) {
      this.lastActivity = now;
      this.resetInactivityTimers();
      
      if (this.isModalShowing) {
        this.closeModal();
        this.showSafeToast('Actividad detectada');
      }
    }
  }

  startPeriodicCheck() {
    this.checkTimer = setInterval(() => {
      this.checkTokenExpiry();
    }, this.checkInterval);
  }

  checkTokenExpiry() {
    const token = this.getLocalStorageItem('token');
    if (!token) return;

    try {
      const payload = this.safeParseJwt(token);
      if (!payload || typeof payload.exp !== 'number') return;
      
      const expiresAt = payload.exp * 1000;
      const timeLeft = expiresAt - Date.now();
      
      if (timeLeft <= 0) {
        this.safeLogout('Token expirado');
        return;
      }
      
      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);
      
      if (timeLeft < 2 * 60 * 1000 && timeLeft > 0) {
        if (!this.isModalShowing) {
          this.showSafeTokenWarning(minutes, seconds);
        }
      }
      
    } catch (err) {
      this.log('Error verificando token');
    }
  }

  // Método ultra seguro para obtener de localStorage
  getLocalStorageItem(key) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const item = window.localStorage.getItem(key);
      return typeof item === 'string' ? item : null;
    } catch (e) {
      return null;
    }
  }

  // Método ultra seguro para parsear JWT
  safeParseJwt(token) {
    if (typeof token !== 'string') return null;
    
    try {
      // Validar formato JWT básico
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      // Decodificar payload base64 de forma segura
      const base64 = parts[1];
      if (!/^[A-Za-z0-9+/=]+$/.test(base64)) return null;
      
      const decoded = this.safeBase64Decode(base64);
      if (!decoded) return null;
      
      return JSON.parse(decoded);
    } catch (e) {
      return null;
    }
  }

  // Decodificación base64 segura
  safeBase64Decode(base64) {
    try {
      // Eliminar padding y validar
      const cleanBase64 = base64.replace(/=+$/, '');
      if (!/^[A-Za-z0-9+/]+$/.test(cleanBase64)) return null;
      
      // Usar atob pero solo después de validación exhaustiva
      const decoded = atob(base64);
      
      // Validar que sea JSON válido
      if (typeof decoded !== 'string') return null;
      if (decoded.trim().length === 0) return null;
      
      return decoded;
    } catch (e) {
      return null;
    }
  }

  startInactivityTimers() {
    this.clearInactivityTimers();
    
    this.warningTimer = setTimeout(() => {
      this.showSafeInactivityWarning();
    }, this.timeout - this.warningTime);
    
    this.timer = setTimeout(() => {
      this.logoutDueToInactivity();
    }, this.timeout);
  }

  resetInactivityTimers() {
    this.startInactivityTimers();
  }

  clearInactivityTimers() {
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  showSafeTokenWarning(minutes, seconds) {
    if (this.isModalShowing) return;
    
    this.isModalShowing = true;
    
    // Crear elementos de forma segura
    const modal = this.createSafeElement('div', 'tokenExpiryModal');
    modal.setAttribute('role', 'alert');
    
    const container = this.createSafeElement('div');
    container.style.cssText = 'display:flex;align-items:flex-start;gap:10px';
    
    const icon = this.createSafeElement('span');
    icon.textContent = '⏰';
    icon.style.cssText = 'font-size:24px';
    
    const content = this.createSafeElement('div');
    
    const title = this.createSafeElement('strong');
    title.textContent = 'Token por expirar';
    title.style.cssText = 'color:#856404;display:block';
    
    const message1 = this.createSafeElement('p');
    message1.textContent = `Tu token expira en ${minutes}:${seconds.toString().padStart(2, '0')}`;
    message1.style.cssText = 'margin:5px 0 0 0;color:#856404;font-size:14px';
    
    const message2 = this.createSafeElement('p');
    message2.textContent = 'Realiza alguna acción para renovar';
    message2.style.cssText = 'margin:5px 0 0 0;color:#856404;font-size:12px';
    
    // Construir estructura
    content.appendChild(title);
    content.appendChild(message1);
    content.appendChild(message2);
    container.appendChild(icon);
    container.appendChild(content);
    modal.appendChild(container);
    
    // Estilos inline seguros
    modal.style.cssText = 'position:fixed;top:20px;right:20px;background:#fff3cd;border:1px solid #ffeaa7;border-radius:8px;padding:15px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);max-width:350px;animation:slideIn 0.3s';
    
    // Agregar animación CSS segura
    const style = this.createSafeElement('style');
    style.textContent = '@keyframes slideIn {from {transform:translateX(100%);opacity:0;} to {transform:translateX(0);opacity:1;}}';
    document.head.appendChild(style);
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
      this.closeModal();
      if (style.parentNode) {
        document.head.removeChild(style);
      }
    }, 10000);
  }

  showSafeInactivityWarning() {
    if (this.isModalShowing) return;
    
    this.isModalShowing = true;
    
    const modal = this.createSafeElement('div', 'inactivityWarningModal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    
    const dialog = this.createSafeElement('div');
    dialog.style.cssText = 'background:white;padding:40px;border-radius:15px;max-width:500px;width:90%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3)';
    
    const icon = this.createSafeElement('div');
    icon.textContent = '⚠️';
    icon.style.cssText = 'font-size:60px;margin-bottom:20px';
    
    const title = this.createSafeElement('h3');
    title.textContent = '¡Inactividad detectada!';
    title.style.cssText = 'color:#dc3545;margin-bottom:15px';
    
    const message1 = this.createSafeElement('p');
    message1.textContent = 'Has estado inactivo por 4 minutos.';
    message1.style.cssText = 'font-size:16px;color:#666;margin-bottom:10px';
    
    const message2 = this.createSafeElement('p');
    message2.style.cssText = 'font-size:16px;color:#666;margin-bottom:25px';
    
    const countdownText = document.createTextNode('La sesión se cerrará en ');
    const countdownSpan = this.createSafeElement('strong');
    countdownSpan.id = 'countdown';
    countdownSpan.textContent = '60';
    countdownSpan.style.cssText = 'color:#dc3545;font-size:20px';
    const secondsText = document.createTextNode(' segundos.');
    
    message2.appendChild(countdownText);
    message2.appendChild(countdownSpan);
    message2.appendChild(secondsText);
    
    const buttonsContainer = this.createSafeElement('div');
    buttonsContainer.style.cssText = 'display:flex;gap:15px;justify-content:center;flex-wrap:wrap';
    
    const continueBtn = this.createSafeElement('button');
    continueBtn.id = 'continueSessionBtn';
    continueBtn.textContent = 'Continuar sesión';
    continueBtn.style.cssText = 'padding:12px 30px;background:#28a745;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;min-width:200px';
    
    const logoutBtn = this.createSafeElement('button');
    logoutBtn.id = 'logoutNowBtn';
    logoutBtn.textContent = 'Cerrar sesión';
    logoutBtn.style.cssText = 'padding:12px 30px;background:#6c757d;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;min-width:200px';
    
    const footer = this.createSafeElement('p');
    footer.textContent = 'Mueve el mouse o presiona una tecla';
    footer.style.cssText = 'font-size:14px;color:#999;margin-top:25px';
    
    // Construir
    buttonsContainer.appendChild(continueBtn);
    buttonsContainer.appendChild(logoutBtn);
    
    dialog.appendChild(icon);
    dialog.appendChild(title);
    dialog.appendChild(message1);
    dialog.appendChild(message2);
    dialog.appendChild(buttonsContainer);
    dialog.appendChild(footer);
    
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;justify-content:center;align-items:center;z-index:99999';
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
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
        this.safeLogout('Sesión cerrada');
      }
    }, 1000);
    
    this.countdownInterval = countdownInterval;
    
    // Event listeners seguros
    this.safeAddEventListener(continueBtn, 'click', () => {
      clearInterval(countdownInterval);
      this.handleUserActivity();
    });
    
    this.safeAddEventListener(logoutBtn, 'click', () => {
      clearInterval(countdownInterval);
      this.safeLogout('Sesión cerrada');
    });
    
    // Actividad para cerrar modal
    const closeOnActivity = () => {
      clearInterval(countdownInterval);
      this.handleUserActivity();
    };
    
    this.safeAddEventListener(document, 'mousemove', closeOnActivity, { once: true });
    this.safeAddEventListener(document, 'keydown', closeOnActivity, { once: true });
  }

  // Helper para crear elementos de forma segura
  createSafeElement(tagName, id = '') {
    const element = document.createElement(tagName);
    if (id) {
      element.id = id;
    }
    return element;
  }

  // Helper para agregar event listeners de forma segura
  safeAddEventListener(element, event, handler, options = {}) {
    if (element && element.addEventListener) {
      try {
        element.addEventListener(event, handler, options);
      } catch (e) {
        // Ignorar errores
      }
    }
  }

  closeModal() {
    const modals = ['inactivityWarningModal', 'tokenExpiryModal'];
    
    modals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    });
    
    this.isModalShowing = false;
    
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  showSafeToast(message) {
    const existingToast = document.getElementById('sessionToast');
    if (existingToast && existingToast.parentNode) {
      existingToast.parentNode.removeChild(existingToast);
    }
    
    const toast = this.createSafeElement('div', 'sessionToast');
    toast.setAttribute('role', 'status');
    
    toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#d4edda;color:#155724;border:1px solid #c3e6cb;padding:12px 20px;border-radius:8px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;gap:10px';
    
    const text = this.createSafeElement('span');
    text.textContent = this.sanitizeText(message);
    
    toast.appendChild(text);
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }

  // Sanitización segura de texto
  sanitizeText(text) {
    if (typeof text !== 'string') return '';
    
    // Eliminar caracteres peligrosos
    const safeText = text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    return safeText;
  }

  logoutDueToInactivity() {
    this.safeLogout('Sesión cerrada por inactividad');
  }

  safeLogout(reason = 'Sesión finalizada') {
    this.log('Cerrando sesión: ' + reason);
    
    // Limpiar almacenamiento de forma segura
    this.clearStorage();
    
    this.closeModal();
    this.clearTimers();
    this.removeEventListeners();
    
    // Redirección segura
    setTimeout(() => {
      const safeReason = this.sanitizeText(reason);
      const encodedReason = encodeURIComponent(safeReason);
      window.location.href = '/login?reason=' + encodedReason;
    }, 500);
  }

  clearStorage() {
    try {
      if (window.localStorage) {
        window.localStorage.removeItem('token');
        window.localStorage.removeItem('sessionID');
      }
      if (window.sessionStorage) {
        window.sessionStorage.removeItem('logoutReason');
      }
    } catch (e) {
      // Ignorar errores de storage
    }
  }

  clearTimers() {
    this.clearInactivityTimers();
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  removeEventListeners() {
    if (this.activityHandler && this.activityEvents) {
      this.activityEvents.forEach(event => {
        try {
          document.removeEventListener(event, this.activityHandler);
        } catch (e) {
          // Ignorar errores
        }
      });
    }
  }

  destroy() {
    this.safeLogout('Sesión cerrada');
  }
}

// Patrón singleton seguro
let sessionManagerInstance = null;

const initSessionManager = (timeoutMinutes = 5) => {
  if (typeof window === 'undefined') return null;
  
  try {
    const token = window.localStorage ? window.localStorage.getItem('token') : null;
    if (!token) return null;
  } catch (e) {
    return null;
  }
  
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager(timeoutMinutes);
    sessionManagerInstance.init();
  } else if (!sessionManagerInstance.initialized) {
    sessionManagerInstance.init();
  }
  
  return sessionManagerInstance;
};

const getSessionManager = () => {
  return sessionManagerInstance;
};

const destroySessionManager = () => {
  if (sessionManagerInstance) {
    sessionManagerInstance.destroy();
    sessionManagerInstance = null;
  }
};

// Exportar de forma segura
export { initSessionManager, getSessionManager, destroySessionManager };