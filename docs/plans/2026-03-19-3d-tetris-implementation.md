# 3D Tetris Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a fully-featured 3D Tetris game in the browser with glass-style rendering, procedural audio, and polished UI.

**Architecture:** Game logic (Well, Piece, GameState) is pure TypeScript with no rendering dependencies — tested with Vitest. The renderer reads game state and manages Three.js meshes. UI is HTML/CSS overlays. Audio uses Web Audio API.

**Tech Stack:** Vite, TypeScript, Three.js, Vitest, Web Audio API

**Note:** All UI uses safe DOM construction (createElement/textContent) instead of innerHTML to avoid XSS concerns.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/main.ts`

**Step 1: Initialize project with Vite**

```bash
cd /Volumes/T9/code/tetris
npm create vite@latest . -- --template vanilla-ts
```

If it asks to overwrite, say yes (directory is nearly empty).

**Step 2: Install dependencies**

```bash
npm install three
npm install -D @types/three vitest
```

**Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

**Step 4: Add test script to package.json**

Add to scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 5: Create placeholder main.ts**

Replace `src/main.ts` with:
```ts
console.log('3D Tetris starting...');
```

**Step 6: Verify everything works**

```bash
npm run dev    # should open browser with console log
npm run test   # should pass (no tests yet)
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + TypeScript + Three.js project"
```

---

### Task 2: Well Data Structure

**Files:**
- Create: `src/game/Well.ts`
- Create: `src/game/Well.test.ts`

**Step 1: Write failing tests**

```ts
// src/game/Well.test.ts
import { describe, it, expect } from 'vitest';
import { Well } from './Well';

