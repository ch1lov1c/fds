/* ============================================================
   WEBNICSS — движок студийного лендинга
   GSAP + ScrollTrigger + Lenis (с фолбэком, если библиотеки не загрузились)
   ============================================================ */
'use strict';
window.__wnBoot = true;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// Файловый просмотрщик Workspace изолирует iframe и блокирует внешние ссылки.
// В обычном браузере и живом предпросмотре этот обработчик не включается.
if (window.__wnWorkspaceImages && window.self !== window.top) {
  let externalNoteTimer;
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const a = event.target.closest('a[href]');
    if (!a || !/^(?:https?:|mailto:|tel:)/i.test(a.getAttribute('href') || '')) return;
    event.preventDefault();
    let note = $('#workspace-external-note');
    if (!note) {
      note = document.createElement('div');
      note.id = 'workspace-external-note';
      note.className = 'workspace-external-note';
      note.setAttribute('role', 'status');
      note.textContent = 'Для открытия ссылки используйте живой предпросмотр сайта или обычный браузер.';
      document.body.appendChild(note);
    }
    note.hidden = false;
    clearTimeout(externalNoteTimer);
    externalNoteTimer = setTimeout(() => { note.hidden = true; }, 5000);
  }, true);
}
// Доступ к хранилищу браузера может быть запрещён. Это не должно ломать витрину.
const storageGet = (kind, key) => { try { return window[kind].getItem(key); } catch (_) { return null; } };
const storageSet = (kind, key, value) => { try { window[kind].setItem(key, value); return true; } catch (_) { return false; } };
const storageRemove = (kind, key) => { try { window[kind].removeItem(key); } catch (_) {} };
// При обновлении пробуем удалить устаревшие записи прежней версии сайта.
storageRemove('localStorage', 'wn_cart');
storageRemove('sessionStorage', 'wn_cart_review');
const money = n => n.toLocaleString('ru-RU') + ' ₽';
// Telegram открывает черновик: посетитель сам решает, отправлять ли сообщение.
const telegramContact = text => `https://t.me/webnicssmng?text=${encodeURIComponent(text)}`;
const vkContact = 'https://vk.me/webnicss';
// В URL передаём только идентификатор услуги, никогда — данные посетителя.
const projectFormLink = (id, index) => `index.html?service=${encodeURIComponent(id + '.' + index)}#project-form`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGsap = !!(window.gsap && window.ScrollTrigger && window.Lenis);
if (!hasGsap) {
  document.documentElement.classList.add('no-gsap');
  // фолбэк: без анимационной библиотеки сразу снимаем прелоадер,
  // чтобы страница не осталась чёрной (офлайн, превью, блокировка CDN)
  document.documentElement.classList.add('loader-skip');
  const killLoader = () => {
    document.body?.classList.remove('is-loading');
    const pre = $('.loader');
    if (pre) pre.style.display = 'none';
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', killLoader);
  else killLoader();
}

/* ---------- прелоадер: показываем только на первом визите сессии ---------- */
const loaderSeen = storageGet('sessionStorage', 'wn_loader') === '1';
if (loaderSeen) {
  document.documentElement.classList.add('loader-skip');
  document.body?.classList.remove('is-loading');
  const pre = $('.loader'); if (pre) pre.style.display = 'none';
}

/* ============================================================
   ДАННЫЕ
   ============================================================ */
const MENU = [
  ['Главная', 'index.html'],
  ['Проекты', 'projects.html#projects-list'],
  ['Услуги', 'service.html#sites'],
  ['Команда', 'index.html#team'],
  ['Контакт', 'index.html#contact'],
];
const here = location.pathname.split('/').pop() || 'index.html';

/* ============================================================
   КОНВЕЙЕР НАПРАВЛЕНИЙ — карточки услуг в бегущей ленте
   ============================================================ */
const DIRECTIONS = [
  {
    title: 'Бизнес', href: 'service.html#sites',
    text: 'Сайты, Telegram-боты и Mini Apps — цифровые решения для ваших задач',
    link: 'Смотреть направления',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 21h8M12 18v3"/></svg>',
  },
  {
    title: 'Производство', href: 'service.html#design',
    text: 'Дизайн, 3D-моделирование, монтаж и презентации — креативный цех под ключ в едином стиле',
    link: 'Обсудить проект',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>',
  },
  {
    title: 'Автоматизация', href: 'service.html#integrations',
    text: 'Интеграции по API, автоматизация рутины и внутренние приложения — код, который убирает ручную работу',
    link: 'Выбрать решение',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 4l-4 16"/></svg>',
  },
];

const CREW = [
  ['Проджект-менеджер', 'Управление проектами и сроками', 'PM', 'team-pm.svg'],
  ['Креативный директор', 'Арт-дирекшн и стратегия', 'AD', 'team-ad.jpg'],
  ['UX/UI-дизайнер', 'Интерфейсы и прототипы', 'UI', 'team-ui.jpg'],
  ['Графический дизайнер', 'Айдентика и фирменный стиль', 'Ps', 'team-ps.jpg'],
  ['3D-моделлер', 'Модели, сцены и рендеры', '3D', 'team-3d.jpg'],
  ['Дизайнер презентаций', 'Деки и инфографика', 'Ke', 'team-ke.jpg'],
  ['Моушн-дизайнер', 'Монтаж и анимация', 'Ae', 'team-ae.jpg'],
  ['Веб-разработчик', 'Сайты и Mini Apps', 'DEV', 'team-dev.jpg'],
  ['ИИ-инженер', 'Нейросети и автоматизация', 'AI', 'team-ai.jpg'],
  ['Финансовый менеджер', 'Учёт, договоры и документы', '₽', 'team-fin.svg'],
];
const SERVICE_IDS = ['sites', 'miniapp', 'bots', 'ai', 'design', 'model3d', 'video', 'tg', 'integrations'];
const SERVICES = [
  ['Сайты', ['Лендинги и магазины', 'Заявки прямо в CRM']],
  ['Mini Apps', ['Магазины внутри Telegram', 'Оплата в пару тапов']],
  ['Боты', ['Помощь и запись', 'Интеграции по задаче']],
  ['Нейросети', ['Внедрение ИИ в процессы', 'Обучение команды']],
  ['Дизайн', ['UI/UX и бренд-системы', 'Презентации и моушн']],
  ['3D', ['Модели и WebGL-сцены', 'Рендеры и анимация']],
  ['Видео', ['Промо и Reels', 'Монтаж и цветокор']],
  ['Telegram', ['Оформление каналов', 'Сообщества и чаты']],
  ['Автоматизация', ['Интеграции и API', 'Поддержка проектов']],
];
/* Детальный каталог типов внутри каждой услуги.
   p — базовая цена, from:true — цена «от», p:null — по запросу после брифа */
const SERVICE_TYPES = {
  sites: {
    lead: 'От одностраничного лендинга до магазина: авторский дизайн, адаптив, скорость и заявки, которые не теряются.',
    types: [
      { n: 'Лендинг под ключ', d: 'Одностраничный сайт с сильным оффером, блоком услуг и портфолио. Заявки падают в Telegram и на почту.', p: 24900, from: true, t: 'от 7 дней', f: ['Дизайн с нуля, без шаблонов', 'Адаптивная вёрстка и оптимизация', 'Домен и SSL подключаем мы'] },
      { n: 'Сайт с заявками в CRM', d: 'Многостраничный сайт компании: услуги, кейсы, формы. Заявки сразу в CRM и Telegram с защитой от спама.', p: 49900, from: true, t: 'от 10 дней', f: ['Интеграция с CRM и Telegram', 'Антиспам и валидация', 'Метрика и цели на старте'] },
      { n: 'Сайт-калькулятор', d: 'Клиент собирает параметры заказа и сразу видит смету. Расчёт уходит вам в чат и клиенту на почту в PDF.', p: 39900, from: true, t: 'от 16 дней', f: ['Любые формулы и параметры', 'Смета в PDF на почту', 'Экспорт расчёта в CRM'] },
      { n: 'Интернет-магазин', d: 'Каталог, оформление заказа, личный кабинет и учёт — для цифровых или физических товаров.', p: 69900, from: true, t: 'от 21 дня', f: ['Способ оплаты по согласованию', 'Личный кабинет и заказы', 'Синхронизация остатков'] },
      { n: 'Web3 / Crypto-проект', d: 'Сайт с подключением кошельков, минтом, дашбордом токена и интеграцией TON/ETH. С аудитом логики.', p: null, t: 'после брифа', f: ['TON Connect и EVM-кошельки', 'Работа с контрактами', 'Аудит и тесты перед релизом'] },
    ],
  },
  miniapp: {
    lead: 'Mini Apps — полноценные приложения внутри Telegram: без установки, с оплатой в пару тапов.',
    types: [
      { n: 'Mini App магазин', d: 'Каталог, оформление и история заказов прямо в интерфейсе Telegram.', p: 49900, from: true, t: 'от 14 дней', f: ['Нативная оплата Telegram', 'Синхрон с ботом и складом', 'Push о статусе заказа'] },
      { n: 'Mini App запись и брони', d: 'Слоты, мастера, напоминания и предоплата — для услуг с расписанием.', p: 34900, from: true, t: 'от 12 дней', f: ['Живое расписание', 'Выбор мастера и услуги', 'Отмена и перенос внутри'] },
      { n: 'Каталог-витрина', d: 'Эффектная презентация продуктов или портфолио с 3D и анимациями.', p: 24900, from: true, t: 'от 10 дней', f: ['Интерфейс в стиле проекта', 'Видео и 3D в карточках', 'Аналитика просмотров'] },
      { n: 'Игровая механика', d: 'Квесты, колесо фортуны, баллы и розыгрыши для удержания аудитории.', p: 49900, from: true, t: 'от 18 дней', f: ['Награды и баллы', 'Антифрод-логика', 'Интеграция с CRM'] },
    ],
  },
  bots: {
    lead: 'Боты для поддержки, записи и обработки обращений — сценарии и интеграции согласуем под задачу.',
    types: [
      { n: 'Бот-магазин с автовыдачей', d: 'Каталог, оформление заказов, оплата и выдача. Состав интеграций согласуем под ваш проект.', p: 34900, from: true, t: 'от 10 дней', f: ['Склад ключей и вебхуки', 'Выдача в чат, на почту и в ЛК', 'Mini App поверх каталога'] },
      { n: 'ИИ-бот поддержки', d: 'Саппорт на языковых моделях с базой знаний компании: отвечает мгновенно, эскалирует человеку.', p: 39900, from: true, t: 'от 12 дней', f: ['База знаний из ваших файлов', 'Передача диалога человеку', 'Аналитика частых вопросов'] },
      { n: 'Бот записи и бронирования', d: 'Слоты, напоминания, предоплата и календарь — для услуг с записью клиентов.', p: 24900, from: true, t: 'от 9 дней', f: ['Синхронизация календаря', 'Напоминания в Telegram', 'Способ предоплаты по согласованию'] },
      { n: 'Интеграции с CRM и 1С', d: 'Связываем бота с вашими системами: заказы, статусы, оплаты и склад без ручного переноса.', p: 24900, from: true, t: 'от 7 дней', f: ['Амора, Битрикс24, 1С', 'Логи и мониторинг ошибок', 'Документация для команды'] },
    ],
  },
  ai: {
    lead: 'Используем инструменты ИИ для автоматизации задач и помогаем командам освоить новые рабочие процессы.',
    types: [
      { n: 'Внедрение ИИ в процессы', d: 'Аудит рутины и сборка связок: автоответы, генерация контента, обработка документов, ИИ-агенты.', p: 39900, from: true, t: 'от 14 дней', f: ['Аудит и карта автоматизации', 'Промпт-инжиниринг', 'Замер экономии времени'] },
      { n: 'Обучение команды', d: 'Воркшоп под ваши задачи: сотрудники работают с ИИ уверенно и по гайдлайнам студии.', p: 14900, from: true, t: '2–4 встречи', f: ['Разбор ваших кейсов', 'Шаблоны и промпт-бук', 'Поддержка 30 дней'] },
    ],
  },
  design: {
    lead: 'UI/UX, бренд-системы и презентации, которые одинаково дорого выглядят на экране и в печати.',
    types: [
      { n: 'UI/UX под ключ', d: 'Исследование, прототип, дизайн-система и готовые экраны для веба или приложения.', p: 29900, from: true, t: 'от 14 дней', f: ['CJM и кликабельный прототип', 'Компонентная библиотека', 'Светлая и тёмная темы'] },
      { n: 'Бренд-пак', d: 'Логотип, айдентика, носители и гайдлайн — характер бренда в одной системе.', p: 24900, from: true, t: 'от 12 дней', f: ['3 концепта знака', 'Цвета, шрифты, сетка', 'Гайдлайн в PDF'] },
      { n: 'Презентация и питч-дек', d: '12–15 слайдов под инвестиции или сделку: структура истории, инфографика, аккуратная типографика.', p: 14900, from: true, t: 'от 8 дней', f: ['Логика истории под задачу', 'Инфографика цифр', 'Анимация и PDF'] },
      { n: 'Моушн-дизайн', d: 'Анимированные логотипы, интерфейсные анимации и графика для соцсетей.', p: 9900, from: true, t: 'от 7 дней', f: ['Lottie и видео-форматы', 'Звук и тайминг', 'Оптимизация под веб'] },
      { n: 'Графика и креативы', d: 'Серии постеров, обложки каналов, баннеры и графика в едином стиле.', p: 5900, from: true, t: 'от 3 дней', f: ['Серия в едином стиле', 'Исходники в Figma/PSD', 'Адаптация под форматы'] },
    ],
  },
  model3d: {
    lead: 'Объёмная графика для сайтов, презентаций и карточек: модели, которые можно покрутить.',
    types: [
      { n: 'Модели товаров', d: '3D-модели продукции для карточек, AR-примерки и рендеров — с чистой сеткой под веб и движки.', p: 9900, from: true, t: 'от 5 дней', f: ['Retopo, UV и PBR-текстуры', 'Форматы GLB/FBX/USDZ', 'Оптимизация веса модели'] },
      { n: 'Интерактивная 3D-сцена', d: 'Сцена на сайт с вращением мышью и пальцем — как объект в этом блоке главной.', p: 29900, from: true, t: 'от 12 дней', f: ['Работает без тяжёлых движков', 'Drag-вращение и инерция', 'Оптимизация под мобильные'] },
      { n: '3D-логотип', d: 'Объёмная версия знака бренда для видео, заставок и соцсетей.', p: 8900, from: true, t: 'от 6 дней', f: ['Несколько ракурсов', 'Цикл анимации знака', 'Исходники Blender/C4D'] },
      { n: 'Рендеры и анимация', d: 'Стилизованные ролики и статичные кадры с кинематографичным светом.', p: 12900, from: true, t: 'от 8 дней', f: ['Сценарий и раскадровка', 'Цветокоррекция', '4K и вертикальные версии'] },
    ],
  },
  video: {
    lead: 'Монтаж и моушн: от 15-секундного Reels до презентационного фильма бренда.',
    types: [
      { n: 'Промо-ролик', d: 'Полный цикл: сценарий, монтаж, цветокоррекция, моушн-графика и звук.', p: 24900, from: true, t: 'от 10 дней', f: ['До 3 правок включено', 'Хронометраж до 90 секунд', 'Версии под все площадки'] },
      { n: 'Пак Reels / Shorts (5 шт)', d: 'Серия коротких видео с ритмичным монтажом, субтитрами и хуком в первые секунды.', p: 12900, from: true, t: 'от 7 дней', f: ['5 роликов в едином стиле', 'Субтитры и хук-кадры', 'Вертикаль 9:16'] },
      { n: 'Монтаж YouTube и подкастов', d: 'Длинный материал: сведение дорожек, чистка звука, нарезки и обложки для выпуска.', p: 7900, from: true, t: 'от 5 дней', f: ['До 30 минут готового видео', 'Субтитры и таймкоды', 'Обложка в комплекте'] },
      { n: 'Цвет и звук', d: 'Постпродакшн готового материала: цветокоррекция, чистка звука, саунд-дизайн.', p: 5900, from: true, t: 'от 4 дней', f: ['Единый цветовой стиль', 'Мастер под веб и эфир', 'Легальные библиотеки музыки'] },
    ],
  },
  tg: {
    lead: 'Оформляем Telegram-каналы и помогаем настроить структуру сообществ под задачу.',
    types: [
      { n: 'Оформление канала', d: 'Аватар, описание, закрепы, обложки постов и контент-план на месяц.', p: 7900, from: true, t: 'от 5 дней', f: ['Айдентика и закрепы', 'Контент-план на месяц', 'Стартовая аналитика'] },
      { n: 'Комьюнити и чаты', d: 'Создаём и настраиваем сообщество: правила, бот-модератор, роли и онбординг.', p: 9900, from: true, t: 'от 7 дней', f: ['Настройки модерации по задаче', 'Сценарии знакомства участников', 'Настройка ролей и правил'] },
      { n: 'Подготовка публикаций', d: 'Тексты и изображения для трёх публикаций по согласованным темам и материалам.', p: 4900, from: true, t: 'от 3 дней', f: ['Три публикации', 'Визуал в выбранном стиле', 'Согласование материалов'] },
    ],
  },
  integrations: {
    lead: 'Связываем сервисы между собой и убираем ручную работу: код, который работает без вас.',
    types: [
      { n: 'Интеграции по API', d: 'CRM, таблицы, мессенджеры, платёжные шлюзы и вебхуки — в одной работающей связке.', p: 19900, from: true, t: 'от 6 дней', f: ['Обработка ошибок и ретраи', 'Логи и мониторинг', 'Документация для команды'] },
      { n: 'Автоматизация рутины', d: 'Сценарии в n8n/Make: заявки, счета, уведомления и отчёты без участия человека.', p: 14900, from: true, t: 'от 4 дней', f: ['Карта процессов до старта', 'Замена ручных операций', 'Инструкция для сотрудников'] },
      { n: 'Внутренние приложения', d: 'Дашборды, системы учёта и кабинеты с ролями, отчётами и выгрузками.', p: 49900, from: true, t: 'от 20 дней', f: ['Роли и права доступа', 'Отчёты и выгрузки', 'Хостинг и поддержка'] },
      { n: 'Поддержка сайта или бота', d: 'Обновления, резервные копии и небольшие улучшения по согласованному плану.', p: 8900, from: true, t: 'за месяц', f: ['Обновления и резервные копии', 'Контроль работы по согласованию', 'Объём и время ответа обсуждаются'] },
    ],
  },
};
/* ============================================================
   РЕНДЕР СПИСКОВ
   ============================================================ */
const pageOf = href => href.split('#')[0] || 'index.html';
$('#menuList').innerHTML = MENU.map(([label, href], i) => `
  <a class="menu-row" href="${href}">
  <span class="menu-word">${label}</span>${pageOf(href) === here ? '<i class="active-dot"></i>' : ''}</a>`).join('');




if ($('#marquee')) {
  $('#marquee').innerHTML = DIRECTIONS.map(d => `
    <a class="cv-card" href="${d.href}" data-cursor>
      <span class="cv-top">
        <span class="cv-ico">${d.icon}</span>
        <span class="cv-go" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </span>
      <span class="cv-body"><b>${d.title}</b><span>${d.text}</span></span>
      <span class="cv-tag">${d.link}<b>→</b></span>
    </a>`).join('');
  /* дублируем ленту для бесшовного цикла */
  $('#marquee').innerHTML += $('#marquee').innerHTML;
}

if ($('#servicesList')) $('#servicesList').innerHTML = SERVICES.map(([title, tags], i) => `
  <a class="sv-row st" href="service.html#${SERVICE_IDS[i]}" data-cursor>
    <span class="sv-title">${title}</span>
    <span class="sv-tags">${tags.map(t => `<span class="pill">${t}</span>`).join('')}</span>
    <span class="sv-go" aria-hidden="true">→</span>
  </a>`).join('');

if ($('#teamCards')) $('#teamCards').innerHTML = CREW.map(([tag, role, icon, img]) => `
  <article class="tm-card st" data-cursor>
    <div class="tm-media">
      <img src="${window.__wnWorkspaceImages?.[img] || img}" alt="${tag} — ${role}" loading="lazy">
      <span class="tm-chip">${icon}</span>
      <span class="tm-shine" aria-hidden="true"></span>
    </div>
    <div class="tm-body">
      <h3 class="tm-role">${tag}</h3>
      <p class="tm-name">${role}</p>
    </div>
  </article>`).join('');

/* ============================================================
   СТРАНИЦА УСЛУГИ: КАТАЛОГ ТИПОВ (service.html)
   ============================================================ */
function svIdFromURL() {
  // Параметры адреса принимаются только из известного списка, а не из прототипа объекта.
  const h = location.hash.slice(1);
  if (SERVICE_IDS.includes(h)) return h;
  const q = new URLSearchParams(location.search).get('id');
  return SERVICE_IDS.includes(q) ? q : 'sites';
}
function revealActiveServicePill() {
  const strip = $('#svPills');
  const active = strip?.querySelector('.pill.active');
  if (!active || strip.scrollWidth <= strip.clientWidth) return;
  const row = strip.getBoundingClientRect();
  const selected = active.getBoundingClientRect();
  if (selected.right > row.right - 8) strip.scrollLeft += selected.right - row.right + 8;
  else if (selected.left < row.left + 8) strip.scrollLeft += selected.left - row.left - 8;
}
if ($('#svRoot')) {
  const svPills = $('#svPills');
  let serviceResizeTimer;
  addEventListener('resize', () => {
    revealActiveServicePill();
    clearTimeout(serviceResizeTimer);
    serviceResizeTimer = setTimeout(() => {
      const target = hashTarget(location.hash);
      if (!target?.matches('#svRoot .sv-hero')) return;
      const y = target.getBoundingClientRect().top;
      // Не перебрасываем человека с середины раздела к заголовку.
      if (y > -250 && y < 250) scrollToTarget(target);
    }, 120);
  });
  document.fonts?.ready.then(revealActiveServicePill);
  svPills.innerHTML = SERVICES.map(([title], i) =>
    `<button class="pill ${SERVICE_IDS[i] === svIdFromURL() ? 'active' : ''}" data-sv="${SERVICE_IDS[i]}">${title}</button>`).join('');
  function renderService(id, push) {
    const idx = SERVICE_IDS.indexOf(id);
    if (idx < 0) return;
    const [title, tags] = SERVICES[idx];
    const block = SERVICE_TYPES[id];
    const sectionMessage = `Здравствуйте! Меня интересует направление «${title}». Хочу обсудить задачу с WEBNICSS.`;
    // В подвале страницы сохраняем контекст выбранного направления, даже
    // когда посетитель переключает вкладки или пользуется историей браузера.
    $$('[data-service-contact]').forEach(link => link.setAttribute('href', telegramContact(sectionMessage)));
    $$('#svPills .pill').forEach((p, i) => p.classList.toggle('active', SERVICE_IDS[i] === id));
    // Показываем активную вкладку целиком, не сдвигая всю страницу.
    revealActiveServicePill();
    $('#svRoot').innerHTML = `
      <div class="sv-hero st" id="${id}">
        <h1 class="page-display">${title.toUpperCase()}</h1>
        <p class="page-lead">${block.lead}</p>
        <div class="sv-hero-tags">${tags.map(t => `<span class="pill">${t}</span>`).join('')}</div>
      </div>
      <div class="sv-type-grid">
        ${block.types.map((t, i) => `
          <article class="sv-type st" style="--i:${i}">
            <div class="sv-type-head">
              <h3>${t.n}</h3>
            </div>
            <p class="sv-type-desc">${t.d}</p>
            <ul class="sv-type-feats">${t.f.map(x => `<li>${x}</li>`).join('')}</ul>
            <div class="sv-type-foot">
              <div><b>${t.p === null ? 'по запросу' : (t.from ? 'от ' + money(t.p) : money(t.p))}</b><span>${t.t}</span></div>
              <div class="contact-actions">
                <a class="btn-chip" href="${telegramContact(`Здравствуйте! Интересует услуга «${t.n}». Хочу обсудить детали с WEBNICSS.`)}" target="_blank" rel="noopener noreferrer" data-cursor aria-label="Написать в Telegram об услуге ${t.n}">
                  <span class="btn-label">Написать в Telegram</span><span class="btn-arrow" aria-hidden="true">↗</span>
                </a>
                <a class="btn-chip ghost" href="${vkContact}" target="_blank" rel="noopener noreferrer" data-cursor aria-label="Написать в ВК об услуге ${t.n}">
                  <span class="btn-label">Написать в ВК</span><span class="btn-arrow" aria-hidden="true">↗</span>
                </a>
                <a class="btn-chip form-link" href="${projectFormLink(id, i)}" data-cursor aria-label="Обсудить проект по услуге ${t.n}">
                  <span class="btn-label">Обсудить проект</span><span class="btn-arrow" aria-hidden="true">↓</span>
                </a>
              </div>
            </div>
          </article>`).join('')}
      </div>
      <div class="sv-cta st">
        <h2>Не нашли нужный формат?</h2>
        <p>Обсудим сочетание сайта, бота, дизайна и автоматизации для вашего проекта.</p>
        <div class="contact-actions">
          <a class="btn-chip big" href="${telegramContact(sectionMessage)}" target="_blank" rel="noopener noreferrer" data-cursor>
            <span class="btn-label">Написать в Telegram</span><span class="btn-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="btn-chip big ghost" href="${vkContact}" target="_blank" rel="noopener noreferrer" data-cursor>
            <span class="btn-label">Написать в ВК</span><span class="btn-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="btn-chip big form-link" href="index.html#project-form" data-cursor>
            <span class="btn-label">Обсудить проект</span><span class="btn-arrow" aria-hidden="true">↓</span>
          </a>
        </div>
      </div>`;
    document.title = `${title} — WEBNICSS®`;
    // Динамически созданные карточки не должны оставаться скрытыми без GSAP.
    if (!hasGsap) $$('#svRoot .st, #svRoot [data-reveal]').forEach(el => el.classList.add('in'));
    if (push && location.hash.slice(1) !== id) history.pushState(null, '', `#${id}`);
    if (hasGsap) ScrollTrigger.refresh();
    if (push) requestAnimationFrame(() => scrollToTarget(document.getElementById(id)));
  }
  renderService(svIdFromURL(), false);
  svPills.addEventListener('click', e => {
    const b = e.target.closest('[data-sv]');
    if (b) renderService(b.dataset.sv, true);
  });
  addEventListener('hashchange', () => { if ($('#svRoot')) renderService(svIdFromURL(), false); });
}


/* ============================================================
   ФОРМА ПРОЕКТА. Открытый ID формы Zapnoty, не ключ и не токен бота.
   Пока ID не задан, поля заблокированы и данные никуда не отправляются.
   ============================================================ */
(function projectInquiry() {
  const form = $('#projectInquiry');
  if (!form) return;
  const fields = form.querySelector('fieldset');
  const status = $('#projectFormStatus');
  const availability = $('#projectFormAvailability');
  const send = $('#projectSend');
  const select = $('#projectService');
  const honey = form.querySelector('[data-honeypot]');
  const startedAt = Date.now();
  let sentId = '', fingerprint = '', consentAt = '';

  // Внешний service-параметр — только ключ из локального каталога. Не вставляем
  // произвольную строку URL в DOM и не передаём персональные данные в адресе.
  SERVICE_IDS.forEach((id, groupIndex) => {
    const group = document.createElement('optgroup');
    group.label = SERVICES[groupIndex][0];
    SERVICE_TYPES[id].types.forEach((entry, i) => {
      const option = document.createElement('option');
      option.value = `${id}.${i}`;
      option.textContent = entry.n;
      group.appendChild(option);
    });
    select.appendChild(group);
  });
  const requested = new URLSearchParams(location.search).get('service') || '';
  if (/^[a-z0-9]+\.\d{1,2}$/i.test(requested) && [...select.options].some(option => option.value === requested)) {
    select.value = requested;
  }

  const publicId = (form.dataset.zapnotyId || '').trim();
  const honeyName = (form.dataset.honeypotName || '_honey').trim();
  const validId = /^[A-Za-z0-9_-]{3,100}$/.test(publicId);
  const validHoney = /^_[A-Za-z0-9_]{2,60}$/.test(honeyName) && !['_request_id', '_submit_time'].includes(honeyName);
  const secureContext = location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (!validId || !validHoney || !secureContext) {
    fields.disabled = true;
    return;
  }
  fields.disabled = false;
  availability.hidden = true;
  status.textContent = '';

  function requestId() {
    if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    if (globalThis.crypto && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
      return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    }
    // В современных HTTPS-браузерах используется crypto; запасной вариант
    // нужен только для идентификатора повторной отправки, не для авторизации.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity() || send.disabled) return;
    const selected = select.options[select.selectedIndex];
    const payload = {
      name: form.elements.name.value.trim(),
      contact: form.elements.contact.value.trim(),
      subject: selected ? selected.textContent : 'Обсудить проект',
      message: form.elements.message.value.trim(),
      consent: 'Дано: 2026-10-31-v2',
      consent_version: '2026-10-31-v2',
      _submit_time: startedAt,
    };
    if (payload.name.length < 2 || payload.contact.length < 4 || payload.message.length < 10) {
      status.textContent = 'Проверьте имя, контакт и описание задачи.';
      return;
    }
    const nextFingerprint = JSON.stringify([payload.name, payload.contact, payload.subject, payload.message]);
    if (!sentId || fingerprint !== nextFingerprint) {
      sentId = requestId(); fingerprint = nextFingerprint; consentAt = new Date().toISOString();
    }
    payload.consent_time = consentAt;
    payload._request_id = sentId;
    payload[honeyName] = honey.value;
    send.disabled = true;
    status.textContent = 'Отправляем заявку…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`https://api.zapnoty.com/f/${encodeURIComponent(publicId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal,
        credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin',
      });
      let result = null;
      try { result = await response.json(); } catch (_) { /* вернём честную ошибку */ }
      if (!response.ok || !result || result.ok !== true) throw new Error('not accepted');
      const selectedValue = select.value;
      form.reset(); select.value = selectedValue;
      sentId = ''; fingerprint = ''; consentAt = '';
      status.textContent = 'Запрос отправлен. Если мы не ответим, пожалуйста, напишите в Telegram или ВКонтакте.';
      status.classList.add('is-success');
    } catch (_) {
      status.classList.remove('is-success');
      status.textContent = 'Не удалось отправить заявку. Повторите попытку или напишите в Telegram или ВКонтакте. Текст формы сохранён на этой странице.';
    } finally {
      clearTimeout(timer); send.disabled = false;
    }
  });
}());

