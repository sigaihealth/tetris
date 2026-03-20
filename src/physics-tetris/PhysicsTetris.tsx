// @ts-nocheck
import { useEffect, useRef, useCallback } from 'react';
import MatterModule from './vendor/matter.js';

const Matter = MatterModule.default || MatterModule;
const { Engine, Bodies, Body, Composite } = Matter;

/* ────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────── */

const COLS = 10;
const ROWS = 20;
const getCellSize = () => {
  const mobile = window.innerWidth < 700;
  const maxH = Math.floor((window.innerHeight - (mobile ? 200 : 120)) / 22);
  const maxW = Math.floor((window.innerWidth - 40) / (COLS + 2));
  return Math.max(18, Math.min(mobile ? 28 : 42, maxH, maxW));
};

const PIECE_DEFS = {
  I: { cells: [[0,0],[1,0],[2,0],[3,0]], color: '#22ddee' },
  O: { cells: [[0,0],[1,0],[0,1],[1,1]], color: '#eedd22' },
  T: { cells: [[0,0],[1,0],[2,0],[1,1]], color: '#ee8822' },
  S: { cells: [[1,0],[2,0],[0,1],[1,1]], color: '#44dd66' },
  Z: { cells: [[0,0],[1,0],[1,1],[2,1]], color: '#ee3366' },
  L: { cells: [[0,0],[0,1],[0,2],[1,2]], color: '#44ee44' },
  J: { cells: [[1,0],[1,1],[1,2],[0,2]], color: '#8844ee' },
};

const PIECE_TYPES = Object.keys(PIECE_DEFS) as (keyof typeof PIECE_DEFS)[];

/* ────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────── */

function hexToRGBA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex: string, amount: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount));
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount));
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
}

/* ────────────────────────────────────────────────────────
   Bag randomiser
   ──────────────────────────────────────────────────────── */

