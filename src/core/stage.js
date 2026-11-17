import * as THREE from 'three';
import { GLTFLoader } from '../../public/vendor/three/loaders/GLTFLoader.js';
import { createShadowTexture, findNodeByName, loadImageTexture } from './textures.js';

const NODE_ALIASES = {
  hotspot_envelope: 'EnvelopeSeal',
  hotspot_sketch_secondary: 'hotspot_sketch',
};

function meshSize(object) {
  object.geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  object.geometry.boundingBox.getSize(size);
  return size;
}

export class StageScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.modelCache = new Map();
    this.currentUnit = null;
    this.currentModel = null;
    this.hotspotMap = new Map();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.loading = new Map();

    this.view = {
      theta: 0,
      phi: 1.1,
      radius: 6.5,
      target: new THREE.Vector3(0, 1, 0),
    };
    this.desiredView = {
      theta: 0,
      phi: 1.1,
      radius: 6.5,
      target: new THREE.Vector3(0, 1, 0),
    };

    this.presentation = { scale: 1, offsetZ: 0, rotationY: 0 };
    this.hoveredMesh = null;
    this.buildEnvironment();
    this.updateCamera(1);
  }

  buildEnvironment() {
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(9.2, 7.2),
      new THREE.MeshStandardMaterial({ color: 0xefe7d6, roughness: 1, metalness: 0 })
    );
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.035;
    base.receiveShadow = true;
    this.scene.add(base);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(6.8, 5.2),
      new THREE.MeshBasicMaterial({
        map: createShadowTexture(),
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.024;
    this.scene.add(shadow);

    const hemi = new THREE.HemisphereLight(0xfff6e5, 0x6d7364, 1.6);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffefd8, 2.1);
    key.position.set(4, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 24;
    key.shadow.camera.left = -7;
    key.shadow.camera.right = 7;
    key.shadow.camera.top = 7;
    key.shadow.camera.bottom = -7;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xd5e5d6, 0.78);
    fill.position.set(-5, 3.5, -4);
    this.scene.add(fill);
  }

  async preload(units) {
    await Promise.all(units.map((unit) => this.loadUnit(unit)));
  }

  async loadUnit(unit) {
    if (this.modelCache.has(unit.id)) return this.modelCache.get(unit.id);
    if (this.loading.has(unit.id)) return this.loading.get(unit.id);

    const task = (async () => {
      const gltf = await new GLTFLoader().loadAsync(unit.model);
      const model = gltf.scene;
      model.userData.unitId = unit.id;
      model.visible = false;
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        object.material = object.material.clone();
      });

      for (const binding of unit.textures || []) {
        const node = findNodeByName(model, binding.node);
        if (!node?.isMesh) continue;

        const fitImage = () => {
          if (!binding.fitImage || !texture.image?.width) return;
          const baseSize = meshSize(node);
          const targetHeight = binding.targetHeight || baseSize.y;
          const targetWidth = targetHeight * (texture.image.width / texture.image.height);
          node.scale.set(targetWidth / baseSize.x, targetHeight / baseSize.y, 1);

          if (binding.frame) {
            const frame = findNodeByName(model, binding.frame);
            if (frame?.isMesh) {
              const frameSize = meshSize(frame);
              frame.scale.set(
                (targetWidth + (binding.framePaddingX ?? 0.24)) / frameSize.x,
                (targetHeight + (binding.framePaddingY ?? 0.22)) / frameSize.y,
                1
              );
            }
          }
        };

        const texture = loadImageTexture(binding.src, fitImage);
        node.material.map = texture;
        node.material.color.set(0xffffff);
        node.material.needsUpdate = true;
        if (texture.image?.width) fitImage();
      }

      this.scene.add(model);
      this.modelCache.set(unit.id, model);
      return model;
    })();

    this.loading.set(unit.id, task);
    try {
      return await task;
    } finally {
      this.loading.delete(unit.id);
    }
  }

  buildHotspotMap(unit) {
    this.hotspotMap.clear();
    for (const hotspot of unit.hotspots || []) {
      const nodeName = NODE_ALIASES[hotspot.node] || hotspot.node;
      if (!nodeName) continue;
      if (!this.hotspotMap.has(nodeName)) this.hotspotMap.set(nodeName, []);
      this.hotspotMap.get(nodeName).push(hotspot);
    }
  }

  show(unit, { resetView = true } = {}) {
    this.setHovered(null);
    if (this.currentModel) this.currentModel.visible = false;
    this.currentUnit = unit;
    this.currentModel = this.modelCache.get(unit.id) || null;
    if (this.currentModel) this.currentModel.visible = true;
    this.buildHotspotMap(unit);
    if (resetView) this.resetView(unit);
  }

  setPresentation(scale, offsetZ = 0, rotationY = 0) {
    this.presentation.scale = scale;
    this.presentation.offsetZ = offsetZ;
    this.presentation.rotationY = rotationY;
    if (this.currentModel) {
      this.currentModel.scale.setScalar(scale);
      this.currentModel.position.z = offsetZ;
      this.currentModel.rotation.y = rotationY;
    }
  }

  setViewFromUnit(unit) {
    const config = unit.camera || {};
    this.desiredView.theta = config.theta ?? 0.35;
    this.desiredView.phi = config.phi ?? 1.1;
    this.desiredView.radius = config.radius ?? 6.5;
    this.desiredView.target.fromArray(config.target || [0, 1, 0]);
  }

  resetView(unit = this.currentUnit) {
    if (!unit) return;
    this.setViewFromUnit(unit);
    this.view.theta = this.desiredView.theta;
    this.view.phi = this.desiredView.phi;
    this.view.radius = this.desiredView.radius;
    this.view.target.copy(this.desiredView.target);
    this.updateCamera(1);
  }

  animateViewToUnit(unit) {
    if (!unit) return;
    this.setViewFromUnit(unit);
  }

  updateCamera(alpha) {
    this.view.theta += (this.desiredView.theta - this.view.theta) * alpha;
    this.view.phi += (this.desiredView.phi - this.view.phi) * alpha;
    this.view.radius += (this.desiredView.radius - this.view.radius) * alpha;
    this.view.target.lerp(this.desiredView.target, alpha);

    const { theta, phi, radius, target } = this.view;
    this.camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    this.camera.lookAt(target);
  }

  bindPointer(canvas, getViewport, isActive, onHotspot, onHover) {
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;

    const inside = (event) => {
      const rect = getViewport();
      if (!rect) return false;
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    };

    canvas.addEventListener('pointerdown', (event) => {
      if (!isActive() || !inside(event)) return;
      dragging = true;
      moved = 0;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
      canvas.classList.add('is-dragging');
    });

    const clearHover = () => {
      this.setHovered(null);
      canvas.classList.remove('is-hover-hotspot');
      onHover?.(null, null);
    };

    canvas.addEventListener('pointermove', (event) => {
      if (!isActive()) return;

      if (!dragging) {
        if (!inside(event)) {
          clearHover();
          return;
        }
        const hit = this.findHotspot(event, getViewport);
        this.setHovered(hit?.object || null);
        canvas.classList.toggle('is-hover-hotspot', Boolean(hit));
        onHover?.(hit, event);
        return;
      }

      this.setHovered(null);
      canvas.classList.remove('is-hover-hotspot');
      onHover?.(null, event);
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = event.clientX;
      lastY = event.clientY;
      this.desiredView.theta -= dx * 0.006;
      this.desiredView.phi = THREE.MathUtils.clamp(this.desiredView.phi - dy * 0.005, 0.42, 1.52);
    });

    canvas.addEventListener('pointerleave', clearHover);

    const endDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      canvas.classList.remove('is-dragging');
      canvas.releasePointerCapture?.(event.pointerId);
      if (moved < 6 && isActive() && inside(event)) this.pickHotspot(event, getViewport(), onHotspot);
    };

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', () => {
      dragging = false;
      canvas.classList.remove('is-dragging');
    });

    canvas.addEventListener(
      'wheel',
      (event) => {
        if (!isActive() || !inside(event)) return;
        event.preventDefault();
        this.desiredView.radius = THREE.MathUtils.clamp(
          this.desiredView.radius + event.deltaY * 0.004,
          4.6,
          9.2
        );
      },
      { passive: false }
    );
  }

  findHotspot(event, getViewport) {
    const rect = getViewport();
    if (!rect || !this.currentModel || !this.currentUnit) return null;
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.raycaster.intersectObject(this.currentModel, true);
    for (const hit of hits) {
      let object = hit.object;
      while (object && object !== this.currentModel) {
        const candidates = this.hotspotMap.get(object.name);
        if (candidates?.length) {
          return { hotspot: candidates[0], unit: this.currentUnit, object };
        }
        object = object.parent;
      }
    }
    return null;
  }

  setHovered(object) {
    if (this.hoveredMesh === object) return;
    if (this.hoveredMesh?.material?.emissive) {
      this.hoveredMesh.material.emissive.set(0x000000);
      this.hoveredMesh.material.emissiveIntensity = 1;
    }
    this.hoveredMesh = object || null;
    if (this.hoveredMesh?.material?.emissive) {
      this.hoveredMesh.material.emissive.set(0x6b4a1f);
      this.hoveredMesh.material.emissiveIntensity = 0.42;
    }
  }

  pickHotspot(event, getViewport, onHotspot) {
    const hit = this.findHotspot(event, getViewport);
    if (hit) onHotspot?.(hit.hotspot, hit.unit, hit.object.name);
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.updateCamera(1 - Math.exp(-dt * 8));
  }

  render(renderer, rect, viewportWidth, viewportHeight) {
    if (!rect || !this.currentModel?.visible) return;
    const x = Math.round(rect.left);
    const y = Math.round(viewportHeight - rect.bottom);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const aspect = width / height;

    if (Math.abs(this.camera.aspect - aspect) > 0.001) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }

    renderer.setScissorTest(true);
    renderer.setScissor(x, y, width, height);
    renderer.setViewport(x, y, width, height);
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, viewportWidth, viewportHeight);
  }
}
