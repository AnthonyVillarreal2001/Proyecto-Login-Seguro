// src/utils/sessionManager.js - VERSIÓN SEGURA CORREGIDA
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
      // Decodificación segura del token JWT
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('Formato de token inválido');
        return;
      }
      
      // Usar decodeURIComponent con escape para evitar problemas
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const payload = JSON.parse(jsonPayload);
      const expiresAt = payload.exp * 1000;
      const timeLeft = expiresAt - Date.now();
      
      // Convertir a minutos y segundos para logging
      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);
      
      console.log(`Token expira en: ${minutes}:${seconds.toString().padStart(2, '0')}`);
      
      // Mostrar advertencia visual cuando queden 2 minutos
      if (timeLeft < 2 * 60 * 1000 && timeLeft > 0) {
        if (!this.isModalShowing) {
          this.showTokenExpiryWarning(minutes, seconds);
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

  showTokenExpiryWarning(minutes, seconds) {
    // Solo mostrar si no hay otro modal
    if (this.isModalShowing) return;
    
    this.isModalShowing = true;
    
    const modal = document.createElement('div');
    modal.id = 'tokenExpiryModal';
    modal.setAttribute('role', 'alert');
    modal.setAttribute('aria-live', 'polite');
    
    // Estilos directamente en el elemento
    modal.style.position = 'fixed';
    modal.style.top = '20px';
    modal.style.right = '20px';
    modal.style.backgroundColor = '#fff3cd';
    modal.style.border = '1px solid #ffeaa7';
    modal.style.borderRadius = '8px';
    modal.style.padding = '15px';
    modal.style.zIndex = '9999';
    modal.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    modal.style.maxWidth = '350px';
    modal.style.animation = 'slideInRight 0.3s ease';
    
    // Crear contenido seguro usando DOM methods
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'flex-start';
    container.style.gap = '10px';
    
    const icon = document.createElement('span');
    icon.textContent = '⏰';
    icon.style.fontSize = '24px';
    
    const contentDiv = document.createElement('div');
    
    const title = document.createElement('strong');
    title.textContent = 'Token por expirar';
    title.style.color = '#856404';
    title.style.display = 'block';
    
    const message1 = document.createElement('p');
    message1.textContent = `Tu token de sesión expira en ${minutes}:${seconds.toString().padStart(2, '0')}`;
    message1.style.margin = '5px 0 0 0';
    message1.style.color = '#856404';
    message1.style.fontSize = '14px';
    
    const message2 = document.createElement('p');
    message2.textContent = 'Realiza alguna acción para renovarlo automáticamente';
    message2.style.margin = '5px 0 0 0';
    message2.style.color = '#856404';
    message2.style.fontSize = '12px';
    
    contentDiv.appendChild(title);
    contentDiv.appendChild(message1);
    contentDiv.appendChild(message2);
    
    container.appendChild(icon);
    container.appendChild(contentDiv);
    modal.appendChild(container);
    
    // Agregar estilos CSS seguros
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    modal.appendChild(style);
    
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
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'inactivityTitle');
    modal.setAttribute('aria-modal', 'true');
    
    // Estilos
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.85)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '99999';
    
    const dialog = document.createElement('div');
    dialog.style.backgroundColor = 'white';
    dialog.style.padding = '40px';
    dialog.style.borderRadius = '15px';
    dialog.style.maxWidth = '500px';
    dialog.style.width = '90%';
    dialog.style.textAlign = 'center';
    dialog.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)';
    
    // Icono
    const icon = document.createElement('div');
    icon.textContent = '⚠️';
    icon.style.fontSize = '60px';
    icon.style.marginBottom = '20px';
    
    // Título
    const title = document.createElement('h3');
    title.id = 'inactivityTitle';
    title.textContent = '¡Inactividad detectada!';
    title.style.color = '#dc3545';
    title.style.marginBottom = '15px';
    
    // Mensaje 1
    const message1 = document.createElement('p');
    message1.textContent = 'Has estado inactivo por 4 minutos.';
    message1.style.fontSize = '16px';
    message1.style.color = '#666';
    message1.style.marginBottom = '10px';
    
    // Mensaje 2 con contador
    const message2 = document.createElement('p');
    message2.textContent = 'La sesión se cerrará en ';
    message2.style.fontSize = '16px';
    message2.style.color = '#666';
    message2.style.marginBottom = '25px';
    
    const countdownSpan = document.createElement('strong');
    countdownSpan.id = 'countdown';
    countdownSpan.textContent = '60';
    countdownSpan.style.color = '#dc3545';
    countdownSpan.style.fontSize = '20px';
    
    const secondsText = document.createTextNode(' segundos.');
    
    message2.appendChild(countdownSpan);
    message2.appendChild(secondsText);
    
    // Botones container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.gap = '15px';
    buttonsContainer.style.justifyContent = 'center';
    buttonsContainer.style.flexWrap = 'wrap';
    
    // Botón continuar
    const continueBtn = document.createElement('button');
    continueBtn.id = 'continueSessionBtn';
    continueBtn.textContent = '🖱️ Continuar sesión';
    continueBtn.style.padding = '12px 30px';
    continueBtn.style.backgroundColor = '#28a745';
    continueBtn.style.color = 'white';
    continueBtn.style.border = 'none';
    continueBtn.style.borderRadius = '8px';
    continueBtn.style.cursor = 'pointer';
    continueBtn.style.fontSize = '16px';
    continueBtn.style.fontWeight = 'bold';
    continueBtn.style.minWidth = '200px';
    
    // Botón logout
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logoutNowBtn';
    logoutBtn.textContent = '👋 Cerrar sesión ahora';
    logoutBtn.style.padding = '12px 30px';
    logoutBtn.style.backgroundColor = '#6c757d';
    logoutBtn.style.color = 'white';
    logoutBtn.style.border = 'none';
    logoutBtn.style.borderRadius = '8px';
    logoutBtn.style.cursor = 'pointer';
    logoutBtn.style.fontSize = '16px';
    logoutBtn.style.minWidth = '200px';
    
    // Footer
    const footer = document.createElement('p');
    footer.textContent = 'Mueve el mouse o presiona una tecla para mantenerte conectado';
    footer.style.fontSize = '14px';
    footer.style.color = '#999';
    footer.style.marginTop = '25px';
    
    // Construir estructura
    buttonsContainer.appendChild(continueBtn);
    buttonsContainer.appendChild(logoutBtn);
    
    dialog.appendChild(icon);
    dialog.appendChild(title);
    dialog.appendChild(message1);
    dialog.appendChild(message2);
    dialog.appendChild(buttonsContainer);
    dialog.appendChild(footer);
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    let countdown = 60;
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdownSpan) {
        countdownSpan.textContent = countdown.toString();
        
        // Cambiar color cuando quedan 10 segundos
        if (countdown <= 10) {
          countdownSpan.style.color = '#ff0000';
          countdownSpan.style.fontWeight = 'bold';
        }
      }
      
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        this.forceLogout('Sesión cerrada por inactividad');
      }
    }, 1000);
    
    // Botón para continuar sesión
    continueBtn.addEventListener('click', () => {
      clearInterval(countdownInterval);
      this.handleUserActivity();
      this.showToast('✅ Sesión extendida', 'success');
    });
    
    // Botón para cerrar sesión
    logoutBtn.addEventListener('click', () => {
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
    
    // Guardar referencia para cleanup
    this.countdownInterval = countdownInterval;
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
    
    // Limpiar intervalos
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  showToast(message, type = 'info') {
    // Sanitizar mensaje
    const sanitizedMessage = this.sanitizeText(message);
    
    // Eliminar toast anterior si existe
    const existingToast = document.getElementById('sessionToast');
    if (existingToast) {
      document.body.removeChild(existingToast);
    }
    
    const toast = document.createElement('div');
    toast.id = 'sessionToast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    
    // Estilos
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = type === 'success' ? '#d4edda' : '#f8d7da';
    toast.style.color = type === 'success' ? '#155724' : '#721c24';
    toast.style.border = `1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'}`;
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';
    
    // Icono
    const icon = document.createElement('span');
    icon.textContent = type === 'success' ? '✅' : '❌';
    icon.style.fontSize = '20px';
    
    // Texto
    const text = document.createElement('span');
    text.textContent = sanitizedMessage;
    
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

  // Función para sanitizar texto
  sanitizeText(text) {
    if (typeof text !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.textContent;
  }

  logoutDueToInactivity() {
    this.forceLogout('Sesión cerrada por inactividad (4+ minutos sin actividad)');
  }

  forceLogout(reason = 'Sesión finalizada') {
    console.log('Forzando logout:', reason);
    
    // Sanitizar razón antes de usar
    const sanitizedReason = this.sanitizeText(reason);
    
    // Guardar razón
    sessionStorage.setItem('logoutReason', sanitizedReason);
    
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
    
    // Redirigir de forma segura
    setTimeout(() => {
      // Codificar parámetros para URL
      const encodedReason = encodeURIComponent(sanitizedReason);
      window.location.href = `/login?reason=${encodedReason}`;
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