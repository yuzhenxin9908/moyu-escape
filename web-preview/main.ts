import './style.css';
import { GameEngine } from '../assets/scripts/core/GameEngine';
import { LEVELS } from '../assets/scripts/core/levels';
import type { Direction, Point } from '../assets/scripts/core/types';

interface LevelResult { stars: number; bestSteps: number }
interface Progress { unlocked: number; results: Record<number, LevelResult> }

const STORAGE_KEY = 'moyu-escape-progress-v2';
const saved = localStorage.getItem(STORAGE_KEY);
const progress: Progress = saved ? JSON.parse(saved) as Progress : { unlocked: 1, results: {} };
let levelIndex = Math.min(Math.max(progress.unlocked - 1, 0), LEVELS.length - 1);
let engine = new GameEngine(LEVELS[levelIndex]);
let touchStart: Point | null = null;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <main class="shell">
    <nav class="topbar">
      <div class="brand"><span class="logo">摸</span><div><strong>摸鱼逃生</strong><small>OFFICE ESCAPE</small></div></div>
      <button id="choose-level" class="ghost">选关</button>
    </nav>
    <header>
      <div class="chapter">第 <span id="level-number"></span> 关</div>
      <h1 id="title"></h1><p id="goal"></p>
      <p id="tip" class="tip"></p>
    </header>
    <section class="hud">
      <div><small>步数</small><strong id="steps">0</strong></div>
      <div><small>目标</small><strong id="target-state">未取得</strong></div>
      <div><small>门禁</small><strong id="key-state">无</strong></div>
    </section>
    <section class="game-card">
      <canvas id="board" aria-label="游戏地图"></canvas>
      <div id="result-panel" class="result-panel" hidden>
        <div class="result-icon" id="result-icon"></div>
        <h2 id="result-title"></h2><p id="result-detail"></p>
        <div class="result-actions"><button id="result-restart" class="secondary">再来一次</button><button id="result-next">下一关</button></div>
      </div>
    </section>
    <div class="legend">
      <span><i class="player"></i>你</span><span><i class="boss"></i>老板</span><span><i class="target"></i>目标</span>
      <span><i class="hideout"></i>躲藏</span><span><i class="camera"></i>监控</span>
    </div>
    <p id="status" class="status"></p>
    <section class="controls" aria-label="方向控制">
      <button data-move="up" aria-label="向上">↑</button>
      <div><button data-move="left" aria-label="向左">←</button><button data-move="down" aria-label="向下">↓</button><button data-move="right" aria-label="向右">→</button></div>
    </section>
    <footer><button id="restart" class="secondary">↻ 重开</button><button id="wait">◷ 等一回合</button></footer>
    <p class="hint">手机可在地图上滑动 · 键盘支持 WASD / 方向键</p>
  </main>
  <dialog id="level-dialog">
    <div class="dialog-head"><div><small>任务列表</small><h2>选择关卡</h2></div><button id="close-levels" class="close">×</button></div>
    <div id="level-grid" class="level-grid"></div>
  </dialog>`;

const canvas = document.querySelector<HTMLCanvasElement>('#board')!;
const context = canvas.getContext('2d')!;
const title = document.querySelector<HTMLElement>('#title')!;
const goal = document.querySelector<HTMLElement>('#goal')!;
const tip = document.querySelector<HTMLElement>('#tip')!;
const status = document.querySelector<HTMLElement>('#status')!;
const steps = document.querySelector<HTMLElement>('#steps')!;
const targetState = document.querySelector<HTMLElement>('#target-state')!;
const keyState = document.querySelector<HTMLElement>('#key-state')!;
const resultPanel = document.querySelector<HTMLElement>('#result-panel')!;
const resultIcon = document.querySelector<HTMLElement>('#result-icon')!;
const resultTitle = document.querySelector<HTMLElement>('#result-title')!;
const resultDetail = document.querySelector<HTMLElement>('#result-detail')!;
const resultNext = document.querySelector<HTMLButtonElement>('#result-next')!;
const levelDialog = document.querySelector<HTMLDialogElement>('#level-dialog')!;
const levelGrid = document.querySelector<HTMLElement>('#level-grid')!;

function persist(): void { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }

function render(): void {
  const level = LEVELS[levelIndex];
  const state = engine.state;
  document.querySelector('#level-number')!.textContent = `${level.id}/${LEVELS.length}`;
  title.textContent = level.name;
  goal.textContent = level.objective;
  tip.textContent = level.tip ?? '';
  steps.textContent = String(state.steps);
  targetState.textContent = state.hasTarget ? '已到手' : '未取得';
  targetState.className = state.hasTarget ? 'good' : '';
  keyState.textContent = state.hasKey ? '已取得' : '无';
  keyState.className = state.hasKey ? 'good' : '';
  status.textContent = state.message || `老板正在巡逻 · 第 ${state.steps + 1} 回合`;
  status.dataset.kind = state.status;

  if (state.status === 'won') saveWin(state.stars, state.steps);
  renderResult();
  drawBoard();
}

function saveWin(stars: number, bestSteps: number): void {
  const previous = progress.results[LEVELS[levelIndex].id];
  progress.results[LEVELS[levelIndex].id] = {
    stars: Math.max(previous?.stars ?? 0, stars),
    bestSteps: Math.min(previous?.bestSteps ?? Number.POSITIVE_INFINITY, bestSteps),
  };
  progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, levelIndex + 2));
  persist();
}

function renderResult(): void {
  const state = engine.state;
  resultPanel.hidden = state.status === 'playing';
  if (state.status === 'playing') return;
  const won = state.status === 'won';
  resultPanel.dataset.kind = state.status;
  resultIcon.textContent = won ? '✓' : '!';
  resultTitle.textContent = won ? `${'★'.repeat(state.stars)}${'☆'.repeat(3 - state.stars)}` : '摸鱼失败';
  resultDetail.textContent = won ? `${state.steps} 步完成 · 三星目标 ${engine.level.parSteps} 步` : state.message;
  resultNext.hidden = !won || levelIndex === LEVELS.length - 1;
}

function drawBoard(): void {
  const level = LEVELS[levelIndex];
  const state = engine.state;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssSize = Math.min(620, window.innerWidth - 32);
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  canvas.width = cssSize * dpr;
  canvas.height = cssSize * dpr;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.fillStyle = '#111827';
  context.fillRect(0, 0, cssSize, cssSize);

  const rows = level.grid.length;
  const columns = level.grid[0].length;
  const size = Math.min((cssSize - 18) / columns, (cssSize - 18) / rows);
  const ox = (cssSize - columns * size) / 2;
  const oy = (cssSize - rows * size) / 2;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const tile = level.grid[y][x];
      rect({ x, y }, tile === '#' ? '#3b465c' : '#1f2a3d', 2.5, size, ox, oy);
      if (tile === 'H') token({ x, y }, '#8b5cf6', '▦', size, ox, oy);
      if (tile === 'T' && !state.hasTarget) token({ x, y }, '#facc15', '☕', size, ox, oy);
      if (tile === 'E') token({ x, y }, '#22c55e', '⇥', size, ox, oy);
      if (tile === 'K' && !state.hasKey) token({ x, y }, '#38bdf8', 'K', size, ox, oy);
      if (tile === 'D') token({ x, y }, state.hasKey ? '#475569' : '#f97316', state.hasKey ? '·' : '▥', size, ox, oy);
    }
  }

  for (const cell of engine.getVisionCells()) rect(cell, 'rgba(251,146,60,.34)', 2.5, size, ox, oy);
  for (const { camera, direction, cells } of engine.getCameraVisionCells()) {
    for (const cell of cells) rect(cell, 'rgba(250,204,21,.25)', 2.5, size, ox, oy);
    token(camera.position, '#f59e0b', directionGlyph(direction), size, ox, oy);
  }
  token(state.boss, '#fb7185', directionGlyph(state.bossDirection), size, ox, oy);
  token(state.player, '#38bdf8', state.hasTarget ? '😎' : '●', size, ox, oy);
}

function directionGlyph(direction: Direction): string {
  return { up: '↑', down: '↓', left: '←', right: '→' }[direction];
}

function rect(point: Point, color: string, inset: number, size: number, ox: number, oy: number): void {
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(ox + point.x * size + inset, oy + point.y * size + inset, size - inset * 2, size - inset * 2, Math.max(4, size * 0.12));
  context.fill();
}

function token(point: Point, color: string, glyph: string, size: number, ox: number, oy: number): void {
  const inset = size * 0.15;
  rect(point, color, inset, size, ox, oy);
  context.fillStyle = '#f8fafc';
  context.font = `700 ${Math.max(13, size * 0.38)}px system-ui`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(glyph, ox + (point.x + 0.5) * size, oy + (point.y + 0.52) * size);
}

function move(direction: Direction): void { engine.move(direction); render(); }
function restart(): void { engine.reset(); render(); }
function nextLevel(): void { loadLevel(Math.min(levelIndex + 1, LEVELS.length - 1)); }
function loadLevel(index: number): void {
  levelIndex = index;
  engine = new GameEngine(LEVELS[levelIndex]);
  levelDialog.close();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  render();
}

function renderLevelGrid(): void {
  levelGrid.innerHTML = LEVELS.map((level, index) => {
    const locked = level.id > progress.unlocked;
    const result = progress.results[level.id];
    return `<button class="level-item" data-level="${index}" ${locked ? 'disabled' : ''}>
      <span>${locked ? '🔒' : String(level.id).padStart(2, '0')}</span><strong>${level.name}</strong>
      <small>${result ? `${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)} · ${result.bestSteps} 步` : locked ? '尚未解锁' : '待完成'}</small>
    </button>`;
  }).join('');
  levelGrid.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((button) => {
    button.addEventListener('click', () => loadLevel(Number(button.dataset.level)));
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => button.addEventListener('click', () => move(button.dataset.move as Direction)));
document.querySelector('#restart')!.addEventListener('click', restart);
document.querySelector('#wait')!.addEventListener('click', () => { engine.wait(); render(); });
document.querySelector('#result-restart')!.addEventListener('click', restart);
resultNext.addEventListener('click', nextLevel);
document.querySelector('#choose-level')!.addEventListener('click', () => { renderLevelGrid(); levelDialog.showModal(); });
document.querySelector('#close-levels')!.addEventListener('click', () => levelDialog.close());
levelDialog.addEventListener('click', (event) => { if (event.target === levelDialog) levelDialog.close(); });

canvas.addEventListener('pointerdown', (event) => { touchStart = { x: event.clientX, y: event.clientY }; });
canvas.addEventListener('pointerup', (event) => {
  if (!touchStart) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
window.addEventListener('keydown', (event) => {
  const keys: Record<string, Direction> = {
    ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
  };
  if (keys[event.key]) { event.preventDefault(); move(keys[event.key]); }
  if (event.key === 'r' || event.key === 'R') restart();
  if (event.key === ' ') { event.preventDefault(); engine.wait(); render(); }
});
window.addEventListener('resize', drawBoard);
render();
