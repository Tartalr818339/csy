import * as THREE from 'three';
import { GLTFLoader } from '../../public/vendor/three/loaders/GLTFLoader.js';
import {
  createCoverTitleTexture,
  createMatTexture,
  createShadowTexture,
  createWoodTexture,
  findNodeByName,
} from './textures.js';

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

function createCurlPage() {
  const columns = 30;
  const rows = 6;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let row = 0; row <= rows; row += 1) {
    for (let col = 0; col <= columns; col += 1) {
      const u = col / columns;
      const v = row / rows;
      positions.push(u * 3.86, 0, lerp(-2.6, 2.6, v));
      uvs.push(u, v);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const a = row * (columns + 1) + col;
      const b = a + 1;
      const c = a + columns + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0xf8f1df,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.visible = false;
  mesh.userData.basePositions = Float32Array.from(positions);
  return mesh;
}

export class BookScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.openProgress = 0;
    this.model = null;
    this.frontPivot = null;
    this.leftPivot = null;
    this.leftPages = null;
    this.coverTitle = null;
    this.bookmark = null;
    this.curlPage = null;
    this.cameraTarget = new THREE.Vector3(1.9, 0.16, 0);
    this.bookPivot = new THREE.Group();
    this.yaw = 0;
    this.desiredYaw = 0;
    this.pitch = 0;
    this.desiredPitch = 0;
    this.idleTime = 0;
    this.pointerX = 0;
    this.pointerY = 0;
    this.targetPointerX = 0;
    this.targetPointerY = 0;
    this.scene.add(this.bookPivot);
    this.buildEnvironment();
  }

  buildEnvironment() {
    const wood = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 34),
      new THREE.MeshStandardMaterial({ map: createWoodTexture(), roughness: 0.95, metalness: 0 })
    );
    wood.rotation.x = -Math.PI / 2;
    wood.position.y = -0.3;
    wood.receiveShadow = true;
    this.scene.add(wood);

    const mat = new THREE.Mesh(
      new THREE.PlaneGeometry(13.2, 9.2),
      new THREE.MeshStandardMaterial({ map: createMatTexture(), roughness: 1, metalness: 0 })
    );
    mat.rotation.x = -Math.PI / 2;
    mat.rotation.z = -0.025;
    mat.position.y = -0.275;
    mat.receiveShadow = true;
    this.scene.add(mat);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(10.5, 7.2),
      new THREE.MeshBasicMaterial({
        map: createShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0.4, -0.265, 0.05);
    this.scene.add(shadow);

    const hemi = new THREE.HemisphereLight(0xfff3df, 0x5f6558, 1.75);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffefd2, 2.25);
    key.position.set(4.5, 9, 6.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 28;
    key.shadow.camera.left = -9;
    key.shadow.camera.right = 9;
    key.shadow.camera.top = 9;
    key.shadow.camera.bottom = -9;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xd7e5d6, 0.72);
    fill.position.set(-6, 4.5, -4);
    this.scene.add(fill);
  }

  async load() {
    const gltf = await new GLTFLoader().loadAsync('./public/models/book.gltf');
    this.model = gltf.scene;
    this.model.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    this.frontPivot = findNodeByName(this.model, 'FrontCoverPivot');
    this.leftPivot = findNodeByName(this.model, 'LeftPagesPivot');
    this.leftPages = findNodeByName(this.model, 'LeftPages');
    this.coverTitle = findNodeByName(this.model, 'CoverTitle');
    this.bookmark = findNodeByName(this.model, 'Bookmark');

    if (this.coverTitle?.isMesh) {
      this.coverTitle.geometry = new THREE.PlaneGeometry(3.2, 2.3);
      this.coverTitle.rotation.x = -Math.PI / 2;
      this.coverTitle.material = new THREE.MeshBasicMaterial({
        map: createCoverTitleTexture(),
        transparent: true,
        side: THREE.FrontSide,
        depthWrite: false,
        toneMapped: false,
      });
      this.coverTitle.renderOrder = 2;
    }

    this.curlPage = createCurlPage();
    this.model.add(this.curlPage);
    this.model.position.x = -2;
    this.bookPivot.add(this.model);
    this.setOpen(0);
    this.resize(window.innerWidth, window.innerHeight);
    return this;
  }

  setOpen(progress) {
    this.openProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const eased = smooth(this.openProgress);

    this.bookPivot.position.x = lerp(2, 0, eased);

    if (this.frontPivot) {
      this.frontPivot.rotation.z = Math.PI * eased;
      this.frontPivot.position.y = lerp(0.31, 0.17, eased);
    }
    if (this.leftPivot) {
      this.leftPivot.rotation.z = Math.PI * 0.965 * eased;
      this.leftPivot.position.y = lerp(0.1, 0.17, eased);
    }
    if (this.leftPages) {
      this.leftPages.visible = this.openProgress > 0.035;
    }
    if (this.coverTitle?.material) {
      this.coverTitle.material.opacity = 1 - smooth(THREE.MathUtils.clamp((this.openProgress - 0.48) / 0.42, 0, 1));
    }
    if (this.bookmark) {
      this.bookmark.visible = this.openProgress < 0.96;
    }
    if (this.curlPage) {
      this.updateCurl(eased);
    }

    const targetX = lerp(1.9, 0, eased);
    const targetY = lerp(0.16, 0.1, eased);
    this.cameraTarget.set(targetX, targetY, 0);
    this.camera.position.set(
      lerp(0.2, 0, eased),
      lerp(6.35, 8.9, eased),
      lerp(7.35, 8.9, eased)
    );
    this.camera.lookAt(this.cameraTarget);
  }

  setPointerParallax(x, y) {
    this.targetPointerX = THREE.MathUtils.clamp(x, -0.5, 0.5);
    this.targetPointerY = THREE.MathUtils.clamp(y, -0.5, 0.5);
  }

  rotateBy(dx, dy) {
    this.desiredYaw += dx * 0.006;
    this.desiredPitch = THREE.MathUtils.clamp(this.desiredPitch + dy * 0.003, -0.2, 0.2);
  }

  resetRotation() {
    this.desiredYaw = 0;
    this.desiredPitch = 0;
  }

  update(dt) {
    const alpha = 1 - Math.exp(-dt * 6);
    this.yaw += (this.desiredYaw - this.yaw) * alpha;
    this.pitch += (this.desiredPitch - this.pitch) * alpha;
    this.pointerX += (this.targetPointerX - this.pointerX) * alpha;
    this.pointerY += (this.targetPointerY - this.pointerY) * alpha;

    this.idleTime += dt;
    const closed = 1 - smooth(this.openProgress);
    const idleYaw =
      closed > 0.98 && Math.abs(this.desiredYaw) < 0.01
        ? Math.sin(this.idleTime * 0.35) * 0.045
        : 0;
    const parallaxYaw = closed * this.pointerX * 0.18;
    const parallaxPitch = closed * this.pointerY * 0.08;

    this.bookPivot.rotation.y = this.yaw + idleYaw + parallaxYaw;
    this.bookPivot.rotation.x = this.pitch + parallaxPitch;
    this.bookPivot.position.y = Math.sin(this.idleTime * 1.1) * 0.012 * closed;
  }

  updateCurl(eased) {
    const visible = this.openProgress > 0.025 && this.openProgress < 0.985;
    this.curlPage.visible = visible;
    if (!visible) return;

    this.curlPage.rotation.z = Math.PI * eased;
    this.curlPage.position.y = 0.1 + Math.sin(Math.PI * this.openProgress) * 0.06;

    const attribute = this.curlPage.geometry.attributes.position;
    const base = this.curlPage.userData.basePositions;
    const wave = Math.sin(Math.PI * this.openProgress);
    for (let i = 0; i < attribute.count; i += 1) {
      const x = base[i * 3];
      const u = x / 3.86;
      attribute.setY(i, Math.sin(Math.PI * u) * wave * 0.36);
    }
    attribute.needsUpdate = true;
    this.curlPage.geometry.computeVertexNormals();
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(renderer) {
    renderer.render(this.scene, this.camera);
  }
}
