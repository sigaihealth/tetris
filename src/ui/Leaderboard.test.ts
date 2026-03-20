import { describe, it, expect, beforeEach } from 'vitest';
import { Leaderboard } from './Leaderboard';
import type { LeaderboardEntry } from './Leaderboard';
import type { WellSize } from './MenuScreen';

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

describe('Leaderboard', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it('starts empty', () => {
    const lb = new Leaderboard('medium', storage);
    expect(lb.getScores()).toEqual([]);
  });

  it('adds and retrieves a score', () => {
    const lb = new Leaderboard('medium', storage);
    lb.addScore(entry('AAA', 1000));
    const scores = lb.getScores();
    expect(scores).toHaveLength(1);
    expect(scores[0].name).toBe('AAA');
    expect(scores[0].score).toBe(1000);
  });

  it('keeps scores sorted highest first', () => {
    const lb = new Leaderboard('medium', storage);
    lb.addScore(entry('LOW', 100));
    lb.addScore(entry('MID', 500));
    lb.addScore(entry('HIGH', 900));
    const scores = lb.getScores();
    expect(scores.map((s) => s.name)).toEqual(['HIGH', 'MID', 'LOW']);
  });

  it('keeps only the top 10 scores', () => {
    const lb = new Leaderboard('medium', storage);
    for (let i = 0; i < 12; i++) {
      lb.addScore(entry(`P${i}`, (i + 1) * 100));
    }
    const scores = lb.getScores();
    expect(scores).toHaveLength(10);
    // Lowest kept score should be 300 (P2)
    expect(scores[scores.length - 1].score).toBe(300);
    // Highest should be 1200 (P11)
    expect(scores[0].score).toBe(1200);
  });

  it('isHighScore returns true when board is not full', () => {
    const lb = new Leaderboard('small', storage);
    lb.addScore(entry('AAA', 500, 1, 'small'));
    expect(lb.isHighScore(100)).toBe(true); // less than 10 entries
  });

  it('isHighScore returns true when score beats the lowest', () => {
    const lb = new Leaderboard('medium', storage);
    for (let i = 0; i < 10; i++) {
      lb.addScore(entry(`P${i}`, (i + 1) * 100));
    }
    // Lowest is 100, so 150 should qualify
    expect(lb.isHighScore(150)).toBe(true);
  });

  it('isHighScore returns false when score does not beat the lowest', () => {
    const lb = new Leaderboard('medium', storage);
    for (let i = 0; i < 10; i++) {
      lb.addScore(entry(`P${i}`, (i + 1) * 100));
    }
    // Lowest is 100, so 50 should not qualify
    expect(lb.isHighScore(50)).toBe(false);
  });

  it('separates leaderboards by well size', () => {
    const lbSmall = new Leaderboard('small', storage);
    const lbLarge = new Leaderboard('large', storage);
    lbSmall.addScore(entry('S1', 1000, 1, 'small'));
    lbLarge.addScore(entry('L1', 2000, 1, 'large'));

    expect(lbSmall.getScores()).toHaveLength(1);
    expect(lbSmall.getScores()[0].name).toBe('S1');
    expect(lbLarge.getScores()).toHaveLength(1);
    expect(lbLarge.getScores()[0].name).toBe('L1');
  });

  it('handles corrupt storage data gracefully', () => {
    storage.setItem('tetris3d_lb_medium', 'not-json!!!');
    const lb = new Leaderboard('medium', storage);
    expect(lb.getScores()).toEqual([]);
  });
});
