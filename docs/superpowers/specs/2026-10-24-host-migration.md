# 房主转移 + 心跳断线检测 + 自建信令（V1.8）

**日期:** 2026-10-24
**父项目:** 掼蛋网页版（见 `2026-10-18-guandan-webgame-design.md`，其中「TODO(将来)：
借助引擎纯函数 + seed 外发」这一条由此落地）
**状态:** 已落地（协议 + 客人自动重连 + 冒烟 smoke-migrate.mjs）

## 为什么做

旧架构里房主即服务器：房主关页面，整场牌局陪葬。V1 设计明确推迟了房主转移，
本轮补上——引擎本来就是纯函数，缺的只是「客人手里要有全量状态」这一条。

## 方案

### 1. 玩家客人改收全量状态

- `serializeFor(st, seat, { fullHands: true })`：玩家客人收到**所有座位的手牌**；
  UI 层依旧只渲染自己的手牌（别人家的牌只显示牌背数量），渲染不泄露。
- **观战者永远全隐藏**（`hideHands: true` 优先级最高，两者同传时以 hideHands 为准）
  ——不回退 45f0470 的隐私约束。代价：玩家客人理论上能从内存里偷看全桌牌，
  P2P 朋友局信任客户端，接受。

### 2. 心跳（WebRTC close 事件不可靠）

- 房主每 4s 向所有连接广播 `{t:'ping'}`；
- 客人记 `lastSeen`，看门狗每 3s 检查：**12 秒没任何消息 → 判定失联**
  （此前只能等 ICE 超时，最慢要几十秒）。主动退出（leaveGuest）会停看门狗。

### 3. 失联后的分流（guest 侧 `onGuestDisconnected`）

1. **最低座位的人类客人**（roomSeats 里 kind=guest 的最小座）→ `migrateToHost()`：
   - 用本地全量状态当权威，绑定原 peer id `gd-<房码>`；
   - 旧房主的座：牌局还在 → 交给 AI（isBot=true，他回来只能当客人重进）；
   - 其他断线客人的座：先交给 AI 代打，重连后收回；
   - peer id 被占（旧房主僵尸 / 竞速）→ 退避重试 3 次，不行就放弃。
2. **其他人**（含观战者）→ 2–3.5s 后自动重连 `joinRoom(?r=)`，无限重试；
   手动「重新连接」按钮保留。

### 4. 重连认座（新房主不认识旧 token）

- hello 新增 `seat` 字段（客人带上自己原来的座）；
- 房主认领顺序：**token 精确匹配 → 「座位 + 名字」匹配**（kind=guest、无连接、
  名字一致）。认领成功后记录 token，之后照旧。
- 名字在迁移时随座位表保留，所以「座位+名字」能唯一落到人。

### 5. 自建信令（环境变量）

公共云（0.peerjs.com）会抽风。`peerOpts()` 读环境变量，未设时走公共云：

```
VITE_PEER_HOST=127.0.0.1 VITE_PEER_PORT=9000 VITE_PEER_SECURE=0 npx vite
# 信令服务器：npx peer --port=9000
```

本地起法：`nohup npx peer --port=9000 &`（挂 `/peerjs`，key 默认 peerjs）。
冒烟脚本全部可以在本地信令下跑，不再看公共云脸色。

## 状态形状变化

- `Msg.hello` 增加 `seat?: Seat`、新增 `{t:'ping'}`；
- `SerializedState` 不变（fullHands 是 serializeFor 的选项，不是新消息）。

## 已知边界（V1 不做）

- 最低座位客人自己关页面 → 无人转移，牌局死亡（重试的客人会一直等）；
- 旧房主刷新回来：原 peer id 被新房主占用，他需要用邀请链接以客人身份重进；
- 迁移时不带 `banned` 黑名单（被踢的人理论上能重进，房主可以再踢一次）；
- 观战者迁移后需等自动重连，观战人数列表从零重新累计。

## 验证

- `scripts/smoke-migrate.mjs`：建房 → 双客人+AI 开局 → 打几手 → 关房主页面 →
  断言 guestA 变 host、guestB 重连追平 log、名字不乱、牌局继续；
- `src/net/room.test.ts`：fullHands / 观战全隐藏 / hideHands 优先级。
