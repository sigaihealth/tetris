import * as THREE from 'three';

const COLOR_MAP: Record<number, number> = {
  1: 0x00bfff,
  2: 0xffd700,
  3: 0xda70d6,
  4: 0x00ff7f,
  5: 0xff4757,
  6: 0xff8c00,
  7: 0x4169e1,
  8: 0xff69b4,
};

// Shared geometries
const blockGeometry = new THREE.BoxGeometry(0.92, 0.92, 0.92);
const edgeBox = new THREE.BoxGeometry(0.96, 0.96, 0.96);
const edgesGeometry = new THREE.EdgesGeometry(edgeBox);

export class BlockMesh {
  static createBlock(colorId: number): THREE.Group {
    const group = new THREE.Group();
    const color = COLOR_MAP[colorId] ?? 0xffffff;

    // Glass cube
    const material = new THREE.MeshPhysicalMaterial({
      color,
      transmission: 0.85,
      roughness: 0.1,
      thickness: 0.5,
      ior: 1.5,
      clearcoat: 1.0,
    });
    const mesh = new THREE.Mesh(blockGeometry, material);
    group.add(mesh);

    // Edge wireframe
    const edgeMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
    });
    const edges = new THREE.LineSegments(edgesGeometry, edgeMaterial);
    group.add(edges);

    return group;
  }

  static createGhostBlock(): THREE.Group {
    const group = new THREE.Group();

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
    });
    const edges = new THREE.LineSegments(edgesGeometry, edgeMaterial);
    group.add(edges);

    return group;
  }

  static createWellFrame(w: number, d: number, h: number): THREE.Group {
    const group = new THREE.Group();

    // Wireframe box around the well
    const boxGeo = new THREE.BoxGeometry(w, h, d);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x444466,
      transparent: true,
      opacity: 0.5,
    });
    const wireframe = new THREE.LineSegments(edgesGeo, lineMat);
    wireframe.position.set(w / 2 - 0.5, h / 2 - 0.5, d / 2 - 0.5);
    group.add(wireframe);

    // Grid at floor
    const grid = new THREE.GridHelper(Math.max(w, d), Math.max(w, d), 0x333355, 0x222244);
    grid.position.set(w / 2 - 0.5, -0.5, d / 2 - 0.5);
    group.add(grid);

    return group;
  }

  static getColor(colorId: number): number {
    return COLOR_MAP[colorId] ?? 0xffffff;
  }
}
