function el(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

export class HUD {
  private container: HTMLElement;
  private scoreEl: HTMLElement;
  private levelEl: HTMLElement;
  private planesEl: HTMLElement;
  private comboEl: HTMLElement;

  constructor() {
    this.container = el('div');
    this.container.id = 'hud';
    const panel = el('div', 'hud-panel hud-left');
    panel.appendChild(el('div', 'hud-label', 'SCORE'));
    this.scoreEl = el('div', 'hud-value', '0');
    panel.appendChild(this.scoreEl);
    panel.appendChild(el('div', 'hud-label', 'LEVEL'));
    this.levelEl = el('div', 'hud-value', '1');
    panel.appendChild(this.levelEl);
    panel.appendChild(el('div', 'hud-label', 'PLANES'));
    this.planesEl = el('div', 'hud-value', '0');
    panel.appendChild(this.planesEl);
    this.container.appendChild(panel);
    this.comboEl = el('div', 'hud-combo');
    this.comboEl.id = 'hud-combo';
    this.container.appendChild(this.comboEl);
    document.body.appendChild(this.container);
  }

  update(score: number, level: number, planes: number): void {
    this.scoreEl.textContent = score.toLocaleString();
    this.levelEl.textContent = String(level);
    this.planesEl.textContent = String(planes);
  }

  showCombo(multiplier: number): void {
    this.comboEl.textContent = `COMBO x${multiplier.toFixed(1)}`;
    this.comboEl.classList.add('flash');
    setTimeout(() => this.comboEl.classList.remove('flash'), 500);
  }

  hideCombo(): void {
    this.comboEl.textContent = '';
  }

  show(): void {
    this.container.style.display = '';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  dispose(): void {
    this.container.remove();
  }
}
