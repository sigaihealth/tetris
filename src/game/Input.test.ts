import { describe, it, expect, beforeEach } from 'vitest';
import { InputHandler } from './Input.js';

describe('InputHandler', () => {
  let input: InputHandler;

  beforeEach(() => {
    input = new InputHandler();
  });

  describe('key mapping', () => {
    it('maps WASD to movement actions', () => {
      expect(input.getAction('KeyA')).toBe('move_left');
      expect(input.getAction('KeyD')).toBe('move_right');
      expect(input.getAction('KeyW')).toBe('move_forward');
      expect(input.getAction('KeyS')).toBe('move_back');
    });

    it('maps arrow keys to movement actions', () => {
      expect(input.getAction('ArrowLeft')).toBe('move_left');
      expect(input.getAction('ArrowRight')).toBe('move_right');
      expect(input.getAction('ArrowUp')).toBe('move_forward');
      expect(input.getAction('ArrowDown')).toBe('move_back');
    });

    it('maps shift to soft drop and space to hard drop', () => {
      expect(input.getAction('ShiftLeft')).toBe('soft_drop');
      expect(input.getAction('ShiftRight')).toBe('soft_drop');
      expect(input.getAction('Space')).toBe('hard_drop');
    });

    it('maps IJKL UO to rotation actions', () => {
      expect(input.getAction('KeyI')).toBe('rotate_x_pos');
      expect(input.getAction('KeyK')).toBe('rotate_x_neg');
      expect(input.getAction('KeyJ')).toBe('rotate_y_pos');
      expect(input.getAction('KeyL')).toBe('rotate_y_neg');
      expect(input.getAction('KeyU')).toBe('rotate_z_pos');
      expect(input.getAction('KeyO')).toBe('rotate_z_neg');
    });

    it('maps Q/E to camera, Escape to pause, M to mute', () => {
      expect(input.getAction('KeyQ')).toBe('camera_left');
      expect(input.getAction('KeyE')).toBe('camera_right');
      expect(input.getAction('Escape')).toBe('pause');
      expect(input.getAction('KeyM')).toBe('mute');
    });

    it('returns null for unmapped keys', () => {
      expect(input.getAction('KeyZ')).toBeNull();
      expect(input.getAction('F1')).toBeNull();
      expect(input.getAction('Digit1')).toBeNull();
    });
  });

  describe('processKeyDown', () => {
    it('fires action immediately on first press', () => {
      const actions = input.processKeyDown('KeyA', 0);
      expect(actions).toEqual(['move_left']);
    });

    it('does not fire on repeated keydown (held key)', () => {
      input.processKeyDown('KeyA', 0);
      const actions = input.processKeyDown('KeyA', 50);
      expect(actions).toEqual([]);
    });

    it('returns empty array for unmapped key', () => {
      const actions = input.processKeyDown('KeyZ', 0);
      expect(actions).toEqual([]);
    });
  });

  describe('processKeyUp', () => {
    it('allows key to fire again after release', () => {
      input.processKeyDown('KeyA', 0);
      input.processKeyUp('KeyA', 100);
      const actions = input.processKeyDown('KeyA', 200);
      expect(actions).toEqual(['move_left']);
    });
  });

  describe('DAS auto-repeat', () => {
    it('does not repeat before DAS delay', () => {
      input.processKeyDown('KeyA', 0);
      const actions = input.tick(100); // 100ms < 170ms delay
      expect(actions).toEqual([]);
    });

    it('repeats after DAS delay', () => {
      input.processKeyDown('KeyA', 0);
      const actions = input.tick(170); // exactly at delay
      expect(actions).toEqual(['move_left']);
    });

    it('repeats at DAS rate after initial delay', () => {
      input.processKeyDown('KeyA', 0);
      input.tick(170); // first repeat
      const actions1 = input.tick(220); // 170 + 50 = 220
      expect(actions1).toEqual(['move_left']);
      const actions2 = input.tick(250); // only 30ms since last repeat
      expect(actions2).toEqual([]);
      const actions3 = input.tick(270); // 220 + 50 = 270
      expect(actions3).toEqual(['move_left']);
    });

    it('does not auto-repeat non-DAS actions like hard_drop', () => {
      input.processKeyDown('Space', 0);
      const actions = input.tick(500); // well past delay
      expect(actions).toEqual([]);
    });

    it('stops repeating after key up', () => {
      input.processKeyDown('KeyA', 0);
      input.processKeyUp('KeyA', 100);
      const actions = input.tick(500);
      expect(actions).toEqual([]);
    });
  });

  describe('reset', () => {
    it('clears all held keys', () => {
      input.processKeyDown('KeyA', 0);
      input.processKeyDown('KeyD', 0);
      input.reset();
      const actions = input.tick(500);
      expect(actions).toEqual([]);
    });
  });
});
