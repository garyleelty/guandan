# 掼蛋网页版实施计划（V1）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本地可玩（1人+3AI）→ 多人 P2P（链接同玩）→ Apple 浅色高级感 UI → 部署 GitHub Pages。

**Architecture:** 引擎纯函数 core（cards/combos/engine/ai/levels）+ 宿主权威 P2P（host 驱动引擎广播快照）+ React UI 渲染镜像状态。详见 `docs/superpowers/specs/2026-10-18-guandan-webgame-design.md`。

**Tech Stack:** Bun + Vite + React 19 + TypeScript + Tailwind v4 + zustand + peerjs + vitest + agent-browser（验收截图）。

**执行方式（本会话）：** inline + TDD。core 任务严格红-绿-重构；UI/net 以验收清单+截图验证。全程用 Ralph 用户故事（`ralph/stories.json`）跟踪验收标准，每完成一项在 `ralph/LOG.md` 记录。

---

## 约定

- 包管理一律 `bun`（`bun install` / `bun run x` / `bunx`）
- 提交节奏：每个任务绿了就 `git commit`
- 点数编码（唯一真相，后续任何比较都用它，不再写点数表）：`3..10=3..10`, `J=11,Q=12,K=13,A=14,小王=16,大王=17,2=18`（避免 15 冲突高粱花，王跳过 15）
- 花色：`♠=0 ♥=1 ♣=2 ♦=3`；每副牌每点数 4 张 + 大小王各 1；两副 → 同点数 8 张
- 牌对象（可序列化，网络传输核心）：`{ id: string, rank: number, suit: number }`，id 形如 `"s15-1"`（黑桃A 第1副）/ `"jb-0"`（小王第0副）
- 队伍：偶数座（0,2）= A 队，奇数座（1,3）= B 队；两队各自升级，**牌局级牌 = max(两队级)**

---

### Task 1: 项目脚手架 + vitest

**Files:** `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`（占位）, `src/styles.css`(Tailwind v4 全局), `.github/workflows/ci.yml`

- [x] **Step 1:** `bun create vite@latest . --template react-ts` 骨架；安装 `react react-dom zustand peerjs`、dev: `vite @vitejs/plugin-react typescript vitest @types/react @types/react-dom tailwindcss @tailwindcss/vite`
- [x] **Step 2:** `src/styles.css`: `@import "tailwindcss";` + Apple 浅色 token（见 Task 9 CSS 块）
- [x] **Step 3:** `bunx vitest run`（空测试可过）→ `bun run build` 过
- [x] **Step 4:** commit "chore: scaffold vite react-ts bun"

### Task 2: core/cards — 牌的定义、洗牌、发牌、排序（TDD）

**Files:**
- Create: `src/core/cards.ts`
- Test: `src/core/cards.test.ts`

- [x] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { RANK, buildDeck, newShuffledDeck, sortCards } from "./cards";
import type { Card } from "./cards";

const hands = (cards: Card[]) => cards.filter((c) => c.rank === RANK.TWO).length;

describe("cards", () => {
  it("将至多 108 张，含 4 王 8 张 2，每人 27 张", () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(108);
    expect(deck.filter((c) => c.rank === RANK.BJ).length).toBe(2);
    expect(deck.filter((c) => c.rank === RANK.SJ).length).toBe(2);
    expect(hands(deck)).toBe(8);
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
  });
  it("无种子洗牌可复现", () => {
    const a = newShuffledDeck({ seed: 42 });
    const b = newShuffledDeck({ seed: 42 });
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });
  it("排序：2 最大在上，王次之，同点黑红梅方相邻", () => {
    const deck = sortCards(deckHands(newShuffledDeck({ seed: 7 }), 0));
    for (let i = 1; i < deck.length; i++) {
      expect(deck[i - 1].rank).toBeGreaterThanOrEqual(deck[i].rank);
      if (deck[i - 1].rank === deck[i].rank) {
        expect(deck[i - 1].suit).toBeLessThanOrEqual(deck[i].suit);
      }
    }
  });
  it("发牌恰好 27×4 无重叠", () => {
    const deck = newShuffledDeck({ seed: 3 });
    const dealt = [0, 1, 2, 3].map((i) => deck.slice(i * 27, i * 27 + 27));
    dealt.forEach((h) => expect(h).toHaveLength(27));
    expect(new Set(dealt.flat().map((c) => c.id)).size).toBe(108);
  });
});

