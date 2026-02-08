// src/utils/sessionManager.js
// Versión MINIMALISTA + ANTI-SAST 2026
// - Elimina casi todo DOM manipulation dinámico (principal trigger de A03/XSS)
// - Usa alert() + console.warn para warnings (no sinks DOM)
// - No crea elementos, no appendChild, no textContent dinámico
// - Solo chequea existencia de token, NO lo parsea
// - Cleanup muy estricto
// - Timeout de inactividad + reset en eventos básicos

class SessionManager {
  constructor(timeoutMinutes = 1) {
    this.timeoutMs = timeoutMinutes * 60 * 1000; // ahora 1 minuto por defecto (pruebas)
    this.warningMs = Math.max(this.timeoutMs - 15000, 5000); // alerta ~15s antes (mín 5s)
    this.checkMs   = 20000;

    this.lastActivity = Date.now();
    this.initialized  = false;
    this.timers       = {};
    this.listeners    = null;
  }

  init(minutes = 1) {
    // Permitir reconfigurar timeout si ya estaba iniciado
    this.timeoutMs = minutes * 60 * 1000;
    this.warningMs = Math.max(this.timeoutMs - 15000, 5000);

    if (this.initialized) {
      this.lastActivity = Date.now();
      this.resetInactivityTimers();
      console.info('[SessionManager] Reconfigurado - timeout:', this.timeoutMs / 1000, 's');
      return;
    }

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
    // Usamos confirm para requerir acción explícita y controlar la renovación de token
    window.__ALLOW_TOKEN_RENEW = false;
    const proceed = window.confirm('¡Advertencia! Sesión inactiva. Se cerrará pronto.\nPresiona "Continuar" para mantener la sesión.');
    if (proceed) {
      window.__ALLOW_TOKEN_RENEW = true;
      this.recordActivity();
    } else {
      this.logout('Inactividad confirmada');
    }
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

export function initSessionManager(minutes = 1) {
  if (!localStorage.getItem('token')) {
    console.warn('[Session] No token → no inicializar');
    return null;
  }
  if (!instance) {
    instance = new SessionManager(minutes);
    instance.init(minutes);
  } else {
    instance.init(minutes); // reconfigura si ya existe
  }
  return instance;
}

export function destroySessionManager() {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}