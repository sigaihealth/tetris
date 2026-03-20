import { describe, it, expect } from 'vitest';
import { AudioEngine } from './AudioEngine.js';

describe('AudioEngine', () => {
  // Note: AudioContext is not available in Node/Vitest.
  // We test only properties and state management that don't touch AudioContext.

  describe('default volumes', () => {
    it('sfxVolume defaults to 0.7', () => {
      const engine = new AudioEngine();
      expect(engine.sfxVolume).toBe(0.7);
    });

    it('musicVolume defaults to 0.5', () => {
      const engine = new AudioEngine();
      expect(engine.musicVolume).toBe(0.5);
    });
  });

  describe('sfxVolume setter', () => {
    it('sets sfxVolume to a valid value', () => {
      const engine = new AudioEngine();
      engine.sfxVolume = 0.3;
      expect(engine.sfxVolume).toBe(0.3);
    });

    it('clamps sfxVolume to 0 when set to negative', () => {
      const engine = new AudioEngine();
      engine.sfxVolume = -0.5;
      expect(engine.sfxVolume).toBe(0);
    });

    it('clamps sfxVolume to 1 when set above 1', () => {
      const engine = new AudioEngine();
      engine.sfxVolume = 1.5;
      expect(engine.sfxVolume).toBe(1);
    });

    it('allows sfxVolume = 0', () => {
      const engine = new AudioEngine();
      engine.sfxVolume = 0;
      expect(engine.sfxVolume).toBe(0);
    });

    it('allows sfxVolume = 1', () => {
      const engine = new AudioEngine();
      engine.sfxVolume = 1;
      expect(engine.sfxVolume).toBe(1);
    });

    it('clamps sfxVolume = -100 to 0', () => {
      const engine = new AudioEngine();
      engine.sfxVolume = -100;
      expect(engine.sfxVolume).toBe(0);
    });

    it('clamps sfxVolume = 999 to 1', () => {
      const engine = new AudioEngine();
      engine.sfxVolume = 999;
      expect(engine.sfxVolume).toBe(1);
    });
  });

  describe('musicVolume setter', () => {
    it('sets musicVolume to a valid value', () => {
      const engine = new AudioEngine();
      engine.musicVolume = 0.8;
      expect(engine.musicVolume).toBe(0.8);
    });

    it('clamps musicVolume to 0 when set to negative', () => {
      const engine = new AudioEngine();
      engine.musicVolume = -0.3;
      expect(engine.musicVolume).toBe(0);
    });

    it('clamps musicVolume to 1 when set above 1', () => {
      const engine = new AudioEngine();
      engine.musicVolume = 2.0;
      expect(engine.musicVolume).toBe(1);
    });

    it('allows musicVolume = 0', () => {
      const engine = new AudioEngine();
      engine.musicVolume = 0;
      expect(engine.musicVolume).toBe(0);
    });

    it('allows musicVolume = 1', () => {
      const engine = new AudioEngine();
      engine.musicVolume = 1;
      expect(engine.musicVolume).toBe(1);
    });
  });

  describe('muted state', () => {
    it('initial muted state is false', () => {
      const engine = new AudioEngine();
      expect(engine.muted).toBe(false);
    });

    it('toggleMute toggles muted from false to true', () => {
      const engine = new AudioEngine();
      // toggleMute accesses this.masterGain which is null, so it only flips the flag
      engine.toggleMute();
      expect(engine.muted).toBe(true);
    });

    it('toggleMute toggles back from true to false', () => {
      const engine = new AudioEngine();
      engine.toggleMute();
      expect(engine.muted).toBe(true);
      engine.toggleMute();
      expect(engine.muted).toBe(false);
    });

    it('multiple toggles cycle correctly', () => {
      const engine = new AudioEngine();
      for (let i = 0; i < 10; i++) {
        engine.toggleMute();
        expect(engine.muted).toBe(i % 2 === 0);
      }
    });
  });

  describe('volume and muted are independent', () => {
    it('changing sfxVolume does not affect muted', () => {
      const engine = new AudioEngine();
      engine.sfxVolume = 0;
      expect(engine.muted).toBe(false);
    });

    it('toggling mute does not affect sfxVolume', () => {
      const engine = new AudioEngine();
      engine.sfxVolume = 0.4;
      engine.toggleMute();
      expect(engine.sfxVolume).toBe(0.4);
    });

    it('toggling mute does not affect musicVolume', () => {
      const engine = new AudioEngine();
      engine.musicVolume = 0.6;
      engine.toggleMute();
      expect(engine.musicVolume).toBe(0.6);
    });
  });

  describe('volume precision', () => {
    it('handles fractional volumes precisely', () => {
      const engine = new AudioEngine();
      engine.sfxVolume = 0.123;
      expect(engine.sfxVolume).toBeCloseTo(0.123);
    });

    it('handles very small positive volumes', () => {
      const engine = new AudioEngine();
      engine.musicVolume = 0.001;
      expect(engine.musicVolume).toBeCloseTo(0.001);
    });
  });
});
