import type { CameraDefinition, Direction, GameState, LevelDefinition, MoveResult, Point } from './types';

const DELTAS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const samePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

export class GameEngine {
  readonly level: LevelDefinition;
  private current: GameState;

  constructor(level: LevelDefinition) {
    this.level = level;
    this.validateLevel(level);
    this.current = this.createInitialState();
  }

  get state(): GameState {
    return structuredClone(this.current);
  }

  reset(): GameState {
    this.current = this.createInitialState();
    return this.state;
  }

  tileAt(point: Point): string {
    return this.level.grid[point.y]?.[point.x] ?? '#';
  }

  getVisionCells(): Point[] {
    return this.castVision(this.current.boss, this.current.bossDirection, this.level.visionRange ?? 4);
  }

  getCameraVisionCells(): { camera: CameraDefinition; direction: Direction; cells: Point[] }[] {
    return (this.level.cameras ?? []).map((camera) => {
      const direction = camera.directions[this.current.steps % camera.directions.length];
      return { camera, direction, cells: this.castVision(camera.position, direction, camera.range ?? 5) };
    });
  }

  wait(): MoveResult {
    if (this.current.status !== 'playing') return { moved: false, state: this.state };
    this.current.steps += 1;
    this.current.message = '屏住呼吸，观察巡逻…';
    this.advanceBoss();
    this.resolveCaught();
    return { moved: true, state: this.state };
  }

  getStars(steps = this.current.steps): number {
    if (steps <= this.level.parSteps) return 3;
    if (steps <= this.level.parSteps + 6) return 2;
    return 1;
  }

  private castVision(origin: Point, direction: Direction, range: number): Point[] {
    const cells: Point[] = [];
    const delta = DELTAS[direction];
    for (let distance = 1; distance <= range; distance += 1) {
      const point = {
        x: origin.x + delta.x * distance,
        y: origin.y + delta.y * distance,
      };
      if (this.tileAt(point) === '#' || this.tileAt(point) === 'D') break;
      cells.push(point);
    }
    return cells;
  }

  move(direction: Direction): MoveResult {
    if (this.current.status !== 'playing') return { moved: false, state: this.state };

    const delta = DELTAS[direction];
    const destination = {
      x: this.current.player.x + delta.x,
      y: this.current.player.y + delta.y,
    };

    const tile = this.tileAt(destination);
    const cameraBlocks = (this.level.cameras ?? []).some((camera) => samePoint(camera.position, destination));
    if (tile === '#' || cameraBlocks || (tile === 'D' && !this.current.hasKey)) {
      this.current.message = tile === 'D' ? '门禁锁着，先找门禁卡' : '这里过不去';
      return { moved: false, state: this.state };
    }

    this.current.player = destination;
    this.current.steps += 1;
    this.current.message = '';

    if (tile === 'K' && !this.current.hasKey) {
      this.current.hasKey = true;
      this.current.message = '拿到门禁卡，锁门可以通过了';
    }

    if (tile === 'T' && !this.current.hasTarget) {
      this.current.hasTarget = true;
      this.current.message = '摸鱼目标到手，快撤！';
    }

    this.advanceBoss();
    this.resolveCaught();

    if (this.current.status === 'playing' && tile === 'E') {
      if (this.current.hasTarget) {
        this.current.status = 'won';
        this.current.stars = this.getStars();
        this.current.message = `成功下班！${'★'.repeat(this.current.stars)} · ${this.current.steps} 步`;
      } else {
        this.current.message = '还没完成摸鱼目标';
      }
    }

    return { moved: true, state: this.state };
  }

  private resolveCaught(): void {
    const onHideout = this.tileAt(this.current.player) === 'H';
    const bossCollision = samePoint(this.current.player, this.current.boss);
    const bossSawPlayer = this.getVisionCells().some((cell) => samePoint(cell, this.current.player));
    const cameraSawPlayer = this.getCameraVisionCells().some(({ cells }) => cells.some((cell) => samePoint(cell, this.current.player)));
    if (bossCollision || (!onHideout && (bossSawPlayer || cameraSawPlayer))) {
      this.current.status = 'caught';
      this.current.message = cameraSawPlayer && !bossSawPlayer ? '被监控拍到了！' : '被老板抓到了！';
    } else if (onHideout) {
      this.current.message = '藏好了，视野扫过也不会被发现';
    }
  }

  private advanceBoss(): void {
    const path = this.level.bossPath;
    const nextIndex = (this.current.bossPathIndex + 1) % path.length;
    const next = path[nextIndex];
    const dx = next.x - this.current.boss.x;
    const dy = next.y - this.current.boss.y;
    this.current.bossDirection = Math.abs(dx) >= Math.abs(dy)
      ? (dx >= 0 ? 'right' : 'left')
      : (dy >= 0 ? 'down' : 'up');
    this.current.boss = { ...next };
    this.current.bossPathIndex = nextIndex;
  }

  private createInitialState(): GameState {
    const player = this.findTile('P');
    const boss = this.level.bossPath[0];
    const next = this.level.bossPath[1] ?? boss;
    const dx = next.x - boss.x;
    const dy = next.y - boss.y;
    const bossDirection: Direction = Math.abs(dx) >= Math.abs(dy)
      ? (dx >= 0 ? 'right' : 'left')
      : (dy >= 0 ? 'down' : 'up');
    return {
      levelId: this.level.id,
      player,
      boss: { ...boss },
      bossPathIndex: 0,
      bossDirection,
      hasTarget: false,
      hasKey: false,
      status: 'playing',
      steps: 0,
      stars: 0,
      message: '先拿目标，再回绿色出口',
    };
  }

  private findTile(tile: string): Point {
    for (let y = 0; y < this.level.grid.length; y += 1) {
      const x = this.level.grid[y].indexOf(tile);
      if (x >= 0) return { x, y };
    }
    throw new Error(`Level ${this.level.id} is missing tile ${tile}`);
  }

  private validateLevel(level: LevelDefinition): void {
    if (level.grid.length === 0) throw new Error(`Level ${level.id} has an empty grid`);
    const width = level.grid[0].length;
    if (!level.grid.every((row) => row.length === width)) {
      throw new Error(`Level ${level.id} has non-rectangular rows`);
    }
    for (const tile of ['P', 'T', 'E']) this.assertSingleTile(level, tile);
    if (level.bossPath.length < 2) throw new Error(`Level ${level.id} needs a boss patrol path`);
    for (const point of level.bossPath) {
      if (this.tileAtFrom(level, point) === '#') throw new Error(`Level ${level.id} boss path crosses a wall`);
    }
    if (!Number.isInteger(level.parSteps) || level.parSteps <= 0) throw new Error(`Level ${level.id} needs positive parSteps`);
    for (const camera of level.cameras ?? []) {
      if (camera.directions.length === 0) throw new Error(`Level ${level.id} camera needs directions`);
      if (this.tileAtFrom(level, camera.position) === '#') throw new Error(`Level ${level.id} camera is inside a wall`);
    }
  }

  private assertSingleTile(level: LevelDefinition, tile: string): void {
    const count = level.grid.reduce((total, row) => total + [...row].filter((value) => value === tile).length, 0);
    if (count !== 1) throw new Error(`Level ${level.id} must contain exactly one ${tile}`);
  }

  private tileAtFrom(level: LevelDefinition, point: Point): string {
    return level.grid[point.y]?.[point.x] ?? '#';
  }
}
