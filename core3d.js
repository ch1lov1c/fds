/* ============================================================
   WEBNICSS — «Три пространства»: интерактивный 3D-объект
   Кристаллическое ядро (икосаэдр) + три орбиты Web / Telegram / 3D.
   Чистый canvas 2D с ручной перспективой: без WebGL, без библиотек,
   работает в превью и на слабых мобильных.
   Вращение: мышь, палец, инерция. prefers-reduced-motion — стоп автоспин.
   ============================================================ */
(() => {
  'use strict';
  const canvas = document.getElementById('coreCanvas');
  if (!canvas || window.__wnCoreBoot) return;
  window.__wnCoreBoot = true;
  const ctx = canvas.getContext('2d');
  const wrap = canvas.closest('.sv-core') || canvas.parentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- геометрия: икосаэдр ---------- */
  const PHI = (1 + Math.sqrt(5)) / 2;
  const RAW = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ];
  const V = RAW.map(([x, y, z]) => {
    const l = Math.hypot(x, y, z);
    return [x / l, y / l, z / l];
  });
  const EDGES = [];
  for (let i = 0; i < V.length; i++) {
    for (let j = i + 1; j < V.length; j++) {
      const d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]);
      if (d < 1.25) EDGES.push([i, j]);
    }
  }

  /* ---------- три орбиты ---------- */
  const RINGS = [
    { r: 1.30, tiltX: 0.42, tiltZ: 0.0, speed: 0.55, color: '#2fe6ff', label: 'WEB' },
    { r: 1.46, tiltX: -1.02, tiltZ: 0.55, speed: -0.38, color: '#7ea6ff', label: 'TG' },
    { r: 1.62, tiltX: 0.18, tiltZ: -1.15, speed: 0.26, color: '#b98bff', label: '3D' },
  ].map(o => ({ ...o, phase: Math.random() * Math.PI * 2 }));

  /* ---------- состояние ---------- */
  let W = 0, H = 0, DPR = 1, R = 140;
  let rx = -0.34, ry = 0.6;            // текущий угол
  let vx = 0, vy = 0;                  // инерция
  let dragging = false, lastX = 0, lastY = 0, idle = 0;
  const auto = reduce ? 0 : 0.0032;
  let t = 0, visible = true, raf = 0;

  /* ---------- размеры ---------- */
  function resize() {
    const rect = wrap.getBoundingClientRect();
    const size = Math.max(220, Math.min(rect.width, rect.height || 380));
    W = rect.width; H = rect.height || 380;
    DPR = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    R = Math.min(W, H) * 0.255;
  }

  /* ---------- проекция ---------- */
  const FOCAL = 3.1;
  function project(p, cx, cy) {
    const cosX = Math.cos(rx), sinX = Math.sin(rx);
    const cosY = Math.cos(ry), sinY = Math.sin(ry);
    // rotate Y, затем X
    let x = p[0] * cosY + p[2] * sinY;
    let z = -p[0] * sinY + p[2] * cosY;
    let y = p[1] * cosX - z * sinX;
    z = p[1] * sinX + z * cosX;
    const s = FOCAL / (FOCAL - z * 0.62);
    return { x: cx + x * R * s, y: cy - y * R * s, z, s };
  }
  const rotPoint = (p, tx, tz) => {
    // tilt по X и по Z — для плоскостей орбит
    const cx = Math.cos(tx), sx = Math.sin(tx), cz = Math.cos(tz), sz = Math.sin(tz);
    let x = p[0] * cz - p[1] * sz;
    let y = p[0] * sz + p[1] * cz;
    let z = p[2];
    const y2 = y * cx - z * sx;
    const z2 = y * sx + z * cx;
    return [x, y2, z2];
  };

  const alphaFor = z => 0.1 + (z + 1) / 2 * 0.72;

  /* ---------- отрисовка ---------- */
  function draw() {
    const cx = W / 2, cy = H / 2 - 6;
    ctx.clearRect(0, 0, W, H);

    // мягкое свечение в центре
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.5);
    glow.addColorStop(0, 'rgba(47,230,255,.16)');
    glow.addColorStop(0.45, 'rgba(29,78,122,.10)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // орбиты
    RINGS.forEach(ring => {
      const N = 96;
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const a = i / N * Math.PI * 2;
        const p = project(rotPoint([Math.cos(a) * ring.r, Math.sin(a) * ring.r, 0], ring.tiltX, ring.tiltZ), cx, cy);
        if (prev) {
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = ring.color;
          ctx.globalAlpha = alphaFor((prev.z + p.z) / 2) * 0.5;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        prev = p;
      }
      // спутник на орбите
      const a = ring.phase + t * ring.speed;
      const sp = project(rotPoint([Math.cos(a) * ring.r, Math.sin(a) * ring.r, 0], ring.tiltX, ring.tiltZ), cx, cy);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 3.2 * sp.s, 0, Math.PI * 2);
      ctx.fillStyle = ring.color;
      ctx.shadowColor = ring.color;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // каркас икосаэдра
    const proj = V.map(v => project(v, cx, cy));
    EDGES.forEach(([i, j]) => {
      const a = proj[i], b = proj[j];
      const z = (a.z + b.z) / 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.globalAlpha = alphaFor(z) * 0.95;
      ctx.strokeStyle = z > 0 ? '#cfefff' : '#2fe6ff';
      ctx.lineWidth = z > 0 ? 1.35 : 0.8;
      ctx.stroke();
    });

    // вершины
    proj.forEach(p => {
      ctx.globalAlpha = Math.min(1, alphaFor(p.z) + 0.18);
      ctx.beginPath();
      ctx.arc(p.x, p.y, (p.z > 0 ? 2.1 : 1.5) * p.s, 0, Math.PI * 2);
      ctx.fillStyle = p.z > 0 ? '#eaffff' : '#2fe6ff';
      ctx.fill();
    });

    // внутреннее ядро — грани с заливкой по глубине
    const ring = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.1, cx, cy, R * 0.95);
    ring.addColorStop(0, 'rgba(47,230,255,.22)');
    ring.addColorStop(0.6, 'rgba(29,78,122,.16)');
    ring.addColorStop(1, 'rgba(6,10,18,.02)');
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();

    // блик
    ctx.globalAlpha = 0.9;
    const sp2 = ctx.createRadialGradient(cx - R * 0.55, cy - R * 0.6, 0, cx - R * 0.55, cy - R * 0.6, R * 0.9);
    sp2.addColorStop(0, 'rgba(255,255,255,.10)');
    sp2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sp2;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  /* ---------- цикл ---------- */
  function tick() {
    t += 0.016;
    if (!dragging) {
      ry += auto + vy;
      rx += vx;
      vy *= 0.94;
      vx *= 0.94;
      if (Math.abs(vy) < 1e-4) vy = 0;
      if (Math.abs(vx) < 1e-4) vx = 0;
      // мягкое возвращение наклона в комфортную зону
      idle += 0.016;
      if (idle > 2.2) rx += (-0.34 - rx) * 0.012;
    }
    rx = Math.max(-1.35, Math.min(1.35, rx));
    draw();
    if (visible) raf = requestAnimationFrame(tick);
  }

  /* ---------- интерактив ---------- */
  function pointerDown(e) {
    dragging = true;
    idle = 0;
    vx = vy = 0;
    lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
    wrap.classList.add('is-grabbing');
  }
  function pointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    ry += dx * 0.0075;
    rx += dy * 0.0065;
    rx = Math.max(-1.35, Math.min(1.35, rx));
    vy = dx * 0.0016;
    vx = dy * 0.0012;
  }
  function pointerUp() {
    dragging = false;
    idle = 0;
    wrap.classList.remove('is-grabbing');
  }

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('pointerleave', pointerUp);
  canvas.addEventListener('dblclick', () => { rx = -0.34; ry = 0.6; vx = vy = 0; });
  canvas.style.touchAction = 'pan-y';

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(tick);
      if (!visible) { cancelAnimationFrame(raf); raf = 0; }
    }, { threshold: 0.05 }).observe(wrap);
  }

  new ResizeObserver(resize).observe(wrap);
  resize();
  raf = requestAnimationFrame(tick);
  wrap.classList.add('is-ready');
})();
