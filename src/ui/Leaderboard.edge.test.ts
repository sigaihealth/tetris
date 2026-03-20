import { describe, it, expect, beforeEach } from 'vitest';
import { Leaderboard } from './Leaderboard.js';
import type { LeaderboardEntry } from './Leaderboard.js';
import type { WellSize } from './MenuScreen.js';

function mockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return store[key] ?? null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      for (const k of Object.keys(store)) delete store[k];
    },
    get length() {
      return Object.keys(store).length;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
  };
}

function entry(
  name: string,
  score: number,
  level: number = 1,
  wellSize: WellSize = 'medium',
): LeaderboardEntry {
  return { name, score, level, wellSize };
}

describe('Leaderboard — edge cases', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  describe('score of 0 qualifies for empty leaderboard', () => {
    it('isHighScore returns true for score 0 on empty board', () => {
      const lb = new Leaderboard('medium', storage);
      expect(lb.isHighScore(0)).toBe(true);
    });

    it('score 0 can be added to leaderboard', () => {
      const lb = new Leaderboard('medium', storage);
      lb.addScore(entry('ZER', 0));
      const scores = lb.getScores();
      expect(scores).toHaveLength(1);
      expect(scores[0].score).toBe(0);
    });
  });

  describe('exact score equal to lowest does not qualify (strictly greater)', () => {
    it('isHighScore returns false for score equal to lowest when board is full', () => {
      const lb = new Leaderboard('medium', storage);
      // Add 10 entries with scores 100-1000
      for (let i = 0; i < 10; i++) {
        lb.addScore(entry(`P${i}`, (i + 1) * 100));
      }
      // Lowest is 100. Score of exactly 100 should NOT qualify.
      expect(lb.isHighScore(100)).toBe(false);
    });

    it('isHighScore returns true for score 1 above lowest when board is full', () => {
      const lb = new Leaderboard('medium', storage);
      for (let i = 0; i < 10; i++) {
        lb.addScore(entry(`P${i}`, (i + 1) * 100));
      }
      // Lowest is 100. Score of 101 should qualify.
      expect(lb.isHighScore(101)).toBe(true);
    });
  });

  describe('insertion order for equal scores', () => {
    it('equal scores are preserved in insertion order (newest last among equals)', () => {
      const lb = new Leaderboard('medium', storage);
      lb.addScore(entry('FIRST', 500));
      lb.addScore(entry('SECOND', 500));
      lb.addScore(entry('THIRD', 500));

      const scores = lb.getScores();
      expect(scores).toHaveLength(3);
      // All have score 500. JavaScript sort is stable, so the order
      // of equal elements is preserved from the array.
      // addScore pushes then sorts by score desc. For equal scores,
      // the original array order is maintained (stable sort).
      expect(scores[0].name).toBe('FIRST');
      expect(scores[1].name).toBe('SECOND');
      expect(scores[2].name).toBe('THIRD');
    });

    it('a higher score always comes before equal scores', () => {
      const lb = new Leaderboard('medium', storage);
      lb.addScore(entry('LOW', 500));
      lb.addScore(entry('LOW2', 500));
      lb.addScore(entry('HIGH', 600));

      const scores = lb.getScores();
      expect(scores[0].name).toBe('HIGH');
      expect(scores[0].score).toBe(600);
    });
  });

  describe('very large scores', () => {
    it('handles scores in the millions', () => {
      const lb = new Leaderboard('medium', storage);
      lb.addScore(entry('MEGA', 9_999_999));
      const scores = lb.getScores();
      expect(scores[0].score).toBe(9_999_999);
    });

    it('sorts very large scores correctly', () => {
      const lb = new Leaderboard('medium', storage);
      lb.addScore(entry('A', 1_000_000));
      lb.addScore(entry('B', 5_000_000));
      lb.addScore(entry('C', 2_500_000));

      const scores = lb.getScores();
      expect(scores[0].score).toBe(5_000_000);
      expect(scores[1].score).toBe(2_500_000);
      expect(scores[2].score).toBe(1_000_000);
    });

    it('isHighScore works with very large scores', () => {
      const lb = new Leaderboard('medium', storage);
      for (let i = 0; i < 10; i++) {
        lb.addScore(entry(`P${i}`, (i + 1) * 1_000_000));
      }
      // Lowest is 1_000_000
      expect(lb.isHighScore(999_999)).toBe(false);
      expect(lb.isHighScore(1_000_001)).toBe(true);
    });
  });

  describe('special characters in name', () => {
    it('stores and retrieves names with special characters', () => {
      const lb = new Leaderboard('medium', storage);
      lb.addScore(entry('A&B<C>', 1000));
      const scores = lb.getScores();
      expect(scores[0].name).toBe('A&B<C>');
    });

    it('handles emoji in names', () => {
      const lb = new Leaderboard('medium', storage);
      lb.addScore(entry('\u{1F680}\u{1F525}', 2000));
      const scores = lb.getScores();
      expect(scores[0].name).toBe('\u{1F680}\u{1F525}');
    });

    it('handles empty string name', () => {
      const lb = new Leaderboard('medium', storage);
      lb.addScore(entry('', 500));
      const scores = lb.getScores();
      expect(scores[0].name).toBe('');
    });

    it('handles unicode characters', () => {
      const lb = new Leaderboard('medium', storage);
      lb.addScore(entry('\u00e9\u00e8\u00ea\u00eb', 700));
      const scores = lb.getScores();
      expect(scores[0].name).toBe('\u00e9\u00e8\u00ea\u00eb');
    });

    it('handles very long names', () => {
      const lb = new Leaderboard('medium', storage);
      const longName = 'A'.repeat(1000);
      lb.addScore(entry(longName, 800));
      const scores = lb.getScores();
      expect(scores[0].name).toBe(longName);
    });
  });

  describe('persistence via storage', () => {
    it('scores persist across Leaderboard instances sharing the same storage', () => {
      const lb1 = new Leaderboard('small', storage);
      lb1.addScore(entry('P1', 500, 1, 'small'));

      const lb2 = new Leaderboard('small', storage);
      const scores = lb2.getScores();
      expect(scores).toHaveLength(1);
      expect(scores[0].name).toBe('P1');
    });
  });

  describe('11th score pushes out the lowest', () => {
    it('adding 11th score removes the lowest from a full board', () => {
      const lb = new Leaderboard('medium', storage);
      for (let i = 0; i < 10; i++) {
        lb.addScore(entry(`P${i}`, (i + 1) * 100));
      }
      // Add 11th score that beats the lowest (100)
      lb.addScore(entry('NEW', 150));

      const scores = lb.getScores();
      expect(scores).toHaveLength(10);
      // P0 (score 100) should be gone
      expect(scores.find(s => s.name === 'P0')).toBeUndefined();
      // NEW (score 150) should be present
      expect(scores.find(s => s.name === 'NEW')).toBeDefined();
    });
  });

  describe('leaderboard with all zero scores', () => {
    it('10 zero scores prevent a 0 from qualifying', () => {
      const lb = new Leaderboard('medium', storage);
      for (let i = 0; i < 10; i++) {
        lb.addScore(entry(`P${i}`, 0));
      }
      // Board is full, lowest is 0. Score of 0 is NOT strictly greater.
      expect(lb.isHighScore(0)).toBe(false);
    });

    it('score of 1 qualifies when all 10 entries are 0', () => {
      const lb = new Leaderboard('medium', storage);
      for (let i = 0; i < 10; i++) {
        lb.addScore(entry(`P${i}`, 0));
      }
      expect(lb.isHighScore(1)).toBe(true);
    });
  });
});
