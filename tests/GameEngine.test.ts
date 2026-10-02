import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine } from '../assets/scripts/core/GameEngine';
import { LEVELS } from '../assets/scripts/core/levels';
import type { LevelDefinition } from '../assets/scripts/core/types';

test('all bundled levels are structurally valid', () => {
  for (const level of LEVELS) assert.doesNotThrow(() => new GameEngine(level));
});

test('walking into a wall does not consume a turn', () => {
  const engine = new GameEngine(LEVELS[0]);
  const result = engine.move('up');
  assert.equal(result.moved, false);
  assert.equal(result.state.steps, 0);
  assert.deepEqual(result.state.player, { x: 1, y: 1 });
  assert.equal(result.state.bossPathIndex, 0);
});

test('collecting the target and reaching exit wins', () => {
  const level: LevelDefinition = {
    id: 99,
    name: 'test',
    objective: 'test',
    grid: ['#######', '#PTE..#', '#....B#', '#######'],
    bossPath: [{ x: 5, y: 2 }, { x: 4, y: 2 }],
    visionRange: 1,
    parSteps: 2,
  };
  const engine = new GameEngine(level);
  assert.equal(engine.move('right').state.hasTarget, true);
  assert.equal(engine.move('right').state.status, 'won');
});

test('boss vision is blocked by walls', () => {
  const level: LevelDefinition = {
    id: 100,
    name: 'vision',
    objective: 'test',
    grid: ['########', '#P.TE..#', '#..#B.##', '########'],
    bossPath: [{ x: 4, y: 2 }, { x: 5, y: 2 }],
    visionRange: 5,
    parSteps: 2,
  };
  const engine = new GameEngine(level);
  engine.move('right');
  assert.equal(engine.state.status, 'playing');
  assert.deepEqual(engine.getVisionCells(), []);
});

test('entering boss line of sight loses the level', () => {
  const level: LevelDefinition = {
    id: 101,
    name: 'caught',
    objective: 'test',
    grid: ['########', '#P.TE..#', '#......#', '#.B....#', '########'],
    bossPath: [{ x: 2, y: 3 }, { x: 2, y: 2 }],
    visionRange: 4,
    parSteps: 2,
  };
  const engine = new GameEngine(level);
  assert.equal(engine.move('right').state.status, 'caught');
});

test('a locked door blocks movement until the keycard is collected', () => {
  const level: LevelDefinition = {
    id: 102, name: 'door', objective: 'test', parSteps: 4,
    grid: ['########', '#PKDTE.#', '#.....B#', '########'],
    bossPath: [{ x: 6, y: 2 }, { x: 5, y: 2 }], visionRange: 1,
  };
  const engine = new GameEngine(level);
  engine.move('right');
  assert.equal(engine.state.hasKey, true);
  assert.equal(engine.move('right').moved, true);
  assert.deepEqual(engine.state.player, { x: 3, y: 1 });
});

test('hideouts protect the player from line of sight', () => {
  const level: LevelDefinition = {
    id: 103, name: 'hideout', objective: 'test', parSteps: 5,
    grid: ['########', '#PHT.E.#', '#......#', '#.B....#', '########'],
    bossPath: [{ x: 2, y: 3 }, { x: 2, y: 2 }], visionRange: 4,
  };
  const engine = new GameEngine(level);
  assert.equal(engine.move('right').state.status, 'playing');
  assert.equal(engine.state.message.includes('藏好了'), true);
});

test('waiting advances rotating cameras without moving the player', () => {
  const level: LevelDefinition = {
    id: 104, name: 'camera', objective: 'test', parSteps: 5,
    grid: ['########', '#..T...#', '#P...E.#', '#.....B#', '########'],
    bossPath: [{ x: 6, y: 3 }, { x: 5, y: 3 }], visionRange: 1,
    cameras: [{ position: { x: 4, y: 1 }, directions: ['left', 'up'], range: 3 }],
  };
  const engine = new GameEngine(level);
  assert.equal(engine.getCameraVisionCells()[0].direction, 'left');
  engine.wait();
  assert.equal(engine.getCameraVisionCells()[0].direction, 'up');
  assert.deepEqual(engine.state.player, { x: 1, y: 2 });
});

test('every bundled level has a route to victory', () => {
    const directions = ['up', 'down', 'left', 'right', 'wait'] as const;

  for (const level of LEVELS) {
    const queue: (typeof directions[number])[][] = [[]];
    const visited = new Set<string>();
    let won = false;

    while (queue.length > 0 && !won) {
      const path = queue.shift()!;
      const engine = new GameEngine(level);
      for (const direction of path) direction === 'wait' ? engine.wait() : engine.move(direction);
      const state = engine.state;
      const key = `${state.player.x},${state.player.y},${state.bossPathIndex},${state.hasTarget},${state.hasKey},${state.steps % 60},${state.status}`;
      if (visited.has(key) || state.status === 'caught') continue;
      visited.add(key);
      if (state.status === 'won') {
        won = true;
        continue;
      }
      if (path.length < 80) for (const direction of directions) queue.push([...path, direction]);
    }

    assert.equal(won, true, `Level ${level.id} (${level.name}) should be solvable`);
  }
});
