// session-timer.js - 30 dakika hareketsizlik zamanlayici
(function() {
  var TIMEOUT_MS = 30 * 60 * 1000; // 30 dakika
  var WARNING_MS = 5 * 60 * 1000; // 5 dakika kala uyar
  var TICK_MS = 1000; // her saniye guncelle
  var lastActivity = Date.now();
  var timerInterval = null;
  var warningShown = false;

  // Kalan sureyi formatla: "25:30"
  function formatTime(ms) {
    var totalSec = Math.max(0, Math.floor(ms / 1000));
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    return min + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // Timer gorunelini olustur
  function createTimerElement() {
    if (document.getElementById('session-timer')) return;
    var el = document.createElement('div');
    el.id = 'session-timer';
    el.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;font-family:monospace;font-size:13px;padding:5px 12px;border-radius:8px;background:#1e293b;color:#e2e8f0;border:1px solid #475569;display:flex;align-items:center;gap:6px;user-select:none;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><span id="session-timer-text">30:00</span>';
    document.body.appendChild(el);
  }

  // Timer'i guncelle
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

    // Son 5 dakika: sari
    if (remaining <= WARNING_MS) {
      timerEl.style.background = 'rgba(180,83,9,0.85)';
      timerEl.style.color = '#fef3c7';
      if (!warningShown) {
        warningShown = true;
        var banner = document.createElement('div');
        banner.id = 'session-warning-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:100000;background:#b45309;color:#fff;text-align:center;padding:10px;font-size:14px;font-weight:600;';
        banner.textContent = 'Oturumunuz ' + Math.ceil(remaining / 60000) + ' dakika sonra kapatilacak. Devam etmek icin ekrana dokunun.';
        document.body.appendChild(banner);
      }
    } else {
      timerEl.style.background = 'rgba(30,41,59,0.85)';
      timerEl.style.color = '#94a3b8';
      warningShown = false;
      var old = document.getElementById('session-warning-banner');
      if (old) old.remove();
    }
  }

  // Aktivite tespit et ve zamanlayiciyi sifirla
  function resetTimer() {
    lastActivity = Date.now();
    warningShown = false;
    var old = document.getElementById('session-warning-banner');
    if (old) old.remove();
    updateTimer();
  }

  // Sadece 401 geldiginde
  window.addEventListener('session-expired', function() {
    clearInterval(timerInterval);
    localStorage.removeItem('oken_token');
    window.location.href = '/login.html';
  });

  // Baslat
  function init() {
    createTimerElement();
    updateTimer();
    timerInterval = setInterval(updateTimer, TICK_MS);

    // Aktivite dinleyicileri
    var events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(function(evt) {
      document.addEventListener(evt, resetTimer, { passive: true });
    });

    // Sayfa gorunurluk degisimi - arka planda da calissin
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        resetTimer();
      }
    });

    // Pencere odak degisimi
    window.addEventListener('focus', resetTimer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