/* подпись лоадера под текущую страницу */
(function loaderLabel() {
  const label = document.body.dataset.loaderLabel || 'Главная';
  const bar = $('[data-loader-bar]'); if (bar) bar.textContent = label;
})();

/* Цель адреса ищем по ID, не передавая произвольный hash в CSS-селектор. */
function hashTarget(hash) {
  if (!hash || hash.length <= 1) return null;
  try {
    const id = decodeURIComponent(hash.slice(1));
    return id === 'home' ? document.body : document.getElementById(id);
  } catch (_) { return null; }
}
function deepLink() {
  const target = hashTarget(location.hash);
  if (!target) return;
  // Дожидаемся окончания загрузчика, построения карточек и расчёта ScrollTrigger.
  setTimeout(() => {
    if (target === hashTarget(location.hash)) scrollToTarget(target);
  }, 350);
}

/* ============================================================
   SMOOTH SCROLL (Lenis) + ЯКОРЯ
   ============================================================ */
let lenis = null;
if (hasGsap) {
  gsap.registerPlugin(ScrollTrigger);
  lenis = new Lenis({ duration: 1.8, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const scrollToTarget = el => {
  if (!el) return;
  const home = el === document.body || el.id === 'home';
  // Берём координату раскладки, а не сдвиг анимированной карточки. Так адрес
  // остаётся точным и после завершения её появления, и при переходе Back.
  let layoutTop = 0;
  for (let node = el; node instanceof HTMLElement; node = node.offsetParent) layoutTop += node.offsetTop;
  // На странице услуг закреплённые фильтры могут занимать больше 90px.
  // Учитываем их реальную высоту, чтобы выбранный заголовок не оказался под меню.
  let offset = 90;
  const filters = el.matches('#svRoot .sv-hero') ? $('#svPills') : null;
  if (filters) {
    const stickyTop = parseFloat(getComputedStyle(filters).top) || 0;
    offset = Math.max(offset, Math.ceil(stickyTop + filters.offsetHeight + 18));
    // Браузер может восстановить старый scrollLeft после первого рендера.
    revealActiveServicePill();
  }
  const top = home ? 0 : Math.max(0, Math.round(layoutTop - offset));
  if (lenis) lenis.scrollTo(top, { duration: 1.3, immediate: reduce, force: true });
  else window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
};
const canonicalPath = path => path.endsWith('/') ? `${path}index.html` : path;
document.addEventListener('click', e => {
  // Не мешаем открывать ссылку в новой вкладке или использовать системные действия браузера.
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href]');
  if (!a || a.hasAttribute('download') || (a.target && a.target.toLowerCase() !== '_self')) return;
  let url;
  try { url = new URL(a.href, location.href); } catch (_) { return; }
  if (url.origin !== location.origin || url.search !== location.search ||
      canonicalPath(url.pathname) !== canonicalPath(location.pathname) || !url.hash) return;
  const target = hashTarget(url.hash);
  if (!target) return;
  e.preventDefault();
  if (url.href !== location.href) {
    try { history.pushState(history.state, '', url.href); } catch (_) { /* file:// или ограничение браузера */ }
  }
  scrollToTarget(target);
});
// Вперёд/назад и ручное изменение фрагмента должны открывать тот же раздел.
addEventListener('hashchange', () => {
  // Дать браузеру и Lenis синхронизироваться после нативного перехода по истории.
  requestAnimationFrame(() => {
    const target = hashTarget(location.hash);
    if (target && !document.body.classList.contains('is-loading')) scrollToTarget(target);
  });
});

/* ============================================================
   ЧАСЫ (время студии, UTC+3)
   ============================================================ */
(function clock() {
  const fmt = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Volgograd', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const tick = () => $$('[data-clock]').forEach(el => { el.textContent = `${fmt.format(new Date())} · UTC+3`; });
  tick(); setInterval(tick, 1000);
})();

/* ============================================================
   СКРЭМБЛ
   ============================================================ */
function scramble(el) {
  const final = el.dataset.final || el.textContent;
  el.dataset.final = final;
  const glyphs = '!<>-_\\/[]{}=+*^?#%@абвгдежзийклмнопрстуфхцчшщъыьэюя0123456789';
  let tick = 0; const total = 18;
  const id = setInterval(() => {
    tick++;
    el.textContent = [...final].map((c, i) =>
      c === ' ' || tick >= (total * i) / final.length + 4 ? c : glyphs[(Math.random() * glyphs.length) | 0]).join('');
    if (tick > total + 4) { clearInterval(id); el.textContent = final; }
  }, 40);
}
/* глитч-появление и периодические сбои названия */
const glitchEl = $('.glitch');
const heroLogo = $('.hero-logo');
function glitchBurst(ms) {
  if (!glitchEl || reduce) return;
  glitchEl.classList.add('glitching');
  setTimeout(() => glitchEl.classList.remove('glitching'), ms);
}
function bootGlitch() {
  if (!glitchEl) return;
  heroLogo.classList.add('glitch-in');
  if (reduce) return;
  glitchBurst(1300);
  setTimeout(() => scramble(glitchEl), 500);
  setInterval(() => { glitchBurst(380); setTimeout(() => scramble(glitchEl), 120); }, 5200);
}
if (!hasGsap) setTimeout(bootGlitch, 900);

/* ============================================================
   КУРСОР
   ============================================================ */
(function cursor() {
  if (matchMedia('(pointer: coarse)').matches) return;
  const c = $('.cursor');
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, on = false;
  addEventListener('mousemove', e => {
    tx = e.clientX; ty = e.clientY;
    if (!on) { on = true; x = tx; y = ty; c.classList.add('on'); }
  });
  document.addEventListener('mouseleave', () => { on = false; c.classList.remove('on'); });
  document.addEventListener('mouseover', e => c.classList.toggle('grow', !!e.target.closest('[data-cursor], a, button')));
  const loop = () => {
    x += (tx - x) * .2; y += (ty - y) * .2;
    c.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  };
  loop();
})();

/* ============================================================
   МЕНЮ
   ============================================================ */
const menu = $('#menu'), menuBtn = $('#menuBtn'), menuLabel = $('.menu-label', menuBtn);
let menuOpen = false;
function setMenu(v) {
  menuOpen = v;
  menu.classList.toggle('open', v);
  menuBtn.classList.toggle('menu-open', v);
  menuBtn.setAttribute('aria-expanded', v);
  menu.setAttribute('aria-hidden', !v);
  menuLabel.textContent = v ? 'ЗАКРЫТЬ' : 'МЕНЮ';
  if (hasGsap) {
    if (v) {
      lenis.stop();
      gsap.fromTo('.menu-row', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .9, ease: 'expo.out', stagger: .06, delay: .25 });
      gsap.fromTo('.menu-head', { opacity: 0 }, { opacity: 1, duration: .6, delay: .3 });
    } else if (!document.body.classList.contains('is-loading')) lenis.start();
  }
}
menuBtn.addEventListener('click', () => setMenu(!menuOpen));
$$('[data-menu-close]').forEach(el => el.addEventListener('click', () => setMenu(false)));
addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
menu.addEventListener('click', e => { if (e.target.closest('.menu-row')) setMenu(false); });

/* ============================================================
   HERO CANVAS — звёздное поле
   ============================================================ */
(function starfield() {
  const cv = $('#heroCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let W, H, stars = [], comets = [];
  const mouse = { x: 0, y: 0 };
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 1.6);
    W = cv.offsetWidth; H = cv.offsetHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: 150 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      z: .3 + Math.random() * 1.7, tw: Math.random() * 6.28, hot: Math.random() > .9,
    }));
  }
  size(); addEventListener('resize', size);
  cv.parentElement.addEventListener('mousemove', e => {
    const r = cv.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width - .5;
    mouse.y = (e.clientY - r.top) / r.height - .5;
  });
  (function frame(t) {
    ctx.clearRect(0, 0, W, H);
    const time = t * .001;
    for (const s of stars) {
      s.y += s.z * .22;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
      const px = s.x + mouse.x * s.z * 26, py = s.y + mouse.y * s.z * 26;
      ctx.beginPath();
      ctx.arc(px, py, s.z * .85, 0, Math.PI * 2);
      ctx.fillStyle = s.hot ? `rgba(47,230,255,${.6 + Math.sin(time * 2 + s.tw) * .35})`
        : `rgba(255,255,255,${.2 + Math.abs(Math.sin(time + s.tw)) * .45})`;
      ctx.fill();
    }
    if (Math.random() < .008) comets.push({ x: Math.random() * W * .7, y: Math.random() * H * .35, vx: 5 + Math.random() * 4, life: 1 });
    comets = comets.filter(c => c.life > 0 && c.x < W);
    for (const c of comets) {
      c.x += c.vx; c.y += 2.2; c.life -= .012;
      const g = ctx.createLinearGradient(c.x - 90, c.y - 42, c.x, c.y);
      g.addColorStop(0, 'rgba(47,230,255,0)');
      g.addColorStop(1, `rgba(47,230,255,${Math.max(c.life, 0)})`);
      ctx.strokeStyle = g; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c.x - 90, c.y - 42); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
    if (!reduce) requestAnimationFrame(frame);
  })(0);
})();

