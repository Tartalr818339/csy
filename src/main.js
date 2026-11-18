import * as THREE from 'three';
import { units } from './data/units.js?v=20261118p';
import { BookScene } from './core/book.js?v=20261118p';
import { StageScene } from './core/stage.js?v=20261118p';
import { AmbientAudio } from './core/audio.js?v=20261118p';
import { UI } from './ui.js?v=20261118p';

const worksIndexItems = units
  .filter((unit) => !['intro', 'works', 'contact'].includes(unit.id))
  .map((unit) => ({
    id: unit.id,
    title: unit.title,
    chapter: unit.chapter,
    nav: unit.nav,
    image: unit.hotspots?.[0]?.image || '',
  }));

const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function tween(duration, onUpdate, easing = easeInOut) {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const raw = Math.min((now - start) / duration, 1);
      onUpdate(easing(raw), raw);
      if (raw < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

const canvas = document.querySelector('#scene-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.autoClear = false;
renderer.setClearColor(0xd8c29c, 1);

const ui = new UI();
const book = new BookScene();
const stage = new StageScene();
const audio = new AmbientAudio();

let opened = false;
let busy = false;
let currentIndex = 0;

async function openBook() {
  if (opened || busy) return;
  busy = true;
  book.resetRotation();
  ui.coverPrompt?.classList.add('is-hidden');

  await tween(1650, (t) => {
    book.setOpen(t);
    if (t > 0.58) ui.setOpen(true);
  }, easeInOut);

  book.setOpen(1);
  ui.setOpen(true);
  document.querySelector('#book-ui')?.setAttribute('aria-hidden', 'false');
  opened = true;

  stage.show(units[0], { resetView: true });
  stage.setPresentation(0.025, -1.15, 0.52);
  await tween(880, (t) => {
    stage.setPresentation(lerp(0.025, 1, t), lerp(-1.15, 0, t), lerp(0.52, 0, t));
  }, easeOut);

  busy = false;
}

async function goTo(index) {
  const nextIndex = (index + units.length) % units.length;

  if (!opened) {
    await openBook();
    if (nextIndex !== 0) await goTo(nextIndex);
    return;
  }
  if (busy || nextIndex === currentIndex) return;

  busy = true;
  ui.setDirectory(false);
  ui.setTurning(true);
  const turnTimer = window.setTimeout(() => ui.setTurning(false), 950);

  await tween(420, (t) => {
    stage.setPresentation(lerp(1, 0.035, t), lerp(0, -1.15, t), lerp(0, -0.52, t));
  }, easeInOut);

  currentIndex = nextIndex;
  const unit = units[currentIndex];
  stage.show(unit, { resetView: true });
  stage.setPresentation(0.035, -1.15, 0.52);

  ui.renderUnit(unit, currentIndex, units.length, null, worksIndexItems);
  ui.renderDirectory(units, currentIndex);
  ui.setChapter(unit, currentIndex, units.length);
  ui.hideHotspotTooltip();
  ui.setStageHint(
    unit.layout === 'index'
      ? '滚动浏览全部作品 · 点击卡片进入展区'
      : '拖拽旋转 · 悬停查看展品 · 点击查看大图'
  );

  await tween(900, (t) => {
    stage.setPresentation(lerp(0.035, 1, t), lerp(-1.15, 0, t), lerp(0.52, 0, t));
  }, easeOut);

  window.clearTimeout(turnTimer);
  ui.setTurning(false);
  busy = false;
}

function openHotspot(hotspot) {
  if (!hotspot) return;
  ui.hideHotspotTooltip();
  ui.showModal(hotspot);

  const galleryNodes = Array.from(document.querySelectorAll('.gallery-item')).map(
    (item) => item.dataset.hotspot
  );
  let syncNode = hotspot.node;
  if (!galleryNodes.includes(syncNode)) {
    syncNode = units[currentIndex].hotspots.find(
      (item) => item.image === hotspot.image && galleryNodes.includes(item.node)
    )?.node;
  }
  ui.highlightHotspot(syncNode || '');
}

function bindEvents() {
  let coverDrag = null;

  canvas.addEventListener('pointerdown', (event) => {
    if (opened || busy || event.button !== 0) return;
    coverDrag = { x: event.clientX, y: event.clientY, moved: 0, id: event.pointerId };
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add('is-dragging');
  });

  canvas.addEventListener('pointermove', (event) => {
    if (opened || busy) return;
    if (!coverDrag) {
      book.setPointerParallax(
        event.clientX / window.innerWidth - 0.5,
        event.clientY / window.innerHeight - 0.5
      );
      return;
    }
    const dx = event.clientX - coverDrag.x;
    const dy = event.clientY - coverDrag.y;
    coverDrag.moved += Math.abs(dx) + Math.abs(dy);
    coverDrag.x = event.clientX;
    coverDrag.y = event.clientY;
    book.rotateBy(dx, dy);
  });

  canvas.addEventListener('pointerleave', () => {
    if (!opened) book.setPointerParallax(0, 0);
  });

  const endCoverDrag = (event) => {
    if (!coverDrag) return;
    const moved = coverDrag.moved;
    coverDrag = null;
    canvas.releasePointerCapture?.(event.pointerId);
    canvas.classList.remove('is-dragging');
    if (moved < 6) openBook();
  };

  canvas.addEventListener('pointerup', endCoverDrag);
  canvas.addEventListener('pointercancel', (event) => {
    coverDrag = null;
    canvas.releasePointerCapture?.(event.pointerId);
    canvas.classList.remove('is-dragging');
  });

  ui.coverPrompt?.addEventListener('click', openBook);

  stage.bindPointer(
    canvas,
    () => (opened ? ui.stageViewport.getBoundingClientRect() : null),
    () => opened && !busy && !ui.getModalOpen(),
    (hotspot) => openHotspot(hotspot),
    (hit, event) => {
      if (!hit || !event) {
        ui.hideHotspotTooltip();
        return;
      }
      ui.showHotspotTooltip(hit.hotspot.title, event.clientX, event.clientY);
    }
  );

  ui.onHotspotSelect = (node) => {
    const hotspot = units[currentIndex].hotspots.find((item) => item.node === node);
    openHotspot(hotspot);
  };

  ui.onWorkSelect = (id) => {
    const index = units.findIndex((unit) => unit.id === id);
    if (index >= 0) goTo(index);
  };

  document.querySelector('#btn-directory')?.addEventListener('click', (event) => {
    const willOpen = !ui.directory.classList.contains('is-open');
    ui.setDirectory(willOpen);
    event.currentTarget.setAttribute('aria-expanded', String(willOpen));
  });
  document.querySelector('#btn-directory-close')?.addEventListener('click', () => ui.setDirectory(false));

  ui.directoryList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-index]');
    if (!button) return;
    goTo(Number(button.dataset.index));
  });

  document.querySelector('#btn-prev')?.addEventListener('click', () => goTo(currentIndex - 1));
  document.querySelector('#btn-next')?.addEventListener('click', () => goTo(currentIndex + 1));

  document.querySelector('#btn-audio')?.addEventListener('click', async () => {
    const playing = await audio.toggle();
    ui.setAudio(playing);
  });

  document.querySelector('#btn-reset')?.addEventListener('click', () => {
    if (!opened) return;
    stage.animateViewToUnit(units[currentIndex]);
    ui.setStageHint('视角已复位 · 可继续拖拽');
  });

  document.querySelectorAll('[data-close-modal]').forEach((element) => {
    element.addEventListener('click', () => ui.hideModal());
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (ui.getModalOpen()) ui.hideModal();
      else ui.setDirectory(false);
      return;
    }
    if (ui.getModalOpen()) return;
    if (event.key === 'ArrowRight') goTo(currentIndex + 1);
    if (event.key === 'ArrowLeft') goTo(currentIndex - 1);
    if (!opened && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openBook();
    }
  });

  window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    book.resize(width, height);
    stage.resize(width, height);
  });
}

async function boot() {
  ui.setLoading(true, '加载纸艺模型与作品素材');
  try {
    await Promise.all([book.load(), stage.preload(units)]);
  } catch (error) {
    console.error('[Paper Book] 资源加载失败', error);
    ui.setLoading(true, '资源加载失败，请刷新页面重试');
    return;
  }

  ui.renderUnit(units[0], 0, units.length, null, worksIndexItems);
  ui.renderDirectory(units, 0);
  ui.setChapter(units[0], 0, units.length);
  ui.setStageHint('拖拽旋转 · 悬停查看展品 · 点击查看大图');
  ui.setAudio(false);
  ui.setLoading(false);
  bindEvents();
}

const clock = new THREE.Clock();

function frame() {
  const delta = Math.min(clock.getDelta(), 0.05);
  stage.update(delta);
  book.update(delta);

  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, width, height);
  renderer.clear();
  book.render(renderer);

  if (opened) {
    stage.render(renderer, ui.stageViewport.getBoundingClientRect(), width, height);
  }

  requestAnimationFrame(frame);
}

boot();
frame();