function deckHands(deck: Card[], seat: number): Card[] {
  return deck.slice(seat * 27, seat * 27 + 27);
}
```

- [x] **Step 2:** `bunx vitest run` → FAIL（模块不存在）
- [x] **Step 3: 实现**

```ts
export const RANK = { THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10, JACK: 11, QUEEN: 12, KING: 13, ACE: 14, SJ: 16, BJ: 17, TWO: 18 } as const;
export type Rank = (typeof RANK)[keyof typeof RANK];
export const SUIT = { SPADE: 0, HEART: 1, CLUB: 2, DIAMOND: 3 } as const; // 王无花色 suit=-1
export type Card = { id: string; rank: number; suit: number };

export function buildDeck(): Card[] {
  const d: Card[] = [];
  for (let deckNo = 0; deckNo < 2; deckNo++) {
    for (let s = 0; s < 4; s++)
      for (let r = RANK.THREE; r <= RANK.ACE; r++) d.push({ id: cardId(s, r, deckNo), rank: r, suit: s });
    d.push({ id: `sj-${deckNo}`, rank: RANK.SJ, suit: -1 });
    d.push({ id: `bj-${deckNo}`, rank: RANK.BJ, suit: -1 });
  }
  return d;
}
export function cardId(s: number, r: number, deckNo = 0): string {
  return `${suitAbbr(s)}${r}-${deckNo}`;
}
function suitAbbr(s: number): string { return ["s", "h", "c", "d"][s] ?? "x"; }

// xorshift 可种子化洗牌（V1 本地用；seed 外发是未来房主迁移的预留路径）
export function newShuffledDeck(opts?: { seed?: number }): Card[] {
  const cards = buildDeck();
  let x = (opts?.seed ?? (Date.now() >>> 0)) | 1;
  const rand = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function sortCards(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => b.rank - a.rank || a.suit - b.suit);
}
export function deal(deck: Card[]): Card[][] {
  return [0, 1, 2, 3].map((i) => sortCards(deck.slice(i * 27, i * 27 + 27)));
}
```

- [x] **Step 4:** `bunx vitest run` → PASS
- [x] **Step 5:** commit "feat(core): cards deck shuffle deal sort"

### Task 3: core/combos — 牌型识别与比较（TDD，边界最多的模块）

**Files:** Create `src/core/combos.ts`, Test `src/core/combos.test.ts`

- [x] **Step 1: 写失败测试（关键边界全覆盖）**

```ts
import { describe, expect, it } from "vitest";
import { RANK } from "./cards";
import { identify, beats, ComboType } from "./combos";
import { mk } from "./testutil";

