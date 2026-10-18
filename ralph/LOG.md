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
