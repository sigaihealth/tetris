export type Vec3 = [number, number, number];
export type Axis = 'x' | 'y' | 'z';
export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'L' | 'J' | 'Tower';

export const TETRACUBES: Record<PieceType, Vec3[]> = {
  I: [[0,0,0], [1,0,0], [2,0,0], [3,0,0]],
  O: [[0,0,0], [1,0,0], [0,0,1], [1,0,1]],
  T: [[0,0,0], [1,0,0], [2,0,0], [1,0,1]],
  S: [[0,0,0], [1,0,0], [1,0,1], [2,0,1]],
  Z: [[0,0,1], [1,0,1], [1,0,0], [2,0,0]],
  L: [[0,0,0], [1,0,0], [2,0,0], [2,0,1]],
  J: [[0,0,0], [1,0,0], [2,0,0], [0,0,1]],
  Tower: [[0,0,0], [1,0,0], [0,0,1], [0,1,0]],
};

export const PIECE_COLORS: Record<PieceType, number> = {
  I: 1, O: 2, T: 3, S: 4, Z: 5, L: 6, J: 7, Tower: 8,
};

export function rotateCubes(cubes: Vec3[], axis: Axis): Vec3[] {
  const rotated = cubes.map(([x, y, z]): Vec3 => {
    switch (axis) {
      case 'x': return [x, -z, y];
      case 'y': return [z, y, -x];
      case 'z': return [-y, x, z];
    }
  });
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  for (const [x, y, z] of rotated) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
  }
  return rotated.map(([x, y, z]) => [x - minX, y - minY, z - minZ]);
}

export class PieceState {
  readonly type: PieceType;
  readonly cubes: Vec3[];
  readonly position: Vec3;

  constructor(type: PieceType, cubes: Vec3[], position: Vec3) {
    this.type = type;
    this.cubes = cubes;
    this.position = position;
  }

  static spawn(type: PieceType, wellWidth: number, wellDepth: number, wellHeight: number): PieceState {
    const cubes = TETRACUBES[type];
    let maxX = 0, maxZ = 0, maxY = 0;
    for (const [x, y, z] of cubes) {
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
    const px = Math.floor((wellWidth - maxX - 1) / 2);
    const pz = Math.floor((wellDepth - maxZ - 1) / 2);
    const py = wellHeight - 1 - maxY;
    return new PieceState(type, cubes, [px, py, pz]);
  }

  worldCubes(): Vec3[] {
    return this.cubes.map(([cx, cy, cz]) => [
      cx + this.position[0],
      cy + this.position[1],
      cz + this.position[2],
    ]);
  }

  moved(dx: number, dy: number, dz: number): PieceState {
    return new PieceState(this.type, this.cubes, [
      this.position[0] + dx,
      this.position[1] + dy,
      this.position[2] + dz,
    ]);
  }

  rotated(axis: Axis): PieceState {
    return new PieceState(this.type, rotateCubes(this.cubes, axis), this.position);
  }

  get colorId(): number {
    return PIECE_COLORS[this.type];
  }
}
