import * as THREE from '/vendor/three/build/three.module.js';
import { OrbitControls } from '/vendor/three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const MM = 0.001;
const DEFAULT_COLORS = {
  alvenaria_branca: '#eae8df',
  mdf_areia: '#b8895d',
  mdf_cinza: '#6b7280',
  mdf_carvalho: '#a16d3a'
};

let state = null;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function count(value) {
  return Math.max(0, Math.round(number(value, 0)));
}

function colorFor(project, materialId) {
  const material = project?.materiais?.[materialId];
  return material?.pbr?.base_color || DEFAULT_COLORS[materialId] || '#a9b3aa';
}

function materialFor(project, materialId, options = {}) {
  return new THREE.MeshStandardMaterial({
    color: options.color || colorFor(project, materialId),
    roughness: number(options.roughness, project?.materiais?.[materialId]?.pbr?.roughness ?? 0.62),
    metalness: number(options.metalness, project?.materiais?.[materialId]?.pbr?.metallic ?? 0),
    transparent: Boolean(options.transparent),
    opacity: number(options.opacity, 1)
  });
}

function board(project, parent, materialId, size, position, options = {}) {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mesh = new THREE.Mesh(geometry, materialFor(project, materialId, options));
  mesh.position.set(position.x, position.y, position.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { kind: options.kind || 'board', material: materialId };
  parent.add(mesh);

  if (options.edges !== false) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: options.edgeColor || '#634733', transparent: true, opacity: 0.45 })
    );
    edges.position.copy(mesh.position);
    parent.add(edges);
  }

  return mesh;
}

