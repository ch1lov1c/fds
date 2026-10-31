/* WEBNICSS: уведомление о техническом хранилище, а не согласие на рекламу. */
(function () {
  'use strict';
  if (window.__wnCookieBoot) return;
  window.__wnCookieBoot = true;

  const key = 'wn_cookie_notice_v1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  function init() {
    const notice = document.getElementById('cookieNotice');
    const dismiss = document.getElementById('cookieNoticeDismiss');
    if (!notice || !dismiss) return;
    let acknowledgedUntil = 0;
    try { acknowledgedUntil = Number(localStorage.getItem(key)) || 0; } catch (_) { /* хранилище может быть запрещено */ }
    if (acknowledgedUntil <= Date.now()) {
      notice.hidden = false;
      try { localStorage.removeItem(key); } catch (_) { /* хранилище может быть запрещено */ }
    }
    dismiss.addEventListener('click', function () {
      // Сохраняется лишь факт закрытия уведомления и срок повторного показа.
      // Это не согласие на аналитику, рекламу или обработку данных формы.
      try { localStorage.setItem(key, String(Date.now() + lifetime)); } catch (_) { /* скрыть хотя бы на этой странице */ }
      notice.hidden = true;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
