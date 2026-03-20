import * as THREE from 'three';

// Bright, high-contrast colors for glass blocks
const COLOR_MAP: Record<number, number> = {
  1: 0x00e5ff, // I — vivid cyan
  2: 0xffea00, // O — vivid yellow
  3: 0xe040fb, // T — vivid magenta
  4: 0x00e676, // S — vivid green
  5: 0xff1744, // Z — vivid red
  6: 0xff9100, // L — vivid orange
  7: 0x448aff, // J — vivid blue
  8: 0xff4081, // Tower — vivid pink
};

// Shared geometries
const blockGeometry = new THREE.BoxGeometry(0.92, 0.92, 0.92);
const edgeBox = new THREE.BoxGeometry(0.96, 0.96, 0.96);
const edgesGeometry = new THREE.EdgesGeometry(edgeBox);

// Cached materials per color (glass is expensive to create)
const glassMaterials = new Map<number, THREE.MeshPhysicalMaterial>();
const edgeMaterials = new Map<number, THREE.LineBasicMaterial>();

function getGlassMaterial(colorId: number): THREE.MeshPhysicalMaterial {
  let mat = glassMaterials.get(colorId);
  if (!mat) {
    const color = COLOR_MAP[colorId] ?? 0xffffff;
    mat = new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      transmission: 0.4,
      roughness: 0.05,
      thickness: 1.0,
      ior: 1.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      side: THREE.DoubleSide,
      envMapIntensity: 2.0,
      emissive: color,
      emissiveIntensity: 0.15,
    });
    glassMaterials.set(colorId, mat);
  }
  return mat;
}

function getEdgeMaterial(colorId: number): THREE.LineBasicMaterial {
  let mat = edgeMaterials.get(colorId);
  if (!mat) {
    const color = COLOR_MAP[colorId] ?? 0xffffff;
    mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
    });
    edgeMaterials.set(colorId, mat);
  }
  return mat;
}

const ghostEdgeMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.35,
});

export class BlockMesh {
  static createBlock(colorId: number): THREE.Group {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(blockGeometry, getGlassMaterial(colorId));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    group.add(new THREE.LineSegments(edgesGeometry, getEdgeMaterial(colorId)));
    return group;
  }

  static createGhostBlock(): THREE.Group {
    const group = new THREE.Group();
    group.add(new THREE.LineSegments(edgesGeometry, ghostEdgeMaterial));
    return group;
  }

  static createWellFrame(w: number, d: number, h: number): THREE.Group {
    const group = new THREE.Group();

    // Well wireframe edges — brighter
    const boxGeo = new THREE.BoxGeometry(w, h, d);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x6688cc,
      transparent: true,
      opacity: 0.7,
    });
    const wireframe = new THREE.LineSegments(edgesGeo, lineMat);
    wireframe.position.set(w / 2 - 0.5, h / 2 - 0.5, d / 2 - 0.5);
    group.add(wireframe);

    // Bright glowing floor grid
    const grid = new THREE.GridHelper(Math.max(w, d), Math.max(w, d), 0x6688ff, 0x4466cc);
    grid.position.set(w / 2 - 0.5, -0.5, d / 2 - 0.5);
    group.add(grid);

    // Solid floor plane for visibility (slightly transparent)
    const floorGeo = new THREE.PlaneGeometry(w, d);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x2233558,
      transparent: true,
      opacity: 0.4,
      metalness: 0.3,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(w / 2 - 0.5, -0.5, d / 2 - 0.5);
    floor.receiveShadow = true;
    group.add(floor);

    return group;
  }

  static getColor(colorId: number): number {
    return COLOR_MAP[colorId] ?? 0xffffff;
  }
}
