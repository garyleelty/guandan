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