function handle(parent, position, length, orientation = 'horizontal') {
  const geometry = new THREE.CylinderGeometry(0.004, 0.004, length, 12);
  const material = new THREE.MeshStandardMaterial({ color: '#4b4038', roughness: 0.32, metalness: 0.72 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position.x, position.y, position.z);
  mesh.rotation.z = orientation === 'horizontal' ? Math.PI / 2 : 0;
  mesh.rotation.x = orientation === 'vertical' ? Math.PI / 2 : 0;
  mesh.castShadow = true;
  mesh.userData = { kind: 'hardware', orientation };
  parent.add(mesh);
  return mesh;
}

function foot(parent, position) {
  const geometry = new THREE.CylinderGeometry(0.018, 0.022, 0.055, 16);
  const material = new THREE.MeshStandardMaterial({ color: '#3f4547', roughness: 0.48, metalness: 0.56 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position.x, position.y, position.z);
  mesh.castShadow = true;
  mesh.userData = { kind: 'foot' };
  parent.add(mesh);
  return mesh;
}

function reveal(parent, position, size) {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const material = new THREE.MeshBasicMaterial({ color: '#2b211b' });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position.x, position.y, position.z);
  mesh.userData = { kind: 'reveal' };
  parent.add(mesh);
  return mesh;
}

function createModule(project, module) {
  const group = new THREE.Group();
  const width = Math.max(number(module.largura, 600), 1) * MM;
  const depth = Math.max(number(module.profundidade, 600), 1) * MM;
  const height = Math.max(number(module.altura, 720), 1) * MM;
  const thickness = Math.max(number(module.espessura_chapa || module.espessura, 18), 1) * MM;
  const x = number(module.x, 0) * MM;
  const y = number(module.y, 0) * MM;
  const z = number(module.z, 0) * MM;
  const materialId = module.material || 'mdf_areia';
  const frontColor = new THREE.Color(colorFor(project, materialId));
  frontColor.offsetHSL(0, -0.02, 0.055);
  const frontColorHex = `#${frontColor.getHexString()}`;
  const innerWidth = Math.max(width - thickness * 2, thickness);
  const innerDepth = Math.max(depth - thickness, thickness);
  const innerHeight = Math.max(height - thickness * 2, thickness);
  const visualGap = Math.max(number(module.folga_porta, 6), 6) * MM;

  group.position.set(x, y, z);
  group.userData = { id: module.id, kind: 'module', type: module.tipo };

  board(project, group, materialId, { x: thickness, y: depth, z: height }, { x: thickness / 2, y: depth / 2, z: height / 2 }, { kind: 'side' });
  board(project, group, materialId, { x: thickness, y: depth, z: height }, { x: width - thickness / 2, y: depth / 2, z: height / 2 }, { kind: 'side' });
  board(project, group, materialId, { x: innerWidth, y: depth, z: thickness }, { x: width / 2, y: depth / 2, z: height - thickness / 2 }, { kind: 'top' });
  board(project, group, materialId, { x: innerWidth, y: depth, z: thickness }, { x: width / 2, y: depth / 2, z: thickness / 2 }, { kind: 'base' });
  board(project, group, materialId, { x: innerWidth, y: thickness, z: innerHeight }, { x: width / 2, y: thickness / 2, z: height / 2 }, { kind: 'back' });

  const shelves = count(module.prateleiras);
  for (let index = 0; index < shelves; index += 1) {
    const shelfZ = thickness + ((index + 1) * innerHeight) / (shelves + 1);
    board(project, group, materialId, { x: innerWidth, y: innerDepth, z: thickness }, { x: width / 2, y: thickness + innerDepth / 2, z: shelfZ }, { kind: 'shelf' });
  }

  const gap = visualGap;
  const doors = count(module.portas);
  const drawers = count(module.gavetas);
  const drawerZoneHeight = drawers > 0 && doors > 0 ? height * 0.38 : drawers > 0 ? height : 0;
  const doorZoneStart = drawers > 0 && doors > 0 ? drawerZoneHeight : 0;
  const doorZoneHeight = Math.max(height - doorZoneStart, thickness);

  if (doors > 0) {
    const doorWidth = Math.max((width - gap * (doors + 1)) / doors, thickness);
    const doorHeight = Math.max(doorZoneHeight - gap * 2, thickness);
    const doorZ = doorZoneStart + gap + doorHeight / 2;
    for (let index = 0; index <= doors; index += 1) {
      const separatorX = index === 0 ? gap / 2 : index === doors ? width - gap / 2 : gap + index * doorWidth + (index - 0.5) * gap;
      reveal(group, { x: separatorX, y: -thickness / 2 - visualGap - 0.002, z: doorZ }, { x: gap * 0.72, y: 0.004, z: doorHeight });
    }
    for (let index = 0; index < doors; index += 1) {
      const doorX = gap + doorWidth / 2 + index * (doorWidth + gap);
      board(project, group, materialId, { x: doorWidth, y: thickness, z: doorHeight }, { x: doorX, y: -thickness / 2 - visualGap / 2, z: doorZ }, { kind: 'door', color: frontColorHex, edgeColor: '#3d281d' });
      const handleX = index === 0 ? doorX + doorWidth * 0.78 : doorX + doorWidth * 0.22;
      handle(group, { x: handleX, y: -thickness * 1.35, z: doorZ }, Math.min(0.12, doorHeight * 0.36), 'vertical');
    }
  }

  if (drawers > 0) {
    const drawerHeight = drawerZoneHeight || height;
    const frontHeight = Math.max((drawerHeight - gap * (drawers + 1)) / drawers, thickness);
    for (let index = 0; index <= drawers; index += 1) {
      const separatorZ = index === 0 ? gap / 2 : index === drawers ? drawerHeight - gap / 2 : gap + index * frontHeight + (index - 0.5) * gap;
      reveal(group, { x: width / 2, y: -thickness / 2 - visualGap - 0.002, z: separatorZ }, { x: Math.max(width - gap * 2, thickness), y: 0.004, z: gap * 0.72 });
    }
    if (doors > 0) {
      reveal(group, { x: width / 2, y: -thickness / 2 - visualGap - 0.003, z: drawerZoneHeight }, { x: Math.max(width - gap * 2, thickness), y: 0.004, z: gap });
    }
    for (let index = 0; index < drawers; index += 1) {
      const frontZ = gap + frontHeight / 2 + index * (frontHeight + gap);
      const frontWidth = Math.max(width - gap * 2, thickness);
      board(project, group, materialId, { x: frontWidth, y: thickness, z: frontHeight }, { x: width / 2, y: -thickness / 2 - visualGap / 2, z: frontZ }, { kind: 'drawer-front', color: frontColorHex, edgeColor: '#3d281d' });
      handle(group, { x: width / 2, y: -thickness * 1.35, z: frontZ }, Math.min(0.14, frontWidth * 0.24), 'horizontal');

      const railDepth = Math.max(innerDepth * 0.86, thickness);
      board(project, group, materialId, { x: thickness, y: railDepth, z: Math.max(frontHeight - thickness, thickness) }, { x: thickness * 1.5, y: thickness + railDepth / 2, z: frontZ }, { kind: 'drawer-side', edges: false });
      board(project, group, materialId, { x: thickness, y: railDepth, z: Math.max(frontHeight - thickness, thickness) }, { x: width - thickness * 1.5, y: thickness + railDepth / 2, z: frontZ }, { kind: 'drawer-side', edges: false });
    }
  }

  const isBaseModule = /inferior|balcao_pia|gaveteiro/i.test(String(module.tipo || ''));
  if (isBaseModule) {
    const footInset = Math.min(width * 0.16, 0.08);
    const footZ = -0.028;
    foot(group, { x: footInset, y: depth * 0.18, z: footZ });
    foot(group, { x: width - footInset, y: depth * 0.18, z: footZ });
    foot(group, { x: footInset, y: depth * 0.82, z: footZ });
    foot(group, { x: width - footInset, y: depth * 0.82, z: footZ });
  }

  return { group, bounds: { x, y, z: Math.min(z - 0.06, z), width, depth, height: height + 0.06 } };
}

function addRoom(project, root) {
  const roomWidth = Math.max(number(project?.ambiente?.largura, 3200), 1) * MM;
  const roomDepth = Math.max(number(project?.ambiente?.profundidade, 800), 1) * MM;
  const wallHeight = Math.max(number(project?.ambiente?.pe_direito, 2700), 1) * MM;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomWidth, roomDepth),
    new THREE.MeshStandardMaterial({ color: '#e9e2d8', roughness: 0.9, metalness: 0 })
  );
  floor.position.set(roomWidth / 2, roomDepth / 2, -0.004);
  floor.receiveShadow = true;
  root.add(floor);

  const grid = new THREE.GridHelper(Math.max(roomWidth, roomDepth), 16, '#b8aa9a', '#d8cec1');
  grid.rotation.x = Math.PI / 2;
  grid.position.set(roomWidth / 2, roomDepth / 2, 0);
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  root.add(grid);

  for (const wall of project.paredes || []) {
    const wallWidth = Math.max(number(wall.largura || wall.comprimento, roomWidth / MM), 1) * MM;
    const wallDepth = Math.max(number(wall.espessura, 120), 1) * MM;
    const wallHeightValue = Math.max(number(wall.altura, wallHeight / MM), 1) * MM;
    const wallMesh = new THREE.Mesh(
      new THREE.BoxGeometry(wallWidth, wallDepth, wallHeightValue),
      materialFor(project, wall.material || 'alvenaria_branca', { transparent: true, opacity: 0.3, roughness: 0.9 })
    );
    wallMesh.position.set(number(wall.x, 0) * MM + wallWidth / 2, number(wall.y, 0) * MM + wallDepth / 2, wallHeightValue / 2);
    wallMesh.receiveShadow = true;
    root.add(wallMesh);
  }

  return { width: roomWidth, depth: roomDepth, height: wallHeight };
}

function disposeSceneObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose());
    } else if (child.material) {
      child.material.dispose();
    }
  });
}

function fitCamera(bounds) {
  if (!state) return;
  const maxRoom = Math.max(bounds.width, bounds.depth, bounds.height, 1);
  const centerX = number(bounds.centerX, bounds.width / 2);
  const centerY = number(bounds.centerY, bounds.depth / 2);
  const centerZ = number(bounds.centerZ, Math.min(bounds.height * 0.35, maxRoom * 0.55));
  const target = new THREE.Vector3(centerX, centerY, centerZ);
  state.controls.target.copy(target);
  state.camera.position.set(centerX + maxRoom * 1.05, centerY - maxRoom * 1.15, centerZ + maxRoom * 0.82);
  state.camera.near = Math.max(maxRoom / 1000, 0.001);
  state.camera.far = maxRoom * 8;
  state.camera.updateProjectionMatrix();
  state.controls.maxDistance = maxRoom * 4;
  state.controls.update();
}

function init() {
  const container = document.getElementById('hybridViewer');
  if (!container) return;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f3efe8');
  const camera = new THREE.PerspectiveCamera(42, 1, 0.001, 100);
  camera.up.set(0, 0, 1);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.25;
  controls.maxPolarAngle = Math.PI * 0.49;

  scene.add(new THREE.HemisphereLight('#fffaf2', '#8e7d6d', 2.1));
  const key = new THREE.DirectionalLight('#fff8ec', 3.2);
  key.position.set(3, -4, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#dce9ff', 1.3);
  fill.position.set(-3, 2, 2);
  scene.add(fill);

  const root = new THREE.Group();
  scene.add(root);
  state = { container, scene, camera, renderer, controls, root };

  const resize = () => {
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 280);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  container.dataset.ready = 'true';
  const status = document.getElementById('hybridViewerStatus');
  if (status) status.textContent = 'Three.js · cena híbrida online';

  window.hybridViewer = { renderProject, exportGlb, sceneStats };
  window.dispatchEvent(new CustomEvent('hybrid-viewer-ready'));
}

function sceneStats() {
  const counts = {};
  if (!state) return counts;
  state.root.traverse((object) => {
    const kind = object.userData?.kind;
    if (kind) counts[kind] = (counts[kind] || 0) + 1;
  });
  return counts;
}

function exportGlb() {
  if (!state) return Promise.reject(new Error('Viewer híbrido ainda não está pronto.'));
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(state.root, (result) => resolve(result), (error) => reject(error), {
      binary: true,
      onlyVisible: true,
      trs: false
    });
  });
}

