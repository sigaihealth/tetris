export type WellSize = 'small' | 'medium' | 'large';

export type GameMode = '3d' | '2d';

export interface MenuCallbacks {
  onStart: (size: WellSize) => void;
  onStart2D: () => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onSfxVolume: (v: number) => void;
  onMusicVolume: (v: number) => void;
}

const WELL_CONFIGS: { size: WellSize; label: string; dim: string }[] = [
  { size: 'small', label: 'Small', dim: '4×4×10' },
  { size: 'medium', label: 'Medium', dim: '5×5×12' },
  { size: 'large', label: 'Large', dim: '6×6×15' },
];

const CONTROLS: [string, string][] = [
  ['WASD / Arrows', 'Move piece'],
  ['I / K', 'Rotate X'],
  ['J / L', 'Rotate Y'],
  ['U / O', 'Rotate Z'],
  ['Space', 'Hard drop'],
  ['Shift', 'Soft drop'],
  ['Q / E', 'Orbit camera'],
  ['Esc', 'Pause'],
  ['M', 'Mute'],
];

function el(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function btn(className: string, text: string, onClick: () => void): HTMLElement {
  const b = document.createElement('button');
  b.className = className;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function slider(
  id: string,
  value: number,
  onInput: (v: number) => void,
): HTMLInputElement {
  const s = document.createElement('input');
  s.type = 'range';
  s.id = id;
  s.className = 'volume-slider';
  s.min = '0';
  s.max = '1';
  s.step = '0.05';
  s.value = String(value);
  s.addEventListener('input', () => onInput(parseFloat(s.value)));
  return s;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export class MenuScreen {
  private overlay: HTMLElement;
  private content: HTMLElement;
  private callbacks: MenuCallbacks;
  private selectedSize: WellSize = 'medium';
  private selectedMode: GameMode = '3d';
  private nameInputEl: HTMLInputElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(callbacks: MenuCallbacks) {
    this.callbacks = callbacks;
    this.overlay = el('div');
    this.overlay.id = 'menu-overlay';
    this.content = el('div', 'menu-container');
    this.overlay.appendChild(this.content);
    document.body.appendChild(this.overlay);
  }

  showStartScreen(): void {
    this.clearContent();
    this.removeKeyHandler();

    // Title
    const title = el('div', 'menu-title');
    const tetrisText = document.createTextNode('TETRIS');
    title.appendChild(tetrisText);
    const span3d = el('span', 'title-3d', '3D');
    title.appendChild(span3d);
    this.content.appendChild(title);

    // Game mode selector
    const modeSection = el('div', 'menu-section');
    modeSection.appendChild(el('div', 'menu-label', 'GAME MODE'));
    const modeRow = el('div', 'size-selector');
    const modeBtns: HTMLElement[] = [];

    const modes: { mode: GameMode; label: string }[] = [
      { mode: '2d', label: '2D CLASSIC' },
      { mode: '3d', label: '3D' },
    ];

    // Well size selector (built ahead so we can show/hide)
    const sizeSection = el('div', 'menu-section');
    sizeSection.appendChild(el('div', 'menu-label', 'WELL SIZE'));
    const sizeRow = el('div', 'size-selector');
    const sizeBtns: HTMLElement[] = [];

    for (const cfg of WELL_CONFIGS) {
      const sBtn = el('button', 'size-btn');
      const labelDiv = el('div', undefined, cfg.label);
      const dimDiv = el('div', 'size-dim', cfg.dim);
      sBtn.appendChild(labelDiv);
      sBtn.appendChild(dimDiv);
      if (cfg.size === this.selectedSize) {
        sBtn.classList.add('selected');
      }
      sBtn.addEventListener('click', () => {
        this.selectedSize = cfg.size;
        for (const b of sizeBtns) b.classList.remove('selected');
        sBtn.classList.add('selected');
      });
      sizeBtns.push(sBtn);
      sizeRow.appendChild(sBtn);
    }
    sizeSection.appendChild(sizeRow);

    const updateSizeVisibility = (): void => {
      sizeSection.style.display = this.selectedMode === '3d' ? '' : 'none';
    };

    for (const m of modes) {
      const mBtn = el('button', 'size-btn');
      mBtn.textContent = m.label;
      if (m.mode === this.selectedMode) {
        mBtn.classList.add('selected');
      }
      mBtn.addEventListener('click', () => {
        this.selectedMode = m.mode;
        for (const b of modeBtns) b.classList.remove('selected');
        mBtn.classList.add('selected');
        updateSizeVisibility();
      });
      modeBtns.push(mBtn);
      modeRow.appendChild(mBtn);
    }
    modeSection.appendChild(modeRow);
    this.content.appendChild(modeSection);

    // Append well size section (visibility managed by mode)
    this.content.appendChild(sizeSection);
    updateSizeVisibility();

    // SFX volume
    const sfxSection = el('div', 'menu-section');
    sfxSection.appendChild(el('div', 'menu-label', 'SFX VOLUME'));
    sfxSection.appendChild(slider('sfx-vol', 0.7, this.callbacks.onSfxVolume));
    this.content.appendChild(sfxSection);

    // Music volume
    const musicSection = el('div', 'menu-section');
    musicSection.appendChild(el('div', 'menu-label', 'MUSIC VOLUME'));
    musicSection.appendChild(slider('music-vol', 0.5, this.callbacks.onMusicVolume));
    this.content.appendChild(musicSection);

    // Start button
    const startAction = (): void => {
      if (this.selectedMode === '2d') {
        this.callbacks.onStart2D();
      } else {
        this.callbacks.onStart(this.selectedSize);
      }
    };

    this.content.appendChild(
      btn('menu-btn primary', 'START GAME', startAction),
    );

    // Controls reference
    const ctrlSection = el('div', 'controls-ref');
    ctrlSection.appendChild(el('div', 'menu-label', 'CONTROLS'));
    const grid = el('div', 'controls-grid');
    for (const [key, action] of CONTROLS) {
      grid.appendChild(el('span', undefined, key));
      grid.appendChild(el('span', undefined, action));
    }
    ctrlSection.appendChild(grid);
    this.content.appendChild(ctrlSection);

    // Enter key listener
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        startAction();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    this.overlay.style.display = '';
  }

  showPauseScreen(): void {
    this.clearContent();
    this.removeKeyHandler();

    this.content.appendChild(el('div', 'menu-title', 'PAUSED'));
    this.content.appendChild(
      btn('menu-btn primary', 'RESUME', () => this.callbacks.onResume()),
    );
    this.content.appendChild(
      btn('menu-btn', 'RESTART', () => this.callbacks.onRestart()),
    );
    this.content.appendChild(
      btn('menu-btn', 'QUIT', () => this.callbacks.onQuit()),
    );

    this.overlay.style.display = '';
  }

  showGameOver(
    score: number,
    level: number,
    planes: number,
    timeMs: number,
    isHighScore: boolean,
  ): void {
    this.clearContent();
    this.removeKeyHandler();

    this.content.appendChild(el('div', 'menu-title', 'GAME OVER'));

    // Stats grid
    const stats = el('div', 'stats-grid');
    const statPairs: [string, string][] = [
      ['Score', score.toLocaleString()],
      ['Level', String(level)],
      ['Planes', String(planes)],
      ['Time', formatTime(timeMs)],
    ];
    for (const [label, value] of statPairs) {
      stats.appendChild(el('span', undefined, label));
      stats.appendChild(el('span', undefined, value));
    }
    this.content.appendChild(stats);

    // High score name input
    if (isHighScore) {
      const hsSection = el('div', 'menu-section');
      hsSection.appendChild(el('div', 'menu-label', 'NEW HIGH SCORE! ENTER NAME'));
      this.nameInputEl = document.createElement('input');
      this.nameInputEl.type = 'text';
      this.nameInputEl.className = 'name-input';
      this.nameInputEl.maxLength = 10;
      this.nameInputEl.value = 'AAA';
      this.nameInputEl.placeholder = 'AAA';
      hsSection.appendChild(this.nameInputEl);
      this.content.appendChild(hsSection);
      // Auto-focus
      setTimeout(() => this.nameInputEl?.focus(), 50);
    } else {
      this.nameInputEl = null;
    }

    this.content.appendChild(
      btn('menu-btn primary', 'PLAY AGAIN', () =>
        this.callbacks.onRestart(),
      ),
    );
    this.content.appendChild(
      btn('menu-btn', 'MAIN MENU', () => this.callbacks.onQuit()),
    );

    this.overlay.style.display = '';
  }

  getNameInput(): string {
    if (!this.nameInputEl) return 'AAA';
    const val = this.nameInputEl.value.trim();
    return val.length > 0 ? val : 'AAA';
  }

  hide(): void {
    this.overlay.style.display = 'none';
    this.removeKeyHandler();
  }

  dispose(): void {
    this.removeKeyHandler();
    this.overlay.remove();
  }

  private clearContent(): void {
    this.content.replaceChildren();
    this.nameInputEl = null;
  }

  private removeKeyHandler(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }
}
