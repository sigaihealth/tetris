import { describe, it, expect } from 'vitest';
import { PieceGenerator } from './PieceGenerator.js';
import type { PieceType } from './Piece.js';

const ALL_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'L', 'J', 'Tower'];

describe('PieceGenerator', () => {
  it('produces all 8 piece types within each bag of 8', () => {
    const gen = new PieceGenerator();
    const firstBag: PieceType[] = [];
    for (let i = 0; i < 8; i++) {
      firstBag.push(gen.next());
    }
    expect([...firstBag].sort()).toEqual([...ALL_TYPES].sort());
  });

  it('second bag also contains all 8 types', () => {
    const gen = new PieceGenerator();
    // Drain first bag
    for (let i = 0; i < 8; i++) gen.next();
    // Collect second bag
    const secondBag: PieceType[] = [];
    for (let i = 0; i < 8; i++) {
      secondBag.push(gen.next());
    }
    expect([...secondBag].sort()).toEqual([...ALL_TYPES].sort());
  });

  it('generates pieces indefinitely without errors', () => {
    const gen = new PieceGenerator();
    for (let i = 0; i < 100; i++) {
      const piece = gen.next();
      expect(ALL_TYPES).toContain(piece);
    }
  });

  it('peek returns upcoming pieces without consuming them', () => {
    const gen = new PieceGenerator();
    const peeked = gen.peek(3);
    expect(peeked).toHaveLength(3);

    // next() should return the same pieces as peeked
    expect(gen.next()).toBe(peeked[0]);
    expect(gen.next()).toBe(peeked[1]);
    expect(gen.next()).toBe(peeked[2]);
  });

  it('peek returns correct count', () => {
    const gen = new PieceGenerator();
    expect(gen.peek(1)).toHaveLength(1);
    expect(gen.peek(5)).toHaveLength(5);
    expect(gen.peek(10)).toHaveLength(10);
  });

  it('reset starts a fresh bag', () => {
    const gen = new PieceGenerator();
    // Consume some pieces
    for (let i = 0; i < 5; i++) gen.next();
    gen.reset();

    // After reset, should still get all 8 types in the first 8
    const bag: PieceType[] = [];
    for (let i = 0; i < 8; i++) {
      bag.push(gen.next());
    }
    expect([...bag].sort()).toEqual([...ALL_TYPES].sort());
  });
});