function createBag() {
  let bag: string[] = [];
  function next(): string {
    if (bag.length === 0) {
      bag = [...PIECE_TYPES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop()!;
  }
  return { next };
}

/* ────────────────────────────────────────────────────────
   Piece factory
   ──────────────────────────────────────────────────────── */

function createPiece(type: string, x: number, y: number, cellSize: number) {
  const def = PIECE_DEFS[type as keyof typeof PIECE_DEFS];
  const collisionSize = cellSize * 0.88; // slightly smaller than grid cell for easier fitting
  const parts = def.cells.map(([cx, cy]) =>
    Bodies.rectangle(
      x + cx * cellSize + cellSize / 2,
      y + cy * cellSize + cellSize / 2,
      collisionSize,
      collisionSize,
      { render: { fillStyle: def.color } },
    ),
  );
  const body = Body.create({
    parts,
    restitution: 0.02,       // almost no bounce
    friction: 0.8,            // grip surfaces well
    frictionStatic: 1.2,      // very hard to slide once stopped
    frictionAir: 0.08,        // air drag slows movement
  });
  Body.setInertia(body, body.inertia * 5); // HIGH inertia = strongly resists toppling
  body.pieceType = type;
  body.pieceColor = def.color;
  return body;
}

/* ────────────────────────────────────────────────────────
   Drawing helpers
   ──────────────────────────────────────────────────────── */

function drawPiece(ctx: CanvasRenderingContext2D, body: any, cellSize: number, highlight: boolean) {
  const color = body.pieceColor;
  const type = body.pieceType;
  if (!color || !type) return;
  const cells = PIECE_DEFS[type as keyof typeof PIECE_DEFS]?.cells;
  if (!cells) return;

  // Calculate center of cells in local coords
  let sumX = 0, sumY = 0;
  for (const [cx, cy] of cells) { sumX += cx; sumY += cy; }
  const centerX = sumX / cells.length;
  const centerY = sumY / cells.length;

  ctx.save();

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 5;

  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);

  const R = cellSize * 0.15;

  // Build unified path
  ctx.beginPath();
  for (const [cx, cy] of cells) {
    const x = (cx - centerX) * cellSize - cellSize * 0.46;
    const y = (cy - centerY) * cellSize - cellSize * 0.46;
    const w = cellSize * 0.92;
    const h = cellSize * 0.92;
    roundRect(ctx, x, y, w, h, R);
  }

  // Translucent fill
  ctx.fillStyle = hexToRGBA(color, highlight ? 0.85 : 0.72);
  ctx.fill();

  // Specular / inner glow gradient
  const grad = ctx.createRadialGradient(
    -cellSize * 0.3, -cellSize * 0.4, 0,
    0, 0, cellSize * 2.2,
  );
  grad.addColorStop(0, 'rgba(255,255,255,0.38)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.10)');
  grad.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Clear shadow for strokes
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Dark rim
  ctx.strokeStyle = hexToRGBA(darken(color, 0.3), 0.6);
  ctx.lineWidth = cellSize * 0.05;
  ctx.stroke();

  // Top highlight stroke along top edges
  ctx.beginPath();
  for (const [cx, cy] of cells) {
    const x = (cx - centerX) * cellSize - cellSize * 0.46 + R;
    const y = (cy - centerY) * cellSize - cellSize * 0.46 + cellSize * 0.06;
    const w = cellSize * 0.92 - R * 2;
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = cellSize * 0.06;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.restore();
}

function drawPiecePreview(ctx: CanvasRenderingContext2D, type: string, x: number, y: number, previewCellSize: number) {
  const def = PIECE_DEFS[type as keyof typeof PIECE_DEFS];
  if (!def) return;
  const cells = def.cells;
  const color = def.color;

  let sumX = 0, sumY = 0;
  for (const [cx, cy] of cells) { sumX += cx; sumY += cy; }
  const centerX = sumX / cells.length;
  const centerY = sumY / cells.length;

  ctx.save();
  ctx.translate(x, y);

  const R = previewCellSize * 0.15;

  ctx.beginPath();
  for (const [cx, cy] of cells) {
    const px = (cx - centerX) * previewCellSize - previewCellSize * 0.46;
    const py = (cy - centerY) * previewCellSize - previewCellSize * 0.46;
    roundRect(ctx, px, py, previewCellSize * 0.92, previewCellSize * 0.92, R);
  }
  ctx.fillStyle = hexToRGBA(color, 0.7);
  ctx.fill();
  ctx.strokeStyle = hexToRGBA(darken(color, 0.3), 0.5);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

/* ────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────── */

export default function PhysicsTetris() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<any>(null);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const cellSize = getCellSize();
    const chamberW = COLS * cellSize;
    const chamberH = ROWS * cellSize;
    const wallThickness = 20;
    const offsetX = Math.floor((window.innerWidth - chamberW) / 2);
    const offsetY = Math.floor((window.innerHeight - chamberH) / 2) + 20;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Matter.js engine
    const engine = Engine.create();
    engine.gravity.x = 0;
    engine.gravity.y = 0.8; // gentler gravity — more time to control pieces

    // Walls (static)
    const leftWall = Bodies.rectangle(
      offsetX - wallThickness / 2, offsetY + chamberH / 2,
      wallThickness, chamberH + wallThickness,
      { isStatic: true, label: 'wall' },
    );
    const rightWall = Bodies.rectangle(
      offsetX + chamberW + wallThickness / 2, offsetY + chamberH / 2,
      wallThickness, chamberH + wallThickness,
      { isStatic: true, label: 'wall' },
    );
    const floor = Bodies.rectangle(
      offsetX + chamberW / 2, offsetY + chamberH + wallThickness / 2,
      chamberW + wallThickness * 2, wallThickness,
      { isStatic: true, label: 'wall' },
    );

    Composite.add(engine.world, [leftWall, rightWall, floor]);

    // Game state
    const bag = createBag();
    let score = 0;
    let gameOver = false;
    let activePiece: any = null;
    let settleCounter = 0;
    let settledBodies: any[] = [];
    let nextType = bag.next();
    let lastTime = performance.now();

    // Keys state
    const keys: Record<string, boolean> = {};

    function spawnPiece() {
      const type = nextType;
      nextType = bag.next();
      const def = PIECE_DEFS[type as keyof typeof PIECE_DEFS];
      // Center piece horizontally in chamber
      const pieceCellsX = def.cells.map(c => c[0]);
      const pieceW = (Math.max(...pieceCellsX) - Math.min(...pieceCellsX) + 1) * cellSize;
      const spawnX = offsetX + (chamberW - pieceW) / 2;
      const spawnY = offsetY - cellSize * 2;

      const piece = createPiece(type, spawnX, spawnY, cellSize);
      Composite.add(engine.world, piece);
      activePiece = piece;
      settleCounter = 0;
    }

    function lockPiece() {
      if (!activePiece) return;

      // Check game over: if any part of the piece is above the chamber top
      const bounds = activePiece.bounds;
      if (bounds.min.y < offsetY - cellSize) {
        gameOver = true;
        activePiece = null;
        return;
      }

      // 1. Snap angle to nearest 90 degrees
      const lockAngle = Math.round(activePiece.angle / (Math.PI / 2)) * (Math.PI / 2);
      Body.setAngle(activePiece, lockAngle);

      // 2. Snap position to grid — align to nearest cell boundary
      //    This ensures pieces stack cleanly and gaps don't appear
      const pos = activePiece.position;
      const gridX = Math.round((pos.x - offsetX) / cellSize) * cellSize + offsetX;
      const gridY = Math.round((pos.y - offsetY) / cellSize) * cellSize + offsetY;
      Body.setPosition(activePiece, { x: gridX, y: gridY });

      // 3. After snapping, check for overlap with existing pieces and nudge if needed
      //    Push the piece upward until it doesn't overlap settled bodies
      let pushAttempts = 0;
      while (pushAttempts < 10) {
        let overlapping = false;
        for (const settled of settledBodies) {
          if (Matter.SAT && Matter.SAT.collides) {
            // Use SAT if available
            for (const partA of activePiece.parts) {
              for (const partB of settled.parts) {
                if (partA === activePiece || partB === settled) continue;
                const col = Matter.SAT.collides(partA, partB);
                if (col && col.collided) { overlapping = true; break; }
              }
              if (overlapping) break;
            }
          } else {
            // Fallback: AABB overlap check
            const a = activePiece.bounds, b = settled.bounds;
            if (a.min.x < b.max.x && a.max.x > b.min.x && a.min.y < b.max.y && a.max.y > b.min.y) {
              overlapping = true;
            }
          }
          if (overlapping) break;
        }
        if (!overlapping) break;
        // Nudge up by 1 cell
        Body.setPosition(activePiece, { x: activePiece.position.x, y: activePiece.position.y - cellSize });
        pushAttempts++;
      }

      Body.setVelocity(activePiece, { x: 0, y: 0 });
      Body.setAngularVelocity(activePiece, 0);
      Body.setStatic(activePiece, true);
      settledBodies.push(activePiece);
      score += 1;
      activePiece = null;
    }

    spawnPiece();

    // Render loop
    let frameId: number;

    function loop(time: number) {
      const dt = Math.min(time - lastTime, 50);
      lastTime = time;

      if (gameOver) {
        drawFrame(ctx, canvas, offsetX, offsetY, chamberW, chamberH, cellSize, settledBodies, activePiece, score, nextType, gameOver);
        frameId = requestAnimationFrame(loop);
        return;
      }

      // Apply forces from keys — strong, responsive controls
      if (activePiece) {
        const forceMag = 0.025 * (activePiece.mass || 1);

        if (keys['ArrowLeft'] || keys['KeyA']) {
          Body.applyForce(activePiece, activePiece.position, { x: -forceMag, y: 0 });
          // Cap horizontal velocity so it doesn't fly off
          if (activePiece.velocity.x < -4) Body.setVelocity(activePiece, { x: -4, y: activePiece.velocity.y });
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
          Body.applyForce(activePiece, activePiece.position, { x: forceMag, y: 0 });
          if (activePiece.velocity.x > 4) Body.setVelocity(activePiece, { x: 4, y: activePiece.velocity.y });
        }
        if (keys['ArrowDown'] || keys['KeyS']) {
          Body.applyForce(activePiece, activePiece.position, { x: 0, y: forceMag * 3 });
        }

        // Angular damping — strongly resist spinning so pieces stay flat
        Body.setAngularVelocity(activePiece, activePiece.angularVelocity * 0.82);

        // Angle correction — nudge toward nearest 90-degree alignment
        const snapAngle = Math.round(activePiece.angle / (Math.PI / 2)) * (Math.PI / 2);
        const angleDiff = snapAngle - activePiece.angle;
        Body.setAngularVelocity(activePiece, activePiece.angularVelocity + angleDiff * 0.06);

        // Horizontal grid-snap guidance — gently nudge piece toward nearest column
        // This makes pieces naturally align to the grid without feeling forced
        const nearestGridX = Math.round((activePiece.position.x - offsetX) / cellSize) * cellSize + offsetX;
        const xDiff = nearestGridX - activePiece.position.x;
        if (Math.abs(xDiff) > 1) {
          Body.applyForce(activePiece, activePiece.position, { x: xDiff * 0.0003 * (activePiece.mass || 1), y: 0 });
        }
      }

      // Step physics (fixed timestep)
      Engine.update(engine, dt);

      // Settling detection
      if (activePiece) {
        const vel = activePiece.velocity;
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y) + Math.abs(activePiece.angularVelocity);
        if (speed < 0.5 && activePiece.position.y > offsetY) {
          settleCounter++;
        } else {
          settleCounter = Math.max(0, settleCounter - 1);
        }
        if (settleCounter > 60) { // ~1 second of stillness before locking
          lockPiece();
          if (!gameOver) spawnPiece();
        }
      }

      drawFrame(ctx, canvas, offsetX, offsetY, chamberW, chamberH, cellSize, settledBodies, activePiece, score, nextType, gameOver);
      frameId = requestAnimationFrame(loop);
    }

    function drawFrame(
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      offsetX: number, offsetY: number,
      chamberW: number, chamberH: number,
      cellSize: number,
      settled: any[],
      active: any,
      score: number,
      nextType: string,
      gameOver: boolean,
    ) {
      // Background
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Dark gradient background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGrad.addColorStop(0, '#0a0e1a');
      bgGrad.addColorStop(0.5, '#101828');
      bgGrad.addColorStop(1, '#0a0e1a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Chamber background
      ctx.fillStyle = 'rgba(8, 12, 24, 0.6)';
      ctx.fillRect(offsetX, offsetY, chamberW, chamberH);

      // Faint grid lines
      ctx.strokeStyle = 'rgba(60, 80, 120, 0.12)';
      ctx.lineWidth = 1;
      for (let i = 1; i < COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + i * cellSize, offsetY);
        ctx.lineTo(offsetX + i * cellSize, offsetY + chamberH);
        ctx.stroke();
      }
      for (let j = 1; j < ROWS; j++) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + j * cellSize);
        ctx.lineTo(offsetX + chamberW, offsetY + j * cellSize);
        ctx.stroke();
      }

      // Chamber walls
      ctx.strokeStyle = 'rgba(100, 140, 200, 0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(offsetX - 1, offsetY - 1, chamberW + 2, chamberH + 2);

      // Draw settled pieces
      ctx.globalCompositeOperation = 'source-over';
      for (const body of settled) {
        drawPiece(ctx, body, cellSize, false);
      }

      // Draw active piece
      if (active) {
        drawPiece(ctx, active, cellSize, true);
      }

      // Clear shadows for UI text
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Title
      ctx.font = `bold ${Math.round(cellSize * 0.6)}px 'Courier New', monospace`;
      ctx.fillStyle = 'rgba(180, 200, 240, 0.8)';
      ctx.textAlign = 'center';
      ctx.fillText('PHYSICS TETRIS', offsetX + chamberW / 2, offsetY - cellSize * 0.4);

      // Score (top left of chamber)
      ctx.font = `bold ${Math.round(cellSize * 0.45)}px 'Courier New', monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(200, 220, 255, 0.9)';
      ctx.fillText(`SCORE: ${score}`, offsetX - cellSize * 0.1, offsetY - cellSize * 1.2);

      // Next piece preview (right of chamber)
      const previewX = offsetX + chamberW + cellSize * 2.5;
      const previewY = offsetY + cellSize * 2;
      ctx.font = `bold ${Math.round(cellSize * 0.38)}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(160, 180, 220, 0.7)';
      ctx.fillText('NEXT', previewX, previewY - cellSize * 1.2);

      // Draw next piece preview
      const previewCellSize = cellSize * 0.7;
      drawPiecePreview(ctx, nextType, previewX, previewY, previewCellSize);

      // Controls hint (below chamber)
      ctx.font = `${Math.round(cellSize * 0.3)}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(120, 140, 180, 0.5)';
      ctx.fillText(
        '\u2190\u2192 Move  \u2191 Rotate  \u2193 Soft drop  SPACE Slam  ESC Menu',
        offsetX + chamberW / 2,
        offsetY + chamberH + cellSize * 1.0,
      );

      // Game over overlay
      if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(offsetX, offsetY, chamberW, chamberH);

        ctx.font = `bold ${Math.round(cellSize * 0.9)}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 80, 80, 0.9)';
        ctx.fillText('GAME OVER', offsetX + chamberW / 2, offsetY + chamberH / 2 - cellSize);

        ctx.font = `bold ${Math.round(cellSize * 0.5)}px 'Courier New', monospace`;
        ctx.fillStyle = 'rgba(200, 220, 255, 0.8)';
        ctx.fillText(`Score: ${score}`, offsetX + chamberW / 2, offsetY + chamberH / 2 + cellSize * 0.3);

        ctx.font = `${Math.round(cellSize * 0.35)}px 'Courier New', monospace`;
        ctx.fillStyle = 'rgba(160, 180, 220, 0.6)';
        ctx.fillText('Press SPACE to restart  |  ESC for menu', offsetX + chamberW / 2, offsetY + chamberH / 2 + cellSize * 1.5);
      }
    }

    // Keyboard handlers
    function onKeyDown(e: KeyboardEvent) {
      keys[e.code] = true;

      if (e.code === 'Escape') {
        // Dispatch exit event
        window.dispatchEvent(new CustomEvent('physics-tetris-exit'));
        return;
      }

      if (gameOver && e.code === 'Space') {
        // Restart
        e.preventDefault();
        cleanup();
        init();
        return;
      }

      if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
      }

      if (!activePiece || gameOver) return;

      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        // Snap rotate 90 degrees — much more controllable than torque
        const targetAngle = Math.round(activePiece.angle / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 2;
        Body.setAngle(activePiece, targetAngle);
        Body.setAngularVelocity(activePiece, 0);
      }

      if (e.code === 'Space') {
        // Slam down — fast, kills horizontal movement, straightens piece
        Body.setVelocity(activePiece, { x: 0, y: 12 });
        Body.setAngularVelocity(activePiece, 0);
        // Snap angle to nearest 90 degrees
        const sAngle = Math.round(activePiece.angle / (Math.PI / 2)) * (Math.PI / 2);
        Body.setAngle(activePiece, sAngle);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      keys[e.code] = false;
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    frameId = requestAnimationFrame(loop);

    function cleanup() {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      Engine.clear(engine);
      // Clear world composites
      Composite.clear(engine.world, false);
    }

    // Store cleanup reference
    stateRef.current = { cleanup };
  }, []);

  useEffect(() => {
    init();
    return () => {
      if (stateRef.current?.cleanup) {
        stateRef.current.cleanup();
      }
    };
  }, [init]);

  // Handle resize
  useEffect(() => {
    function onResize() {
      if (stateRef.current?.cleanup) {
        stateRef.current.cleanup();
      }
      init();
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [init]);

  // Expose keys ref so touch buttons can set them
  const keysRef = useRef({});
  useEffect(() => {
    keysRef.current = {};
  }, []);

  // Touch button handlers — set/clear keys just like keyboard
  const touchStart = useCallback((code) => {
    keysRef.current[code] = true;
    // For one-shot actions (rotate, slam), also trigger via a custom event
    if (code === 'ArrowUp' || code === 'Space') {
      window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    }
  }, []);
  const touchEnd = useCallback((code) => {
    keysRef.current[code] = false;
  }, []);

  // Patch keys in the game loop — merge touch keys into the existing keys object
  // We do this by overriding the init effect to also read keysRef
  // Actually simpler: just dispatch keydown/keyup events from touch buttons

  const isMobile = typeof window !== 'undefined' && (window.innerWidth < 700 || 'ontouchstart' in window);

  // Touch button component
  const TB = useCallback(({ label, code, wide, tall }) => (
    <button
      onTouchStart={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown', { code })); }}
      onTouchEnd={(e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keyup', { code })); }}
      onMouseDown={() => window.dispatchEvent(new KeyboardEvent('keydown', { code }))}
      onMouseUp={() => window.dispatchEvent(new KeyboardEvent('keyup', { code }))}
      style={{
        width: wide ? 90 : 62, height: tall ? 62 : 52,
        borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.06)', color: 'rgba(200,220,255,0.7)',
        fontSize: wide ? 12 : 20, fontFamily: "'Orbitron', monospace", fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', touchAction: 'none', userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >{label}</button>
  ), []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#0a0e1a',
      zIndex: 50,
      touchAction: 'none',
    }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Mobile touch controls */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 12, left: 0, right: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          zIndex: 60, pointerEvents: 'auto',
        }}>
          {/* Top row: Rotate + Slam */}
          <div style={{ display: 'flex', gap: 10 }}>
            <TB label="↻" code="ArrowUp" />
            <TB label="SLAM" code="Space" wide />
          </div>
          {/* Bottom row: Left, Down, Right */}
          <div style={{ display: 'flex', gap: 10 }}>
            <TB label="←" code="ArrowLeft" tall />
            <TB label="↓" code="ArrowDown" tall />
            <TB label="→" code="ArrowRight" tall />
          </div>
        </div>
      )}

      {/* Back button for mobile */}
      {isMobile && (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('physics-tetris-exit'))}
          style={{
            position: 'fixed', top: 12, left: 12, zIndex: 60,
            padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.06)', color: 'rgba(200,220,255,0.6)',
            fontFamily: "'Orbitron', monospace", fontSize: 10, fontWeight: 700,
            letterSpacing: 2, cursor: 'pointer',
          }}
        >← MENU</button>
      )}
    </div>
  );
}
