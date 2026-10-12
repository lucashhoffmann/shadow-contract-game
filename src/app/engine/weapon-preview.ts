import * as THREE from 'three';

import {
  createWeaponModel,
  type WeaponModelId,
} from '@/app/engine/renderers/weapon.renderer';

// Foto de cada arma para o HUD: desenha uma vez num canvas fora da tela e
// devolve data URLs. A UI mostra como <img>, sem tocar em three.

const WIDTH = 384;
const HEIGHT = 192;
const ASPECT = WIDTH / HEIGHT;
// quase de lado, um pouco de cima e de frente, para dar volume
const TILT = 0.22;
const TURN = -0.25;
// compensa a queda que TILT + TURN dao ao cano: ele fica na horizontal
const ROLL = Math.atan(Math.sin(-TURN) * Math.tan(TILT));
const MARGIN = 1.06;

export function renderWeaponPreviews(): Record<WeaponModelId, string> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(WIDTH, HEIGHT, false);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-2, 6, 5);
  scene.add(sun);

  const camera = new THREE.OrthographicCamera();
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  const shoot = (id: WeaponModelId): string => {
    const model = createWeaponModel(id);
    model.root.rotation.set(TILT, TURN, ROLL);
    scene.add(model.root);
    // enquadra a arma inteira, qualquer que seja o tamanho do modelo
    box.setFromObject(model.root);
    box.getCenter(center);
    box.getSize(size);
    const half = Math.max(size.x / 2, (size.y / 2) * ASPECT) * MARGIN;
    camera.left = -half;
    camera.right = half;
    camera.top = half / ASPECT;
    camera.bottom = -half / ASPECT;
    camera.near = 0.1;
    camera.far = size.z + 20;
    camera.position.set(center.x, center.y, box.max.z + 10);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL();
    scene.remove(model.root);
    model.dispose();
    return url;
  };

  const previews = {
    sword: shoot('sword'),
    pistol: shoot('pistol'),
    silenced: shoot('silenced'),
    shotgun: shoot('shotgun'),
    ammo: shoot('ammo'),
  };
  renderer.dispose();
  renderer.forceContextLoss();
  return previews;
}
