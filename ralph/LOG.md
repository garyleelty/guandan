# Ralph 执行日志

## S1 脚手架 done
- bun run build OK; vitest 冒烟 OK; commit 3b3ae04

### Task 2 cards

## S2 牌引擎 done
- cards 8 tests / combos 17 tests all green; commits 88237Series (cards), combos.

## S3 局引擎 done
- engine 18 tests: 收拢/接风/双下/1+3/1+4/A级；commit "engine state machine"
- ai 9 tests: 队友配合/最小压/炸弹兜底 + 100局 fuzz + 400局 autoplay；commit "AI mover"
- 注意：plan Task5 的 AiView 打分制启发式简化为 aiMove(state, seat) 直接读 GameState——保持合法性与策略底线（队友不压、最小压、炸留后手），后续可升级。

## S4 单机 UI done
- store/CardFace/Hand/Table/Lobby/App（bot 驱动 350/750ms，双击 quickLead）；commit "feat(ui): solo playable table"
- 修手牌溢出（重叠 -26）；Action 判别联合修正 tsc；52 tests 全绿。
- Task9 特效/音效：sound.ts Web Audio（play/bomb/win + 静音 gd-muted）+ 炸弹金光"炸 弹"/天炸黑带；commit "feat(ui): bomb/jokers fx + web-audio sounds + mute toggle"。

## S5 多人 P2P done
- room/host/guest/RoomView；双标签页实测：链接加入、开局广播、出牌/过同步双向一致。
- 关键修复：broadcastState/hostApplyIntent 以 store.match 为唯一真相（房主本地出牌曾导致 room.match 过期）；commit "fix(net): broadcast reads store as source of truth"。
- 掉线 AI 接管（hostDrop）、满房 leave+close、客人断线提示 guestLost。

## S6 部署/验收 done
- .github/workflows/deploy.yml（bun → tsc → vitest → GH_PAGES build → deploy-pages）；GH_PAGES=1 build/preview 本地验证通过。
- 截图归档 docs/screenshots/（01-lobby/02-table-start/03-midgame/04-bomb-fx/05-settlement）。
- 2026-10-18 推送到 github.com/garyleelty/guandan（main），CI 与 deploy-pages 均 success；线上 https://garyleelty.github.io/guandan/ index+assets 200；标题修正为「掼蛋 · Guandan」后再次部署成功。

## S7 UI 改版「夜桌」done
- 方向：design-taste-frontend / draw.mjs --app --style true-black-flat（seed 758630644）。旧版「Apple 浅色 + 玻璃 + 蓝色渐变」inspect 判 4 FAIL，改为暗色真黑：桌面暖近黑 #0e0d0c，卡片是唯一亮物，琥珀 #f2b33d 只落在数据上（级牌/我方/炸弹）。
- 令牌重写 src/styles.css（@theme：ground/surface/raised/line/muted/faint/accent…），按钮改反色白底黑字（一屏一个主按钮），.btn 等组件类移入 @layer components 以便工具类覆盖。
- core 新增（带单测）：sortBySuitGroups（理牌·花色聚拢）、levelToRank（2 级 → 点数 18，修掉级牌角标不显示的 bug）、levelLabel、cardIdToRank（记牌器用）。
- 牌桌重做：顶栏（产品标记 + 级牌阶梯 + 范围 + 音效图标）、三家牌背表示剩牌、出牌记录条、记牌器条（未见牌面）、操作条（出牌/过/理牌·点数⇄花色）、炸弹特效改纯黑带 + 琥珀字。
- 花色从字体符号改成矢量 SVG（inspect 判 emoji）；音效开关从 emoji 改 16px 线性图标。
- 大厅/房间/结算由子代理按同一令牌重做；顺手修 bug：大厅「通过链接加入」原来只切 mode 不切 screen，客人房码页永远进不去（现改为 mode+screen 同时切）。
- 验收：tasteskill inspect --app 大厅与牌桌均 0 FAIL 0 WARN；lint --app src/ui 0 FAIL（2 WARN：房码/链接用等宽字，属 ID 例外）；真浏览器冒烟 scripts/smoke-ui.mjs（出牌→AI 接牌→整局结算、理牌切换排序、无 console 报错）；截图重出 docs/screenshots/。
- 新增 ?solo=1 直达牌桌（分享单机局 / 验收截图用）、window.__gdAi 调试钩子（验收脚本驱动 AI 打完一局）。
- 66 tests 全绿、tsc -b 零错、oxlint 零错、bun run build 通过。

## S8 AI 升级 + 提示 done
- ai.ts 从 20 行占位升级为代价制策略：领出按「牌值 + 牌型偏好 + 拆牌惩罚」选最小代价组合
  （顺子 > 对子 > 单张，保留炸弹/三张/对子结构），跟牌能小压就小压、拆牌太贵就过。
