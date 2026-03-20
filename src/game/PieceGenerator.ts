import type { PieceType } from './Piece.js';

const ALL_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'L', 'J', 'Tower'];

export class PieceGenerator {
  private bag: PieceType[] = [];

  constructor() { this.fillBag(); }

  private fillBag(): void {
    const bag = [...ALL_TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    this.bag.push(...bag);
  }

  next(): PieceType {
    if (this.bag.length <= 8) this.fillBag();
    return this.bag.shift()!;
  }

  peek(count: number): PieceType[] {
    while (this.bag.length < count) this.fillBag();
    return this.bag.slice(0, count);
  }

  reset(): void {
    this.bag = [];
    this.fillBag();
  }
}
