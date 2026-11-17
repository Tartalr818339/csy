import * as THREE from 'three';

function canvasTexture(canvas, repeatX = 1, repeatY = 1) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  return texture;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const random = seededRandom(18);

  ctx.fillStyle = '#d8bd92';
  ctx.fillRect(0, 0, 1024, 1024);

  for (let i = 0; i < 78; i += 1) {
    const y = random() * 1024;
    const amplitude = 4 + random() * 16;
    const wavelength = 130 + random() * 320;
    ctx.beginPath();
    ctx.moveTo(-20, y);
    for (let x = -20; x <= 1044; x += 12) {
      ctx.lineTo(x, y + Math.sin((x / wavelength) * Math.PI * 2 + i) * amplitude);
    }
    ctx.strokeStyle = random() > 0.45 ? 'rgba(116, 83, 47, 0.10)' : 'rgba(255, 245, 218, 0.16)';
    ctx.lineWidth = 1 + random() * 3;
    ctx.stroke();
  }

  for (let i = 0; i < 5400; i += 1) {
    ctx.fillStyle = random() > 0.5 ? 'rgba(104, 75, 43, 0.045)' : 'rgba(255, 249, 230, 0.07)';
    ctx.fillRect(random() * 1024, random() * 1024, 1.4, 1.4);
  }

  return canvasTexture(canvas, 3, 2);
}

export function createMatTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const random = seededRandom(72);

  ctx.fillStyle = '#8d9f86';
  ctx.fillRect(0, 0, 1024, 1024);

  for (let i = 0; i < 18000; i += 1) {
    const light = random() > 0.5;
    ctx.fillStyle = light ? 'rgba(247, 250, 238, 0.055)' : 'rgba(45, 62, 43, 0.055)';
    ctx.fillRect(random() * 1024, random() * 1024, 2, 2);
  }

  ctx.strokeStyle = 'rgba(244, 239, 216, 0.38)';
  ctx.lineWidth = 3;
  ctx.setLineDash([9, 11]);
  ctx.strokeRect(38, 38, 948, 948);
  ctx.setLineDash([]);

  return canvasTexture(canvas, 1, 1);
}

export function createShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(256, 256, 40, 256, 256, 250);
  gradient.addColorStop(0, 'rgba(51, 45, 32, 0.42)');
  gradient.addColorStop(0.5, 'rgba(51, 45, 32, 0.18)');
  gradient.addColorStop(1, 'rgba(51, 45, 32, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCoverTitleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 1024, 720);
  ctx.strokeStyle = 'rgba(88, 62, 24, 0.62)';
  ctx.lineWidth = 5;
  ctx.strokeRect(54, 54, 916, 612);
  ctx.lineWidth = 2;
  ctx.strokeRect(74, 74, 876, 572);

  ctx.fillStyle = '#4d3a1d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 116px "Songti SC", "Noto Serif SC", "SimSun", serif';
  ctx.fillText('个人作品集', 512, 360);

  for (const [x, y] of [[128, 128], [896, 128], [128, 592], [896, 592]]) {
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(88, 62, 24, 0.55)';
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function loadImageTexture(src, onLoad) {
  const texture = new THREE.TextureLoader().load(src, onLoad);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.anisotropy = 8;
  return texture;
}

export function findNodeByName(root, name) {
  let found = null;
  root.traverse((object) => {
    if (!found && object.name === name) found = object;
  });
  return found;
}