- 新规则（TDD，6 条新用例）：不拆炸弹；炸弹留到对手只剩 1-2 张；好 2 不赢（单张/一对 2 留最后）；
  领出优先对子与顺子；只有炸弹能压且对手还早 → 过牌。
- 牌桌加「提示」按钮：调用同一套 aiMove 替我选好牌并给出一句建议（「建议：三张 4」），直接按出牌即可。
- P2P 回归：双标签页实测建房→链接进房→AI 补位→开局→双方出牌同步（scripts/smoke-p2p.mjs）。
- 72 tests 全绿；真浏览器冒烟 scripts/smoke-ui.mjs 覆盖 理牌/出牌/AI 接牌/提示。

## S9 升级延续 + 下一局 done
- 修 bug：「再来一局」把级数打回 2 级——掼蛋的升级整场连打，级数必须延续。
  新增纯函数 nextRoundOptions(prev)：级数接着上一局、下一局由上一局头游领出；整场结束（打过 A）才从 2 级重来。
  单机 rematch 与 P2P hostStart 都改用它（src/state/store.ts、src/net/host.ts），带 4 条单测。
- 修 bug：P2P 里房主的「再来一局」是死的（rematch 只处理 solo）——新增 rematchSink，房主开下一局会广播给客人；
  客人端结算页改为「等待房主开下一局」，不再有无效按钮。
- 真浏览器验证：打完一局后 levels {even:4,odd:2} → 再来一局仍为 {even:4,odd:2}，新一局由头游（座位 2）领出。
- 76 tests 全绿；P2P 双标签页回归仍同步。

## S10 牌面放大 + 手机端摊牌 + 本场战绩 done
- 牌面按屏宽分三档：桌面 76×108（露出 40px）、平板 62×88、手机 50×72；
  CardFace 改 size 档位（lg/md/sm/xs，角标与中央花色同步缩放）。
- 手机端 27 张牌挤成一排看不清 → 加「摊牌/收牌」切换：摊开成网格（每行 5-6 张，可纵向滚），
  收起回到底部一排；真浏览器 390px 实测 27 张全在位、一屏可见 24 张。
- 结算加「本场战绩」：每局一枚 chip（我方胜=琥珀、对家胜=中性）+「N 局 · 我方 X 胜」。
  引擎新增 RoundResult 与 GameState.history（跨局延续），单机与 P2P 都带着走；网络协议同步 history 字段。
- 出牌按钮被禁时说明原因：「这手不是合法牌型」「压不过桌面的对子 9」——禁用的按钮不该让人猜。
- 79 tests 全绿；inspect 1440/768/390 均 0 FAIL 0 WARN；截图重出（含两局战绩的结算页）。



## S11 进贡还贡（引擎先行，UI 待接）进行中
- 先按想当然写了一版（三游+四游各交一张给对手队头游），查证后推翻：官方口径是
  **只有下游（四游）进贡给上游（头游）、上游还要还一张 ≤10 的牌、还牌后由下游领出新一局**。
  依据：维基百科「掼蛋·贡牌 / Subsequent Hands」（引《江苏省掼蛋竞赛简易规则 2017 版》）。
  规则与设计写进 docs/superpowers/specs/2026-10-21-tribute-design.md。
- 引擎实现（src/core/engine.ts）：
  - `newTributeRound(prev)`：整场结束返回 null；算出进贡者（普通=四游，双下游=四游+三游）、
    复制上一局旧手牌、`phase='tribute'`；
  - `give` 动作两段：`step='give'` 交贡或抗贡（双王/天王炸才可抗贡）→ 引擎发新局
    （贡牌不进牌堆，直接进收贡者手牌，进贡者少拿一张等还牌）→ `step='return'` 收贡方还一张 ≤10；
  - 领出者：下游（双下游时贡牌大的那位）／抗贡时头游；
  - 双下游分配：贡牌大的给头游、小的给二游，点数相同按顺时针。
- 10 条新单测（src/core/tribute.test.ts）覆盖上述全部口径；全库 89 tests 全绿。
- 未接线：store/host 仍走原来的「头游领出下一局」，UI 无进贡视图（下一轮接）。
- 顺带记下另一条规则差异（暂不改）：官方淮安口径是「2 最小、级牌大于 A」，我们现在是
  「2 最大、级牌不作特殊牌」，还牌上界 10 在我们牌序里实际是 3–10。

## S11 进贡还贡（引擎先行 → 全链路接通）done
- 引擎先行部分见上条；本条是**接线**：上一轮只做引擎，这轮把进贡真正接进游戏。
- 流程改造（core/engine.ts 的 nextRound）：整场没结束 → 下一局先走进贡；
  整场结束（打过 A）或没有上一局 → 开新的一场。store 的 startSolo 与 host 的 hostStart 都走它。
- 进贡视图（src/ui/TributePanel.tsx）：面板讲清「现在轮到谁、做什么」——
  上局名次、当前该交/该还、每个人交了什么；操作条按阶段换按钮（交贡 / 还牌 / 抗贡）。
  手牌区在进贡阶段就是「上一局剩下的手牌」，玩家看着自己的牌交出去。
