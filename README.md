# 摸鱼逃生

打工人主题的微信小游戏竖切片：玩家每行动一回合，老板巡逻一步、监控旋转一次；利用躲藏点和门禁卡取得摸鱼目标，再安全返回出口。

## 已完成

- 8 个渐进式关卡（当前以 TypeScript 数据保存，后续可直接改为远程 JSON）
- 玩家移动、墙体阻挡、目标拾取、出口判定
- 老板巡逻、朝向与受墙体遮挡的直线视野
- 躲藏点、门禁卡、锁门、旋转监控与等待回合
- 触控方向键、地图滑动、键盘、重开、下一关
- 三星步数评价、选关界面、本地最佳成绩与解锁进度
- Cocos Creator 3.8 TypeScript 客户端适配层
- 共用规则核心的浏览器预览与自动测试

## 立即预览

```bash
npm install
npm run dev
```

浏览器打开终端给出的地址。完整校验：

```bash
npm run check
```

## 用 Cocos Creator 打开

1. 安装 Cocos Dashboard，并安装 Cocos Creator 3.8.8。
2. 在 Dashboard 里选择“导入”，选中本项目根目录。
3. 第一次打开后，让 Creator 完成资源导入并生成 `temp/tsconfig.cocos.json`。
4. 新建一个空的 2D 场景并保存为 `assets/scenes/Main.scene`。
5. 将 `Main.scene` 设为启动场景后预览。

`assets/scripts/MoyuGame.ts` 在场景启动后会自动创建完整游戏 UI，无需手工拖节点或绑定组件。

## 发布微信小游戏

在 Cocos Creator 打开“项目 → 构建发布”，平台选“微信小游戏”，填写小游戏 AppID 后构建；再用微信开发者工具导入构建目录进行真机调试和上传。

## 目录

```text
assets/scripts/core/       与引擎无关的游戏规则、关卡数据
assets/scripts/MoyuGame.ts Cocos Creator 显示和输入适配
web-preview/               无需安装 Cocos 的浏览器预览
tests/                     规则单元测试
```

## 下一阶段

- 用正式像素/扁平风美术替换色块
- 增加同事诱饵、声音范围和一次性道具
- 接入微信登录、排行榜、每日挑战和激励视频广告
- 增加关卡可解性校验与关卡编辑器
