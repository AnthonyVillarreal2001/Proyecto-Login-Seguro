// src/utils/sessionManager.js - VERSIÓN COMPLETAMENTE SEGURA
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
    
    // Crear estilos CSS globales seguros una sola vez
    this.createGlobalStyles();
    
    console.log(`SessionManager configurado para ${timeoutMinutes} minutos de inactividad`);
  }

  // Crear estilos CSS globales de forma segura
  createGlobalStyles() {
    if (document.getElementById('session-manager-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'session-manager-styles';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      #sessionToast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      #tokenExpiryModal {
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
      }
      
      #inactivityWarningModal {
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
      }
    `;
    document.head.appendChild(style);
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
        this.showToast('Actividad detectada, sesión extendida', 'success');
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
      // Decodificación segura del token JWT sin atob vulnerable
      const payload = this.parseJwt(token);
      if (!payload || !payload.exp) {
        console.error('Token inválido o sin expiración');
        return;
      }
      
      const expiresAt = payload.exp * 1000;
      const timeLeft = expiresAt - Date.now();
      
      if (timeLeft <= 0) {
        this.forceLogout('Token expirado');
        return;
      }
      
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

  // Método seguro para parsear JWT
  parseJwt(token) {
    try {
      // Validar formato básico
      if (typeof token !== 'string' || token.split('.').length !== 3) {
        return null;
      }
      
      const base64Url = token.split('.')[1];
      // Reemplazar caracteres de Base64Url
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      
      // Decodificar Base64 de forma segura
      const jsonPayload = this.decodeBase64(base64);
      if (!jsonPayload) return null;
      
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT:', error);
      return null;
    }
  }

  // Decodificar Base64 de forma segura
  decodeBase64(base64) {
    try {
      // Usar atob pero con validación previa
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return new TextDecoder().decode(bytes);
    } catch (error) {
      console.error('Error decoding base64:', error);
      return null;
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
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  showTokenExpiryWarning(minutes, seconds) {
    // Solo mostrar si no hay otro modal
    if (this.isModalShowing) return;
    
    this.isModalShowing = true;
    
    const modal = document.createElement('div');
    modal.id = 'tokenExpiryModal';
    modal.setAttribute('role', 'alert');
    modal.setAttribute('aria-live', 'polite');
    
    const container = this.createElementWithStyles('div', {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px'
    });
    
    const icon = this.createElementWithStyles('span', {
      fontSize: '24px'
    });
    icon.textContent = '⏰';
    
    const contentDiv = document.createElement('div');
    
    const title = this.createElementWithStyles('strong', {
      color: '#856404',
      display: 'block'
    });
    title.textContent = 'Token por expirar';
    
    const message1 = this.createElementWithStyles('p', {
      margin: '5px 0 0 0',
      color: '#856404',
      fontSize: '14px'
    });
    message1.textContent = `Tu token de sesión expira en ${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const message2 = this.createElementWithStyles('p', {
      margin: '5px 0 0 0',
      color: '#856404',
      fontSize: '12px'
    });
    message2.textContent = 'Realiza alguna acción para renovarlo automáticamente';
    
    contentDiv.appendChild(title);
    contentDiv.appendChild(message1);
    contentDiv.appendChild(message2);
    
    container.appendChild(icon);
    container.appendChild(contentDiv);
    modal.appendChild(container);
    
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
    
    const dialog = this.createElementWithStyles('div', {
      backgroundColor: 'white',
      padding: '40px',
      borderRadius: '15px',
      maxWidth: '500px',
      width: '90%',
      textAlign: 'center',
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
    });
    
    // Icono
    const icon = this.createElementWithStyles('div', {
      fontSize: '60px',
      marginBottom: '20px'
    });
    icon.textContent = '⚠️';
    
    // Título
    const title = this.createElementWithStyles('h3', {
      color: '#dc3545',
      marginBottom: '15px'
    });
    title.id = 'inactivityTitle';
    title.textContent = '¡Inactividad detectada!';
    
    // Mensaje 1
    const message1 = this.createElementWithStyles('p', {
      fontSize: '16px',
      color: '#666',
      marginBottom: '10px'
    });
    message1.textContent = 'Has estado inactivo por 4 minutos.';
    
    // Mensaje 2 con contador
    const message2 = this.createElementWithStyles('p', {
      fontSize: '16px',
      color: '#666',
      marginBottom: '25px'
    });
    const message2Text = document.createTextNode('La sesión se cerrará en ');
    const countdownSpan = this.createElementWithStyles('strong', {
      color: '#dc3545',
      fontSize: '20px'
    });
    countdownSpan.id = 'countdown';
    countdownSpan.textContent = '60';
    const secondsText = document.createTextNode(' segundos.');
    
    message2.appendChild(message2Text);
    message2.appendChild(countdownSpan);
    message2.appendChild(secondsText);
    
    // Botones container
    const buttonsContainer = this.createElementWithStyles('div', {
      display: 'flex',
      gap: '15px',
      justifyContent: 'center',
      flexWrap: 'wrap'
    });
    
    // Botón continuar
    const continueBtn = this.createElementWithStyles('button', {
      padding: '12px 30px',
      backgroundColor: '#28a745',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: 'bold',
      minWidth: '200px'
    });
    continueBtn.id = 'continueSessionBtn';
    continueBtn.textContent = '🖱️ Continuar sesión';
    
    // Botón logout
    const logoutBtn = this.createElementWithStyles('button', {
      padding: '12px 30px',
      backgroundColor: '#6c757d',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '16px',
      minWidth: '200px'
    });
    logoutBtn.id = 'logoutNowBtn';
    logoutBtn.textContent = '👋 Cerrar sesión ahora';
    
    // Footer
    const footer = this.createElementWithStyles('p', {
      fontSize: '14px',
      color: '#999',
      marginTop: '25px'
    });
    footer.textContent = 'Mueve el mouse o presiona una tecla para mantenerte conectado';
    
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
    
    // Hacer el modal enfocable
    modal.tabIndex = -1;
    modal.focus();
    
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
    
    // Guardar referencia para cleanup
    this.countdownInterval = countdownInterval;
    
    // Botón para continuar sesión
    continueBtn.addEventListener('click', () => {
      clearInterval(countdownInterval);
      this.handleUserActivity();
      this.showToast('Sesión extendida', 'success');
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
      this.showToast('Sesión extendida', 'success');
    };
    
    document.addEventListener('mousemove', handleActivity, { once: true });
    document.addEventListener('keydown', handleActivity, { once: true });
  }

  // Helper para crear elementos con estilos
  createElementWithStyles(tagName, styles) {
    const element = document.createElement(tagName);
    Object.assign(element.style, styles);
    return element;
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
    
    // Configurar estilos basados en tipo
    if (type === 'success') {
      toast.style.backgroundColor = '#d4edda';
      toast.style.color = '#155724';
      toast.style.border = '1px solid #c3e6cb';
    } else {
      toast.style.backgroundColor = '#f8d7da';
      toast.style.color = '#721c24';
      toast.style.border = '1px solid #f5c6cb';
    }
    
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
    
    // Crear elemento temporal y usar textContent
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
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    
    // Remover event listeners
    if (this.activityHandler && this.activityEvents) {
      this.activityEvents.forEach(event => {
        document.removeEventListener(event, this.activityHandler);
      });
    }
    
    // Limpiar estilos globales
    const styles = document.getElementById('session-manager-styles');
    if (styles) {
      document.head.removeChild(styles);
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