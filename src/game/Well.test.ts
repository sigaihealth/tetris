import { describe, it, expect, beforeEach } from 'vitest';
import { Well } from './Well.js';

describe('Well', () => {
  let well: Well;

  beforeEach(() => {
    well = new Well(4, 4, 10);
  });

  describe('constructor', () => {
    it('creates a well with correct dimensions', () => {
      expect(well.width).toBe(4);
      expect(well.depth).toBe(4);
      expect(well.height).toBe(10);
    });

    it('initializes all cells to 0', () => {
      for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 10; y++) {
          for (let z = 0; z < 4; z++) {
            expect(well.getCell(x, y, z)).toBe(0);
          }
        }
      }
    });
  });

  describe('get/set cells', () => {
    it('sets and gets a cell value', () => {
      well.setCell(1, 2, 3, 5);
      expect(well.getCell(1, 2, 3)).toBe(5);
    });

    it('stores values independently per cell', () => {
      well.setCell(0, 0, 0, 1);
      well.setCell(1, 0, 0, 2);
      well.setCell(0, 1, 0, 3);
      well.setCell(0, 0, 1, 4);
      expect(well.getCell(0, 0, 0)).toBe(1);
      expect(well.getCell(1, 0, 0)).toBe(2);
      expect(well.getCell(0, 1, 0)).toBe(3);
      expect(well.getCell(0, 0, 1)).toBe(4);
    });

    it('overwrites existing cell value', () => {
      well.setCell(2, 3, 1, 7);
      well.setCell(2, 3, 1, 3);
      expect(well.getCell(2, 3, 1)).toBe(3);
    });
  });

  describe('inBounds', () => {
    it('returns true for valid coordinates', () => {
      expect(well.inBounds(0, 0, 0)).toBe(true);
      expect(well.inBounds(3, 9, 3)).toBe(true);
      expect(well.inBounds(2, 5, 2)).toBe(true);
    });

    it('returns false for negative coordinates', () => {
      expect(well.inBounds(-1, 0, 0)).toBe(false);
      expect(well.inBounds(0, -1, 0)).toBe(false);
      expect(well.inBounds(0, 0, -1)).toBe(false);
    });

    it('returns false for out-of-range coordinates', () => {
      expect(well.inBounds(4, 0, 0)).toBe(false);
      expect(well.inBounds(0, 10, 0)).toBe(false);
      expect(well.inBounds(0, 0, 4)).toBe(false);
    });
  });

  describe('isOccupied', () => {
    it('returns false for empty cells', () => {
      expect(well.isOccupied(0, 0, 0)).toBe(false);
    });

    it('returns true for occupied cells', () => {
      well.setCell(1, 1, 1, 3);
      expect(well.isOccupied(1, 1, 1)).toBe(true);
    });

    it('returns false after setting to 0', () => {
      well.setCell(1, 1, 1, 3);
      well.setCell(1, 1, 1, 0);
      expect(well.isOccupied(1, 1, 1)).toBe(false);
    });
  });

  describe('isPlaneComplete', () => {
    it('returns false for empty plane', () => {
      expect(well.isPlaneComplete(0)).toBe(false);
    });

    it('returns false for partially filled plane', () => {
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 3; z++) {
          well.setCell(x, 0, z, 1);
        }
      }
      expect(well.isPlaneComplete(0)).toBe(false);
    });

    it('returns true for completely filled plane', () => {
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          well.setCell(x, 0, z, 1);
        }
      }
      expect(well.isPlaneComplete(0)).toBe(true);
    });
  });

  describe('clearCompletePlanes', () => {
    it('returns 0 when no planes are complete', () => {
      well.setCell(0, 0, 0, 1);
      expect(well.clearCompletePlanes()).toBe(0);
    });

    it('clears a single complete plane and drops above', () => {
      // Fill plane y=0
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          well.setCell(x, 0, z, 1);
        }
      }
      // Place a block at y=1
      well.setCell(2, 1, 2, 5);

      const cleared = well.clearCompletePlanes();
      expect(cleared).toBe(1);

      // The block that was at y=1 should now be at y=0
      expect(well.getCell(2, 0, 2)).toBe(5);
      // y=1 should be empty
      expect(well.isOccupied(2, 1, 2)).toBe(false);
    });

    it('clears multiple complete planes', () => {
      // Fill planes y=0 and y=1
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 4; x++) {
          for (let z = 0; z < 4; z++) {
            well.setCell(x, y, z, 1);
          }
        }
      }
      // Place a block at y=2
      well.setCell(1, 2, 1, 7);

      const cleared = well.clearCompletePlanes();
      expect(cleared).toBe(2);

      // The block that was at y=2 should now be at y=0
      expect(well.getCell(1, 0, 1)).toBe(7);
      expect(well.isOccupied(1, 1, 1)).toBe(false);
      expect(well.isOccupied(1, 2, 1)).toBe(false);
    });

    it('clears non-adjacent planes', () => {
      // Fill y=0
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          well.setCell(x, 0, z, 1);
        }
      }
      // y=1 is incomplete
      well.setCell(0, 1, 0, 2);
      // Fill y=2
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          well.setCell(x, 2, z, 3);
        }
      }

      const cleared = well.clearCompletePlanes();
      expect(cleared).toBe(2);

      // y=1 partial content should drop to y=0
      expect(well.getCell(0, 0, 0)).toBe(2);
      expect(well.isOccupied(1, 0, 0)).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears all cells', () => {
      well.setCell(0, 0, 0, 1);
      well.setCell(3, 9, 3, 8);
      well.reset();
      expect(well.getCell(0, 0, 0)).toBe(0);
      expect(well.getCell(3, 9, 3)).toBe(0);
    });
  });
});
