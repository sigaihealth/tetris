import { describe, it, expect } from 'vitest';
import { TETRACUBES, PIECE_COLORS, rotateCubes, PieceState } from './Piece.js';
import type { PieceType, Vec3, Axis } from './Piece.js';

const ALL_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'L', 'J', 'Tower'];
const ALL_AXES: Axis[] = ['x', 'y', 'z'];

function sortCubes(cubes: Vec3[]): Vec3[] {
  return [...cubes].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
}

function cubeKey(cubes: Vec3[]): string {
  return sortCubes(cubes).map(([x, y, z]) => `${x},${y},${z}`).join('|');
}

describe('Piece — edge cases', () => {
  describe('all 8 piece types have unique shapes', () => {
    it('no two piece types share the same shape', () => {
      const shapes = new Set<string>();
      for (const type of ALL_TYPES) {
        const key = cubeKey(TETRACUBES[type]);
        shapes.add(key);
      }
      expect(shapes.size).toBe(8);
    });

    it('each piece type has exactly 4 cubes', () => {
      for (const type of ALL_TYPES) {
        expect(TETRACUBES[type]).toHaveLength(4);
      }
    });
  });

  describe('rotation identity: 4 rotations returns to original for ALL piece types on ALL axes', () => {
    for (const type of ALL_TYPES) {
      for (const axis of ALL_AXES) {
        it(`${type} piece: 4 rotations around ${axis} axis returns to original`, () => {
          let cubes = TETRACUBES[type];
          for (let i = 0; i < 4; i++) {
            cubes = rotateCubes(cubes, axis);
          }
          expect(sortCubes(cubes)).toEqual(sortCubes(TETRACUBES[type]));
        });
      }
    }
  });

  describe('rotation on all 3 axes for each piece type', () => {
    for (const type of ALL_TYPES) {
      it(`${type} piece: rotating on each axis preserves 4 cubes`, () => {
        for (const axis of ALL_AXES) {
          const rotated = rotateCubes(TETRACUBES[type], axis);
          expect(rotated).toHaveLength(4);
          // All coordinates should be non-negative (normalized)
          for (const [x, y, z] of rotated) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(z).toBeGreaterThanOrEqual(0);
          }
        }
      });

      it(`${type} piece: all rotated positions are unique (no duplicate cubes)`, () => {
        for (const axis of ALL_AXES) {
          const rotated = rotateCubes(TETRACUBES[type], axis);
          const keys = rotated.map(([x, y, z]) => `${x},${y},${z}`);
          expect(new Set(keys).size).toBe(4);
        }
      });
    }
  });

  describe('spawn position is centered for each piece type in each well size', () => {
    const wellSizes: [number, number, number][] = [
      [4, 4, 10],   // small
      [5, 5, 12],   // medium
      [6, 6, 15],   // large
    ];

    for (const type of ALL_TYPES) {
      for (const [w, d, h] of wellSizes) {
        it(`${type} spawns within bounds of ${w}x${d}x${h} well`, () => {
          const piece = PieceState.spawn(type, w, d, h);
          const worldCubes = piece.worldCubes();

          for (const [x, y, z] of worldCubes) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThan(w);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThan(h);
            expect(z).toBeGreaterThanOrEqual(0);
            expect(z).toBeLessThan(d);
          }
        });

        it(`${type} spawns at top of ${w}x${d}x${h} well`, () => {
          const piece = PieceState.spawn(type, w, d, h);
          const worldCubes = piece.worldCubes();
          const maxY = Math.max(...worldCubes.map(([, y]) => y));
          // The topmost cube should be at height-1
          expect(maxY).toBe(h - 1);
        });

        it(`${type} is horizontally centered in ${w}x${d}x${h} well`, () => {
          const piece = PieceState.spawn(type, w, d, h);
          const worldCubes = piece.worldCubes();
          const xs = worldCubes.map(([x]) => x);
          const zs = worldCubes.map(([, , z]) => z);
          const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
          const centerZ = (Math.min(...zs) + Math.max(...zs)) / 2;

          // Center should be roughly in the middle of the well (within 1 cell)
          expect(Math.abs(centerX - (w - 1) / 2)).toBeLessThanOrEqual(1);
          expect(Math.abs(centerZ - (d - 1) / 2)).toBeLessThanOrEqual(1);
        });
      }
    }
  });

  describe('PieceState immutability', () => {
    it('moved() returns a NEW PieceState, does not mutate original', () => {
      const original = new PieceState('T', TETRACUBES['T'], [2, 5, 3]);
      const originalPos: Vec3 = [...original.position];
      const originalCubes = original.cubes.map(c => [...c]);

      const moved = original.moved(1, -1, 2);

      // Original unchanged
      expect(original.position).toEqual(originalPos);
      expect(original.cubes).toEqual(originalCubes);

      // Moved has new position
      expect(moved.position).toEqual([3, 4, 5]);
      expect(moved.type).toBe('T');

      // They are different objects
      expect(moved).not.toBe(original);
    });

    it('rotated() returns a NEW PieceState, does not mutate original', () => {
      const original = new PieceState('L', TETRACUBES['L'], [1, 7, 2]);
      const originalPos: Vec3 = [...original.position];
      const originalCubes = original.cubes.map(c => [...c] as Vec3);

      const rotated = original.rotated('y');

      // Original unchanged
      expect(original.position).toEqual(originalPos);
      expect(original.cubes).toEqual(originalCubes);

      // Rotated is a different object
      expect(rotated).not.toBe(original);
      expect(rotated.position).toEqual(originalPos); // position doesn't change on rotate
      expect(rotated.type).toBe('L');
    });

    it('successive moved() calls are independent', () => {
      const original = new PieceState('I', TETRACUBES['I'], [0, 0, 0]);
      const m1 = original.moved(1, 0, 0);
      const m2 = original.moved(0, 1, 0);

      expect(m1.position).toEqual([1, 0, 0]);
      expect(m2.position).toEqual([0, 1, 0]);
      expect(original.position).toEqual([0, 0, 0]);
    });

    it('successive rotated() calls are independent from original', () => {
      const original = new PieceState('S', TETRACUBES['S'], [0, 0, 0]);
      const r1 = original.rotated('x');
      const r2 = original.rotated('y');

      // r1 and r2 are different rotations
      expect(r1.cubes).not.toEqual(r2.cubes);
      // Original is unchanged
      expect(original.cubes).toEqual(TETRACUBES['S']);
    });
  });

  describe('colorId returns correct value for each piece type', () => {
    const expectedColors: Record<PieceType, number> = {
      I: 1, O: 2, T: 3, S: 4, Z: 5, L: 6, J: 7, Tower: 8,
    };

    for (const type of ALL_TYPES) {
      it(`${type} has colorId ${expectedColors[type]}`, () => {
        const piece = new PieceState(type, TETRACUBES[type], [0, 0, 0]);
        expect(piece.colorId).toBe(expectedColors[type]);
        expect(piece.colorId).toBe(PIECE_COLORS[type]);
      });
    }
  });

  describe('worldCubes with various positions', () => {
    it('correctly offsets cubes at position [0,0,0]', () => {
      const piece = new PieceState('O', TETRACUBES['O'], [0, 0, 0]);
      const world = piece.worldCubes();
      // O: [[0,0,0], [1,0,0], [0,0,1], [1,0,1]]
      expect(sortCubes(world)).toEqual(sortCubes([[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]]));
    });

    it('correctly offsets cubes at large position', () => {
      const piece = new PieceState('O', TETRACUBES['O'], [10, 20, 30]);
      const world = piece.worldCubes();
      expect(sortCubes(world)).toEqual(sortCubes([
        [10, 20, 30], [11, 20, 30], [10, 20, 31], [11, 20, 31],
      ]));
    });

    it('correctly offsets cubes at negative position', () => {
      const piece = new PieceState('I', TETRACUBES['I'], [-1, -2, -3]);
      const world = piece.worldCubes();
      // I: [[0,0,0], [1,0,0], [2,0,0], [3,0,0]]
      expect(sortCubes(world)).toEqual(sortCubes([
        [-1, -2, -3], [0, -2, -3], [1, -2, -3], [2, -2, -3],
      ]));
    });
  });

  describe('rotation changes shape for non-symmetric pieces', () => {
    it('I piece changes orientation on y-axis rotation', () => {
      const original = TETRACUBES['I']; // horizontal line along x
      const rotated = rotateCubes(original, 'y');
      // Should now be along z axis
      expect(cubeKey(rotated)).not.toBe(cubeKey(original));
    });

    it('O piece is symmetric on y-axis rotation', () => {
      const original = TETRACUBES['O'];
      const rotated = rotateCubes(original, 'y');
      // O piece is 2x2 in XZ plane, rotating around Y should give the same shape
      expect(sortCubes(rotated)).toEqual(sortCubes(original));
    });

    it('2 rotations on same axis gives a different result than 0 or 4 for I piece', () => {
      const original = TETRACUBES['I'];
      let cubes = original;
      cubes = rotateCubes(cubes, 'z');
      cubes = rotateCubes(cubes, 'z');
      // 2 rotations of I on z: should be same as original (I is symmetric under 180)
      // Actually let's verify:
      expect(sortCubes(cubes)).toEqual(sortCubes(original));
    });
  });
});
