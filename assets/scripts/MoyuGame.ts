import {
  _decorator,
  Camera,
  Canvas,
  Color,
  Component,
  director,
  Director,
  EventKeyboard,
  Graphics,
  input,
  Input,
  KeyCode,
  Label,
  Layers,
  Node,
  ResolutionPolicy,
  sys,
  UITransform,
  Vec3,
  view,
} from 'cc';
import { GameEngine } from './core/GameEngine';
import { LEVELS } from './core/levels';
import type { Direction, Point } from './core/types';

const { ccclass } = _decorator;

const COLORS = {
  background: new Color('#111827'),
  floor: new Color('#253047'),
  wall: new Color('#536076'),
  vision: new Color(245, 158, 11, 90),
  player: new Color('#38BDF8'),
  boss: new Color('#FB7185'),
  target: new Color('#FACC15'),
  exit: new Color('#4ADE80'),
  hideout: new Color('#8B5CF6'),
  camera: new Color('#F59E0B'),
  key: new Color('#38BDF8'),
  door: new Color('#F97316'),
  white: new Color('#F8FAFC'),
  muted: new Color('#94A3B8'),
};

@ccclass('MoyuGame')
export class MoyuGame extends Component {
  private levelIndex = 0;
  private engine = new GameEngine(LEVELS[0]);
  private boardGraphics!: Graphics;
  private titleLabel!: Label;
  private statusLabel!: Label;
  private goalLabel!: Label;
  private nextButton!: Node;

  protected onLoad(): void {
    view.setDesignResolutionSize(750, 1334, ResolutionPolicy.SHOW_ALL);
    this.buildInterface();
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    this.render();
  }