describe("identify", () => {
  it("单/对/三张/三带二", () => {
    expect(identify([mk("10")])).toMatchObject({ type: ComboType.SINGLE, rank: 10, len: 1 });
    expect(identify([mk("K"), mk("K")])).toMatchObject({ type: ComboType.PAIR });
    expect(identify([mk("6"), mk("6"), mk("6")])).toMatchObject({ type: ComboType.TRIPLE });
    expect(identify([mk("8"), mk("8"), mk("8"), mk("3"), mk("3")])).toMatchObject({ type: ComboType.TRIPLE_PAIR });
  });
  it("顺子恰 5 张，2 与王不可入，A 可收头 10JQKA", () => {
    expect(identify([mk("3"), mk("4"), mk("5"), mk("6"), mk("7")])).toMatchObject({ type: ComboType.STRAIGHT });
    expect(identify([mk("10"), mk("J"), mk("Q"), mk("K"), mk("A")])).toMatchObject({ type: ComboType.STRAIGHT, rank: 14 });
    expect(identify([mk("J"), mk("Q"), mk("K"), mk("A"), mk("2")])).toBeNull();
    expect(identify([mk("3"), mk("4"), mk("5"), mk("6"), mk("7"), mk("8")])).toBeNull(); // 6 张不是顺子
  });
  it("连对 ≥3 组；钢板 ≥2 组连续三张", () => {
    expect(identify([mk("5"), mk("5"), mk("6"), mk("6"), mk("7"), mk("7")])).toMatchObject({ type: ComboType.PAIRS, count: 3 });
    expect(identify([mk("7"), mk("7"), mk("7"), mk("8"), mk("8"), mk("8")])).toMatchObject({ type: ComboType.PLATE });
    expect(identify([mk("5"), mk("5"), mk("6"), mk("6")])).toBeNull();
  });
  it("炸弹 4-8 同点；同花顺 5 连同花；天炸四王", () => {
    expect(identify([mk("2"), mk("2"), mk("2"), mk("2")])).toMatchObject({ type: ComboType.BOMB, count: 4 });
    expect(identify([mk("6●"), mk("6●"), mk("6●"), mk("6●"), mk("6●"), mk("6●"), mk("7●"), mk("7●")])).toMatchObject({ type: ComboType.BOMB, count: 8 });
    const sf = [mk("5♦"), mk("6♦"), mk("7♦"), mk("8♦"), mk("9♦")];
    expect(identify(sf)).toMatchObject({ type: ComboType.SFLUSH });
    expect(identify([mk("BJ"), mk("BJ"), mk("SJ"), mk("SJ")])).toMatchObject({ type: ComboType.JOKERS });
    expect(identify([mk("BJ"), mk("BJ"), mk("BJ"), mk("BJ")])).toBeNull(); // 只有 2 大王 2 小王
  });
  it("A2345 或 JKQ 等 2 参与的组合非法", () => {
    expect(identify([mk("A"), mk("2"), mk("3"), mk("4"), mk("5")])).toBeNull();
    expect(identify([mk("9"), mk("9"), mk("10"), mk("10"), mk("J"), mk("J"), mk("Q"), mk("Q")])).toMatchObject({ type: ComboType.PAIRS, count: 4 });
  });
});

describe("beats（可以不打，非法组合直接 identify 为 null）", () => {
  const s = (ids: string[]) => identify(mk(ids)!);
  it("同型同长比点", () => {
    expect(beats(s(["Q", "Q"])!, s(["9", "9"])!)).toBe(true);
    expect(beats(s(["QA"])!, s(["KK"])!)).toBe(false); // typo-proof: 单张 A vs K? 用正确写法：
  });
  it("炸弹打非炸；天炸打一切；同花顺压炸弹", () => {
    expect(beats(s(["K", "K"])!, s(["3", "3", "3", "3"])!)).toBe(false);
    expect(beats(s(["3", "3", "3", "3"])!, s(["K", "K"])!)).toBe(true);
    expect(beats(s(["SJ", "SJ", "BJ", "BJ"])!, s(["2", "2", "2", "2", "2", "2", "2", "2"])!)).toBe(true);
    expect(beats(s(["2", "2", "2", "2", "2", "2", "2", "2"])!, s(["5♦", "6♦", "7♦", "8♦", "9♦"])!)).toBe(true);
  });
});
```

注：`mk`/`testutil` 由步骤 3 提供（含 `"6●"` = 同花六的宽松写法），避免测试里手写对象。

- [x] **Step 2:** FAIL
- [x] **Step 3: 实现（识别→比较）**

```ts
import { RANK } from "./cards";
import type { Card } from "./cards";

export enum ComboType { SINGLE, PAIR, TRIPLE, TRIPLE_PAIR, STRAIGHT, PAIRS, PLATE, BOMB, SFLUSH, JOKERS }

