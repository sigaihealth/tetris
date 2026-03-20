import { describe, it, expect, beforeEach } from 'vitest';
import { Well } from './Well.js';

describe('Well — edge cases', () => {
  describe('clear multiple non-adjacent planes', () => {
    it('clears plane 0 and plane 2 while keeping plane 1 intact', () => {
      const well = new Well(4, 4, 10);

      // Fill plane 0 completely
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          well.setCell(x, 0, z, 1);
        }
      }
      // Fill plane 1 partially (leave one cell empty)
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          if (x === 0 && z === 0) continue;
          well.setCell(x, 1, z, 2);
        }
      }
      // Fill plane 2 completely
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          well.setCell(x, 2, z, 3);
        }
      }
      // Place a marker block at y=3
      well.setCell(1, 3, 1, 9);

      const cleared = well.clearCompletePlanes();
      expect(cleared).toBe(2);

      // After clearing: plane 1 content drops to y=0, y=3 marker drops to y=1
      // The partial plane (was at y=1) should be at y=0
      expect(well.getCell(1, 0, 1)).toBe(2); // was in partial plane
      expect(well.isOccupied(0, 0, 0)).toBe(false); // was the empty cell in partial plane

      // The marker (was at y=3) should be at y=1
      expect(well.getCell(1, 1, 1)).toBe(9);
    });

    it('clears plane 0 and plane 3, keeps plane 1 and plane 2', () => {
      const well = new Well(3, 3, 8);

      // Fill plane 0
      for (let x = 0; x < 3; x++) {
        for (let z = 0; z < 3; z++) {
          well.setCell(x, 0, z, 1);
        }
      }
      // Plane 1: one cell only
      well.setCell(0, 1, 0, 5);
      // Plane 2: two cells
      well.setCell(0, 2, 0, 6);
      well.setCell(1, 2, 1, 7);
      // Fill plane 3
      for (let x = 0; x < 3; x++) {
        for (let z = 0; z < 3; z++) {
          well.setCell(x, 3, z, 4);
        }
      }

      const cleared = well.clearCompletePlanes();
      expect(cleared).toBe(2);

      // After clearing: old plane 1 -> y=0, old plane 2 -> y=1
      expect(well.getCell(0, 0, 0)).toBe(5);
      expect(well.getCell(0, 1, 0)).toBe(6);
      expect(well.getCell(1, 1, 1)).toBe(7);

      // Planes 2+ should be empty
      expect(well.isOccupied(0, 2, 0)).toBe(false);
    });
  });

  describe('fill entire well and clear', () => {
    it('clearing all planes in a fully filled well returns height', () => {
      const well = new Well(4, 4, 10);
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 4; x++) {
          for (let z = 0; z < 4; z++) {
            well.setCell(x, y, z, 1);
          }
        }
      }
      const cleared = well.clearCompletePlanes();
      expect(cleared).toBe(10);

      // All cells should now be empty
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 4; x++) {
          for (let z = 0; z < 4; z++) {
            expect(well.getCell(x, y, z)).toBe(0);
          }
        }
      }
    });
  });

  describe('reset', () => {
    it('clears all cells after filling the well', () => {
      const well = new Well(4, 4, 10);
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 4; x++) {
          for (let z = 0; z < 4; z++) {
            well.setCell(x, y, z, (x + y + z) % 8 + 1);
          }
        }
      }
      well.reset();
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 4; x++) {
          for (let z = 0; z < 4; z++) {
            expect(well.getCell(x, y, z)).toBe(0);
          }
        }
      }
    });
  });

  describe('boundary: getCell/setCell at max valid indices', () => {
    it('set and get at (width-1, height-1, depth-1)', () => {
      const well = new Well(5, 5, 12);
      well.setCell(4, 11, 4, 7);
      expect(well.getCell(4, 11, 4)).toBe(7);
    });

    it('set and get at (0, 0, 0)', () => {
      const well = new Well(5, 5, 12);
      well.setCell(0, 0, 0, 3);
      expect(well.getCell(0, 0, 0)).toBe(3);
    });

    it('inBounds at exact boundaries', () => {
      const well = new Well(6, 6, 15);
      expect(well.inBounds(5, 14, 5)).toBe(true);
      expect(well.inBounds(6, 14, 5)).toBe(false);
      expect(well.inBounds(5, 15, 5)).toBe(false);
      expect(well.inBounds(5, 14, 6)).toBe(false);
    });
  });

  describe('large well dimensions (6x6x15)', () => {
    let well: Well;

    beforeEach(() => {
      well = new Well(6, 6, 15);
    });

    it('creates well with correct dimensions', () => {
      expect(well.width).toBe(6);
      expect(well.depth).toBe(6);
      expect(well.height).toBe(15);
    });

    it('all cells start empty', () => {
      for (let y = 0; y < 15; y++) {
        for (let x = 0; x < 6; x++) {
          for (let z = 0; z < 6; z++) {
            expect(well.getCell(x, y, z)).toBe(0);
          }
        }
      }
    });

    it('fills and clears a plane in a 6x6 well', () => {
      for (let x = 0; x < 6; x++) {
        for (let z = 0; z < 6; z++) {
          well.setCell(x, 0, z, 1);
        }
      }
      expect(well.isPlaneComplete(0)).toBe(true);
      const cleared = well.clearCompletePlanes();
      expect(cleared).toBe(1);
    });

    it('isPlaneComplete returns false when only 35 of 36 cells are filled', () => {
      for (let x = 0; x < 6; x++) {
        for (let z = 0; z < 6; z++) {
          if (x === 5 && z === 5) continue;
          well.setCell(x, 3, z, 1);
        }
      }
      expect(well.isPlaneComplete(3)).toBe(false);
    });

    it('handles many planes cleared at once', () => {
      // Fill first 5 planes
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 6; x++) {
          for (let z = 0; z < 6; z++) {
            well.setCell(x, y, z, 1);
          }
        }
      }
      // Marker at y=5
      well.setCell(2, 5, 2, 9);

      const cleared = well.clearCompletePlanes();
      expect(cleared).toBe(5);
      // Marker should drop to y=0
      expect(well.getCell(2, 0, 2)).toBe(9);
    });
  });

  describe('removePlane shifts data correctly', () => {
    it('preserves different color values when shifting down', () => {
      const well = new Well(4, 4, 10);
      // Fill plane 0
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          well.setCell(x, 0, z, 1);
        }
      }
      // Place unique values at various y levels
      well.setCell(0, 1, 0, 2);
      well.setCell(1, 2, 1, 3);
      well.setCell(2, 3, 2, 4);
      well.setCell(3, 9, 3, 5);

      const cleared = well.clearCompletePlanes();
      expect(cleared).toBe(1);

      // Values should have shifted down by 1
      expect(well.getCell(0, 0, 0)).toBe(2);
      expect(well.getCell(1, 1, 1)).toBe(3);
      expect(well.getCell(2, 2, 2)).toBe(4);
      expect(well.getCell(3, 8, 3)).toBe(5);
    });

    it('top plane becomes empty after shift', () => {
      const well = new Well(4, 4, 10);
      // Fill planes 0 through 8
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 4; x++) {
          for (let z = 0; z < 4; z++) {
            well.setCell(x, y, z, 1);
          }
        }
      }
      // Plane 9 has some content
      well.setCell(0, 9, 0, 5);

      well.clearCompletePlanes();
      // After clearing 9 planes, plane 9 content should be at y=0
      expect(well.getCell(0, 0, 0)).toBe(5);
      // All other cells should be empty
      for (let y = 1; y < 10; y++) {
        for (let x = 0; x < 4; x++) {
          for (let z = 0; z < 4; z++) {
            expect(well.getCell(x, y, z)).toBe(0);
          }
        }
      }
    });
  });

  describe('isOccupied with different values', () => {
    it('any non-zero value counts as occupied', () => {
      const well = new Well(4, 4, 10);
      for (let v = 1; v <= 8; v++) {
        well.setCell(0, 0, 0, v);
        expect(well.isOccupied(0, 0, 0)).toBe(true);
      }
    });
  });
});
