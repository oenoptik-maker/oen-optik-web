// session-timer.js - 30 dakika hareketsizlik zamanlayici
(function() {
  var TIMEOUT_MS = 30 * 60 * 1000;
  var WARNING_MS = 5 * 60 * 1000;
  var TICK_MS = 1000;
  var lastActivity = Date.now();
  var timerInterval = null;
  var warningShown = false;

  function formatTime(ms) {
    var totalSec = Math.max(0, Math.floor(ms / 1000));
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    return min + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function createTimerElement() {
    if (document.getElementById('session-timer')) return;

    var headerRight = document.querySelector('.header-right');
    var themeToggle = document.querySelector('.theme-toggle');
    if (!headerRight) return;

    var el = document.createElement('div');
    el.id = 'session-timer';
    el.style.cssText = 'display:flex;align-items:center;gap:5px;font-family:monospace;font-size:13px;padding:4px 10px;border-radius:6px;background:#1e293b;color:#e2e8f0;border:1px solid #334155;margin-left:8px;white-space:nowrap;';
    el.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span id="session-timer-text">30:00</span>';

    if (themeToggle) {
      headerRight.insertBefore(el, themeToggle);
    } else {
      headerRight.appendChild(el);
    }
  }

  function updateTimer() {
    var elapsed = Date.now() - lastActivity;
    var remaining = TIMEOUT_MS - elapsed;
    var textEl = document.getElementById('session-timer-text');
    var timerEl = document.getElementById('session-timer');
    if (!textEl) return;

    if (remaining <= 0) {
      clearInterval(timerInterval);
      localStorage.removeItem('oken_token');
      window.location.href = '/login.html';
      return;
    }

    textEl.textContent = formatTime(remaining);

    if (remaining <= WARNING_MS) {
      timerEl.style.background = '#7c2d12';
      timerEl.style.color = '#fef3c7';
      timerEl.style.borderColor = '#f59e0b';
      if (!warningShown) {
        warningShown = true;
        var banner = document.createElement('div');
        banner.id = 'session-warning-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:100000;background:#b45309;color:#fff;text-align:center;padding:10px;font-size:14px;font-weight:600;';
        banner.textContent = 'Oturumunuz ' + Math.ceil(remaining / 60000) + ' dakika sonra kapatilacak. Devam etmek icin ekrana dokunun.';
        document.body.appendChild(banner);
      }
    } else {
      timerEl.style.background = '#1e293b';
      timerEl.style.color = '#e2e8f0';
      timerEl.style.borderColor = '#334155';
      warningShown = false;
      var old = document.getElementById('session-warning-banner');
      if (old) old.remove();
    }
  }

  function resetTimer() {
    lastActivity = Date.now();
    warningShown = false;
    var old = document.getElementById('session-warning-banner');
    if (old) old.remove();
    updateTimer();
  }

  window.addEventListener('session-expired', function() {
    clearInterval(timerInterval);
    localStorage.removeItem('oken_token');
    window.location.href = '/login.html';
  });

  function init() {
    createTimerElement();
    updateTimer();
    timerInterval = setInterval(updateTimer, TICK_MS);

    var events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(function(evt) {
      document.addEventListener(evt, resetTimer, { passive: true });
    });

    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) resetTimer();
    });

    window.addEventListener('focus', resetTimer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
