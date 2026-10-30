/* Проверка текущей статической сборки WEBNICSS. Не публиковать в веб-корне.
   Требуются Playwright и запущенный HTTP-сервер; подробности в TESTS-README.txt. */
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const BASE = (process.env.SITE_URL || 'http://127.0.0.1:8082').replace(/\/$/, '');
const abs = p => `${BASE}/${p}`;

async function waitIntro(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
}
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  context.on('page', page => {
    page.on('pageerror', error => errors.push(`${page.url()}: ${error.message}`));
    page.on('response', response => {
      if (response.url().startsWith(BASE) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
  });
  await context.addInitScript(() => sessionStorage.setItem('wn_loader', '1'));
  const page = await context.newPage();

  // Logo and first screen on typical portrait and landscape sizes.
  for (const [width, height] of [[320,480],[320,568],[360,640],[390,740],[430,932],[568,320],[740,360],[1440,900]]) {
    await page.setViewportSize({ width, height });
    await page.goto(abs('index.html'), { waitUntil: 'domcontentloaded' });
    await waitIntro(page);
    const m = await page.evaluate(() => {
      const box = element => {
        const r = element.getBoundingClientRect();
        return { left:r.left, right:r.right, top:r.top, bottom:r.bottom };
      };
      return {
        word: box(document.querySelector('.hero-logo .glitch')),
        mark: box(document.querySelector('.hero-logo .copy-mark')),
        lead: box(document.querySelector('.hero-lead')),
        buttons: [...document.querySelectorAll('.hero-cta a')].map(box),
        scrollWidth: document.documentElement.scrollWidth,
        viewport: { width:innerWidth, height:innerHeight },
      };
    });
    assert.equal(m.buttons.length, 2, 'На первом экране должны быть две кнопки');
    assert.ok(Math.abs(m.mark.top - m.word.top) < 3 && m.mark.left >= m.word.right - 1, `Знак © перенесён не на верхнюю строку: ${width}×${height}`);
    assert.ok(m.mark.right <= width && m.word.left >= 0, `Логотип выходит за край: ${width}×${height}`);
    assert.ok(m.lead.top >= 0 && m.lead.bottom <= height, `Описание не помещается: ${width}×${height}`);
    for (const b of m.buttons) assert.ok(b.top >= 0 && b.bottom <= height + 1, `Кнопка не помещается: ${width}×${height}`);
    assert.ok(m.scrollWidth <= width + 1, `Горизонтальное переполнение: ${width}×${height}`);
    console.log(`✓ Первый экран ${width}×${height}`);
  }

  await page.setViewportSize({ width:1280, height:800 });
  await page.goto(abs('index.html'), { waitUntil:'domcontentloaded' });
  await waitIntro(page);
  assert.equal(await page.locator('#cartOverlay, #menuCart, #shopList, #prodRoot, [data-box]').count(), 0);
  assert.equal(await page.locator('#servicesList .sv-row').count(), 9);
  const links = await page.locator('#servicesList .sv-row').evaluateAll(els => els.map(e => e.getAttribute('href')));
  assert.ok(links.includes('service.html#ai') && links.includes('service.html#tg'));
  assert.ok(!links.includes('service.html#ads'));
  await page.locator('#menuBtn').click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#menu').getAttribute('aria-hidden'), 'false');
  const menuText = await page.locator('#menuList').innerText();
  assert.doesNotMatch(menuText, /Корзина|Витрина|Реклама/i);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#menu').getAttribute('aria-hidden'), 'true');
  console.log('✓ Меню и главная без корзины и витрины');

  // The selected service must render from its address, not just the top of the page.
  for (const id of ['sites','miniapp','bots','ai','design','model3d','video','tg','integrations']) {
    await page.goto(abs(`service.html#${id}`), { waitUntil:'domcontentloaded' });
    await page.waitForSelector(`#svRoot .sv-hero[id="${id}"]`);
    assert.equal(await page.locator(`#svRoot .sv-hero[id="${id}"]`).count(), 1, id);
  }
  assert.equal(await page.locator('[data-sv="ads"]').count(), 0);
  await page.goto(abs('service.html#ai'), { waitUntil:'domcontentloaded' });
  await page.waitForSelector('#svRoot .sv-hero#ai');
  let content = await page.locator('#svRoot').innerText();
  assert.doesNotMatch(content, /Подписки на нейросети|API-ключи и токены|ChatGPT Plus|Claude Pro/i);
  assert.match(content, /Внедрение ИИ/);
  await page.locator('[data-sv="tg"]').click();
  assert.ok(page.url().endsWith('#tg'));
  assert.equal(await page.locator('#svRoot .sv-hero#tg').count(), 1);
  content = await page.locator('#svRoot').innerText();
  assert.doesNotMatch(content, /Premium|Stars/i);
  await page.locator('[data-sv="sites"]').click();
  content = await page.locator('#svRoot').innerText();
  assert.doesNotMatch(content, /WordPress|WooCommerce/i);
  await page.goBack();
  await page.waitForSelector('#svRoot .sv-hero#tg');
  assert.equal(await page.locator('#svRoot .sv-hero#tg').count(), 1, 'Назад должен возвращать выбранную услугу');
  await page.goForward();
  await page.waitForSelector('#svRoot .sv-hero#sites');
  for (const [width, height] of [[390,844],[1280,800]]) {
    await page.setViewportSize({ width, height });
    await page.goto(abs('service.html#ai'), { waitUntil:'domcontentloaded' });
    await waitIntro(page);
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const strip=document.querySelector('#svPills').getBoundingClientRect();
      const active=document.querySelector('#svPills .active').getBoundingClientRect();
      const title=document.querySelector('#svRoot h1').getBoundingClientRect();
      return { strip:{left:strip.left,right:strip.right,bottom:strip.bottom}, active:{left:active.left,right:active.right}, titleTop:title.top };
    });
    assert.ok(m.titleTop >= m.strip.bottom, `Заголовок закрыт фильтром: ${width}×${height}`);
    assert.ok(m.active.left >= m.strip.left && m.active.right <= m.strip.right + 1, `Активный фильтр скрыт: ${width}×${height}`);
  }
  await page.setViewportSize({ width:1280, height:800 });
  console.log('✓ Девять услуг, прямые ссылки, видимый фильтр и история браузера');

  // Project cards and previous bookmarked URLs.
  for (const id of ['project-status','project-phoenix','project-bot','project-automation']) {
    await page.goto(abs(`projects.html#${id}`), { waitUntil:'domcontentloaded' });
    await page.waitForSelector(`#${id}`);
    await page.waitForTimeout(1800);
    assert.ok(await page.locator(`#${id}`).isVisible(), id);
    const y = await page.locator(`#${id}`).evaluate(el => el.getBoundingClientRect().top);
    assert.ok(y < 800 && y > -700, `Переход к проекту ${id}: top=${y}`);
  }
  for (const legacy of ['shop.html?category=ai#catalog','product.html#a1']) {
    await page.goto(abs(legacy), { waitUntil:'domcontentloaded' });
    assert.match(await page.locator('main').innerText(), /РАЗДЕЛ ЗАКРЫТ/i);
    assert.equal(await page.locator('#cartOverlay, #shopList, #prodRoot, [data-add]').count(), 0);
    assert.equal(await page.locator('a[href="service.html#sites"]').count() > 0, true);
  }
  console.log('✓ Кейсы и безопасные страницы для старых ссылок');

  // Verify actual canvas changes while the user drags; motion reduction disables autospin.
  await page.goto(abs('index.html'), { waitUntil:'domcontentloaded' });
  const canvas = page.locator('#coreCanvas');
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const c=document.querySelector('#coreCanvas');
    window.__wnBeforeDrag = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  });
  const r = await canvas.boundingBox();
  assert.ok(r && r.width > 100 && r.height > 100, 'Нет 3D-сцены');
  await page.mouse.move(r.x+r.width*.45, r.y+r.height*.5);
  await page.mouse.down();
  await page.mouse.move(r.x+r.width*.8, r.y+r.height*.65, { steps:12 });
  await page.waitForTimeout(200);
  const diff = await page.evaluate(() => {
    const c=document.querySelector('#coreCanvas'), a=window.__wnBeforeDrag;
    const b=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let changed=0;
    for(let i=0;i<b.length;i+=4) if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>30) changed++;
    return {changed, pixels:b.length/4};
  });
  await page.mouse.up();
  assert.ok(diff.changed > 500, `Фигура не изменилась при drag: ${JSON.stringify(diff)}`);
  console.log(`✓ Интерактивная фигура вращается: изменилось ${diff.changed} пикселей`);

  // Legal pages and legacy local data cleanup.
  for (const name of ['privacy.html','terms.html','security.html']) {
    await page.goto(abs(name), { waitUntil:'domcontentloaded' });
    assert.equal(await page.locator('#cartOverlay, #menuCart, a[href="shop.html#catalog"]').count(), 0);
    assert.ok(await page.locator('.legal-title').count() === 1);
  }
  await page.goto(abs('index.html'), { waitUntil:'domcontentloaded' });
  await page.evaluate(() => {localStorage.setItem('wn_cart','legacy');sessionStorage.setItem('wn_cart_review','1')});
  await page.reload({ waitUntil:'domcontentloaded' });
  assert.equal(await page.evaluate(() => localStorage.getItem('wn_cart')), null);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('wn_cart_review')), null);
  console.log('✓ Документы и очистка старых технических записей');

  // Site and services remain usable if animation libraries fail to load.
  const fallback = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce' });
  await fallback.addInitScript(() => sessionStorage.setItem('wn_loader','1'));
  await fallback.route(/\/(?:gsap\.min|ScrollTrigger\.min|lenis\.min)\.js$/, route => route.abort());
  const simple = await fallback.newPage();
  const simpleErrors = [];
  simple.on('pageerror', e => simpleErrors.push(e.message));
  await simple.goto(abs('service.html#ai'), { waitUntil:'domcontentloaded' });
  await simple.waitForSelector('#svRoot .sv-type.in');
  assert.equal(await simple.evaluate(() => document.documentElement.classList.contains('no-gsap')), true);
  assert.equal(await simple.locator('#svRoot .sv-type').count(), 2);
  assert.deepEqual(simpleErrors, []);
  await fallback.close();
  console.log('✓ Резервный режим без библиотек анимации');

  // Direct file:// opening without external network.
  const offline = await browser.newContext({ reducedMotion:'reduce' });
  await offline.addInitScript(() => sessionStorage.setItem('wn_loader','1'));
  await offline.route(/^https?:/, route => route.abort());
  const local = await offline.newPage();
  const localErrors = [];
  local.on('pageerror', e => localErrors.push(e.message));
  await local.goto(pathToFileURL(path.join(__dirname,'index.html')).href, { waitUntil:'domcontentloaded' });
  await local.waitForSelector('#servicesList .sv-row');
  assert.equal(await local.locator('#servicesList .sv-row').count(), 9);
  assert.equal(await local.locator('#coreCanvas').count(), 1);
  assert.deepEqual(localErrors, []);
  await offline.close();
  console.log('✓ Открытие index.html напрямую без сети');

  // Reproduce the Workspace file viewer: opaque-origin sandbox, scripts on,
  // neighbouring files unavailable. The embedded home and its 3D must work.
  const viewerContext = await browser.newContext({ viewport:{width:390,height:740}, reducedMotion:'reduce' });
  await viewerContext.route(/^https?:/, route => route.abort());
  const viewer = await viewerContext.newPage();
  const viewerErrors = [];
  viewer.on('pageerror', e => viewerErrors.push(e.message));
  await viewer.setContent('<!doctype html><html><body style="margin:0"><iframe sandbox="allow-scripts" style="border:0;width:390px;height:740px"></iframe></body></html>');
  const html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  await viewer.locator('iframe').evaluate((iframe, contents) => { iframe.srcdoc = contents; }, html);
  await viewer.waitForTimeout(1300);
  const frame = viewer.frames().find(f => f.parentFrame());
  assert.ok(frame, 'Нет sandbox iframe');
  const state = await frame.evaluate(() => ({
    boot:!!window.__wnBoot, core:!!window.__wnCoreBoot,
    bg:getComputedStyle(document.body).backgroundColor,
    teamImage:document.querySelector('#teamCards img')?.getAttribute('src') || '',
    services:document.querySelectorAll('#servicesList .sv-row').length,
    lastButton:document.querySelector('.hero-cta a:last-child').getBoundingClientRect().bottom,
  }));
  assert.ok(state.boot && state.core && state.bg === 'rgb(10, 10, 10)');
  assert.ok(state.teamImage.startsWith('data:') && state.services === 9 && state.lastButton <= 740);
  await frame.locator('.hero-cta a[href="#about"]').click();
  await viewer.waitForTimeout(600);
  assert.ok(await frame.evaluate(() => scrollY) > 200, 'Якорь в sandbox не прокручивает главную');
  await frame.evaluate(() => scrollTo(0,0));
  await frame.locator('.hero-cta a[href^="projects.html"]').click();
  assert.match(await frame.locator('#workspace-preview-note').innerText(), /живой предпросмотр/);
  assert.deepEqual(viewerErrors, []);
  await viewerContext.close();
  console.log('✓ Автономный просмотр главной в sandbox Workspace');

  assert.deepEqual(errors, [], `Ошибки страниц или ресурсов: ${errors.join('; ')}`);
  await context.close();
  await browser.close();
  console.log('Все проверки пройдены.');
}
main().catch(e => { console.error(e); process.exit(1); });
