import * as THREE from 'three';
import { seededRandom, ENEMIES } from './core.js';

export function worldToScene(x, y, world) {
  return { x: x - world.width / 2, z: y - world.height / 2 };
}

export function sceneToWorld(x, z, world) {
  return { x: x + world.width / 2, y: z + world.height / 2 };
}

export class Renderer {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#161b15');
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20000);
    this.camera.up.set(0, 1, 0);
    this.ambient = new THREE.HemisphereLight('#d9e3ce', '#40372a', 2.2);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight('#fff0d3', 3.2);
    this.sun.position.set(-900, 1500, 800);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -1400;
    this.sun.shadow.camera.right = 1400;
    this.sun.shadow.camera.top = 1400;
    this.sun.shadow.camera.bottom = -1400;
    this.scene.add(this.sun);
    this.staticRoot = new THREE.Group();
    this.dynamicRoot = new THREE.Group();
    this.scene.add(this.staticRoot, this.dynamicRoot);
    this.dynamic = new Map();
    this.visible = new Set();
    this.cursorKey = {};
    this.materials = new Map();
    this.geometries = {
      box: new THREE.BoxGeometry(1, 1, 1),
      sphere: new THREE.SphereGeometry(1, 14, 10),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
      cone: new THREE.ConeGeometry(1, 1, 8),
      rock: new THREE.DodecahedronGeometry(1, 0),
      ring: new THREE.TorusGeometry(1, 0.07, 6, 32),
    };
    this.raycaster = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hit = new THREE.Vector3();
    this.ndc = new THREE.Vector2();
  }

  material(color, roughness = 0.88, emissive = '#000000') {
    const key = `${color}/${roughness}/${emissive}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({
      color, roughness, emissive, emissiveIntensity: emissive === '#000000' ? 0 : 0.8,
    }));
    return this.materials.get(key);
  }

  addMesh(parent, geometry, color, x, y, z, sx, sy, sz, options = {}) {
    const mesh = new THREE.Mesh(geometry, this.material(color, options.roughness, options.emissive));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = options.shadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    parent.add(mesh);
    return mesh;
  }

  box(parent, x, y, z, sx, sy, sz, color, options) {
    return this.addMesh(parent, this.geometries.box, color, x, y, z, sx, sy, sz, options);
  }

  resize(world, rect, map) {
    this.world = { ...world };
    this.rect = { width: rect.width, height: rect.height };
    const ratio = Math.min(window.devicePixelRatio || 1, this.settings.effects ? 1.6 : 1);
    this.gl.setPixelRatio(ratio);
    this.gl.setSize(rect.width, rect.height, false);
    this.setMap(map);
    this.setCamera({ x: 0, y: 0, zoom: 1 }, world);
  }

  setMap(map) {
    this.map = map;
    this.staticRoot.clear();
    const { width: W, height: H } = this.world;
    const color = map.colors[1];
    this.scene.background.set(color);

    const outer = new THREE.Mesh(new THREE.PlaneGeometry(W * 4, H * 4), this.material(map.colors[0]));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.12;
    outer.receiveShadow = true;
    this.staticRoot.add(outer);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), this.material(color));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.staticRoot.add(ground);

    const roadColor = map.layout === 'valley' ? '#3d5143' : '#655e48';
    const addRoad = (x1, y1, x2, y2, width) => {
      const a = worldToScene(x1, y1, this.world), b = worldToScene(x2, y2, this.world);
      const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
      const road = this.box(this.staticRoot, (a.x + b.x) / 2, 0.025, (a.z + b.z) / 2,
        length, 0.035, width, roadColor, { shadow: false });
      road.rotation.y = Math.atan2(-dz, dx);
      const center = this.box(this.staticRoot, (a.x + b.x) / 2, 0.047, (a.z + b.z) / 2,
        length, 0.012, 0.12, '#a99a6b', { shadow: false });
      center.rotation.y = road.rotation.y;
    };
    if (map.layout === 'valley') {
      addRoad(W * 0.05, H * 0.72, W * 0.95, H * 0.34, 72);
      addRoad(W * 0.2, H * 0.12, W * 0.76, H * 0.88, 42);
    } else if (map.layout === 'canyon') {
      addRoad(W * 0.16, H * 0.82, W * 0.84, H * 0.2, 68);
      addRoad(W * 0.12, H * 0.28, W * 0.86, H * 0.72, 34);
    } else {
      addRoad(W * 0.05, H * 0.7, W * 0.94, H * 0.3, 74);
      addRoad(W * 0.75, H * 0.08, W * 0.32, H * 0.88, 38);
    }

    const random = seededRandom(map.seed);
    for (let i = 0; i < 145; i++) {
      const x = random() * W, y = random() * H;
      const pos = worldToScene(x, y, this.world);
      const size = 4 + random() * 10;
      if (random() > 0.48) {
        this.addMesh(this.staticRoot, this.geometries.rock, '#56604a', pos.x, size * 0.22, pos.z,
          size, size * 0.48, size * 0.8);
      } else {
        this.addMesh(this.staticRoot, this.geometries.sphere, '#596748', pos.x, size * 0.3, pos.z,
          size * 0.72, size * 0.35, size * 0.65, { shadow: false });
      }
    }

    const sites = map.layout === 'valley'
      ? [[.78, .76, .9], [.38, .24, .65], [.17, .7, .52]]
      : map.layout === 'canyon'
        ? [[.72, .25, .9], [.53, .82, .7], [.17, .32, .52]]
        : [[.8, .2, .9], [.14, .8, .7], [.52, .3, .58]];
    for (const [px, py, scale] of sites) this.compound(W * px, H * py, scale);

    const helipad = worldToScene(W * 0.35, H * 0.37, this.world);
    this.box(this.staticRoot, helipad.x, 0.014, helipad.z, 170, 0.015, 142, '#747764', { shadow: false });
    this.addMesh(this.staticRoot, this.geometries.ring, '#c6c79c', helipad.x, 0.035, helipad.z,
      47, 1, 47, { shadow: false });
  }

  compound(x, y, scale) {
    const p = worldToScene(x, y, this.world);
    this.box(this.staticRoot, p.x, 0.13, p.z, 175 * scale, 0.1, 150 * scale, '#343d32', { shadow: false });
    for (const [dx, dz, w, h, color] of [
      [-35, -22, 72, 42, '#78806b'], [35, -16, 50, 64, '#727c68'], [-47, 35, 44, 50, '#68735f'],
    ]) {
      this.box(this.staticRoot, p.x + dx * scale, h * scale / 2 + 0.17, p.z + dz * scale,
        w * scale, h * scale, 48 * scale, color);
      this.box(this.staticRoot, p.x + dx * scale, h * scale + 0.19, p.z + dz * scale,
        w * scale * 1.04, 5 * scale, 51 * scale, '#a0a184');
    }
  }

  setCamera(cameraState, world = this.world) {
    if (!world || !this.rect) return;
    const { width: W, height: H } = world;
    const aspect = this.rect.width / Math.max(1, this.rect.height);
    const diagonal = (W + H) / Math.SQRT2;
    const viewWidth = Math.max(diagonal * 1.1, diagonal * 0.64 * aspect);
    const viewHeight = viewWidth / aspect;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.zoom = cameraState.zoom;
    this.camera.updateProjectionMatrix();
    const cx = cameraState.x + W / (2 * cameraState.zoom);
    const cy = cameraState.y + H / (2 * cameraState.zoom);
    const target = worldToScene(cx, cy, world);
    const distance = Math.max(W, H) * 1.6;
    this.camera.position.set(target.x + distance, distance, target.z + distance);
    this.camera.lookAt(target.x, 0, target.z);
    this.camera.updateMatrixWorld();
  }

  screenToWorld(screenX, screenY) {
    this.ndc.set(screenX * 2 - 1, -screenY * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.ground, this.hit)) return { x: 0, y: 0 };
    return sceneToWorld(this.hit.x, this.hit.z, this.world);
  }

  newDynamic(item, create) {
    let group = this.dynamic.get(item);
    if (!group) {
      group = new THREE.Group();
      this.dynamic.set(item, group);
      this.dynamicRoot.add(group);
      create(group);
    }
    this.visible.add(item);
    return group;
  }

  makeHelicopter(group) {
    this.box(group, 0, 0.7, 0, 35, 13, 51, '#687a62');
    this.box(group, 0, 0.9, 8, 24, 11, 23, '#9ba689');
    this.box(group, 0, 0.91, 16, 19, 7, 12, '#334e48', { roughness: 0.3 });
    this.box(group, 0, 0.75, -48, 7, 7, 52, '#798a70');
    this.box(group, 0, 0.7, -78, 4, 3, 16, '#8e9a7e');
    this.box(group, -10, 0.36, 1, 3, 4, 55, '#343f35');
    this.box(group, 10, 0.36, 1, 3, 4, 55, '#343f35');
    this.box(group, 0, 1.42, 0, 4, 2, 77, '#343f35');
    const muzzle = this.addMesh(group, this.geometries.sphere, '#fff0a4', 0, 0.95, 31, 5, 3, 5,
      { emissive: '#ffb331', shadow: false });
    muzzle.visible = false;
    group.userData.muzzle = muzzle;
    const rotor = new THREE.Group();
    rotor.position.y = 1.62;
    this.box(rotor, 0, 0, 0, 4, 1, 86, '#d4d7bf');
    this.box(rotor, 0, 0, 0, 86, 1, 4, '#d4d7bf');
    group.add(rotor);
    group.userData.rotor = rotor;
  }

  makeEnemy(group, type) {
    if (type === 'drone' || type === 'kamikaze') {
      const color = type === 'kamikaze' ? '#cb6f4f' : '#9d9a72';
      this.box(group, 0, 0.8, 0, 16, 7, 20, color);
      for (const [x, z] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) {
        this.box(group, x / 2, 0.56, z / 2, 3, 2, 3, '#4b5546');
        this.addMesh(group, this.geometries.sphere, '#303c31', x, 0.58, z, 7, 2, 7);
        this.box(group, x, 0.66, z, 17, 1, 2, '#c6c7ad', { shadow: false });
      }
      this.addMesh(group, this.geometries.sphere, '#ed9d68', 7, 0.9, 0, 3, 2, 3, { emissive: '#a34219' });
      return;
    }
    const boss = type === 'boss';
    const bodyColor = boss ? '#77795d' : '#747c63';
    this.box(group, 0, 0.55, 0, boss ? 76 : 48, 18, boss ? 88 : 58, bodyColor);
    for (const side of [-1, 1]) {
      this.box(group, side * 26, 0.31, 0, 9, 8, boss ? 100 : 68, '#343c32');
      for (let z = -32; z < 34; z += 13) this.box(group, side * 26, 0.32, z, 5, 6, 4, '#a4a17a');
    }
    this.box(group, 0, 0.95, -2, boss ? 45 : 28, 12, boss ? 46 : 34, '#8d9270');
    this.box(group, 0, 1.16, -8, 10, 2, 16, '#b7b68a');
    const turret = new THREE.Group();
    turret.position.set(0, 1.3, 0);
    this.box(turret, 0, 0, 0, 17, 8, 20, '#a29e76');
    this.box(turret, 0, 0, 20, 5, 4, type === 'artillery' || boss ? 48 : 34, '#b9b08a');
    group.add(turret);
    group.userData.turret = turret;
  }

  label(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.font = 'bold 42px monospace';
    context.textAlign = 'center';
    context.lineWidth = 8;
    context.strokeStyle = '#10150f';
    context.fillStyle = color;
    context.strokeText(text, 256, 78);
    context.fillText(text, 256, 78);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(74, 19, 1);
    return sprite;
  }

  draw(g, dt) {
    this.setCamera(g.camera, g.world);
    this.visible.clear();
    for (const decal of g.decals) {
      const group = this.newDynamic(decal, obj => {
        this.box(obj, 0, 0.08, 0, 28, 0.03, 22, '#25271f', { shadow: false });
        this.box(obj, 0, 0.1, 0, 18, 0.035, 13, '#493e31', { shadow: false });
      });
      const pos = worldToScene(decal.x, decal.y, g.world);
      group.position.set(pos.x, 0, pos.z);
      group.rotation.y = -decal.angle;
      group.scale.setScalar(decal.size / 26);
    }
    for (const wreck of g.wreckSmoke) {
      const group = this.newDynamic(wreck, obj => {
        for (let i = 0; i < 3; i++) this.addMesh(obj, this.geometries.sphere, '#343a31',
          (i - 1) * 5, 4 + i * 7, (i % 2) * 4, 1, 1, 1, { shadow: false });
      });
      const pos = worldToScene(wreck.x, wreck.y, g.world);
      group.position.set(pos.x, 0, pos.z);
      const pulse = 0.85 + Math.sin(g.visualTime * 2 + wreck.timer) * 0.08;
      group.scale.setScalar(pulse);
      group.children.forEach((smoke, i) => smoke.scale.set(8 + i * 2, 7 + i * 3, 8 + i * 2));
    }
    for (const pickup of g.pickups) {
      const group = this.newDynamic(pickup, obj => {
        this.box(obj, 0, 0.5, 0, 20, 12, 20, '#26391e');
        this.box(obj, 0, 0.53, 0, 5, 14, 2, '#d9e99b', { emissive: '#879b36' });
        this.box(obj, 0, 0.53, 0, 14, 5, 2, '#d9e99b', { emissive: '#879b36' });
      });
      const pos = worldToScene(pickup.x, pickup.y, g.world);
      group.position.set(pos.x, Math.sin(g.visualTime * 3 + pickup.x) * 2, pos.z);
      group.rotation.y += dt * 0.5;
    }
    for (const enemy of g.enemies) {
      const group = this.newDynamic(enemy, obj => this.makeEnemy(obj, enemy.type));
      const pos = worldToScene(enemy.x, enemy.y, g.world);
      group.position.set(pos.x, 0, pos.z);
      group.rotation.y = Math.PI / 2 - enemy.angle;
      group.scale.setScalar(ENEMIES[enemy.type].scale);
      if (group.userData.turret) group.userData.turret.rotation.y = enemy.angle - enemy.turret;
    }
    for (const bullet of g.bullets) {
      const group = this.newDynamic(bullet, obj => {
        const color = bullet.friendly ? '#f0d98f' : '#ed9872';
        const rocket = bullet.kind === 'rocket' || bullet.kind === 'enemyRocket';
        const mesh = this.addMesh(obj, rocket ? this.geometries.cone : this.geometries.sphere,
          color, 0, 0, 0, bullet.kind === 'rocket' || bullet.kind === 'enemyRocket' ? 2 : 1.8,
          rocket ? 10 : 1.8,
          rocket ? 2 : 1.8,
          { emissive: color });
        if (rocket) mesh.rotation.x = Math.PI / 2;
      });
      const pos = worldToScene(bullet.x, bullet.y, g.world);
      group.position.set(pos.x, 0.75, pos.z);
      group.rotation.y = Math.atan2(bullet.vx, bullet.vy);
    }
    for (const warning of g.warnings) {
      const group = this.newDynamic(warning, obj => {
        const ring = this.addMesh(obj, this.geometries.ring, '#f2ad71', 0, 0.12, 0, 1, 1, 1, { emissive: '#b55b22', shadow: false });
        ring.rotation.x = Math.PI / 2;
        this.box(obj, 0, 0.12, 0, 2, 0.04, 22, '#f2ad71', { emissive: '#b55b22', shadow: false });
        this.box(obj, 0, 0.12, 0, 22, 0.04, 2, '#f2ad71', { emissive: '#b55b22', shadow: false });
      });
      const pos = worldToScene(warning.x, warning.y, g.world);
      group.position.set(pos.x, 0, pos.z);
      group.scale.setScalar(warning.radius / 22);
      group.visible = Math.sin(g.visualTime * 9) > -0.1;
    }
    if (g.player.health > 0) {
      const player = g.player;
      const group = this.newDynamic(player, obj => this.makeHelicopter(obj));
      const pos = worldToScene(player.x, player.y, g.world);
      group.position.set(pos.x, 0, pos.z);
      group.rotation.set(player.pitch * 0.35, Math.PI / 2 - player.angle, player.bank * 0.35);
      group.userData.rotor.rotation.y = g.visualTime * 42;
      group.userData.muzzle.visible = player.muzzle > 0;
      group.visible = !(player.invulnerable > 0 && Math.floor(g.visualTime * 18) % 2 === 0);
    }
    if (g.state === 'playing' && !g.touch) {
      const cursor = this.newDynamic(this.cursorKey, group => {
        const ring = this.addMesh(group, this.geometries.ring, '#e8edbd', 0, 0.16, 0, 12, 1, 12,
          { shadow: false, emissive: '#717d3a' });
        ring.rotation.x = Math.PI / 2;
        this.box(group, 0, 0.16, 0, 40, 0.025, 1, '#e8edbd', { shadow: false });
        this.box(group, 0, 0.16, 0, 1, 0.025, 40, '#e8edbd', { shadow: false });
      });
      const pos = worldToScene(g.pointer.x, g.pointer.y, g.world);
      cursor.position.set(pos.x, 0, pos.z);
    }
    for (const particle of g.particles) {
      const group = this.newDynamic(particle, obj => this.addMesh(obj,
        particle.smoke ? this.geometries.sphere : this.geometries.box, particle.color, 0, 0, 0, 1, 1, 1,
        { shadow: false, emissive: particle.smoke ? '#000000' : particle.color }));
      const pos = worldToScene(particle.x, particle.y, g.world);
      const fade = Math.max(0, particle.life / particle.maxLife);
      group.position.set(pos.x, 0.5 + (1 - fade) * 9, pos.z);
      group.scale.setScalar(Math.max(0.02, particle.size * (particle.smoke ? 1.2 : 0.6) * fade));
      group.rotation.y = Math.atan2(particle.vx, particle.vy);
    }
    for (const explosion of g.explosions) {
      const group = this.newDynamic(explosion, obj => {
        const ring = this.addMesh(obj, this.geometries.ring, '#f4c27a', 0, 1, 0, 1, 1, 1, { emissive: '#bd4d21' });
        ring.rotation.x = Math.PI / 2;
      });
      const pos = worldToScene(explosion.x, explosion.y, g.world);
      const progress = 1 - explosion.life / explosion.maxLife;
      group.position.set(pos.x, 0, pos.z);
      group.scale.setScalar(Math.max(0.01, explosion.size * progress));
      group.children[0].material = this.material('#f4c27a', 0.5, '#bd4d21');
    }
    for (const floater of g.floaters) {
      const group = this.newDynamic(floater, obj => {
        const sprite = this.label(floater.text, floater.color);
        obj.add(sprite);
        obj.userData.sprite = sprite;
      });
      const pos = worldToScene(floater.x, floater.y, g.world);
      group.position.set(pos.x, 28 + (1 - floater.life) * 28, pos.z);
      group.scale.setScalar(floater.big ? 1.2 : 0.75);
      group.userData.sprite.material.opacity = Math.max(0, floater.life);
    }

    for (const [item, group] of this.dynamic) {
      if (!this.visible.has(item)) {
        this.dynamicRoot.remove(group);
        this.dynamic.delete(item);
      }
    }
    this.gl.render(this.scene, this.camera);
  }
}
