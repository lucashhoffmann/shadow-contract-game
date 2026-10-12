import * as THREE from 'three';

import { bloodPoolGeometry } from '@/app/engine/renderers/world.renderer';

// area da malha: soma dos triangulos
function area(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex()!;
  const [a, b, c] = [0, 1, 2].map(() => new THREE.Vector3());
  let total = 0;
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(position, index.getX(i));
    b.fromBufferAttribute(position, index.getX(i + 1));
    c.fromBufferAttribute(position, index.getX(i + 2));
    total += new THREE.Triangle(a, b, c).getArea();
  }
  return total;
}

// maior e menor distancia do contorno ao centro
function reach(geometry: THREE.BufferGeometry): [number, number] {
  const position = geometry.getAttribute('position');
  const lengths = Array.from({ length: position.count }, (_, i) =>
    Math.hypot(position.getX(i), position.getY(i)),
  );
  return [Math.min(...lengths), Math.max(...lengths)];
}

describe('bloodPoolGeometry', () => {
  it('toda poca tem a area do circulo de raio 1', () => {
    for (const seed of [1, 2, 7, 42, 1337]) {
      expect(area(bloodPoolGeometry(seed))).toBeCloseTo(Math.PI, 1);
    }
  });

  it('nao e redonda: o contorno entra e sai do circulo', () => {
    for (const seed of [1, 2, 7, 42, 1337]) {
      const [inner, outer] = reach(bloodPoolGeometry(seed));
      expect(outer - inner).toBeGreaterThan(0.25);
      // sem pontas absurdas nem buracos
      expect(inner).toBeGreaterThan(0.35);
      expect(outer).toBeLessThan(1.7);
    }
  });

  it('cada seed da uma forma; a mesma seed, a mesma forma', () => {
    const points = (seed: number) =>
      Array.from(bloodPoolGeometry(seed).getAttribute('position').array);
    expect(points(5)).toEqual(points(5));
    expect(points(5)).not.toEqual(points(6));
  });
});
