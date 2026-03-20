import { describe, it, expect } from 'vitest';
import { TETRACUBES, PIECE_COLORS, rotateCubes, PieceState } from './Piece.js';
import type { PieceType, Vec3, Axis } from './Piece.js';

describe('TETRACUBES', () => {
  const allTypes: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'L', 'J', 'Tower'];

  it('defines 8 piece types', () => {
    expect(Object.keys(TETRACUBES)).toHaveLength(8);
  });

  it.each(allTypes)('piece %s has exactly 4 cubes', (type) => {
    expect(TETRACUBES[type]).toHaveLength(4);
  });

  it.each(allTypes)('piece %s has unique cube positions', (type) => {
    const cubes = TETRACUBES[type];
    const keys = cubes.map(([x, y, z]) => `${x},${y},${z}`);
    expect(new Set(keys).size).toBe(4);
  });

  it('assigns unique color IDs 1-8', () => {
    const ids = Object.values(PIECE_COLORS);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(8);
    }
  });
});

describe('rotateCubes', () => {
  function sortCubes(cubes: Vec3[]): Vec3[] {
    return [...cubes].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  }

  it('rotates around x axis', () => {
    const cubes: Vec3[] = [[0,0,0], [1,0,0]];
    const rotated = rotateCubes(cubes, 'x');
    // After x rotation: [x, -z, y] => [0,0,0], [1,0,0] (since z=0 for both)
    expect(sortCubes(rotated)).toEqual(sortCubes([[0,0,0], [1,0,0]]));
  });

  it('rotates around y axis', () => {
    const cubes: Vec3[] = [[0,0,0], [1,0,0]];
    const rotated = rotateCubes(cubes, 'y');
    // [z, y, -x] => [0,0,0], [0,0,-1] => normalized: [0,0,0], [0,0,1] wait let me recalc
    // [0,0,0] -> [0,0,0], [1,0,0] -> [0,0,-1]
    // min: 0,0,-1. normalize: [0,0,1], [0,0,0]
    expect(sortCubes(rotated)).toEqual(sortCubes([[0,0,1], [0,0,0]]));
  });

  it('rotates around z axis', () => {
    const cubes: Vec3[] = [[0,0,0], [1,0,0]];
    const rotated = rotateCubes(cubes, 'z');
    // [-y, x, z] => [0,0,0], [0,1,0]
    expect(sortCubes(rotated)).toEqual(sortCubes([[0,0,0], [0,1,0]]));
  });

  it('normalizes to non-negative coordinates', () => {
    const cubes: Vec3[] = [[0,0,0], [1,0,0], [2,0,0]];
    const axes: Axis[] = ['x', 'y', 'z'];
    for (const axis of axes) {
      const rotated = rotateCubes(cubes, axis);
      for (const [x, y, z] of rotated) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(z).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('4 rotations around any axis returns to original shape', () => {
    const allTypes: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'L', 'J', 'Tower'];
    const axes: Axis[] = ['x', 'y', 'z'];

    for (const type of allTypes) {
      for (const axis of axes) {
        let cubes = TETRACUBES[type];
        for (let i = 0; i < 4; i++) {
          cubes = rotateCubes(cubes, axis);
        }
        expect(sortCubes(cubes)).toEqual(sortCubes(TETRACUBES[type]));
      }
    }
  });

  it('preserves cube count after rotation', () => {
    const cubes: Vec3[] = [[0,0,0], [1,0,0], [2,0,0], [1,0,1]];
    const rotated = rotateCubes(cubes, 'y');
    expect(rotated).toHaveLength(4);
  });
});

describe('PieceState', () => {
  describe('spawn', () => {
    it('spawns piece at top of well, centered', () => {
      const piece = PieceState.spawn('I', 6, 6, 15);
      // I piece: max x=3, maxY=0, maxZ=0
      // px = floor((6 - 3 - 1)/2) = 1
      // pz = floor((6 - 0 - 1)/2) = 2
      // py = 15 - 1 - 0 = 14
      expect(piece.position[1]).toBe(14); // at top
      expect(piece.type).toBe('I');
    });

    it('uses correct cubes from TETRACUBES', () => {
      const piece = PieceState.spawn('T', 5, 5, 12);
      expect(piece.cubes).toEqual(TETRACUBES['T']);
    });
  });

  describe('worldCubes', () => {
    it('returns cubes offset by position', () => {
      const piece = new PieceState('I', [[0,0,0], [1,0,0], [2,0,0], [3,0,0]], [2, 5, 3]);
      const world = piece.worldCubes();
      expect(world).toEqual([[2,5,3], [3,5,3], [4,5,3], [5,5,3]]);
    });
  });

  describe('moved', () => {
    it('returns new PieceState with offset position', () => {
      const piece = new PieceState('O', TETRACUBES['O'], [1, 2, 3]);
      const moved = piece.moved(1, -1, 0);
      expect(moved.position).toEqual([2, 1, 3]);
      expect(moved.type).toBe('O');
      // Original is unchanged (immutable)
      expect(piece.position).toEqual([1, 2, 3]);
    });
  });

  describe('rotated', () => {
    it('returns new PieceState with rotated cubes', () => {
      const piece = new PieceState('I', TETRACUBES['I'], [1, 5, 1]);
      const rotated = piece.rotated('y');
      // I piece rotated around y should change orientation
      expect(rotated.cubes).not.toEqual(piece.cubes);
      expect(rotated.position).toEqual(piece.position);
      expect(rotated.type).toBe('I');
    });

    it('does not modify original piece', () => {
      const piece = new PieceState('T', TETRACUBES['T'], [0, 0, 0]);
      const originalCubes = [...piece.cubes];
      piece.rotated('x');
      expect(piece.cubes).toEqual(originalCubes);
    });
  });

  describe('colorId', () => {
    it('returns the correct color for each type', () => {
      const types: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'L', 'J', 'Tower'];
      for (const type of types) {
        const piece = new PieceState(type, TETRACUBES[type], [0, 0, 0]);
        expect(piece.colorId).toBe(PIECE_COLORS[type]);
      }
    });
  });
});
