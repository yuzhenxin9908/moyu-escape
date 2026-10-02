export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

export interface LevelDefinition {
  id: number;
  name: string;
  objective: string;
  grid: string[];
  bossPath: Point[];
  visionRange?: number;
  parSteps: number;
  tip?: string;
  cameras?: CameraDefinition[];
}

export interface CameraDefinition {
  position: Point;
  directions: Direction[];
  range?: number;
}

export type GameStatus = 'playing' | 'won' | 'caught';

export interface GameState {
  levelId: number;
  player: Point;
  boss: Point;
  bossPathIndex: number;
  bossDirection: Direction;
  hasTarget: boolean;
  hasKey: boolean;
  status: GameStatus;
  steps: number;
  stars: number;
  message: string;
}

export interface MoveResult {
  moved: boolean;
  state: GameState;
}
