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

## S14 下游那队赢不了整场 + 报牌阈值 + AI 记牌 done
- 补两条官方规则：
  ① 英文版《淮安掼蛋竞赛规则》：**上一局下游（第四名）那队，本局赢了也不能拿下整场**
     （状态新增 dwellerTeam，进贡局从上一局第四名带下来；A 级双下时若赢方正是
     上一局下游那队，就不算拿下整场，整场继续，级数不升）。
     结算页会写一句「上一局的下游那队，本局赢不了整场」，别让人以为卡住了。
  ② 报牌阈值按官方：**手里 ≤10 张要报数**（原来按 ≤2 标「报牌」）。
- AI 记牌（core/ai.ts）：从出牌记录算每个点数还剩几张（两副牌每点 8 张、王 2 张），
  扣掉自己手里的，得到「对手可能还有多少张」的上界；领出对子/三张/炸弹时，
  按对手可能凑出的更大组数估风险（按对手剩牌数封顶），风险高的牌型代价更大。
  效果：算得出对手压不动就先甩那手（先出 K 对而不是 9 对）。
- 验收：118 tests 全绿（新增 3 条下游规则用例 + 2 条记牌用例）；
  真浏览器单机与 P2P 双页跑通、无 console 错误；inspect 0 FAIL 0 WARN，lint 0 FAIL。
- AI 单步耗时 ~2.2ms（记牌把牌 id→点数做了缓存），牌局节奏不受影响。

## S15 牌谱（这一局每手出的真实牌面）done
- 出牌记录条只写「谁出了什么牌型」，复盘时看不到具体是哪几张——补一个**牌谱**面板：
  操作条上「牌谱」按钮打开，逐手列出序号、座位、牌型、真实牌面，过牌也记一笔。
- 牌谱要还原「当时打的是哪几张」：牌已经离开手牌了，所以新增 `cardFromId(id)`
  （从 id 反解整张牌，普通牌与王都支持），配 2 条单测。
- 桌面与手机都能用：手机上面板全屏、牌面自动换行；顺手修了两个布局问题——
  打开面板时页面横向溢出 5px（表格根节点加 overflow-x-hidden）、
  面板用 grid 居中导致 max-w-full 失效（改 flex 居中 + fixed 覆盖层）。
- 验收：120 tests 全绿；inspect 1440/768/390 均 0 FAIL 0 WARN，lint 0 FAIL；
  截图新增 docs/screenshots/08-play-history.png。

## S16 AI 难度三档 done
- 难度进状态（`GameState.aiLevel`），单机大厅与 P2P 房间都能选，联机协议同步。
- 三档的差别是真的：
  - **简单**：拆牌代价打折（会拆对子、三张）、领出带随机——偶尔想不起；
  - **普通**：会算牌型、算拆牌代价，不算剩余牌；
  - **难**：再加上上一轮的**记牌**——算得出对手压得动就不出那手对子。
- 界面：大厅三张卡（简单/普通/难，各带一句说明），房间一排小按钮；玩法速览补上
  「红桃级牌是逢人配」与「每局之间下游进贡、上游还牌」两条新规则。
- 验收：122 tests 全绿（新增 2 条难度差异用例：普通档宁可用 A 也不拆对 9，
  简单档会拆对 9 去压）；真浏览器单机与 P2P 双页跑通、无 console 错误；
  inspect 0 FAIL 0 WARN，lint 0 FAIL；截图 docs/screenshots/09-ai-level.png。
- 记一笔：**房主转移做不了**——纯 P2P 没有服务器，房主一关整个房间就没了，
  客人之间没法选新房主。要做这个得先上服务端或信令中转。

## S17 客人断线重连 done
- 之前客人刷新页面就丢座位：断线后座位变 AI 顶替，重连的人是"新玩家"，原来的座位空着。
- 做法：客人本机记一个 token（localStorage），握手 hello 时带上；房主按 token 认领原座
  （断线后座位虽然变成 AI/空位，token 仍留着）——重连就还是那个座位，名字也还在。
- 牌局中断线重连同样能收回座位：AI 顶替的那两手由 AI 打完，座位交回本人后接着打，
  牌桌顶栏显示「已重新连接」提示。
- 真浏览器验证（scripts/smoke-reconnect.mjs）：房内刷新 → 座位不变、房主座位表不重复；
  牌局中刷新 → 座位不变、`players.isBot` 变回 false（AI 不再替打）、无 console 错误。
- 房主转移仍然做不了（纯 P2P 没有服务器，状态只在房主浏览器里）——这条要上服务端才能谈。

## S18 房间体验：房主踢人 + 客人等候室 done
- **房主能请人出房间**：座位行加「移出」按钮；客人收到明确提示
  （「你已被房主请出房间」，并说明可以回大厅或等房主再拉），座位当场空出来。
- **客人主动离开也把座位空出来**——之前客人走了座位还占着，房间凑不齐人。
- **客人的等候室不再是干巴巴一行字**：显示房号、四座身份（房东 / 玩家 / AI / 虚位）、
  房主定的 AI 难度。协议里 welcome 改为带完整座位信息（含身份），客人才能画对。
- 真浏览器验证（scripts/smoke-kick.mjs）：踢人后房主座位表该座变虚位、
  客人看到提示文案、两边无 console 错误；P2P 与重连两条脚本照常通过。
- 顺手修了三个中文乱码（补丁时把「踢/里/个」写坏了）：host.ts 的踢人文案、
  TributePanel 的进贡提示、RoomView 的等候室注释——已全仓扫过一遍没有残留。

## S19 牌桌手感：出牌落桌动效 + 音效补齐 done
- **出牌从座位方向落到桌心**：以前中央的牌是「凭空出现」（一个 pop），
  现在按出牌者相对我的方向滑入（自己=下、搭档=上、左家=左、右家=右），
  200ms、只做反馈不做过场。四个方向各一条 keyframes（styles.css）。
- **音效补齐**：选牌一声轻咔哒、过牌一记闷响、进贡两声上行；
  原来的出牌/炸弹/胜负音色不动。
- 验收：122 tests 全绿；真浏览器确认中央牌的落桌动画类按方向生效
  （左家出牌 → animate-land-left）、无 console 错误；
  inspect 0 FAIL 0 WARN，lint 0 FAIL。
