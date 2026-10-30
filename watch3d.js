/* ============================================================
   WEBNICSS — интерактивная 3D-модель Luxury Watch
   Лёгкая премиальная сцена: RoomEnvironment (PMREM), без теней,
   Reflector и тяжёлых частиц. Drag-вращение + авто-ротация.
   ============================================================ */
import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';

const stage = document.querySelector('[data-watch]');
const mount = document.querySelector('#watchCanvas');

function fail() {
  if (stage) stage.classList.add('is-fallback');
  window.__watch3d = { ready: false, controls: null };
}

if (!stage || !mount) { fail(); }
else try {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.1, 100);
  camera.position.set(0, 0.45, 9.8);

  /* собственное студийное окружение: только нейтраль, циан и фиолет — никаких посторонних рефлексов */
  const pmrem = new THREE.PMREMGenerator(renderer);
  {
    const env = new THREE.Scene();
    const panelGeo = new THREE.PlaneGeometry(12, 12);
    const panel = (hex, k, pos, rot) => {
      const m = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) }));
      m.position.set(...pos); m.rotation.set(...rot); env.add(m);
    };
    panel(0xffffff, 3.2, [0, 5.5, 0], [Math.PI / 2, 0, 0]);          /* верхний софтбокс */
    panel(0xdfe8ff, 1.1, [-5.5, 1, 2], [0, Math.PI / 2, 0]);         /* холодный заполняющий */
    panel(0x2fe6ff, 2.4, [-4.5, -2, -3.5], [0, -0.7, 0]);            /* циановая кромка */
    panel(0x8b5cf6, 2.1, [4.5, 2, -3.5], [0, 0.7, 0]);               /* фиолетовая кромка */
    panel(0xffffff, 1.4, [0, 0, 6.5], [0, 0, 0]);                    /* фронтальная подсветка */
    scene.environment = pmrem.fromScene(env, 0.04).texture;
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 7.2;
  controls.maxDistance = 12.5;
  controls.minPolarAngle = Math.PI * 0.28;
  controls.maxPolarAngle = Math.PI * 0.72;
  controls.autoRotate = !reduce;
  controls.autoRotateSpeed = 1.1;
  controls.target.set(0, -0.15, 0);

  /* ---- материалы ---- */
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xc6ccd6, metalness: 1, roughness: 0.3, envMapIntensity: 0.85, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const steelDark = new THREE.MeshPhysicalMaterial({ color: 0x7c838e, metalness: 1, roughness: 0.42, envMapIntensity: 0.75 });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xd8ab5e, metalness: 1, roughness: 0.32, envMapIntensity: 0.95, clearcoat: 0.5 });
  const dialMat = new THREE.MeshPhysicalMaterial({ color: 0x05060a, metalness: 0.05, roughness: 0.9, envMapIntensity: 0.08 });
  const handMat = new THREE.MeshPhysicalMaterial({ color: 0xeef2f7, metalness: 1, roughness: 0.18, envMapIntensity: 1.6 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 });

  const watch = new THREE.Group();
  watch.rotation.x = -0.32;
  watch.scale.setScalar(0.82);
  scene.add(watch);

  /* ---- корпус: два цилиндра + фаска ---- */
  const caseBack = new THREE.Mesh(new THREE.CylinderGeometry(2.06, 2.0, 0.5, 64), steelDark);
  caseBack.rotation.x = Math.PI / 2;
  watch.add(caseBack);
  const caseMid = new THREE.Mesh(new THREE.CylinderGeometry(2.16, 2.08, 0.34, 64), steel);
  caseMid.rotation.x = Math.PI / 2;
  caseMid.position.z = 0.06;
  watch.add(caseMid);

  /* ---- безель: тор + 60 рифлей через InstancedMesh ---- */
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(1.96, 0.17, 24, 96), gold);
  bezel.position.z = 0.26;
  watch.add(bezel);
  const fluteGeo = new THREE.BoxGeometry(0.055, 0.2, 0.16);
  const flutes = new THREE.InstancedMesh(fluteGeo, gold, 60);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 2.04, Math.sin(a) * 2.04, 0.27);
    dummy.rotation.set(0, 0, a - Math.PI / 2);
    dummy.updateMatrix();
    flutes.setMatrixAt(i, dummy.matrix);
  }
  watch.add(flutes);

  /* ---- циферблат с канвас-текстурой (санбёрст + минутная разметка) ---- */
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const ctx = cv.getContext('2d');
  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
  grad.addColorStop(0, '#141a24'); grad.addColorStop(0.7, '#0a0d13'); grad.addColorStop(1, '#05070b');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(255,255,255,.05)';
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(256 + Math.cos(a) * 70, 256 + Math.sin(a) * 70);
    ctx.lineTo(256 + Math.cos(a) * 250, 256 + Math.sin(a) * 250); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(216,171,94,.55)'; ctx.lineWidth = 2;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2; const long = i % 5 === 0;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(a) * (long ? 208 : 224), 256 + Math.sin(a) * (long ? 208 : 224));
    ctx.lineTo(256 + Math.cos(a) * 240, 256 + Math.sin(a) * 240);
    ctx.stroke();
  }
  const dialTex = new THREE.CanvasTexture(cv);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.78, 0.08, 64), dialMat.clone());
  dial.material.map = dialTex; dial.material.needsUpdate = true;
  dial.rotation.x = Math.PI / 2; dial.position.z = 0.24;
  watch.add(dial);

  /* ---- 12 часовых меток ---- */
  const markGeo = new THREE.BoxGeometry(0.09, 0.3, 0.07);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const m = new THREE.Mesh(markGeo, i % 3 === 0 ? gold : handMat);
    m.position.set(Math.cos(a) * 1.48, Math.sin(a) * 1.48, 0.33);
    m.rotation.z = a - Math.PI / 2;
    watch.add(m);
  }

  /* ---- стрелки: пивот в центре через translate геометрии ---- */
  function hand(len, wid, mat, z) {
    const g = new THREE.BoxGeometry(wid, len, 0.05);
    g.translate(0, len / 2 - 0.12, 0);
    const m = new THREE.Mesh(g, mat);
    m.position.z = z;
    return m;
  }
  const hourH = hand(0.92, 0.13, handMat, 0.4);
  const minH = hand(1.34, 0.09, handMat, 0.44);
  const secH = hand(1.42, 0.035, gold, 0.48);
  hourH.rotation.z = -0.9; minH.rotation.z = 0.65; secH.rotation.z = 2.1;
  watch.add(hourH, minH, secH);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 32), gold);
  pin.rotation.x = Math.PI / 2; pin.position.z = 0.5;
  watch.add(pin);

  /* ---- центральный логотип WEBNICSS на циферблате ---- */
  const logoCv = document.createElement('canvas');
  logoCv.width = logoCv.height = 256;
  const lctx = logoCv.getContext('2d');
  lctx.fillStyle = '#05070b';
  lctx.fillRect(0, 0, 256, 256);
  lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
  lctx.font = 'bold 82px Archivo';
  lctx.fillStyle = '#d8ab5e';
  lctx.fillText('WEBNICSS', 128, 120);
  lctx.font = '20px Inter Tight';
  lctx.fillStyle = '#2fe6ff';
  lctx.fillText('LUXURY', 128, 148);
  const logoTex = new THREE.CanvasTexture(logoCv);
  const logo = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 32), dialMat.clone());
  logo.material.map = logoTex; logo.material.needsUpdate = true;
  logo.rotation.x = Math.PI / 2; logo.position.z = 0.35;
  watch.add(logo);

  /* ---- окно даты на 3 часа ---- */
  const dateGeo = new THREE.BoxGeometry(0.18, 0.14, 0.06);
  const dateMat = new THREE.MeshPhysicalMaterial({ color: 0x1a2028, metalness: 0.3, roughness: 0.5 });
  const dateWin = new THREE.Mesh(dateGeo, dateMat);
  dateWin.position.set(1.42, 0, 0.36);
  watch.add(dateWin);
  const dateTex = document.createElement('canvas');
  dateTex.width = dateTex.height = 128;
  const dctx = dateTex.getContext('2d');
  dctx.fillStyle = '#05070b'; dctx.fillRect(0, 0, 128, 128);
  dctx.fillStyle = '#2fe6ff'; dctx.textAlign = 'center'; dctx.textBaseline = 'middle';
  dctx.font = 'bold 56px Archivo'; dctx.fillText('14', 64, 68);
  const dateNum = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.03, 32), dialMat.clone());
  dateNum.material.map = new THREE.CanvasTexture(dateTex); dateNum.material.needsUpdate = true;
  dateNum.rotation.x = Math.PI / 2; dateNum.position.set(1.42, 0, 0.366);
  watch.add(dateNum);

  /* ---- сапфировое стекло ---- */
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1.82, 64), glassMat);
  glass.position.z = 0.42;
  watch.add(glass);

  /* ---- заводная головка и ушки ---- */
  /* заводная головка с канавками */
  const crown = new THREE.Group();
  const crownBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.32, 24), gold);
  crownBody.rotation.z = Math.PI / 2;
  crown.add(crownBody);
  /* канавки на головке */
  const fluteGeo2 = new THREE.BoxGeometry(0.025, 0.14, 0.1);
  const crownFlutes = new THREE.InstancedMesh(fluteGeo2, steelDark, 8);
  const d3 = new THREE.Object3D();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    d3.position.set(Math.cos(a) * 0.135, Math.sin(a) * 0.135, 0);
    d3.rotation.set(0, 0, a - Math.PI / 2);
    d3.updateMatrix();
    crownFlutes.setMatrixAt(i, d3.matrix);
  }
  crown.add(crownFlutes);
  crown.position.set(2.3, 0, 0.05);
  watch.add(crown);
  const lugGeo = new THREE.BoxGeometry(0.34, 0.62, 0.3);
  [[-1.35, 2.02], [1.35, 2.02], [-1.35, -2.02], [1.35, -2.02]].forEach(([x, y]) => {
    const lug = new THREE.Mesh(lugGeo, steel);
    lug.position.set(x, y, -0.02);
    watch.add(lug);
  });

  /* ---- браслет: инстанс-линки с лёгкой дугой к запястью ---- */
  const linkGeo = new THREE.BoxGeometry(1.12, 0.38, 0.32);
  const PER_SIDE = 4;
  const bracelet = new THREE.InstancedMesh(linkGeo, steel, PER_SIDE * 2);
  const d2 = new THREE.Object3D();
  let li = 0;
  for (const side of [1, -1]) {
    for (let k = 0; k < PER_SIDE; k++) {
      d2.position.set(0, side * (2.42 + k * 0.42), -0.06 - k * 0.12);
      d2.rotation.set(side * k * 0.09, 0, 0);
      d2.updateMatrix();
      bracelet.setMatrixAt(li++, d2.matrix);
    }
  }
  watch.add(bracelet);

  /* ---- свет: нейтральный ключ + фирменные циан/фиолет кромки ---- */
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(4, 6, 7); scene.add(key);
  const cyan = new THREE.PointLight(0x2fe6ff, 30, 18);
  cyan.position.set(-4.2, -1.6, 3.2); scene.add(cyan);
  const violet = new THREE.PointLight(0x8b5cf6, 26, 18);
  violet.position.set(4.2, 1.8, 2.6); scene.add(violet);

  /* ---- размеры, пауза вне вьюпорта ---- */
  let inView = true;
  new IntersectionObserver(es => { inView = es[0].isIntersecting; }, { threshold: 0.05 }).observe(stage);
  function resize() {
    const w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  new ResizeObserver(resize).observe(mount);

  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    if (!inView) return;
    const t = clock.getElapsedTime();
    if (!reduce) watch.position.y = Math.sin(t * 0.8) * 0.06; /* мягкое парение */
    controls.update();
    renderer.render(scene, camera);
  }
  tick();

  stage.classList.add('is-ready');
  window.__watch3d = { ready: true, controls };
} catch (e) {
  console.warn('watch3d: WebGL недоступен, показываю постер', e);
  fail();
}