/* ============================================================
   АНИМАЦИИ GSAP / ФОЛБЭК
   ============================================================ */
function splitWords(el) {
  const nodes = [];
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) nodes.push(tw.currentNode);
  const words = [];
  nodes.forEach(n => {
    const frag = document.createTextNode ? document.createDocumentFragment() : null;
    const f = document.createDocumentFragment();
    n.textContent.split(/(\s+)/).forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)) { f.append(part); return; }
      const s = document.createElement('span');
      s.className = 'wd'; s.textContent = part;
      f.append(s); words.push(s);
    });
    n.replaceWith(f);
  });
  return words;
}

if (hasGsap) {
  /* nav: появление лого/инфо после 140px и компактные зоны */
  const navEl = $('.nav');
  const compact = new Set();
  let past = false;
  const updateNav = () => {
    navEl.classList.toggle('show-logo', past);
    navEl.classList.toggle('show-info', past && compact.size === 0);
  };
  lenis.on('scroll', e => { const p = e.scroll > 140; if (p !== past) { past = p; updateNav(); } });
  $$('[data-nav-compact]').forEach((z, i) => ScrollTrigger.create({
    trigger: z, start: 'top 70px', end: 'bottom 70px',
    onToggle: s => { s.isActive ? compact.add(i) : compact.delete(i); updateNav(); },
  }));

  /* velocity-марки + палец/мышь */
  if ($('#marquee')) (function marquee() {
    const wrap = $('[data-marquee-wrap]');
    const track = $('#marquee');
    wrap.style.touchAction = 'none';
    let x = 0, setW = 1, vel = 0, dragging = false, startX = 0, startTrackX = 0;
    const measure = () => { setW = (track.scrollWidth + 12) / 2; };
    measure(); document.fonts.ready.then(measure); addEventListener('resize', measure);
    const wrapX = () => {
      if (x <= -setW) x += setW;
      if (x >= setW) x -= setW;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    };
    track.addEventListener('pointerdown', e => {
      dragging = true;
      startX = e.clientX;
      startTrackX = x;
      vel = 0;
      track.style.transition = 'none';
    });
    addEventListener('pointermove', e => {
      if (!dragging) return;
      x = startTrackX + (e.clientX - startX);
      wrapX();
    });
    addEventListener('pointerup', () => { if (dragging) { dragging = false; track.style.transition = ''; } });
    addEventListener('pointercancel', () => { dragging = false; track.style.transition = ''; });
    lenis.on('scroll', e => { if (!dragging) vel = e.velocity || 0; });
    gsap.ticker.add((t, dt) => {
      if (dragging) return;
      const speed = reduce ? 0 : 40 + Math.min(900, Math.abs(vel) * 16);
      x -= (speed * dt) / 1000; vel *= .9;
      wrapX();
    });
  })();

  /* пословный цветовой reveal */
  $$('[data-reveal]').forEach(el => {
    const soft = el.dataset.reveal === 'soft';
    const words = splitWords(el);
    gsap.fromTo(words, { color: soft ? '#777777' : '#858585' }, {
      color: soft ? '#aaaaaa' : '#d4d4d4', ease: 'none', stagger: .1,
      scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 40%', scrub: true },
    });
  });

  /* параллакс манифеста */
  gsap.fromTo('[data-mf-left]', { y: 0 }, { y: -60, ease: 'none',
    scrollTrigger: { trigger: '.manifesto', start: 'top bottom', end: 'top top', scrub: true } });
  gsap.fromTo('[data-mf-right]', { y: 90 }, { y: 0, ease: 'none',
    scrollTrigger: { trigger: '.manifesto', start: 'top bottom', end: 'top top', scrub: true } });

  /* about-card */
  gsap.fromTo('.about-card', { scale: .96, y: 80 }, { scale: 1, y: 0, ease: 'none',
    scrollTrigger: { trigger: '.about-card', start: 'top bottom', end: 'top 55%', scrub: true } });

  /* строки и работы */
  $$('.sv-row.st').forEach(row => gsap.from(row, { y: 60, opacity: 0, duration: 1.1, ease: 'expo.out',
    scrollTrigger: { trigger: row, start: 'top 92%' } }));
  if ($('.wk-grid')) gsap.from('.wk-cell.st', { y: 50, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .08,
    scrollTrigger: { trigger: '.wk-grid', start: 'top 85%' } });
  if ($$('.pj-card.st,.pj-mini.st,.good-mini.st').length) gsap.from('.pj-card.st,.pj-mini.st,.good-mini.st', { y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: .07,
    scrollTrigger: { trigger: '.pj-grid,.teaser', start: 'top 88%' } });

  /* team grid — каскадное появление карточек сетки */
  (function teamGrid() {
    const cards = $$('.tm-card');
    if (!cards.length) return;
    gsap.from(cards, {
      y: 48, opacity: 0, duration: .9, ease: 'expo.out', stagger: .06,
      scrollTrigger: { trigger: '.tm-cards', start: 'top 86%', once: true },
      onComplete: () => gsap.set(cards, { clearProps: 'transform' }),
    });
  })();

  /* футер */
  $$('.ft-line').forEach(line => gsap.fromTo(line, { y: 100, rotation: 3, opacity: 0 },
    { y: 0, rotation: 0, opacity: 1, ease: 'none',
      scrollTrigger: { trigger: line, start: 'top bottom', end: 'top 72%', scrub: true } }));
  gsap.fromTo('.ft-cta', { y: 60, opacity: 0 }, { y: 0, opacity: 1, ease: 'none',
    scrollTrigger: { trigger: '.footer', start: 'top 90%', end: 'top 30%', scrub: true } });

  /* загрузчик → интро */
  gsap.set('[data-intro]', { y: -160, opacity: 0 });
  if (loaderSeen) {
    /* повторный визит: прелоадер уже скрыт, интро без ожидания */
    gsap.set('.loader', { display: 'none' });
    bootGlitch();
    gsap.to('[data-intro]', { y: 0, opacity: 1, duration: .9, ease: 'expo.out', stagger: .04,
      onComplete: () => { document.body.classList.remove('is-loading'); lenis.start(); ScrollTrigger.refresh(); deepLink(); } });
  }
  const loader = () => new Promise(done => {
    if (loaderSeen) return done();
    const cv = $('.ld-sphere');
    const ctx = cv.getContext('2d');
    const line = $('[data-loader-line]');
    const cx = cv.width / 2, cy = cv.height / 2, R = cx * 0.8;
    const TOTAL = 120;
    const flies = [];
    for (let i = 0; i < TOTAL; i++) {
      const phi = Math.acos(-1 + (2 * i) / TOTAL);
      const theta = Math.sqrt(TOTAL * Math.PI) * phi;
      flies.push({
        x: cx + R * Math.sin(phi) * Math.cos(theta),
        y: cy + R * Math.sin(phi) * Math.sin(theta),
        z: R * Math.cos(phi)
      });
    }
    const draw = (p) => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, R);
      grad.addColorStop(0, 'rgba(47,230,255,.12)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(47,230,255,.22)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      const lit = Math.floor(p * TOTAL);
      for (let i = 0; i < TOTAL; i++) {
        const f = flies[i], isLit = i < lit;
        const d = 1 - Math.abs(f.z) / R;
        const size = isLit ? 1.6 + d * 2.6 : 0.7 + d * 1.2;
        const alpha = isLit ? 0.65 + d * 0.25 : 0.06 + d * 0.06;
        ctx.fillStyle = isLit ? (i % 2 === 0 ? '#2fe6ff' : '#8b5cf6') : 'rgba(255,255,255,.05)';
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(f.x, f.y, size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    };
    gsap.set('.ld-tag,.ld-name-char,.ld-light,.ld-meta,.ld-sphere-wrap', { opacity: 0 });
    gsap.set('.ld-content', { opacity: 0 });
    gsap.set(line, { scaleX: 0 });
    const prog = { v: 0 };
    gsap.timeline({ onComplete: done })
      .to('.ld-content', { opacity: 1, duration: 0.5, ease: 'power2.out' })
      .to(prog, {
        v: 1, duration: reduce ? 0.5 : 1.9, ease: 'power2.inOut',
        onUpdate: () => draw(prog.v)
      })
      .to('.ld-sphere-wrap,.ld-tag', { opacity: 1, duration: 0.5 }, '<0.25')
      .to('.ld-light', { xPercent: 240, duration: 1.2, ease: 'power2.inOut', opacity: 1 }, '<0.15')
      .to('.ld-name-char', { opacity: 1, y: 0, duration: 0.55, ease: 'expo.out', stagger: 0.045 }, '<0.25')
      .to('.ld-meta', { opacity: 1, duration: 0.5 }, '<0.35')
      .to({}, { duration: 0.5 })
      .to('.ld-content', { y: -46, opacity: 0, duration: 0.45, ease: 'power3.in' }, '+=0.18')
      .to('.ld-front', { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, '-=0.12')
      .to('.ld-back', { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, '-=0.78')
      .set('.loader', { display: 'none' })
      .add(() => storageSet('sessionStorage', 'wn_loader', '1'));
  });
  loader().then(() => {
    if (loaderSeen) return; /* интро уже запущено выше */
    bootGlitch();
    gsap.to('[data-intro]', { y: 0, opacity: 1, duration: 1.4, ease: 'expo.out', stagger: .05,
      delay: reduce ? 0 : .35,
      onComplete: () => { document.body.classList.remove('is-loading'); lenis.start(); ScrollTrigger.refresh(); deepLink(); } });
  });
  $('.to-top')?.addEventListener('click', () => lenis.scrollTo(0, { duration: 2.6 }));
} else {
  /* ---------- ФОЛБЭК БЕЗ GSAP ---------- */
  document.documentElement.classList.add('no-gsap');
  const loaderEl = $('.loader');
  if (loaderSeen) { loaderEl.style.display = 'none'; document.body.classList.remove('is-loading'); deepLink(); }
  setTimeout(() => {
    loaderEl.style.display = 'none';
    document.body.classList.remove('is-loading');
    storageSet('sessionStorage', 'wn_loader', '1');
    deepLink();
  }, 1900);
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: .15 });
  $$('.st,[data-reveal],.ft-line,.ft-cta').forEach(el => io.observe(el));
  /* марки на CSS */
  const track = $('#marquee');
  if (track) track.style.animation = 'marqueeX 26s linear infinite';
  $('.to-top')?.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
}
