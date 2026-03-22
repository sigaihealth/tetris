import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock peerjs before importing PeerManager
vi.mock('peerjs', () => ({ default: class {} }));

import { PeerManager } from './PeerManager.js';

describe('PeerManager', () => {
  let pm: PeerManager;

  beforeEach(() => {
    pm = new PeerManager();
  });

  describe('generateRoomCode', () => {
    it('returns a 4-digit numeric string', () => {
      const code = pm.generateRoomCode();
      expect(code).toHaveLength(4);
      expect(code).toMatch(/^\d{4}$/);
    });

    it('is between 1000 and 9999', () => {
      for (let i = 0; i < 100; i++) {
        const num = Number(pm.generateRoomCode());
        expect(num).toBeGreaterThanOrEqual(1000);
        expect(num).toBeLessThanOrEqual(9999);
      }
    });

    it('different calls produce different codes (variety in 100 calls)', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(pm.generateRoomCode());
      }
      expect(codes.size).toBeGreaterThan(50);
    });
  });

  describe('generateAlias', () => {
    it('returns a non-empty string', () => {
      const alias = pm.generateAlias();
      expect(alias.length).toBeGreaterThan(0);
    });

    it('matches pattern: adjective + noun + number', () => {
      const adjs = ['Swift', 'Brave', 'Cool', 'Fast', 'Keen', 'Bold', 'Sly', 'Wild'];
      const nouns = ['Fox', 'Cat', 'Owl', 'Bear', 'Wolf', 'Hawk', 'Lion', 'Lynx'];

      for (let i = 0; i < 50; i++) {
        const alias = pm.generateAlias();
        // Should start with one of the adjectives
        const startsWithAdj = adjs.some(a => alias.startsWith(a));
        expect(startsWithAdj).toBe(true);

        // Should contain one of the nouns
        const containsNoun = nouns.some(n => alias.includes(n));
        expect(containsNoun).toBe(true);

        // Should end with a number 0-99
        const numMatch = alias.match(/\d+$/);
        expect(numMatch).not.toBeNull();
        const num = parseInt(numMatch![0], 10);
        expect(num).toBeGreaterThanOrEqual(0);
        expect(num).toBeLessThan(100);
      }
    });

    it('different calls produce variety', () => {
      const aliases = new Set<string>();
      for (let i = 0; i < 100; i++) {
        aliases.add(pm.generateAlias());
      }
      // With 8 * 8 * 100 = 6400 possibilities, 100 calls should have good variety
      expect(aliases.size).toBeGreaterThan(30);
    });
  });

  describe('initial state', () => {
    it('isHost is false', () => {
      expect(pm.isHost).toBe(false);
    });

    it('isConnected is false', () => {
      expect(pm.isConnected).toBe(false);
    });

    it('opponentAlias is "Opponent"', () => {
      expect(pm.opponentAlias).toBe('Opponent');
    });

    it('callback properties are null', () => {
      expect(pm.onMessage).toBeNull();
      expect(pm.onConnected).toBeNull();
      expect(pm.onDisconnected).toBeNull();
    });
  });

  describe('send() with no connection', () => {
    it('does not throw when sending without a connection', () => {
      expect(() => {
        pm.send({ type: 'ready' });
      }).not.toThrow();
    });

    it('does not throw for any message type', () => {
      expect(() => pm.send({ type: 'start' })).not.toThrow();
      expect(() => pm.send({ type: 'rematch' })).not.toThrow();
      expect(() => pm.send({ type: 'game_over', score: 1000 })).not.toThrow();
      expect(() => pm.send({ type: 'garbage', count: 3 })).not.toThrow();
      expect(() => pm.send({ type: 'alias', name: 'Test' })).not.toThrow();
    });
  });

  describe('disconnect()', () => {
    it('resets state', () => {
      pm.disconnect();
      expect(pm.isHost).toBe(false);
      expect(pm.isConnected).toBe(false);
    });

    it('does not throw when called multiple times', () => {
      expect(() => {
        pm.disconnect();
        pm.disconnect();
        pm.disconnect();
      }).not.toThrow();
    });

    it('can still generate codes after disconnect', () => {
      pm.disconnect();
      const code = pm.generateRoomCode();
      expect(code).toHaveLength(4);
      expect(code).toMatch(/^\d{4}$/);
    });
  });

  describe('callback assignment', () => {
    it('allows setting onMessage callback', () => {
      const handler = vi.fn();
      pm.onMessage = handler;
      expect(pm.onMessage).toBe(handler);
    });

    it('allows setting onConnected callback', () => {
      const handler = vi.fn();
      pm.onConnected = handler;
      expect(pm.onConnected).toBe(handler);
    });

    it('allows setting onDisconnected callback', () => {
      const handler = vi.fn();
      pm.onDisconnected = handler;
      expect(pm.onDisconnected).toBe(handler);
    });
  });
});