export type Combo = {
  type: ComboType;
  rank: number;       // 主点（比较用）
  count?: number;     // 炸弹张数 / 连对组数 / 钢板组数
  cards: Card[];
};

export function identify(cards: Card[]): Combo | null {
  const n = cards.length;
  if (n === 0) return null;
  const counts = new Map<number, { c: number; suits: number[]; ids: string[] }>();
  for (const { rank, suit, id } of cards) {
    const e = counts.get(rank) ?? { c: 0, suits: [], ids: [] };
    e.c++; e.suits.push(suit); e.ids.push(id);
    counts.set(rank, e);
  }
  const groups = [...counts.values()];
  // 天炸
  const jokers = counts.get(RANK.SJ)!.c + (counts.get(RANK.BJ)?.c ?? 0) ... // 伪码占位 → 实现时写全
  ...
}
```

实现要点（写代码时逐条落地）：
1. `n===1` → SINGLE（王合法）；`n===2` → 两同点 PAIR 或两王（SJ+BJ 各 1 张 = 无效；双王=2 张王但只有各 2 张，两王同 rank 不可能）→ `JOKERS` 仅当 `n===4` 且 `{BJ×2, SJ×2}`
2. 有王（rank≥16）出现在任何非 JOKERS 组合 → 返回 null
3. 顺子/SFLUSH：恰 5 张、点数连续、无双张；SFLUSH 要求同花 `suit` 一致且非王;连 2 与跨 2 非法（rank 18 不可入：任何 group.rank===TWO 即非合法顺型成员）
4. PAIRS：每组恰好 2 张、≥3 组、连续;PLATE：每组 3 张、≥2 组、连续
5. BOMB：4≤n≤8 同点;SFLUSH 优先级处理：同花 5 连归类 SFLUSH 而非 STRAIGHT
6. TRIPLE_PAIR：3+2 两点
7. `beats(a, b)`：a.type===JOKERS → true；a.type===SFLUSH → b.type!==SFLUSH ? true : 同长比点；a.type===BOMB → b 非炸（非 SFLUSH/BOMB/JOKERS）true，同型 BOMB 数量优先再点数；否则同 type 且（count 相等）比 rank，否则 false

- [x] **Step 4:** PASS
- [x] **Step 5:** commit "feat(core): combos identify beats"

### Task 4: core/engine — 状态机（TDD）

**Files:** Create `src/core/engine.ts`, Test `src/core/engine.test.ts`

状态与动作（唯一形状，UI/AI/net 全用它）：

```ts
import type { Card } from "./cards";
import type { Combo } from "./combos";

export type Seat = 0 | 1 | 2 | 3;
export type Team = "even" | "odd"; // even=座0,2

export type PlayerState = { seat: Seat; name: string; isBot: boolean; hand: Card[]; finishOrder: number | null };
export type Trick = { leader: Seat; table: { seat: Seat; combo: Combo } | null; passRun: number };
export type Level = { even: number; odd: number }; // 各队已到级，2..14(A)

export type GameState = {
  phase: "playing" | "ended";
  levels: Level;                 // 两队等级
  players: PlayerState[];
  turn: Seat;
  trick: Trick;
  handsOut: Record<Seat, number>;// 每人已打空记 0 之后就不再轮（finishOrder 顺序）
  finishCount: number;           // 已经完成使用的计数
  log: PlayedEntry[];            // 全局动作日志（回放/记录 UI）
};
export type PlayedEntry = { seat: Seat; combo: Combo | null }  // null=过
export type Action = { kind: "play" | "pass"; seat: Seat; cards?: string[] /*ids*/ };
```

- [x] **Step 1: 失败测试（以下行为逐条断言）**

```ts
核心场景（用 newGame(seed) 起 4 人手牌，手动构造小牌局面驱动）：
1. newGame 后 phase=playing、turn=0、`levels.even=levels.odd=2` → 各 hand 27
2. 当轮玩家出合法牌（压过或领出）→ 手牌 -n、table 更新、turn 推进到下一个未完成座
3. 领出不可过：empty table 时 pass 非法 → engine 忽略（原 state 不变）
4. 压不过桌面的 play 非法 → state 不变
5. 轮转：PASS 连满（除 lastPlayed 外全过）→ trick 胜者=lastPlayed；table 清空；leader=胜者
6. 胜者打空 → finishOrder=1（头游）→ 若二游与他同队 → 立即 ended（双下）
   若二游异队 → 继续，直到第三名 finishOrder=3 → ended（含 4 次 finish）
