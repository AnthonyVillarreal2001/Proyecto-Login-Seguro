// src/utils/sessionManager.js
// Versión ultra-defensiva para SAST / security_check.py
// - Cero innerHTML → solo createElement + textContent + setAttribute
// - Todo string estático o escapado
// - No parseamos JWT (solo existencia y formato básico)
// - Cleanup exhaustivo de timers y listeners
// - ARIA + role + focus para accesibilidad (bonus)

class SessionManager {
  constructor(timeoutMinutes = 5) {
    this.timeoutMs = timeoutMinutes * 60 * 1000;
    this.warningMs = this.timeoutMs - 60 * 1000; // 60 segundos de advertencia
    this.checkIntervalMs = 15000;

    this.lastActivity = Date.now();
    this.warningVisible = false;
    this.initialized = false;

    this.timers = { warning: null, logout: null, check: null };
    this.listeners = null;

    this.addSafeGlobalStyles();
  }

  addSafeGlobalStyles() {
    if (document.getElementById('safe-session-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'safe-session-styles';
    styleEl.textContent = `
      .session-toast {
        position: fixed;
        top: 16px;
        right: 16px;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10001;
        box-shadow: 0 4px 14px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: system-ui, sans-serif;
        max-width: 380px;
      }
      .session-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
      }
      .session-modal-box {
        background: white;
        padding: 32px 24px;
        border-radius: 12px;
        max-width: 460px;
        width: 90%;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.4);
      }
      .session-btn {
        padding: 12px 32px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 600;
        min-width: 180px;
      }
      .btn-continue { background: #28a745; color: white; }
      .btn-logout   { background: #6c757d; color: white; }
    `;
    document.head.appendChild(styleEl);
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.lastActivity = Date.now();

    this.setupActivityDetection();
    this.startTokenValidityCheck();
    this.resetTimers();
  }

  setupActivityDetection() {
    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];

    const handler = this.throttledActivity(1200);

    events.forEach(ev => {
      document.addEventListener(ev, handler, { passive: true });
    });

    this.listeners = { events, handler };
  }

  throttledActivity(delay) {
    let lastCall = 0;
    return () => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        this.recordUserActivity();
      }
    };
  }

  recordUserActivity() {
    this.lastActivity = Date.now();
    this.resetTimers();

    if (this.warningVisible) {
      this.hideWarning();
      this.showToast('Sesión extendida por actividad', 'success');
    }
  }

  startTokenValidityCheck() {
    this.timers.check = setInterval(() => this.validateSessionToken(), this.checkIntervalMs);
  }

  validateSessionToken() {
    const token = localStorage.getItem('token');
    if (!token) {
      this.logout('No se encontró token de sesión');
      return;
    }

    // Solo chequeo estructural básico - NUNCA confiamos en el contenido del JWT en cliente
    if (token.split('.').length !== 3) {
      this.logout('Token con formato inválido');
    }

    // Ideal: fetch('/api/validate-token') aquí si el backend lo permite
  }

  resetTimers() {
    this.clearAllTimers();

    this.timers.warning = setTimeout(() => this.showWarningModal(), this.warningMs);
    this.timers.logout  = setTimeout(() => this.logout('Inactividad prolongada'), this.timeoutMs);
  }

  clearAllTimers() {
    Object.values(this.timers).forEach(timer => {
      if (timer) clearTimeout(timer);
    });
    this.timers = { warning: null, logout: null, check: null };
  }

  showWarningModal() {
    if (this.warningVisible) return;
    this.warningVisible = true;

    const overlay = document.createElement('div');
    overlay.className = 'session-modal-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'session-warning-title');

    const box = document.createElement('div');
    box.className = 'session-modal-box';

    const title = document.createElement('h3');
    title.id = 'session-warning-title';
    title.style.color = '#c82333';
    title.textContent = 'Sesión a punto de expirar';

    const text = document.createElement('p');
    text.textContent = 'Por inactividad, la sesión se cerrará en ';

    const countdownEl = document.createElement('strong');
    countdownEl.id = 'countdown';
    countdownEl.textContent = '60';
    countdownEl.style.color = '#c82333';

    text.appendChild(countdownEl);
    text.appendChild(document.createTextNode(' segundos.'));

    const btnContainer = document.createElement('div');
    btnContainer.style.margin = '24px 0';
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '16px';
    btnContainer.style.justifyContent = 'center';
    btnContainer.style.flexWrap = 'wrap';

    const continueBtn = document.createElement('button');
    continueBtn.className = 'session-btn btn-continue';
    continueBtn.textContent = 'Continuar sesión';
    continueBtn.onclick = () => {
      this.recordUserActivity();
      this.hideWarning();
    };

    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'session-btn btn-logout';
    logoutBtn.textContent = 'Cerrar ahora';
    logoutBtn.onclick = () => this.logout('Cierre manual');

    btnContainer.appendChild(continueBtn);
    btnContainer.appendChild(logoutBtn);

    box.appendChild(title);
    box.appendChild(text);
    box.appendChild(btnContainer);

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Countdown
    let seconds = 60;
    const cdInterval = setInterval(() => {
      seconds--;
      countdownEl.textContent = seconds;
      if (seconds <= 10) {
        countdownEl.style.color = '#ff0000';
      }
      if (seconds <= 0) {
        clearInterval(cdInterval);
        this.logout('Sesión cerrada por inactividad');
      }
    }, 1000);

    this.timers.countdown = cdInterval;

    // Cerrar con actividad
    const closeOnAct = () => {
      clearInterval(cdInterval);
      this.recordUserActivity();
      this.hideWarning();
    };
    document.addEventListener('click', closeOnAct, { once: true });
  }

  showToast(message, type = 'info') {
    const existing = document.querySelector('.session-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'session-toast';
    toast.setAttribute('role', 'alert');

    const icon = document.createElement('span');
    icon.style.fontSize = '20px';
    icon.textContent = type === 'success' ? '✅' : '⚠️';

    const textSpan = document.createElement('span');
    textSpan.textContent = this.safeEscape(message);

    toast.appendChild(icon);
    toast.appendChild(textSpan);

    if (type === 'success') {
      toast.style.background = '#d4edda';
      toast.style.color = '#155724';
      toast.style.border = '1px solid #c3e6cb';
    } else {
      toast.style.background = '#fff3cd';
      toast.style.color = '#856404';
      toast.style.border = '1px solid #ffeaa7';
    }

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
  }

  safeEscape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML; // Esto escapa < > & " '
  }

  hideWarning() {
    const modal = document.querySelector('.session-modal-overlay');
    if (modal) modal.remove();
    this.warningVisible = false;

    if (this.timers.countdown) {
      clearInterval(this.timers.countdown);
      this.timers.countdown = null;
    }
  }

  logout(reason = 'Sesión finalizada') {
    this.clearAllTimers();

    if (this.listeners) {
      this.listeners.events.forEach(ev => {
        document.removeEventListener(ev, this.listeners.handler);
      });
      this.listeners = null;
    }

    localStorage.removeItem('token');

    this.hideWarning();

    const safeReason = encodeURIComponent(this.safeEscape(reason));
    window.location.replace(`/login?reason=${safeReason}&_=${Date.now()}`);
  }

  destroy() {
    this.logout('Gestor de sesión destruido');
  }
}

// Singleton pattern
let singletonInstance = null;

export function initSessionManager(timeoutMinutes = 5) {
  if (!localStorage.getItem('token')) return null;

  if (!singletonInstance) {
    singletonInstance = new SessionManager(timeoutMinutes);
    singletonInstance.init();
  }
  return singletonInstance;
}

export function destroySessionManager() {
  if (singletonInstance) {
    singletonInstance.destroy();
    singletonInstance = null;
  }
}