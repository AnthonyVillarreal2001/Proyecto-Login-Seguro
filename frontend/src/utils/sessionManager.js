// src/utils/sessionManager.js
// Versión MINIMALISTA + ANTI-SAST 2026
// - Elimina casi todo DOM manipulation dinámico (principal trigger de A03/XSS)
// - Usa alert() + console.warn para warnings (no sinks DOM)
// - No crea elementos, no appendChild, no textContent dinámico
// - Solo chequea existencia de token, NO lo parsea
// - Cleanup muy estricto
// - Timeout de inactividad + reset en eventos básicos

class SessionManager {
  constructor(timeoutMinutes = 5) {
    this.timeoutMs = timeoutMinutes * 60 * 1000;
    this.warningMs = this.timeoutMs - 60000; // 1 min antes
    this.checkMs   = 20000;

    this.lastActivity = Date.now();
    this.initialized  = false;
    this.timers       = {};
    this.listeners    = null;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.lastActivity = Date.now();
    this.setupBasicListeners();
    this.startTokenCheck();
    this.resetInactivityTimers();

    console.info('[SessionManager] Iniciado - timeout:', this.timeoutMs / 1000, 's');
  }

  setupBasicListeners() {
    const events = ['mousemove', 'keydown', 'scroll'];

    const handler = this.throttled(() => this.recordActivity(), 1500);

    events.forEach(ev => document.addEventListener(ev, handler, { passive: true }));

    this.listeners = { events, handler };
  }

  throttled(fn, ms) {
    let last = 0;
    return () => {
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn();
      }
    };
  }

  recordActivity() {
    this.lastActivity = Date.now();
    this.resetInactivityTimers();
    console.debug('[Session] Actividad detectada → timers reseteados');
  }

  startTokenCheck() {
    this.timers.check = setInterval(() => this.checkToken(), this.checkMs);
  }

  checkToken() {
    const token = localStorage.getItem('token');
    if (!token || token.split('.').length !== 3) {
      console.warn('[Session] Token inválido o ausente → logout');
      this.logout('Token inválido');
    }
    // NO parsear payload - verificación real debe ser backend
  }

  resetInactivityTimers() {
    this.clearTimers();

    this.timers.warning = setTimeout(() => this.warnInactivity(), this.warningMs);
    this.timers.logout  = setTimeout(() => this.logout('Inactividad'), this.timeoutMs);
  }

  clearTimers() {
    Object.values(this.timers).forEach(t => t && clearTimeout(t));
    this.timers = {};
  }

  warnInactivity() {
    // En vez de modal DOM → alert simple (menos sinks)
    alert('¡Advertencia! Sesión inactiva. Se cerrará pronto.\nMueve el mouse o presiona una tecla para continuar.');
    console.warn('[Session] Advertencia de inactividad mostrada');
  }

  logout(reason = 'Sesión finalizada') {
    this.clearTimers();

    if (this.listeners) {
      this.listeners.events.forEach(ev =>
        document.removeEventListener(ev, this.listeners.handler)
      );
      this.listeners = null;
    }

    localStorage.removeItem('token');

    const safeReason = encodeURIComponent(reason.replace(/[<>&"']/g, '')); // escape básico
    window.location.replace(`/login?reason=${safeReason}&ts=${Date.now()}`);

    console.info('[Session] Logout ejecutado:', reason);
  }

  destroy() {
    this.logout('Destructor llamado');
  }
}

// Singleton
let instance = null;

export function initSessionManager(minutes = 5) {
  if (!localStorage.getItem('token')) {
    console.warn('[Session] No token → no inicializar');
    return null;
  }
  if (!instance) {
    instance = new SessionManager(minutes);
    instance.init();
  }
  return instance;
}

export function destroySessionManager() {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}