  protected onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
  }

  private buildInterface(): void {
    const canvas = this.node.addComponent(Canvas);
    const transform = this.node.addComponent(UITransform);
    transform.setContentSize(750, 1334);
    this.node.layer = Layers.Enum.UI_2D;

    const cameraNode = new Node('UICamera');
    cameraNode.layer = Layers.Enum.UI_2D;
    cameraNode.parent = this.node;
    cameraNode.setPosition(0, 0, 1000);
    const camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.ORTHO;
    camera.orthoHeight = 667;
    camera.visibility = Layers.Enum.UI_2D;
    camera.priority = 1;
    canvas.cameraComponent = camera;

    const background = this.createGraphicsNode('Background', this.node, 750, 1334, 0, 0);
    background.fillColor = COLORS.background;
    background.rect(-375, -667, 750, 1334);
    background.fill();

    this.titleLabel = this.createLabel('Title', this.node, 44, COLORS.white, 0, 555, 680, 70);
    this.goalLabel = this.createLabel('Goal', this.node, 24, COLORS.muted, 0, 498, 680, 70);

    const board = new Node('Board');
    board.layer = Layers.Enum.UI_2D;
    board.parent = this.node;
    board.setPosition(0, 80);
    board.addComponent(UITransform).setContentSize(680, 680);
    this.boardGraphics = board.addComponent(Graphics);

    this.statusLabel = this.createLabel('Status', this.node, 27, COLORS.white, 0, -315, 680, 80);

    this.createButton('↑', 0, -415, () => this.move('up'));
    this.createButton('←', -105, -520, () => this.move('left'));
    this.createButton('↓', 0, -520, () => this.move('down'));
    this.createButton('→', 105, -520, () => this.move('right'));
    this.createButton('重开', -245, -520, () => this.restart(), 120, 76);
    this.createButton('等待', 245, -520, () => this.waitTurn(), 120, 76);
    this.nextButton = this.createButton('下一关', 245, -610, () => this.nextLevel(), 130, 70);
    this.nextButton.active = false;

    canvas.alignCanvasWithScreen = true;
  }

  private render(): void {
    const level = LEVELS[this.levelIndex];
    const state = this.engine.state;
    this.titleLabel.string = `摸鱼逃生  ${level.id}/${LEVELS.length} · ${level.name}`;
    this.goalLabel.string = level.objective;
    this.statusLabel.string = state.message || `步数 ${state.steps} · ${state.hasTarget ? '目标已到手' : '目标未完成'} · ${state.hasKey ? '有门禁' : '无门禁'}`;
    this.statusLabel.color = state.status === 'caught' ? COLORS.boss : state.status === 'won' ? COLORS.exit : COLORS.white;
    this.nextButton.active = state.status === 'won';

    const g = this.boardGraphics;
    g.clear();
    const rows = level.grid.length;
    const columns = level.grid[0].length;
    const tileSize = Math.min(650 / columns, 650 / rows);
    const originX = -(columns * tileSize) / 2;
    const originY = (rows * tileSize) / 2;

    for (const cell of this.engine.getVisionCells()) this.drawCell(g, cell, tileSize, originX, originY, COLORS.vision, 0);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const tile = level.grid[y][x];
        this.drawCell(g, { x, y }, tileSize, originX, originY, tile === '#' ? COLORS.wall : COLORS.floor, 3);
        if (tile === 'T' && !state.hasTarget) this.drawToken(g, { x, y }, tileSize, originX, originY, COLORS.target, 0.22);
        if (tile === 'E') this.drawToken(g, { x, y }, tileSize, originX, originY, COLORS.exit, 0.32);
        if (tile === 'H') this.drawToken(g, { x, y }, tileSize, originX, originY, COLORS.hideout, 0.25);
        if (tile === 'K' && !state.hasKey) this.drawToken(g, { x, y }, tileSize, originX, originY, COLORS.key, 0.25);
        if (tile === 'D') this.drawToken(g, { x, y }, tileSize, originX, originY, state.hasKey ? COLORS.wall : COLORS.door, 0.22);
      }
    }
    for (const cell of this.engine.getVisionCells()) this.drawCell(g, cell, tileSize, originX, originY, COLORS.vision, 0);
    for (const { camera, cells } of this.engine.getCameraVisionCells()) {
      for (const cell of cells) this.drawCell(g, cell, tileSize, originX, originY, new Color(250, 204, 21, 70), 0);
      this.drawToken(g, camera.position, tileSize, originX, originY, COLORS.camera, 0.17);
    }
    this.drawToken(g, state.boss, tileSize, originX, originY, COLORS.boss, 0.17);
    this.drawToken(g, state.player, tileSize, originX, originY, COLORS.player, 0.2);
  }

  private drawCell(g: Graphics, point: Point, size: number, ox: number, oy: number, color: Color, gap: number): void {
    g.fillColor = color;
    g.roundRect(ox + point.x * size + gap, oy - (point.y + 1) * size + gap, size - gap * 2, size - gap * 2, 8);
    g.fill();
  }

  private drawToken(g: Graphics, point: Point, size: number, ox: number, oy: number, color: Color, insetRatio: number): void {
    const inset = size * insetRatio;
    g.fillColor = color;
    g.roundRect(ox + point.x * size + inset, oy - (point.y + 1) * size + inset, size - inset * 2, size - inset * 2, 12);
    g.fill();
  }

  private move(direction: Direction): void {
    this.engine.move(direction);
    this.render();
  }

  private restart(): void {
    this.engine.reset();
    this.render();
  }

  private waitTurn(): void {
    this.engine.wait();
    this.render();
  }

  private nextLevel(): void {
    this.levelIndex = (this.levelIndex + 1) % LEVELS.length;
    this.engine = new GameEngine(LEVELS[this.levelIndex]);
    this.render();
  }

  private onKeyDown(event: EventKeyboard): void {
    const mapping: Partial<Record<KeyCode, Direction>> = {
      [KeyCode.ARROW_UP]: 'up', [KeyCode.KEY_W]: 'up',
      [KeyCode.ARROW_DOWN]: 'down', [KeyCode.KEY_S]: 'down',
      [KeyCode.ARROW_LEFT]: 'left', [KeyCode.KEY_A]: 'left',
      [KeyCode.ARROW_RIGHT]: 'right', [KeyCode.KEY_D]: 'right',
    };
    const direction = mapping[event.keyCode];
    if (direction) this.move(direction);
    if (event.keyCode === KeyCode.KEY_R) this.restart();
  }

  private createLabel(name: string, parent: Node, fontSize: number, color: Color, x: number, y: number, width: number, height: number): Label {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.parent = parent;
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(width, height);
    const label = node.addComponent(Label);
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 8;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    return label;
  }

  private createGraphicsNode(name: string, parent: Node, width: number, height: number, x: number, y: number): Graphics {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.parent = parent;
    node.setPosition(new Vec3(x, y, 0));
    node.addComponent(UITransform).setContentSize(width, height);
    return node.addComponent(Graphics);
  }

  private createButton(text: string, x: number, y: number, action: () => void, width = 84, height = 84): Node {
    const node = new Node(`Button-${text}`);
    node.layer = Layers.Enum.UI_2D;
    node.parent = this.node;
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(width, height);
    const g = node.addComponent(Graphics);
    g.fillColor = new Color('#334155');
    g.roundRect(-width / 2, -height / 2, width, height, 18);
    g.fill();
    const label = this.createLabel('Text', node, text.length > 1 ? 24 : 36, COLORS.white, 0, 0, width - 8, height - 8);
    label.string = text;
    node.on(Node.EventType.TOUCH_END, action, this);
    return node;
  }
}

let bootstrapped = false;
director.on(Director.EVENT_AFTER_SCENE_LAUNCH, () => {
  if (bootstrapped) return;
  const scene = director.getScene();
  if (!scene) return;
  bootstrapped = true;
  const root = new Node('MoyuEscape');
  root.parent = scene;
  root.addComponent(MoyuGame);
  if (sys.isBrowser) console.info('摸鱼逃生 MVP 已启动');
});
