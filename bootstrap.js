/* Загрузчик: все скрипты хранятся на сайте; работа без доступного storage. */
(function () {
  'use strict';
  try {
    if (window.sessionStorage.getItem('wn_loader') === '1') {
      document.documentElement.classList.add('loader-skip');
    }
  } catch (_) { /* Приватный режим или запрет хранилища не должны ломать страницу. */ }

  window.setTimeout(function () {
    if (window.__wnBoot) return;
    document.documentElement.classList.add('loader-skip');
    if (document.body) document.body.classList.remove('is-loading');
    var loader = document.querySelector('.loader');
    if (loader) loader.style.display = 'none';
    document.querySelectorAll('[data-intro]').forEach(function (element) {
      element.style.opacity = 1;
      element.style.transform = 'none';
    });
  }, 2500);
}());