describe('Well', () => {
  it('creates empty grid with correct dimensions', () => {
    const well = new Well(4, 4, 10);
    expect(well.width).toBe(4);
    expect(well.depth).toBe(4);
    expect(well.height).toBe(10);
    expect(well.getCell(0, 0, 0)).toBe(0);
    expect(well.getCell(3, 9, 3)).toBe(0);
  });

  it('sets and gets cells', () => {
    const well = new Well(4, 4, 10);
    well.setCell(1, 2, 3, 5);
    expect(well.getCell(1, 2, 3)).toBe(5);
    expect(well.getCell(0, 0, 0)).toBe(0);
  });

  it('checks bounds correctly', () => {
    const well = new Well(4, 4, 10);
    expect(well.inBounds(0, 0, 0)).toBe(true);
    expect(well.inBounds(3, 9, 3)).toBe(true);
    expect(well.inBounds(-1, 0, 0)).toBe(false);
    expect(well.inBounds(4, 0, 0)).toBe(false);
    expect(well.inBounds(0, 10, 0)).toBe(false);
  });

  it('checks if cell is occupied', () => {
    const well = new Well(4, 4, 10);
    expect(well.isOccupied(1, 2, 3)).toBe(false);
    well.setCell(1, 2, 3, 1);
    expect(well.isOccupied(1, 2, 3)).toBe(true);
  });

  it('detects full planes', () => {
    const well = new Well(4, 4, 10);
    for (let x = 0; x < 4; x++) {
      for (let z = 0; z < 4; z++) {
        well.setCell(x, 0, z, 1);
      }
    }
    expect(well.isPlaneComplete(0)).toBe(true);
    expect(well.isPlaneComplete(1)).toBe(false);
  });

  it('clears complete planes and drops blocks above', () => {
    const well = new Well(4, 4, 10);
    for (let x = 0; x < 4; x++) {
      for (let z = 0; z < 4; z++) {
        well.setCell(x, 0, z, 1);
      }
    }
    well.setCell(2, 1, 2, 3);
    const cleared = well.clearCompletePlanes();
    expect(cleared).toBe(1);
    expect(well.getCell(2, 0, 2)).toBe(3);
    expect(well.getCell(2, 1, 2)).toBe(0);
  });

  it('clears multiple planes at once', () => {
    const well = new Well(4, 4, 10);
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          well.setCell(x, y, z, 1);
        }
      }
    }
    well.setCell(1, 2, 1, 5);
    const cleared = well.clearCompletePlanes();
    expect(cleared).toBe(2);
    expect(well.getCell(1, 0, 1)).toBe(5);
    expect(well.getCell(1, 1, 1)).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/game/Well.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement Well**

```ts
// src/game/Well.ts
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
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/game/Well.test.ts
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/game/Well.ts src/game/Well.test.ts
git commit -m "feat: add Well data structure with plane clearing"
```

---

### Task 3: Piece Definitions & Rotation

**Files:**
- Create: `src/game/Piece.ts`
- Create: `src/game/Piece.test.ts`

**Step 1: Write failing tests**

```ts
// src/game/Piece.test.ts
import { describe, it, expect } from 'vitest';
import { TETRACUBES, rotateCubes, PieceState } from './Piece';

describe('Tetracubes', () => {
  it('defines 8 piece types', () => {
    expect(Object.keys(TETRACUBES)).toHaveLength(8);
  });

  it('each piece has exactly 4 cubes', () => {
    for (const [name, cubes] of Object.entries(TETRACUBES)) {
      expect(cubes, `${name} should have 4 cubes`).toHaveLength(4);
    }
  });
});

describe('rotateCubes', () => {
  it('rotates around X axis', () => {
    const cubes = [[0, 0, 0], [0, 1, 0]] as [number, number, number][];
    const rotated = rotateCubes(cubes, 'x');
    expect(rotated).toContainEqual([0, 0, 0]);
    expect(rotated).toContainEqual([0, 0, 1]);
  });

  it('rotates around Y axis', () => {
    const cubes = [[0, 0, 0], [1, 0, 0]] as [number, number, number][];
    const rotated = rotateCubes(cubes, 'y');
    expect(rotated).toHaveLength(2);
  });

  it('rotates around Z axis', () => {
    const cubes = [[0, 0, 0], [1, 0, 0]] as [number, number, number][];
    const rotated = rotateCubes(cubes, 'z');
    expect(rotated).toHaveLength(2);
  });

  it('four rotations return to original', () => {
    const original = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]] as [number, number, number][];
    let cubes = original;
    for (let i = 0; i < 4; i++) {
      cubes = rotateCubes(cubes, 'x');
    }
    const sorted = (c: [number, number, number][]) =>
      [...c].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    expect(sorted(cubes)).toEqual(sorted(original));
  });
});

describe('PieceState', () => {
  it('creates a piece at spawn position', () => {
    const piece = PieceState.spawn('I', 4, 4, 10);
    expect(piece.type).toBe('I');
    expect(piece.position).toBeDefined();
  });

  it('returns world positions of cubes', () => {
    const piece = PieceState.spawn('O', 4, 4, 10);
    const positions = piece.worldCubes();
    expect(positions).toHaveLength(4);
    for (const [x, y, z] of positions) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(z).toBeGreaterThanOrEqual(0);
    }
  });

  it('moves piece', () => {
    const piece = PieceState.spawn('I', 4, 4, 10);
    const moved = piece.moved(1, 0, 0);
    expect(moved.position[0]).toBe(piece.position[0] + 1);
  });

  it('rotates piece', () => {
    const piece = PieceState.spawn('I', 4, 4, 10);
    const rotated = piece.rotated('x');
    expect(rotated.cubes).not.toEqual(piece.cubes);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/game/Piece.test.ts
```

**Step 3: Implement Piece**

```ts
// src/game/Piece.ts
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
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/game/Piece.test.ts
```

**Step 5: Commit**

```bash
git add src/game/Piece.ts src/game/Piece.test.ts
git commit -m "feat: add tetracube piece definitions and 3-axis rotation"
```

---

### Task 4: Piece Generator (Bag Randomizer)

**Files:**
- Create: `src/game/PieceGenerator.ts`
- Create: `src/game/PieceGenerator.test.ts`

**Step 1: Write failing tests**

```ts
// src/game/PieceGenerator.test.ts
import { describe, it, expect } from 'vitest';
import { PieceGenerator } from './PieceGenerator';

describe('PieceGenerator', () => {
  it('generates all 8 piece types in each bag', () => {
    const gen = new PieceGenerator();
    const firstBag: string[] = [];
    for (let i = 0; i < 8; i++) {
      firstBag.push(gen.next());
    }
    expect(new Set(firstBag).size).toBe(8);
  });

  it('generates pieces indefinitely', () => {
    const gen = new PieceGenerator();
    for (let i = 0; i < 100; i++) {
      expect(gen.next()).toBeTruthy();
    }
  });

  it('peek returns upcoming pieces without consuming them', () => {
    const gen = new PieceGenerator();
    const peeked = gen.peek(3);
    expect(peeked).toHaveLength(3);
    expect(gen.next()).toBe(peeked[0]);
    expect(gen.next()).toBe(peeked[1]);
    expect(gen.next()).toBe(peeked[2]);
  });

  it('reset clears state', () => {
    const gen = new PieceGenerator();
    gen.next();
    gen.next();
    gen.reset();
    const bag: string[] = [];
    for (let i = 0; i < 8; i++) {
      bag.push(gen.next());
    }
    expect(new Set(bag).size).toBe(8);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/game/PieceGenerator.test.ts
```

**Step 3: Implement PieceGenerator**

```ts
// src/game/PieceGenerator.ts
import { PieceType } from './Piece';

const ALL_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'L', 'J', 'Tower'];

export class PieceGenerator {
  private bag: PieceType[] = [];

  constructor() {
    this.fillBag();
  }

  private fillBag(): void {
    const bag = [...ALL_TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    this.bag.push(...bag);
  }

  next(): PieceType {
    if (this.bag.length <= 8) {
      this.fillBag();
    }
    return this.bag.shift()!;
  }

  peek(count: number): PieceType[] {
    while (this.bag.length < count) {
      this.fillBag();
    }
    return this.bag.slice(0, count);
  }

  reset(): void {
    this.bag = [];
    this.fillBag();
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/game/PieceGenerator.test.ts
```

**Step 5: Commit**

```bash
git add src/game/PieceGenerator.ts src/game/PieceGenerator.test.ts
git commit -m "feat: add bag randomizer piece generator"
```

---

### Task 5: GameState — Core Game Logic

**Files:**
- Create: `src/game/GameState.ts`
- Create: `src/game/GameState.test.ts`

**Step 1: Write failing tests**

```ts
// src/game/GameState.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, GameConfig } from './GameState';

const SMALL_CONFIG: GameConfig = { width: 4, depth: 4, height: 10 };

describe('GameState', () => {
  let game: GameState;

  beforeEach(() => {
    game = new GameState(SMALL_CONFIG);
  });

  it('starts with score 0, level 1', () => {
    expect(game.score).toBe(0);
    expect(game.level).toBe(1);
    expect(game.planesCleared).toBe(0);
  });

  it('spawns a piece on start', () => {
    game.start();
    expect(game.activePiece).not.toBeNull();
  });

  it('moves piece', () => {
    game.start();
    const before = game.activePiece!.position[0];
    const moved = game.tryMove(1, 0, 0);
    expect(moved).toBe(true);
    expect(game.activePiece!.position[0]).toBe(before + 1);
  });

  it('prevents moving out of bounds', () => {
    game.start();
    for (let i = 0; i < 20; i++) game.tryMove(-1, 0, 0);
    const pos = game.activePiece!.position[0];
    // Should not go below valid position
    expect(pos).toBeGreaterThanOrEqual(-1);
  });

  it('rotates piece', () => {
    game.start();
    game.tryRotate('x');
    expect(game.activePiece).not.toBeNull();
  });

  it('hard drops piece to bottom', () => {
    game.start();
    game.hardDrop();
    let hasBlock = false;
    for (let x = 0; x < 4; x++) {
      for (let z = 0; z < 4; z++) {
        if (game.well.isOccupied(x, 0, z)) hasBlock = true;
      }
    }
    expect(hasBlock).toBe(true);
  });

  it('ticks gravity — piece falls', () => {
    game.start();
    const startY = game.activePiece!.position[1];
    game.tick();
    expect(game.activePiece!.position[1]).toBe(startY - 1);
  });

  it('spawns new piece after lock', () => {
    game.start();
    game.hardDrop();
    expect(game.activePiece).not.toBeNull();
  });

  it('scores points for hard drop', () => {
    game.start();
    game.hardDrop();
    expect(game.score).toBeGreaterThan(0);
  });

  it('detects game over', () => {
    game.start();
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          game.well.setCell(x, y, z, 1);
        }
      }
    }
    game.hardDrop();
    expect(game.isGameOver).toBe(true);
  });

  it('levels up after 10 planes', () => {
    game.start();
    game.addPlanesCleared(10);
    expect(game.level).toBe(2);
  });

  it('fall interval decreases with level', () => {
    game.start();
    const interval1 = game.fallInterval;
    game.addPlanesCleared(10);
    expect(game.fallInterval).toBeLessThan(interval1);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/game/GameState.test.ts
```

**Step 3: Implement GameState**

```ts
// src/game/GameState.ts
import { Well } from './Well';
import { PieceState, PieceType, Axis, Vec3 } from './Piece';
import { PieceGenerator } from './PieceGenerator';

export interface GameConfig {
  width: number;
  depth: number;
  height: number;
}

export type GameEvent =
  | { type: 'piece_moved' }
  | { type: 'piece_rotated' }
  | { type: 'piece_locked' }
  | { type: 'planes_cleared'; count: number; y: number[] }
  | { type: 'hard_drop'; distance: number }
  | { type: 'soft_drop' }
  | { type: 'level_up'; level: number }
  | { type: 'game_over' }
  | { type: 'combo'; multiplier: number };

export const WELL_PRESETS = {
  small: { width: 4, depth: 4, height: 10 },
  medium: { width: 5, depth: 5, height: 12 },
  large: { width: 6, depth: 6, height: 15 },
} as const;

export class GameState {
  readonly well: Well;
  readonly config: GameConfig;
  private generator: PieceGenerator;
  private _activePiece: PieceState | null = null;
  private _score = 0;
  private _level = 1;
  private _planesCleared = 0;
  private _isGameOver = false;
  private _comboCount = 0;
  private _events: GameEvent[] = [];
  private _startTime = 0;
  private _elapsedMs = 0;

  constructor(config: GameConfig) {
    this.config = config;
    this.well = new Well(config.width, config.depth, config.height);
    this.generator = new PieceGenerator();
  }

  get activePiece(): PieceState | null { return this._activePiece; }
  get score(): number { return this._score; }
  get level(): number { return this._level; }
  get planesCleared(): number { return this._planesCleared; }
  get isGameOver(): boolean { return this._isGameOver; }
  get elapsedMs(): number { return this._elapsedMs; }
  get nextPieces(): PieceType[] { return this.generator.peek(3); }

  get fallInterval(): number {
    if (this._level <= 10) {
      return Math.max(1000 - (this._level - 1) * 80, 200);
    }
    return Math.max(200 - (this._level - 10) * 10, 100);
  }

  flushEvents(): GameEvent[] {
    const events = this._events;
    this._events = [];
    return events;
  }

  start(): void {
    this.well.reset();
    this._score = 0;
    this._level = 1;
    this._planesCleared = 0;
    this._isGameOver = false;
    this._comboCount = 0;
    this._startTime = Date.now();
    this.generator.reset();
    this.spawnPiece();
  }

  private spawnPiece(): void {
    const type = this.generator.next();
    this._activePiece = PieceState.spawn(type, this.config.width, this.config.depth, this.config.height);
    if (this.collides(this._activePiece)) {
      this._isGameOver = true;
      this._events.push({ type: 'game_over' });
    }
  }

  private collides(piece: PieceState): boolean {
    for (const [x, y, z] of piece.worldCubes()) {
      if (!this.well.inBounds(x, y, z)) return true;
      if (this.well.isOccupied(x, y, z)) return true;
    }
    return false;
  }

  tryMove(dx: number, dy: number, dz: number): boolean {
    if (!this._activePiece || this._isGameOver) return false;
    const moved = this._activePiece.moved(dx, dy, dz);
    if (this.collides(moved)) return false;
    this._activePiece = moved;
    this._events.push({ type: 'piece_moved' });
    return true;
  }

  tryRotate(axis: Axis): boolean {
    if (!this._activePiece || this._isGameOver) return false;
    const rotated = this._activePiece.rotated(axis);

    if (!this.collides(rotated)) {
      this._activePiece = rotated;
      this._events.push({ type: 'piece_rotated' });
      return true;
    }

    const kicks: Vec3[] = [
      [1,0,0], [-1,0,0], [0,0,1], [0,0,-1],
      [0,1,0], [0,-1,0],
      [2,0,0], [-2,0,0], [0,0,2], [0,0,-2],
    ];
    for (const [dx, dy, dz] of kicks) {
      const kicked = rotated.moved(dx, dy, dz);
      if (!this.collides(kicked)) {
        this._activePiece = kicked;
        this._events.push({ type: 'piece_rotated' });
        return true;
      }
    }
    return false;
  }

  tick(): void {
    if (!this._activePiece || this._isGameOver) return;
    this._elapsedMs = Date.now() - this._startTime;
    const dropped = this._activePiece.moved(0, -1, 0);
    if (this.collides(dropped)) {
      this.lockPiece();
    } else {
      this._activePiece = dropped;
    }
  }

  softDrop(): boolean {
    if (!this._activePiece || this._isGameOver) return false;
    const dropped = this._activePiece.moved(0, -1, 0);
    if (this.collides(dropped)) return false;
    this._activePiece = dropped;
    this._score += 1;
    this._events.push({ type: 'soft_drop' });
    return true;
  }

  hardDrop(): void {
    if (!this._activePiece || this._isGameOver) return;
    let distance = 0;
    while (true) {
      const dropped = this._activePiece.moved(0, -1, 0);
      if (this.collides(dropped)) break;
      this._activePiece = dropped;
      distance++;
    }
    this._score += distance * 2;
    this._events.push({ type: 'hard_drop', distance });
    this.lockPiece();
  }

  private lockPiece(): void {
    if (!this._activePiece) return;
    const colorId = this._activePiece.colorId;
    for (const [x, y, z] of this._activePiece.worldCubes()) {
      if (this.well.inBounds(x, y, z)) {
        this.well.setCell(x, y, z, colorId);
      }
    }
    this._events.push({ type: 'piece_locked' });

    const clearedPlanes: number[] = [];
    for (let y = this.config.height - 1; y >= 0; y--) {
      if (this.well.isPlaneComplete(y)) {
        clearedPlanes.push(y);
      }
    }

    const cleared = this.well.clearCompletePlanes();
    if (cleared > 0) {
      this._comboCount++;
      this.addPlanesCleared(cleared);
      const comboMultiplier = 1 + (this._comboCount - 1) * 0.5;
      let baseScore: number;
      switch (cleared) {
        case 1: baseScore = 100; break;
        case 2: baseScore = 300; break;
        case 3: baseScore = 500; break;
        default: baseScore = 800; break;
      }
      this._score += Math.floor(baseScore * this._level * comboMultiplier);
      this._events.push({ type: 'planes_cleared', count: cleared, y: clearedPlanes });
      if (this._comboCount > 1) {
        this._events.push({ type: 'combo', multiplier: comboMultiplier });
      }
    } else {
      this._comboCount = 0;
    }

    this.spawnPiece();
  }

  addPlanesCleared(count: number): void {
    this._planesCleared += count;
    const newLevel = Math.floor(this._planesCleared / 10) + 1;
    if (newLevel > this._level) {
      this._level = newLevel;
      this._events.push({ type: 'level_up', level: this._level });
    }
  }

  ghostPosition(): Vec3 | null {
    if (!this._activePiece) return null;
    let ghost = this._activePiece;
    while (true) {
      const dropped = ghost.moved(0, -1, 0);
      if (this.collides(dropped)) break;
      ghost = dropped;
    }
    return ghost.position;
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/game/GameState.test.ts
```

**Step 5: Commit**

```bash
git add src/game/GameState.ts src/game/GameState.test.ts
git commit -m "feat: add core GameState with scoring, levels, and game over"
```

---

### Task 6: Input Handler

**Files:**
- Create: `src/game/Input.ts`
- Create: `src/game/Input.test.ts`

**Step 1: Write failing tests**

```ts
// src/game/Input.test.ts
import { describe, it, expect } from 'vitest';
import { InputHandler } from './Input';

describe('InputHandler', () => {
  it('maps keys to actions', () => {
    const handler = new InputHandler();
    expect(handler.getAction('KeyA')).toBe('move_left');
    expect(handler.getAction('ArrowLeft')).toBe('move_left');
    expect(handler.getAction('Space')).toBe('hard_drop');
    expect(handler.getAction('KeyQ')).toBe('camera_left');
    expect(handler.getAction('KeyI')).toBe('rotate_x_pos');
    expect(handler.getAction('Escape')).toBe('pause');
    expect(handler.getAction('KeyM')).toBe('mute');
  });

  it('returns null for unmapped keys', () => {
    const handler = new InputHandler();
    expect(handler.getAction('F12')).toBeNull();
  });

  it('initial press fires immediately', () => {
    const handler = new InputHandler();
    const actions = handler.processKeyDown('KeyA', 0);
    expect(actions).toContain('move_left');
  });

  it('DAS fires after delay', () => {
    const handler = new InputHandler();
    handler.processKeyDown('KeyA', 0);
    const early = handler.tick(100);
    expect(early).not.toContain('move_left');
    const late = handler.tick(200);
    expect(late).toContain('move_left');
  });

  it('stops DAS on key up', () => {
    const handler = new InputHandler();
    handler.processKeyDown('KeyA', 0);
    handler.processKeyUp('KeyA', 50);
    const actions = handler.tick(200);
    expect(actions).not.toContain('move_left');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/game/Input.test.ts
```

**Step 3: Implement InputHandler**

```ts
// src/game/Input.ts
export type Action =
  | 'move_left' | 'move_right' | 'move_forward' | 'move_back'
  | 'soft_drop' | 'hard_drop'
  | 'rotate_x_pos' | 'rotate_x_neg'
  | 'rotate_y_pos' | 'rotate_y_neg'
  | 'rotate_z_pos' | 'rotate_z_neg'
  | 'camera_left' | 'camera_right'
  | 'pause' | 'mute';

const KEY_MAP: Record<string, Action> = {
  KeyA: 'move_left', ArrowLeft: 'move_left',
  KeyD: 'move_right', ArrowRight: 'move_right',
  KeyW: 'move_forward', ArrowUp: 'move_forward',
  KeyS: 'move_back', ArrowDown: 'move_back',
  ShiftLeft: 'soft_drop', ShiftRight: 'soft_drop',
  Space: 'hard_drop',
  KeyI: 'rotate_x_pos', KeyK: 'rotate_x_neg',
  KeyJ: 'rotate_y_pos', KeyL: 'rotate_y_neg',
  KeyU: 'rotate_z_pos', KeyO: 'rotate_z_neg',
  KeyQ: 'camera_left', KeyE: 'camera_right',
  Escape: 'pause', KeyM: 'mute',
};

const DAS_DELAY = 170;
const DAS_RATE = 50;
const DAS_ACTIONS = new Set<Action>([
  'move_left', 'move_right', 'move_forward', 'move_back', 'soft_drop',
]);

interface HeldKey {
  action: Action;
  pressTime: number;
  lastRepeat: number;
}

export class InputHandler {
  private heldKeys = new Map<string, HeldKey>();

  getAction(code: string): Action | null {
    return KEY_MAP[code] ?? null;
  }

  processKeyDown(code: string, time: number): Action[] {
    const action = this.getAction(code);
    if (!action) return [];
    if (!this.heldKeys.has(code)) {
      this.heldKeys.set(code, { action, pressTime: time, lastRepeat: time });
      return [action];
    }
    return [];
  }

  processKeyUp(code: string, _time: number): void {
    this.heldKeys.delete(code);
  }

  tick(time: number): Action[] {
    const actions: Action[] = [];
    for (const [, held] of this.heldKeys) {
      if (!DAS_ACTIONS.has(held.action)) continue;
      if (time - held.pressTime >= DAS_DELAY && time - held.lastRepeat >= DAS_RATE) {
        actions.push(held.action);
        held.lastRepeat = time;
      }
    }
    return actions;
  }

  reset(): void {
    this.heldKeys.clear();
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/game/Input.test.ts
```

**Step 5: Commit**

```bash
git add src/game/Input.ts src/game/Input.test.ts
git commit -m "feat: add input handler with DAS auto-repeat"
```

---

### Task 7: Three.js Scene Setup

**Files:**
- Create: `src/renderer/SceneManager.ts`

No unit tests — thin Three.js wrapper tested visually.

**Step 1: Implement SceneManager**

```ts
// src/renderer/SceneManager.ts
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private clock = new THREE.Clock();

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.3, 0.85
    ));
    const fxaa = new ShaderPass(FXAAShader);
    fxaa.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
    this.composer.addPass(fxaa);

    this.setupLights();
    this.setupEnvironment();
    window.addEventListener('resize', () => this.onResize());
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0x404060, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(5, 10, 5);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    this.scene.add(dir);
    const point = new THREE.PointLight(0x4060ff, 0.5, 20);
    point.position.set(0, 2, 0);
    this.scene.add(point);
  }

  private setupEnvironment(): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(
      new THREE.SphereGeometry(10),
      new THREE.MeshBasicMaterial({ color: 0x1a1a2e, side: THREE.BackSide })
    ));
    this.scene.environment = pmrem.fromScene(envScene).texture;
    pmrem.dispose();
  }

  private onResize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  getDeltaTime(): number { return this.clock.getDelta(); }
  render(): void { this.composer.render(); }
}
```

**Step 2: Commit**

```bash
git add src/renderer/SceneManager.ts
git commit -m "feat: add Three.js scene with post-processing pipeline"
```

---

### Task 8: Glass Block Meshes

**Files:**
- Create: `src/renderer/BlockMesh.ts`

**Step 1: Implement BlockMesh**

```ts
// src/renderer/BlockMesh.ts
import * as THREE from 'three';

const GLASS_COLORS: Record<number, number> = {
  1: 0x00bfff, 2: 0xffd700, 3: 0xda70d6, 4: 0x00ff7f,
  5: 0xff4757, 6: 0xff8c00, 7: 0x4169e1, 8: 0xff69b4,
};

const BLOCK_GEO = new THREE.BoxGeometry(0.92, 0.92, 0.92);
const EDGE_GEO = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.96, 0.96, 0.96));

export class BlockMesh {
  static createBlock(colorId: number): THREE.Group {
    const color = GLASS_COLORS[colorId] ?? 0xffffff;
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(BLOCK_GEO, new THREE.MeshPhysicalMaterial({
      color, transparent: true, transmission: 0.85, roughness: 0.1,
      thickness: 0.5, ior: 1.5, clearcoat: 1.0, clearcoatRoughness: 0.1,
      side: THREE.DoubleSide,
    }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    group.add(new THREE.LineSegments(EDGE_GEO,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 })
    ));
    return group;
  }

  static createGhostBlock(): THREE.Group {
    const group = new THREE.Group();
    group.add(new THREE.LineSegments(EDGE_GEO,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })
    ));
    return group;
  }

  static createWellFrame(width: number, depth: number, height: number): THREE.Group {
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(width, height, depth);
    const wireframe = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x2a2a4a, transparent: true, opacity: 0.5 })
    );
    wireframe.position.set(width / 2 - 0.5, height / 2 - 0.5, depth / 2 - 0.5);
    group.add(wireframe);
    const grid = new THREE.GridHelper(Math.max(width, depth), Math.max(width, depth), 0x1a1a3e, 0x1a1a3e);
    grid.position.set(width / 2 - 0.5, -0.5, depth / 2 - 0.5);
    group.add(grid);
    return group;
  }

  static getColor(colorId: number): number {
    return GLASS_COLORS[colorId] ?? 0xffffff;
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer/BlockMesh.ts
git commit -m "feat: add glass block mesh factory with translucent materials"
```

---

### Task 9: Camera Controller

**Files:**
- Create: `src/renderer/CameraController.ts`

**Step 1: Implement CameraController**

```ts
// src/renderer/CameraController.ts
import * as THREE from 'three';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3();
  private angle = Math.PI / 4;
  private targetAngle = Math.PI / 4;
  private radius: number;
  private elevation: number;

  constructor(camera: THREE.PerspectiveCamera, w: number, d: number, h: number) {
    this.camera = camera;
    this.target.set(w / 2 - 0.5, h / 3, d / 2 - 0.5);
    this.radius = Math.max(w, d) * 2;
    this.elevation = h * 0.8;
    this.updateCamera();
  }

  orbitLeft(): void { this.targetAngle += Math.PI / 4; }
  orbitRight(): void { this.targetAngle -= Math.PI / 4; }

  update(dt: number): void {
    this.angle += (this.targetAngle - this.angle) * 5 * dt;
    this.updateCamera();
  }

  private updateCamera(): void {
    this.camera.position.set(
      this.target.x + Math.cos(this.angle) * this.radius,
      this.elevation,
      this.target.z + Math.sin(this.angle) * this.radius,
    );
    this.camera.lookAt(this.target);
  }

  reset(w: number, d: number, h: number): void {
    this.target.set(w / 2 - 0.5, h / 3, d / 2 - 0.5);
    this.radius = Math.max(w, d) * 2;
    this.elevation = h * 0.8;
    this.angle = this.targetAngle = Math.PI / 4;
    this.updateCamera();
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer/CameraController.ts
git commit -m "feat: add keyboard-driven orbit camera controller"
```

---

### Task 10: Well Renderer

**Files:**
- Create: `src/renderer/WellRenderer.ts`

**Step 1: Implement WellRenderer**

```ts
// src/renderer/WellRenderer.ts
import * as THREE from 'three';
import { Well } from '../game/Well';
import { PieceState, Vec3 } from '../game/Piece';
import { BlockMesh } from './BlockMesh';

export class WellRenderer {
  private scene: THREE.Scene;
  private blockGroup = new THREE.Group();
  private activeGroup = new THREE.Group();
  private ghostGroup = new THREE.Group();
  private wellFrame: THREE.Group;

  constructor(scene: THREE.Scene, w: number, d: number, h: number) {
    this.scene = scene;
    this.wellFrame = BlockMesh.createWellFrame(w, d, h);
    this.scene.add(this.wellFrame);
    this.scene.add(this.blockGroup);
    this.scene.add(this.activeGroup);
    this.scene.add(this.ghostGroup);
  }

  updateWell(well: Well): void {
    this.blockGroup.clear();
    for (let y = 0; y < well.height; y++) {
      for (let x = 0; x < well.width; x++) {
        for (let z = 0; z < well.depth; z++) {
          const c = well.getCell(x, y, z);
          if (c !== 0) {
            const block = BlockMesh.createBlock(c);
            block.position.set(x, y, z);
            this.blockGroup.add(block);
          }
        }
      }
    }
  }

  updateActivePiece(piece: PieceState | null): void {
    this.activeGroup.clear();
    if (!piece) return;
    for (const [x, y, z] of piece.worldCubes()) {
      const block = BlockMesh.createBlock(piece.colorId);
      block.position.set(x, y, z);
      this.activeGroup.add(block);
    }
  }

  updateGhost(piece: PieceState | null, ghostPos: Vec3 | null): void {
    this.ghostGroup.clear();
    if (!piece || !ghostPos) return;
    for (const [cx, cy, cz] of piece.cubes) {
      const ghost = BlockMesh.createGhostBlock();
      ghost.position.set(cx + ghostPos[0], cy + ghostPos[1], cz + ghostPos[2]);
      this.ghostGroup.add(ghost);
    }
  }

  dispose(): void {
    this.scene.remove(this.wellFrame);
    this.scene.remove(this.blockGroup);
    this.scene.remove(this.activeGroup);
    this.scene.remove(this.ghostGroup);
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer/WellRenderer.ts
git commit -m "feat: add well renderer connecting game state to Three.js meshes"
```

---

### Task 11: Particle Effects

**Files:**
- Create: `src/renderer/Effects.ts`

**Step 1: Implement Effects**

```ts
// src/renderer/Effects.ts
import * as THREE from 'three';
import { BlockMesh } from './BlockMesh';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class Effects {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private shakeIntensity = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  planeClearEffect(width: number, depth: number, y: number, colorId: number): void {
    const color = BlockMesh.getColor(colorId);
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        for (let i = 0; i < 4; i++) {
          const geo = new THREE.BoxGeometry(
            0.1 + Math.random() * 0.2, 0.1 + Math.random() * 0.2, 0.1 + Math.random() * 0.2
          );
          const mat = new THREE.MeshPhysicalMaterial({
            color, transparent: true, transmission: 0.7, opacity: 1.0,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5);
          this.scene.add(mesh);
          this.particles.push({
            mesh, life: 1.0, maxLife: 0.8 + Math.random() * 0.6,
            velocity: new THREE.Vector3(
              (Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4
            ),
          });
        }
      }
    }
    this.shakeIntensity = 0.15;
  }

  gameOverEffect(width: number, depth: number, height: number): void {
    this.shakeIntensity = 0.3;
  }

  update(dt: number, camera: THREE.Camera): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.velocity.y -= 9.8 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.rotation.x += dt * 3;
      p.life -= dt / p.maxLife;
      (p.mesh.material as THREE.MeshPhysicalMaterial).opacity = Math.max(0, p.life);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
    if (this.shakeIntensity > 0) {
      camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= 0.9;
      if (this.shakeIntensity < 0.001) this.shakeIntensity = 0;
    }
  }

  dispose(): void {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles = [];
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer/Effects.ts
git commit -m "feat: add particle effects for plane clears and game over"
```

---

### Task 12: Audio Engine & Sound Effects

**Files:**
- Create: `src/audio/AudioEngine.ts`
- Create: `src/audio/SoundEffects.ts`

**Step 1: Implement AudioEngine**

```ts
// src/audio/AudioEngine.ts
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _sfxVolume = 0.7;
  private _musicVolume = 0.5;
  private _muted = false;

  get context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  get master(): GainNode {
    this.context;
    return this.masterGain!;
  }

  get sfxVolume(): number { return this._sfxVolume; }
  set sfxVolume(v: number) { this._sfxVolume = Math.max(0, Math.min(1, v)); }
  get musicVolume(): number { return this._musicVolume; }
  set musicVolume(v: number) { this._musicVolume = Math.max(0, Math.min(1, v)); }
  get muted(): boolean { return this._muted; }

  toggleMute(): void {
    this._muted = !this._muted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this._muted ? 0 : 1, this.context.currentTime);
    }
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  createOscillator(type: OscillatorType, freq: number): OscillatorNode {
    const osc = this.context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.context.currentTime);
    return osc;
  }

  createGain(value: number): GainNode {
    const g = this.context.createGain();
    g.gain.setValueAtTime(value, this.context.currentTime);
    return g;
  }

  createNoise(duration: number): AudioBufferSourceNode {
    const size = this.context.sampleRate * duration;
    const buf = this.context.createBuffer(1, size, this.context.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = this.context.createBufferSource();
    src.buffer = buf;
    return src;
  }
}
```

**Step 2: Implement SoundEffects**

```ts
// src/audio/SoundEffects.ts
import { AudioEngine } from './AudioEngine';

export class SoundEffects {
  constructor(private engine: AudioEngine) {}
  private get ctx() { return this.engine.context; }
  private get vol() { return this.engine.sfxVolume; }

  move(): void {
    const t = this.ctx.currentTime;
    const n = this.engine.createNoise(0.05);
    const g = this.engine.createGain(this.vol * 0.3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.setValueAtTime(4000, t);
    n.connect(f); f.connect(g); g.connect(this.engine.master);
    n.start(t); n.stop(t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  }

  rotate(): void {
    const t = this.ctx.currentTime;
    const o = this.engine.createOscillator('sine', 800);
    const g = this.engine.createGain(this.vol * 0.2);
    o.frequency.exponentialRampToValueAtTime(1600, t + 0.08);
    o.connect(g); g.connect(this.engine.master);
    o.start(t); o.stop(t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  }

  softDrop(): void {
    const t = this.ctx.currentTime;
    const o = this.engine.createOscillator('sine', 150);
    const g = this.engine.createGain(this.vol * 0.15);
    o.connect(g); g.connect(this.engine.master);
    o.start(t); o.stop(t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  }

  hardDrop(): void {
    const t = this.ctx.currentTime;
    const o = this.engine.createOscillator('triangle', 80);
    const g1 = this.engine.createGain(this.vol * 0.5);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    o.connect(g1); g1.connect(this.engine.master);
    o.start(t); o.stop(t + 0.15);
    const n = this.engine.createNoise(0.1);
    const g2 = this.engine.createGain(this.vol * 0.3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(500, t);
    n.connect(f); f.connect(g2); g2.connect(this.engine.master);
    n.start(t); n.stop(t + 0.1);
  }

  planeClear(count: number): void {
    const t = this.ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const delay = i * 0.08;
      const freq = 600 + i * 200;
      const o = this.engine.createOscillator('sine', freq);
      const g = this.engine.createGain(this.vol * 0.3);
      o.frequency.exponentialRampToValueAtTime(freq + 400, t + delay + 0.3);
      o.connect(g); g.connect(this.engine.master);
      o.start(t + delay); o.stop(t + delay + 0.3);
      g.gain.setValueAtTime(this.vol * 0.3, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.3);
    }
    const n = this.engine.createNoise(0.2);
    const ng = this.engine.createGain(this.vol * 0.15);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.setValueAtTime(3000, t);
    n.connect(f); f.connect(ng); ng.connect(this.engine.master);
    n.start(t); n.stop(t + 0.2);
  }

  combo(multiplier: number): void {
    const t = this.ctx.currentTime;
    const freq = 400 + multiplier * 200;
    const o = this.engine.createOscillator('sine', freq);
    const g = this.engine.createGain(this.vol * 0.25);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.15);
    o.connect(g); g.connect(this.engine.master);
    o.start(t); o.stop(t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  }

  levelUp(): void {
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const d = i * 0.1;
      const o = this.engine.createOscillator('sine', freq);
      const g = this.engine.createGain(this.vol * 0.3);
      o.connect(g); g.connect(this.engine.master);
      o.start(t + d); o.stop(t + d + 0.15);
      g.gain.setValueAtTime(this.vol * 0.3, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.15);
    });
  }

  gameOver(): void {
    const t = this.ctx.currentTime;
    [523, 392, 330, 262].forEach((freq, i) => {
      const d = i * 0.25;
      const o = this.engine.createOscillator('triangle', freq);
      const g = this.engine.createGain(this.vol * 0.4);
      o.connect(g); g.connect(this.engine.master);
      o.start(t + d); o.stop(t + d + 0.4);
      g.gain.setValueAtTime(this.vol * 0.4, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.4);
    });
  }
}
```

**Step 3: Commit**

```bash
git add src/audio/AudioEngine.ts src/audio/SoundEffects.ts
git commit -m "feat: add procedural audio engine and sound effects"
```

---

### Task 13: Procedural Music Generator

**Files:**
- Create: `src/audio/MusicGenerator.ts`

**Step 1: Implement MusicGenerator**

```ts
// src/audio/MusicGenerator.ts
import { AudioEngine } from './AudioEngine';

export class MusicGenerator {
  private engine: AudioEngine;
  private oscillators: OscillatorNode[] = [];
  private isPlaying = false;
  private level = 1;
  private loopTimer: number | null = null;

  constructor(engine: AudioEngine) { this.engine = engine; }
  private get ctx() { return this.engine.context; }

  start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.createPad();
    this.scheduleArpeggio();
  }

  stop(): void {
    this.isPlaying = false;
    for (const o of this.oscillators) { try { o.stop(); } catch {} }
    this.oscillators = [];
    if (this.loopTimer !== null) { clearTimeout(this.loopTimer); this.loopTimer = null; }
  }

  setLevel(level: number): void { this.level = level; }

  private createPad(): void {
    const t = this.ctx.currentTime;
    const vol = this.engine.musicVolume;
    for (const freq of [65.41, 98.0]) {
      const osc = this.engine.createOscillator('sine', freq);
      const gain = this.engine.createGain(vol * 0.08);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200 + this.level * 20, t);
      const lfo = this.engine.createOscillator('sine', 0.3 + this.level * 0.05);
      const lfoGain = this.engine.createGain(3);
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency); lfo.start(t);
      osc.connect(filter); filter.connect(gain); gain.connect(this.engine.master);
      osc.start(t);
      this.oscillators.push(osc, lfo);
    }
  }

  private scheduleArpeggio(): void {
    if (!this.isPlaying) return;
    const t = this.ctx.currentTime;
    const vol = this.engine.musicVolume;
    const scale = [130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63];
    const tempo = 0.3 - Math.min(this.level * 0.01, 0.15);
    const numNotes = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numNotes; i++) {
      const freq = scale[Math.floor(Math.random() * scale.length)];
      const d = i * tempo;
      const o = this.engine.createOscillator('sine', freq);
      const g = this.engine.createGain(vol * 0.06);
      o.connect(g); g.connect(this.engine.master);
      o.start(t + d); o.stop(t + d + tempo * 0.8);
      g.gain.setValueAtTime(vol * 0.06, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + tempo * 0.8);
    }
    this.loopTimer = window.setTimeout(() => this.scheduleArpeggio(), (numNotes * tempo + 0.5) * 1000);
  }
}
```

**Step 2: Commit**

```bash
git add src/audio/MusicGenerator.ts
git commit -m "feat: add procedural ambient music generator"
```

---

### Task 14: HUD Overlay

**Files:**
- Create: `src/ui/HUD.ts`

Uses safe DOM construction (createElement/textContent).

**Step 1: Implement HUD**

```ts
// src/ui/HUD.ts
function el(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

export class HUD {
  private container: HTMLElement;
  private scoreEl: HTMLElement;
  private levelEl: HTMLElement;
  private planesEl: HTMLElement;
  private comboEl: HTMLElement;

  constructor() {
    this.container = el('div');
    this.container.id = 'hud';

    const panel = el('div', 'hud-panel hud-left');
    panel.appendChild(el('div', 'hud-label', 'SCORE'));
    this.scoreEl = el('div', 'hud-value', '0');
    panel.appendChild(this.scoreEl);
    panel.appendChild(el('div', 'hud-label', 'LEVEL'));
    this.levelEl = el('div', 'hud-value', '1');
    panel.appendChild(this.levelEl);
    panel.appendChild(el('div', 'hud-label', 'PLANES'));
    this.planesEl = el('div', 'hud-value', '0');
    panel.appendChild(this.planesEl);
    this.container.appendChild(panel);

    this.comboEl = el('div', 'hud-combo');
    this.comboEl.id = 'hud-combo';
    this.container.appendChild(this.comboEl);

    document.body.appendChild(this.container);
  }

  update(score: number, level: number, planes: number): void {
    this.scoreEl.textContent = score.toLocaleString();
    this.levelEl.textContent = String(level);
    this.planesEl.textContent = String(planes);
  }

  showCombo(multiplier: number): void {
    this.comboEl.textContent = `COMBO x${multiplier.toFixed(1)}`;
    this.comboEl.classList.add('flash');
    setTimeout(() => this.comboEl.classList.remove('flash'), 500);
  }

  hideCombo(): void { this.comboEl.textContent = ''; }
  show(): void { this.container.style.display = ''; }
  hide(): void { this.container.style.display = 'none'; }
  dispose(): void { this.container.remove(); }
}
```

**Step 2: Commit**

```bash
git add src/ui/HUD.ts
git commit -m "feat: add HUD overlay for score, level, and combo display"
```

---

### Task 15: Menu Screens

**Files:**
- Create: `src/ui/MenuScreen.ts`

Uses safe DOM construction throughout.

**Step 1: Implement MenuScreen**

```ts
// src/ui/MenuScreen.ts
export type WellSize = 'small' | 'medium' | 'large';

export interface MenuCallbacks {
  onStart: (size: WellSize) => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onSfxVolume: (v: number) => void;
  onMusicVolume: (v: number) => void;
}

function el(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function btn(className: string, text: string, onClick: () => void): HTMLElement {
  const b = el('button', className, text);
  b.addEventListener('click', onClick);
  return b;
}

function slider(id: string, value: number, onInput: (v: number) => void): HTMLInputElement {
  const s = document.createElement('input');
  s.type = 'range'; s.min = '0'; s.max = '100';
  s.value = String(value); s.className = 'volume-slider'; s.id = id;
  s.addEventListener('input', () => onInput(Number(s.value) / 100));
  return s;
}

export class MenuScreen {
  private overlay: HTMLElement;
  private callbacks: MenuCallbacks;
  private selectedSize: WellSize = 'medium';
  private enterHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(callbacks: MenuCallbacks) {
    this.callbacks = callbacks;
    this.overlay = el('div');
    this.overlay.id = 'menu-overlay';
    document.body.appendChild(this.overlay);
  }

  showStartScreen(): void {
    this.overlay.replaceChildren();
    const container = el('div', 'menu-container');

    // Title
    const title = el('h1', 'menu-title', 'TETRIS');
    const sub = el('span', 'title-3d', '3D');
    title.appendChild(sub);
    container.appendChild(title);

    // Size selector
    const sizeSection = el('div', 'menu-section');
    sizeSection.appendChild(el('div', 'menu-label', 'WELL SIZE'));
    const sizeRow = el('div', 'size-selector');
    const sizes: { key: WellSize; label: string; dim: string }[] = [
      { key: 'small', label: 'SMALL', dim: '4x4x10' },
      { key: 'medium', label: 'MEDIUM', dim: '5x5x12' },
      { key: 'large', label: 'LARGE', dim: '6x6x15' },
    ];
    const sizeBtns: HTMLElement[] = [];
    for (const s of sizes) {
      const b = el('button', `size-btn${s.key === this.selectedSize ? ' selected' : ''}`);
      b.appendChild(document.createTextNode(s.label));
      b.appendChild(document.createElement('br'));
      b.appendChild(el('span', 'size-dim', s.dim));
      b.dataset.size = s.key;
      b.addEventListener('click', () => {
        sizeBtns.forEach(sb => sb.classList.remove('selected'));
        b.classList.add('selected');
        this.selectedSize = s.key;
      });
      sizeBtns.push(b);
      sizeRow.appendChild(b);
    }
    sizeSection.appendChild(sizeRow);
    container.appendChild(sizeSection);

    // Volume sliders
    const volSection = el('div', 'menu-section');
    volSection.appendChild(el('div', 'menu-label', 'SFX'));
    volSection.appendChild(slider('sfx-slider', 70, (v) => this.callbacks.onSfxVolume(v)));
    volSection.appendChild(el('div', 'menu-label', 'MUSIC'));
    volSection.appendChild(slider('music-slider', 50, (v) => this.callbacks.onMusicVolume(v)));
    container.appendChild(volSection);

    // Start button
    const startSection = el('div', 'menu-section');
    startSection.appendChild(btn('menu-btn primary', 'PRESS ENTER TO START',
      () => this.callbacks.onStart(this.selectedSize)));
    container.appendChild(startSection);

    // Controls reference
    const ctrlSection = el('div', 'menu-section controls-ref');
    ctrlSection.appendChild(el('div', 'menu-label', 'CONTROLS'));
    const grid = el('div', 'controls-grid');
    const controls = [
      ['WASD / Arrows', 'Move piece'],
      ['I/K J/L U/O', 'Rotate X/Y/Z'],
      ['Space', 'Hard drop'],
      ['Shift', 'Soft drop'],
      ['Q / E', 'Orbit camera'],
      ['Esc', 'Pause'],
      ['M', 'Mute'],
    ];
    for (const [key, desc] of controls) {
      grid.appendChild(el('span', undefined, key));
      grid.appendChild(el('span', undefined, desc));
    }
    ctrlSection.appendChild(grid);
    container.appendChild(ctrlSection);

    this.overlay.appendChild(container);
    this.overlay.style.display = '';

    // Enter key
    this.cleanupEnterHandler();
    this.enterHandler = (e: KeyboardEvent) => {
      if (e.code === 'Enter') {
        this.cleanupEnterHandler();
        this.callbacks.onStart(this.selectedSize);
      }
    };
    document.addEventListener('keydown', this.enterHandler);
  }

  showPauseScreen(): void {
    this.overlay.replaceChildren();
    this.cleanupEnterHandler();
    const container = el('div', 'menu-container');
    container.appendChild(el('h2', 'menu-title', 'PAUSED'));
    container.appendChild(btn('menu-btn primary', 'RESUME', () => this.callbacks.onResume()));
    container.appendChild(btn('menu-btn', 'RESTART', () => this.callbacks.onRestart()));
    container.appendChild(btn('menu-btn', 'QUIT TO MENU', () => this.callbacks.onQuit()));
    this.overlay.appendChild(container);
    this.overlay.style.display = '';
  }

  showGameOver(score: number, level: number, planes: number, timeMs: number, isHighScore: boolean): void {
    this.overlay.replaceChildren();
    this.cleanupEnterHandler();
    const container = el('div', 'menu-container');
    container.appendChild(el('h2', 'menu-title', 'GAME OVER'));

    const grid = el('div', 'stats-grid');
    const stats = [
      ['Score', score.toLocaleString()],
      ['Level', String(level)],
      ['Planes', String(planes)],
      ['Time', formatTime(timeMs)],
    ];
    for (const [label, value] of stats) {
      grid.appendChild(el('span', undefined, label));
      grid.appendChild(el('span', undefined, value));
    }
    container.appendChild(grid);

    if (isHighScore) {
      const hs = el('div', 'menu-section');
      hs.appendChild(el('div', 'menu-label', 'NEW HIGH SCORE!'));
      const input = document.createElement('input');
      input.type = 'text'; input.id = 'name-input';
      input.className = 'name-input'; input.placeholder = 'Enter name';
      input.maxLength = 10;
      hs.appendChild(input);
      container.appendChild(hs);
    }

    container.appendChild(btn('menu-btn primary', 'PLAY AGAIN', () => this.callbacks.onRestart()));
    container.appendChild(btn('menu-btn', 'MAIN MENU', () => this.callbacks.onQuit()));
    this.overlay.appendChild(container);
    this.overlay.style.display = '';
  }

  getNameInput(): string {
    const input = document.getElementById('name-input') as HTMLInputElement | null;
    return input?.value.trim() || 'AAA';
  }

  hide(): void {
    this.overlay.style.display = 'none';
    this.cleanupEnterHandler();
  }

  private cleanupEnterHandler(): void {
    if (this.enterHandler) {
      document.removeEventListener('keydown', this.enterHandler);
      this.enterHandler = null;
    }
  }

  dispose(): void { this.overlay.remove(); this.cleanupEnterHandler(); }
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}
```

**Step 2: Commit**

```bash
git add src/ui/MenuScreen.ts
git commit -m "feat: add menu screens for start, pause, and game over"
```

---

### Task 16: Leaderboard

**Files:**
- Create: `src/ui/Leaderboard.ts`
- Create: `src/ui/Leaderboard.test.ts`

**Step 1: Write failing tests**

```ts
// src/ui/Leaderboard.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Leaderboard } from './Leaderboard';

const mockStorage: Record<string, string> = {};
const mock = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
} as unknown as Storage;

describe('Leaderboard', () => {
  beforeEach(() => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; });

  it('starts empty', () => {
    expect(new Leaderboard('small', mock).getScores()).toEqual([]);
  });

  it('adds and retrieves scores', () => {
    const lb = new Leaderboard('small', mock);
    lb.addScore({ name: 'AAA', score: 1000, level: 5, wellSize: 'small' });
    expect(lb.getScores()).toHaveLength(1);
  });

  it('keeps top 10 sorted descending', () => {
    const lb = new Leaderboard('small', mock);
    for (let i = 0; i < 12; i++)
      lb.addScore({ name: `P${i}`, score: i * 100, level: 1, wellSize: 'small' });
    const scores = lb.getScores();
    expect(scores).toHaveLength(10);
    expect(scores[0].score).toBe(1100);
  });

  it('isHighScore checks correctly', () => {
    const lb = new Leaderboard('small', mock);
    expect(lb.isHighScore(100)).toBe(true);
    for (let i = 0; i < 10; i++)
      lb.addScore({ name: `P${i}`, score: 1000, level: 1, wellSize: 'small' });
    expect(lb.isHighScore(999)).toBe(false);
    expect(lb.isHighScore(1001)).toBe(true);
  });

  it('separates by well size', () => {
    const lb1 = new Leaderboard('small', mock);
    const lb2 = new Leaderboard('medium', mock);
    lb1.addScore({ name: 'A', score: 100, level: 1, wellSize: 'small' });
    lb2.addScore({ name: 'B', score: 200, level: 1, wellSize: 'medium' });
    expect(lb1.getScores()).toHaveLength(1);
    expect(lb2.getScores()).toHaveLength(1);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/ui/Leaderboard.test.ts
```

**Step 3: Implement Leaderboard**

```ts
// src/ui/Leaderboard.ts
import type { WellSize } from './MenuScreen';

export interface LeaderboardEntry {
  name: string;
  score: number;
  level: number;
  wellSize: WellSize;
}

export class Leaderboard {
  private key: string;
  private storage: Storage;

  constructor(wellSize: WellSize, storage: Storage = localStorage) {
    this.key = `tetris3d_lb_${wellSize}`;
    this.storage = storage;
  }

  getScores(): LeaderboardEntry[] {
    const raw = this.storage.getItem(this.key);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  addScore(entry: LeaderboardEntry): void {
    const scores = this.getScores();
    scores.push(entry);
    scores.sort((a, b) => b.score - a.score);
    this.storage.setItem(this.key, JSON.stringify(scores.slice(0, 10)));
  }

  isHighScore(score: number): boolean {
    const scores = this.getScores();
    return scores.length < 10 || score > scores[scores.length - 1].score;
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/ui/Leaderboard.test.ts
```

**Step 5: Commit**

```bash
git add src/ui/Leaderboard.ts src/ui/Leaderboard.test.ts
git commit -m "feat: add leaderboard with localStorage persistence"
```

---

### Task 17: CSS Styles

**Files:**
- Create: `src/styles.css`

**Step 1: Write the complete stylesheet**

See design doc for full visual spec. Create `src/styles.css` with all HUD, menu, and overlay styles. The glass-themed dark UI with gradient title, translucent panels, and glowing accents. Key classes: `.hud-panel`, `.hud-value`, `.menu-container`, `.menu-title`, `.size-btn`, `.menu-btn`, `.controls-grid`, `.stats-grid`, `.name-input`, `.hud-combo.flash`.

Refer to the design doc Section 7 (UI) for the complete list of screens and elements to style.

**Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat: add glass-themed CSS styles for HUD and menus"
```

---

### Task 18: Main Entry Point — Wire Everything Together

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`

**Step 1: Update index.html**

Simple HTML with just a canvas element and script tag.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TETRIS 3D</title>
  </head>
  <body>
    <canvas id="game-canvas"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

**Step 2: Implement main.ts — the App class**

Wire all systems together:
- Create `App` class managing state transitions: `menu` | `playing` | `paused` | `gameover`
- Initialize SceneManager, AudioEngine, SoundEffects, MusicGenerator, HUD, MenuScreen
- `startGame(size)`: create GameState, WellRenderer, CameraController; start music; show HUD
- `onKeyDown/onKeyUp`: dispatch to InputHandler, then map Actions to game methods
- Action mapping: movement calls `game.tryMove()`, rotation calls `game.tryRotate()` (3x for negative), camera calls `cameraController.orbit*()`, hard/soft drop
- Game loop via `requestAnimationFrame`:
  - Process DAS input ticks
  - Accumulate gravity timer, call `game.tick()` when interval reached
  - Flush game events → trigger SFX, particle effects, HUD updates
  - Update WellRenderer, CameraController, Effects
  - Render via SceneManager
- Event handlers: `planes_cleared` → sfx + particles, `combo` → sfx + HUD, `level_up` → sfx + music, `game_over` → sfx + effects + delayed menu transition

**Step 3: Verify the app runs**

```bash
npm run dev
```

Test all features manually (see design doc for full checklist).

**Step 4: Run all tests**

```bash
npm run test
```

**Step 5: Commit**

```bash
git add index.html src/main.ts
git commit -m "feat: wire up complete game loop with all systems"
```

---

### Task 19: Final Polish & Bug Fixes

Manual testing sweep and performance optimization.

**Checklist:**
- [ ] All 8 piece types spawn and display correctly
- [ ] Rotation on all 3 axes with wall kicks
- [ ] Hard/soft drop with score bonuses
- [ ] Plane clearing with particles and sound
- [ ] Combo multiplier display
- [ ] Level progression and speed increase
- [ ] Camera orbit smooth interpolation
- [ ] Ghost piece accuracy
- [ ] All menu screens (start, pause, game over)
- [ ] Leaderboard persistence
- [ ] Mute toggle
- [ ] Window resize

**Performance:** If glass materials cause frame drops, use simpler materials for settled blocks and full glass only on the active piece.

**Final commit:**

```bash
git add -A
git commit -m "polish: final bug fixes and performance tuning"
```