- AI（core/ai.ts 的 aiTributeMove）：交手里最大的一张；有双王/天王炸就抗贡；
  还牌还手里最小的一张 ≤10 的牌。App 里进贡阶段单独一个 effect 驱动。
- 联机：SerializedState 带上 tribute；房主 hostApplyIntent 允许进贡阶段的 give 意图，
  客人的交贡走「意图 → 房主跑引擎 → 广播」这条路。
- 顺手修了一个会卡死的边角：收贡方手里一张 10 以下的牌都没有时，还牌规则改为「还最小的一张」，
  不再让牌局停在那里。
- 验收：91 tests 全绿（新增 11 条进贡单测 + 3 条 AI 进贡单测 + 3 条 store 流程单测）；
  真浏览器单机走完「打完一局 → 再来一局 → 进贡 → 还牌 → 下游领出新一局」，
  每家 27 张、领出者是下游；P2P 双页同样走通（客人的交贡经房主生效，两边状态一致）；
  inspect 1440/768/390 均 0 FAIL 0 WARN；手机 390px 无横向溢出。

## S12 牌序对齐官方淮安口径 done
- 起因：做进贡时查证官方规则，发现我们的牌序是跑得快口径（2 最大、级牌不作特殊牌），
  不是掼蛋。官方（维基引《淮安掼蛋竞赛规则》2017）：**2 最小**，**级牌大于 A 小于王**，
  级牌不能按原点数出牌（但顺子里按原点数），顺子 **A 可高可低**（A-2-3-4-5 合法）。
  规则与迁移计划写进 docs/superpowers/specs/2026-10-22-rank-order.md。
- 编码：2→2、3..A→3..14、级牌比较值 15、小王 16、大王 17（原来 2 是 18）。
  `effectiveRank(card, level)` 把本局级牌算成 15。
- combos：identify(cards, level) 多一个本局级数参数；
  顺子按原点数判断（A 低用 1）；连对/钢板按比较值连续，级数那一点跳过；
  同色的一对王现在算对子（官方口径）。
- 引擎：GameState 加 `handLevel`（本局级数）。新局默认 2 级；
  进贡局按官方取「上一局头游那队的级数」，不再简单取两队最大值。
- AI：牌值/拆牌代价按比较值算；「好 2 不赢」改成「好牌不赢」——级牌留到最后；
  进贡交的是比较值最大的牌（2 现在是最小的牌，不会被当成贡牌）。
- UI：手牌按比较值排序（级牌排在 A 之上）、级牌角标、记牌器的点数清单。
- 验收：99 tests 全绿（牌型用例按新口径重写，另加级牌与本局级数用例）；
  真浏览器单机/进贡/P2P 三条路径都跑通，无 console 错误；
  inspect 1440/768/390 均 0 FAIL 0 WARN，lint 0 FAIL。
- 还没做（下一轮）：**逢人配**（红桃级牌万能）、下游那队不能在本局赢整场、报牌强制。

## S13 逢人配 + 炸系层级修正 done
- 依据：维基引《江苏省掼蛋竞赛简易规则 2017 版》原文——
  「红心花色的级牌…可以充当任意牌点的花色牌（即除大小王）搭配使用，称为"逢人配"」；
  同花顺「可以压五张及以下的炸弹，但六张及以上的炸弹比同花顺更大」；
  「A 在三连对、二连三、顺子、同花顺中可作为 1，最小者，也可作为 K+1」。
  规则与实现写进 docs/superpowers/specs/2026-10-22-wild-card.md。
- 逢人配：本局级数的**红桃**级牌是万能牌。identify 里枚举它替代成 2..A 识别牌型
  （花色沿用自身，同花顺另走「补同花色那张」特例），多解时取牌型强的、同型取点数大的；
  legalMoves 额外生成它能凑的牌型（成组、补顺子一格、三带二/连对、钢板）；
  交出去的是原牌，扣牌按原 id。
- 顺手修了两条一直错的规则：
  ① 原来「同花顺压一切炸弹」——官方是同花顺只压五张及以下的炸弹，六张及以上反过来压它；
  ② A 在连对/钢板里也能当 1（最小）或 K+1（最大），原来只认顺子里的 A 可高可低。
- UI：红桃级牌标「配」角标（黑底），其余级牌「级」角标（琥珀底）；
  AI 给逢人配牌值 +30（它比普通级牌灵活），不轻易甩掉。
- 已知简化：手里两张万能配时只按同点替代枚举（成对子/三张/炸弹），
  两张万能配分占顺子两格暂不支持。
- 验收：113 tests 全绿（新增 11 条逢人配用例）；真浏览器单机/进贡跑通、无 console 错误；
  inspect 1440/768/390 均 0 FAIL 0 WARN。
