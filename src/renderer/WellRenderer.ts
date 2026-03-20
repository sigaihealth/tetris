import * as THREE from 'three';
import type { Well } from '../game/Well.ts';
import type { PieceState, Vec3 } from '../game/Piece.ts';
import { BlockMesh } from './BlockMesh.ts';

export class WellRenderer {
  private readonly scene: THREE.Scene;
  private readonly wellFrame: THREE.Group;
  private readonly blockGroup: THREE.Group;
  private readonly activeGroup: THREE.Group;
  private readonly ghostGroup: THREE.Group;

  constructor(scene: THREE.Scene, w: number, d: number, h: number) {
    this.scene = scene;

    this.wellFrame = BlockMesh.createWellFrame(w, d, h);
    this.scene.add(this.wellFrame);

    this.blockGroup = new THREE.Group();
    this.scene.add(this.blockGroup);

    this.activeGroup = new THREE.Group();
    this.scene.add(this.activeGroup);

    this.ghostGroup = new THREE.Group();
    this.scene.add(this.ghostGroup);
  }

  updateWell(well: Well): void {
    this.blockGroup.clear();
    for (let y = 0; y < well.height; y++) {
      for (let z = 0; z < well.depth; z++) {
        for (let x = 0; x < well.width; x++) {
          const cell = well.getCell(x, y, z);
          if (cell !== 0) {
            const block = BlockMesh.createBlock(cell);
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

    const worldCubes = piece.worldCubes();
    for (const [x, y, z] of worldCubes) {
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
      ghost.position.set(
        cx + ghostPos[0],
        cy + ghostPos[1],
        cz + ghostPos[2],
      );
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
