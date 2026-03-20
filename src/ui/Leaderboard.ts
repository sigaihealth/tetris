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
    try {
      return JSON.parse(raw) as LeaderboardEntry[];
    } catch {
      return [];
    }
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