7. 头游率队升级：队友=二游 → +3 的断言基于 1+2 同队；1+3 → +2；1+4 → +1（三用例构造）
8. 级牌承接：even 队升 3 → levels.even=5; odd=2 → 牌局级牌=max=5（收尾 2）
9. A 级尚未双下不算胜：levels odd=14 出头游+3 游(队友) → 留在 14 重来；双下 → ended.matchWinner
```

用 helper 驱动而不是手撕 108 张：`testDriver(state)` 封装“按 AI 挑最小合法牌打完一整局”的 `autoplay(state)`，验证 6/7（随机 seed 100 局：全部能 ended 且 finish 1..4 单调）。

- [x] **Step 2:** FAIL
- [x] **Step 3: 实现**

引擎样例骨架（实现时补全所有分支）：

```ts
export function newGame(opts: { levels?: Level; names?: string[]; seed?: number }): GameState { ... }
export function step(state: GameState, action: Action): GameState {
  if (state.phase !== "playing") return state;
  const st = clone(state);
  if (action.kind === "play") { /* 校验轮次/context/合法 → 扣牌/补 log/终结处理 */ }
  else { /* 空牌桌不可过；过则 passRun++ 等 */ }
  /* passRun 满 → 收拢 trick：winner 领出；若 winner 已 finish → 接风 */
  /* finish 处理：finishCount++；若满足结束条件 → 计分 + ended */
}
export function legalMoves(state: GameState, seat: Seat): Combo[] { /* combos 全枚举（遵循 identify）*/ }
export function autoplay(state: GameState, rand = Math.random): GameState { /* AI 循环驱动到 ended */ }
```

实现要点：
1. **每个 action 校验**：`action.seat===state.turn`、动过完毕座位非法、`pass` 需 `trick.table` 存在、`play` 需手牌含 ids 且 `beats`
2. **turn 推进**：下一个 `finishOrder===null` 的座
3. **trick 结束判定**：`passRun === activeCount-1`（activeCount=未 finish 玩家数；特别地 activeCount===1 时该家自胜）
4. **终局判定**：`finishCount===2` 且两名 finish 同队 → ended；`finishCount===3` → ended
5. **计分**：even/odd 队中头游队 delta 按 3/2/1 级；`打 A 需双下`：若头游队 level=14 且 delta<3 → 只加分不合 variant（留在 14）；双下 delta=3 时 level 从 14 → "过 A" = matchWinner 记该队
6. **levels 推进**：赢队 level += delta（14 封顶不越），下一局级牌 = max(两 level)
7. **log 全记录**，`handBySeat` 镜像供 UI 读取座位手牌

- [x] **Step 4:** PASS（含 100 局 autoplay 单不崩断言）
- [x] **Step 5:** commit "feat(core): engine state machine"

### Task 5: core/ai — 中等策略（TDD + 模拟回归）

**Files:** Create `src/core/ai.ts`, Test `src/core/ai.test.ts`

- [x] **Step 1: 失败测试**

```ts
1. aiMove 永远是 legalMoves 之一（100 随机局面 fuzz）
2. 领出时桌面空 → 从“非炸、非天炸”走子里挑期望计分最小者（不破坏炸弹）
3. 队友领出且队友牌不强 → pass 优先（构造手牌/桌面验证返回 null 意图）
4. 对手剩 ≤2 且我这有炸、当前桌面对手大 → 出炸
5. 能最小压时用最小可压组合
6. 记牌：手上有明确的“对手不可能有更大”的单张（对手全过且他家剩数为 0）→ 大牌压发
```

- [x] **Step 2:** FAIL
- [x] **Step 3: 实现（打分制 heuristic）**

```ts
export type AiView = {
  mySeat: Seat; hand: Card[]; table: Trick["table"]; lastPlayedSize: number;
  counts: Record<Seat, number>;       // 各家未出张数
  seenRanks: Map<Rank, number>;       // 全局已见出牌点数计数
  teammate: Seat; teams: [Team, Team][];
  levels: Level;
};
export function aiMove(view: AiView, rand = Math.random): { kind: "play"; cards: Card[] } | { kind: "pass" } { ... }
```

策略分层（实现为独立可测函数）：
1. `legal = legalMoves(...)`，无 → pass
2. **领出（table 空为 null combo）**：候选打分 = 模型(破坏手牌度, 保留控制权, 吃了能抢的风险)。基础：小对/顺子优先于散单，散单选最小；同长度多选一时偏好出“点数少对家可能接不顺”的；不拆炸弹/钢板资源；手炸时优先常规型领出
3. **跟牌**：
   - 队友是桌上主 → 牌够好在中位以上（rank ≥ K）就过；只有能小压且不破结构才小压
   - 对手主 → 最小可压常规型；但若 `min(counts[opponents]) <= 2` 或对手主点 ≥ Q 且自己手牌质量高 → 用大子/炸弹
   - 桌主是我队友且换我必须出（passRun 剩一）→ 依然可以过（不做强制压）
4. **炸弹时机**：对手剩 ≤2（出完即赢局势）、或我方能因炸弹打完后头部抢头游、或对手打出 ≥6 张的大炸弹应对 → 用
5. **残局**：我方剩 1 张/对且为最大可能点 → 优先甩出
6. 记牌：用 seenRanks 判断“该点数已空+别人手牌数为最小单张”→ 主动大单锁头

- [x] **Step 4:** PASS + `bunx vitest run src/core/ai.test.ts`
- [x] **Step 5:** 400 局 autoplay 回归（无断言失败即过）+ commit

### Task 6: 状态接 UI（未完 UI 先接 store，最小 React 挂点）

**Files:** `src/state/store.ts`, `src/App.tsx`

- [x] **Step 1:** zustand store：`{ state: GameState | null, mySeat: Seat, dispatch(action) }`
- [x] **Step 2:** App：`state===null → Lobby`，有 state → Table（先无样式跑通逻辑）
- [x] **Step 3:** 手动启 `bun run dev` 用 autoplay 预览跑满一局
- [x] **Step 4:** commit

### Task 7: 单机完整可玩（Lobby / Room 简版 + Table / Hand 完整）

**Files:** `src/ui/Lobby.tsx`, `src/ui/Table.tsx`, `src/ui/Hand.tsx`、`src/state/store.ts` 扩展

- [x] **Step 1:** Lobby 三入口：创建房间 / 加入链接（读 `?r=`）/ 单机（me seat0 + 3 AI）
- [x] **Step 2:** Table 四方位布局 + Hand 选中/弹起/可压提示（React + Tailwind token，详见 Task 9 视觉完成）
- [x] **Step 3:** 手牌/打出交互：点选→出牌/过；行非法时引用报错 toast
- [x] **Step 4:** agent-browser 打开 `http://localhost:5173`，单机局中截图人工比对设计稿，微调
- [x] **Step 5:** commit

