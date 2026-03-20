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

/** Creates grid lines on a plane (returns a Group of LineSegments) */
function createGridLines(
  w: number, h: number, stepsW: number, stepsH: number,
  color: number, opacity: number
): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });

  // Vertical lines
  for (let i = 0; i <= stepsW; i++) {
    const x = (i / stepsW) * w - w / 2;
    const points = [new THREE.Vector3(x, -h / 2, 0), new THREE.Vector3(x, h / 2, 0)];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    group.add(new THREE.Line(geo, mat));
  }
  // Horizontal lines
  for (let i = 0; i <= stepsH; i++) {
    const y = (i / stepsH) * h - h / 2;
    const points = [new THREE.Vector3(-w / 2, y, 0), new THREE.Vector3(w / 2, y, 0)];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    group.add(new THREE.Line(geo, mat));
  }
  return group;
}

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
    const cx = w / 2 - 0.5;
    const cy = h / 2 - 0.5;
    const cz = d / 2 - 0.5;

    // Well wireframe edges — bright
    const boxGeo = new THREE.BoxGeometry(w, h, d);
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x88aaee,
      transparent: true,
      opacity: 0.8,
    });
    const wireframe = new THREE.LineSegments(edgesGeo, lineMat);
    wireframe.position.set(cx, cy, cz);
    group.add(wireframe);

    // ── FLOOR ──
    // Bright glowing floor grid
    const grid = new THREE.GridHelper(Math.max(w, d), Math.max(w, d), 0x88bbff, 0x6699dd);
    grid.position.set(cx, -0.5, cz);
    group.add(grid);

    // Solid lit floor plane
    const floorGeo = new THREE.PlaneGeometry(w, d);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x334466,
      emissive: 0x223355,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.7,
      metalness: 0.2,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, -0.5, cz);
    floor.receiveShadow = true;
    group.add(floor);

    // ── WALLS (4 sides with grid lines) ──
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2a3555,
      emissive: 0x1a2540,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.15,
      metalness: 0.1,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });

    // Back wall (z = -0.5)
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    backWall.position.set(cx, cy, -0.5);
    group.add(backWall);
    const backGrid = createGridLines(w, h, w, h, 0x5577bb, 0.25);
    backGrid.position.set(cx, cy, -0.49);
    group.add(backGrid);

    // Front wall (z = d - 0.5)
    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    frontWall.position.set(cx, cy, d - 0.5);
    frontWall.rotation.y = Math.PI;
    group.add(frontWall);
    const frontGrid = createGridLines(w, h, w, h, 0x5577bb, 0.25);
    frontGrid.position.set(cx, cy, d - 0.49);
    frontGrid.rotation.y = Math.PI;
    group.add(frontGrid);

    // Left wall (x = -0.5)
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(d, h), wallMat);
    leftWall.position.set(-0.5, cy, cz);
    leftWall.rotation.y = Math.PI / 2;
    group.add(leftWall);
    const leftGrid = createGridLines(d, h, d, h, 0x5577bb, 0.25);
    leftGrid.position.set(-0.49, cy, cz);
    leftGrid.rotation.y = Math.PI / 2;
    group.add(leftGrid);

    // Right wall (x = w - 0.5)
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(d, h), wallMat);
    rightWall.position.set(w - 0.5, cy, cz);
    rightWall.rotation.y = -Math.PI / 2;
    group.add(rightWall);
    const rightGrid = createGridLines(d, h, d, h, 0x5577bb, 0.25);
    rightGrid.position.set(w - 0.49, cy, cz);
    rightGrid.rotation.y = -Math.PI / 2;
    group.add(rightGrid);

    return group;
  }

  static getColor(colorId: number): number {
    return COLOR_MAP[colorId] ?? 0xffffff;
  }
}
