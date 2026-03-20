export class Well {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  private grid: Uint8Array;

  constructor(width: number, depth: number, height: number) {
    this.width = width;
    this.depth = depth;
    this.height = height;
    this.grid = new Uint8Array(width * height * depth);
  }

  private index(x: number, y: number, z: number): number {
    return y * this.width * this.depth + z * this.width + x;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height && z >= 0 && z < this.depth;
  }

  getCell(x: number, y: number, z: number): number {
    return this.grid[this.index(x, y, z)];
  }

  setCell(x: number, y: number, z: number, value: number): void {
    this.grid[this.index(x, y, z)] = value;
  }

  isOccupied(x: number, y: number, z: number): boolean {
    return this.getCell(x, y, z) !== 0;
  }

  isPlaneComplete(y: number): boolean {
    for (let x = 0; x < this.width; x++) {
      for (let z = 0; z < this.depth; z++) {
        if (!this.isOccupied(x, y, z)) return false;
      }
    }
    return true;
  }

  clearCompletePlanes(): number {
    let cleared = 0;
    let y = 0;
    while (y < this.height) {
      if (this.isPlaneComplete(y)) {
        this.removePlane(y);
        cleared++;
      } else {
        y++;
      }
    }
    return cleared;
  }

  private removePlane(planeY: number): void {
    for (let y = planeY; y < this.height - 1; y++) {
      for (let x = 0; x < this.width; x++) {
        for (let z = 0; z < this.depth; z++) {
          this.setCell(x, y, z, this.getCell(x, y + 1, z));
        }
      }
    }
    for (let x = 0; x < this.width; x++) {
      for (let z = 0; z < this.depth; z++) {
        this.setCell(x, this.height - 1, z, 0);
      }
    }
  }

  reset(): void {
    this.grid.fill(0);
  }
}