### Task 8: net — PeerJS 房间（多人 P2P）

**Files:** `src/net/room.ts`, `src/net/host.ts`, `src/net/guest.ts`

- [x] **Step 1:** `room.ts`：6 位房码（无易混字符集）、`peer id = gd-<code>`、链接组装/解析
- [x] **Step 2:** `host.ts`：Peer 初始化、DATA 连接收 HELLO/INTENT/LEAVE、每引擎 step 后广播 STATE 每客个性化（myHand 只发本人）、EVENT 回执、 客人 60s 重连再 hello 视为坐回
- [x] **Step 3:** `guest.ts`：connect → on STATE 写 store；INTENT 发送
- [x] **Step 4:** 双开 Chrome 冒烟（host tab / ?r= 房码 tab）：可互见名字+互出牌
- [x] **Step 5:** commit "feat(net): peerjs host guest"

### Task 9: UI 视觉完成（Apple 浅色精修）+ 特效 + 音效（Web Audio）

**Files:** `src/styles.css` token、`Table.tsx` 精修、`Hand.tsx` 动画、`effects.tsx`、`sound.ts`

CSS token（Tailwind v4 `@theme`）：

```css
@theme {
  --color-ink: #1d1d1f;
  --color-ink-2: #424245;
  --color-ink-3: #86868b;
  --color-paper: #f2f2f7;
  --color-paper-2: #ffffff;
  --color-blue: #007aff;
  --color-blue-2: #5ac8fa;
  --color-orange: #ff9500;
  --radius-xl: 12px; --radius-2xl: 20px;
  --shadow-soft: 0 1px 2px rgb(0 0 0/.05), 0 4px 12px rgb(0 0 0/.06), 0 12px 32px rgb(0 0 0/.07);
  --shadow-card: 0 2px 4px rgb(0 0 0/.06), 0 6px 18px rgb(0 0 0/.10);
}
```