function renderProject(project, parts = []) {
  if (!state || !project) return;
  for (const child of state.root.children) disposeSceneObject(child);
  state.root.clear();
  const room = addRoom(project, state.root);
  const modules = Array.isArray(project.modulos) ? project.modulos : [];
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const module of modules) {
    const built = createModule(project, module);
    state.root.add(built.group);
    minX = Math.min(minX, built.bounds.x);
    minY = Math.min(minY, built.bounds.y);
    minZ = Math.min(minZ, built.bounds.z);
    maxX = Math.max(maxX, built.bounds.x + built.bounds.width);
    maxY = Math.max(maxY, built.bounds.y + built.bounds.depth);
    maxZ = Math.max(maxZ, built.bounds.z + built.bounds.height);
  }

  const hasModules = modules.length > 0;
  const focusWidth = hasModules ? Math.max(maxX - minX, room.width * 0.45) : room.width;
  const focusDepth = hasModules ? Math.max(maxY - minY, room.depth * 0.45) : room.depth;
  const focusHeight = hasModules ? Math.max(maxZ - minZ, room.height * 0.28) : room.height;
  const focusMinX = hasModules ? minX : 0;
  const focusMinY = hasModules ? minY : 0;
  const focusMinZ = hasModules ? minZ : 0;

  state.root.userData = { project, parts, adapter: 'three-hybrid-viewer' };
  fitCamera({
    width: focusWidth,
    depth: focusDepth,
    height: focusHeight,
    centerX: focusMinX + focusWidth / 2,
    centerY: focusMinY + focusDepth / 2,
    centerZ: focusMinZ + focusHeight / 2
  });
  const status = document.getElementById('hybridViewerStatus');
  if (status) status.textContent = `Three.js · ${modules.length} módulo${modules.length === 1 ? '' : 's'}`;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
