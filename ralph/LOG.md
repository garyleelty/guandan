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