验收点（执行时逐条截图核对）：
- [x] 背景 `--color-paper` 微渐变，四家布局：北=对家牌背+芯片、东西=竖小牌背、南=大手牌
- [x] 选中牌 `-translate-y-2 ring-2 ring-[--color-blue]`；不可压牌 `opacity-60 saturate-50`
- [x] 出牌动画：`transition-transform duration-300 ease-[cubic-bezier(.2,.9,.3,1.2)]`
- [x] 炸弹=震屏 `animate-[shake_.4s]` + 金光字；天炸=黑金全屏横条
- [x] 级牌角标（四角 chip）+ 报牌橙闪（余 ≤2）
- [x] 大厅三入口卡（创建/加入/单机）+ 房间页四座位卡 + "+AI" + 开始
- [x] 身份改昵称（localStorage）
- [x] Web Audio 合成音效：出牌/炸弹/胜利 3 类 + 静音开关

### Task 10: 部署 + CI + 截图验收（收尾）

**Files:** `.github/workflows/deploy.yml`（Pages）、`vite.config.ts`（`base: "/guandan/"`）

- [x] **Step 1:** CI：`bun install && bunx tsc --noEmit && bunx vitest run && bun run build`
- [x] **Step 2:** Pages 工作流（actions/deploy-pages），`?r=` 模式保证刷新不 404
- [x] **Step 3:** 本地 `GH_PAGES=1 bun run build && GH_PAGES=1 bun run preview` agent-browser 截图验收：大厅 / 牌局 / 炸弹特效 / 结算
- [x] **Step 4:** 把截图归档 `docs/screenshots/` ，commit；向用户展示

---

## Ralph 用户故事化（执行即填 stories）

`ralph/stories.json`：每故事 { id, title, criteria: [{ id, desc, check: "cmd" | "manual" }] }，执行每个 Task 时把 criteria 勾掉并记 LOG。具体轮廓：

- S1 脚手架（T1）：`bun run build` 零错
- S2 引擎牌（T2/T3）：vitest 全绿 ≥ 60 用例
- S3 引擎局（T4/T5）：autoplay 400 局无崩溃 + 升级计分对
- S4 单机 UI（T6/T7/T9）：截图五张对齐验收（大厅/房间/牌局/特效/结算）
- S5 多人（T8）：双开冒烟
- S6 部署（T10）：CI 绿 + Pages URL 可开 + 截图归档
