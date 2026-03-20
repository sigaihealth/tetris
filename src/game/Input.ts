export type Action =
  | 'move_left' | 'move_right' | 'move_forward' | 'move_back'
  | 'soft_drop' | 'hard_drop'
  | 'rotate_x_pos' | 'rotate_x_neg'
  | 'rotate_y_pos' | 'rotate_y_neg'
  | 'rotate_z_pos' | 'rotate_z_neg'
  | 'camera_left' | 'camera_right'
  | 'pause' | 'mute';

const KEY_MAP: Record<string, Action> = {
  KeyA: 'move_left', ArrowLeft: 'move_left',
  KeyD: 'move_right', ArrowRight: 'move_right',
  KeyW: 'move_forward', ArrowUp: 'move_forward',
  KeyS: 'move_back', ArrowDown: 'move_back',
  ShiftLeft: 'soft_drop', ShiftRight: 'soft_drop',
  Space: 'hard_drop',
  KeyI: 'rotate_x_pos', KeyK: 'rotate_x_neg',
  KeyJ: 'rotate_y_pos', KeyL: 'rotate_y_neg',
  KeyU: 'rotate_z_pos', KeyO: 'rotate_z_neg',
  KeyQ: 'camera_left', KeyE: 'camera_right',
  Escape: 'pause', KeyM: 'mute',
};

const DAS_DELAY = 170;
const DAS_RATE = 50;
const DAS_ACTIONS = new Set<Action>(['move_left', 'move_right', 'move_forward', 'move_back', 'soft_drop']);

interface HeldKey { action: Action; pressTime: number; lastRepeat: number; }

export class InputHandler {
  private heldKeys = new Map<string, HeldKey>();

  getAction(code: string): Action | null { return KEY_MAP[code] ?? null; }

  processKeyDown(code: string, time: number): Action[] {
    const action = this.getAction(code);
    if (!action) return [];
    if (!this.heldKeys.has(code)) {
      this.heldKeys.set(code, { action, pressTime: time, lastRepeat: time });
      return [action];
    }
    return [];
  }

  processKeyUp(code: string, _time: number): void { this.heldKeys.delete(code); }

  tick(time: number): Action[] {
    const actions: Action[] = [];
    for (const [, held] of this.heldKeys) {
      if (!DAS_ACTIONS.has(held.action)) continue;
      if (time - held.pressTime >= DAS_DELAY && time - held.lastRepeat >= DAS_RATE) {
        actions.push(held.action);
        held.lastRepeat = time;
      }
    }
    return actions;
  }

  reset(): void { this.heldKeys.clear(); }
}
