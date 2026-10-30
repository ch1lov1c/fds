#!/usr/bin/env python3
"""Встроить резерв предпросмотра в index.html, сохранив обычные внешние файлы сайта.

Запускать из любой папки после изменения styles.css, fonts.css, main.js или
core3d.js. Pillow необязателен: если он есть, в превью попадут компактные копии
картинок; иначе будут использованы исходные файлы. Скрипт не публиковать в веб-корне.
"""
from pathlib import Path
import base64
import hashlib
import io
import json
import re

root = Path(__file__).resolve().parent
index = root / 'index.html'
html = index.read_text(encoding='utf-8')

# Повторный запуск заменяет предыдущие встроенные ресурсы, а не добавляет копии.
for name in ('STYLE', 'MAIN', 'CORE'):
    begin = f'<!-- WORKSPACE-{name}-BEGIN -->'
    end = f'<!-- WORKSPACE-{name}-END -->'
    if begin in html or end in html:
        if html.count(begin) != 1 or html.count(end) != 1:
            raise SystemExit(f'Неверные границы встроенного блока {name}')
        left = html.index(begin)
        right = html.index(end, left) + len(end)
        # Нормализуем только окружающие переводы строк: повторная сборка
        # не должна накапливать пустые строки или менять незатронутую разметку.
        while left > 0 and html[left - 1] in '\r\n':
            left -= 1
        while right < len(html) and html[right] in '\r\n':
            right += 1
        html = html[:left] + '\n' + html[right:]

font_css = (root / 'fonts.css').read_text(encoding='utf-8')
faces = re.findall(r'@font-face\s*\{[^}]+\}', font_css, flags=re.I)
if len(faces) < 8:
    raise SystemExit('Не найдены локальные шрифты сайта')
# Первые два блока — Archivo, следующие шесть — разные подмножества Inter Tight.
# Сами woff2 переменные; один диапазон веса заменяет повторные правила для каждого веса.
font_rules = []
for face in faces[:8]:
    face = re.sub(r'font-weight:\s*300\s*;', 'font-weight: 100 900;', face)
    match = re.search(r'url\(([^)]+\.woff2)\)', face)
    if not match:
        raise SystemExit('В определении шрифта нет локального woff2')
    font = (root / match.group(1)).read_bytes()
    uri = 'data:font/woff2;base64,' + base64.b64encode(font).decode('ascii')
    face = face[:match.start()] + 'url(' + uri + ')' + face[match.end():]
    font_rules.append(face)

styles = (root / 'styles.css').read_text(encoding='utf-8')
inline_css = '\n/* Резерв шрифтов и стилей для закрытого просмотра Workspace. */\n' + '\n'.join(font_rules) + '\n' + styles + '\n'
if '</style' in inline_css.lower():
    raise SystemExit('Небезопасная последовательность в CSS')
style_block = '<!-- WORKSPACE-STYLE-BEGIN -->\n<style id="workspace-style">' + inline_css + '</style>\n<!-- WORKSPACE-STYLE-END -->'

main = (root / 'main.js').read_text(encoding='utf-8')
core = (root / 'core3d.js').read_text(encoding='utf-8')
assets = sorted(set(re.findall(r"'(team-[^']+\.(?:jpg|svg))'", main)))
if not assets:
    raise SystemExit('Не найдены изображения команды')
try:
    from PIL import Image
except ImportError:
    Image = None
asset_map = {}
for name in assets:
    p = root / name
    content = p.read_bytes()
    mime = 'image/svg+xml' if p.suffix.lower() == '.svg' else 'image/jpeg'
    if mime == 'image/jpeg' and Image is not None:
        try:
            with Image.open(p) as im:
                im = im.convert('RGB')
                im.thumbnail((360, 360))
                out = io.BytesIO()
                im.save(out, format='JPEG', quality=68, optimize=True, progressive=True)
                content = out.getvalue()
        except Exception:
            pass  # Исходное изображение остаётся доступным и без Pillow.
    asset_map[name] = 'data:' + mime + ';base64,' + base64.b64encode(content).decode('ascii')

workspace_nav = r'''
// В закрытом просмотрщике относительные страницы не загружаются. Оставляем
// внутренние якоря рабочими, а вместо пустой страницы показываем подсказку.
(function () {
  let noticeTimer;
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const href = (link.getAttribute('href') || '').trim();
    if (!href || /^(?:https?:|mailto:|tel:|data:|blob:|\/\/)/i.test(href)) return;
    const parts = href.split('#');
    const page = parts[0].replace(/^\.\//, '').split('?')[0];
    if (page === '' || page === 'index.html') {
      let id = parts[1] || 'home';
      try { id = decodeURIComponent(id); } catch (_) { return; }
      const target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!/^[a-z0-9_-]+\.html$/i.test(page)) return;
    event.preventDefault();
    let note = document.getElementById('workspace-preview-note');
    if (!note) {
      note = document.createElement('div');
      note.id = 'workspace-preview-note';
      note.setAttribute('role', 'status');
      note.style.cssText = 'position:fixed;z-index:9999;bottom:18px;left:50%;transform:translateX(-50%);width:min(92vw,440px);padding:13px 16px;background:#111b1d;color:#f5f8f8;border:1px solid #2fe6ff;border-radius:6px;font:14px/1.4 Arial,sans-serif;text-align:center;box-shadow:0 10px 35px #000a;pointer-events:none';
      note.textContent = 'Для перехода на другие страницы откройте живой предпросмотр сайта.';
      document.body.appendChild(note);
    }
    note.style.display = 'block';
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { note.style.display = 'none'; }, 5000);
  }, true);
}());
'''
main_fallback = '\nif (!window.__wnBoot) {\nwindow.__wnWorkspaceImages=' + json.dumps(asset_map, separators=(',', ':')) + ';\n' + workspace_nav + '\n' + main + '\n}\n'
core_fallback = '\nif (!window.__wnCoreBoot) {\n' + core + '\n}\n'
for text in (main_fallback, core_fallback):
    if '</script' in text.lower():
        raise SystemExit('Небезопасная последовательность в JavaScript')

def csp_hash(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode('utf-8')).digest()).decode('ascii') + "'"

policy = "default-src 'self'; script-src 'self' " + csp_hash(main_fallback) + ' ' + csp_hash(core_fallback) + "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'self'"
meta = '<meta http-equiv="Content-Security-Policy" content="' + policy + '">'
html, n = re.subn(r'<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*">', lambda _: meta, html, count=1, flags=re.I)
if n != 1:
    raise SystemExit('Не найден заголовок Content-Security-Policy')

def insert_after(text, marker, addition):
    if text.count(marker) != 1:
        raise SystemExit('Не найдена или повторяется точка вставки: ' + marker)
    return text.replace(marker, marker + '\n' + addition, 1)

font_link = '<link rel="stylesheet" href="fonts.css">'
if html.count(font_link) != 1:
    raise SystemExit('Не найдена точка вставки стилей')
html = html.replace(font_link, style_block + '\n' + font_link, 1)
main_block = '<!-- WORKSPACE-MAIN-BEGIN -->\n<script id="workspace-main">' + main_fallback + '</script>\n<!-- WORKSPACE-MAIN-END -->'
core_block = '<!-- WORKSPACE-CORE-BEGIN -->\n<script id="workspace-core">' + core_fallback + '</script>\n<!-- WORKSPACE-CORE-END -->'
html = insert_after(html, '<script src="main.js"></script>', main_block)
html = insert_after(html, '<script src="core3d.js"></script>', core_block)
index.write_text(html, encoding='utf-8')
print('Готово:', index.name, f'{index.stat().st_size / 1024:.0f} КБ;', len(assets), 'изображений команды в автономном превью')
print('Основные CSS и JS продолжают лежать отдельными редактируемыми файлами.')
