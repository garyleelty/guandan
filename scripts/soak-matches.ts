// 压力跑整场：连打若干整场，查规则边角（进贡重复牌那类问题就是这么抓出来的）
// CI 里也跑这个：bun run scripts/soak-matches.ts 50
import { runSoak } from '../src/core/soak.ts'

const N = Number(process.argv[2] ?? 30)
const r = runSoak(N)
console.log(`打了 ${r.matches} 场，共 ${r.rounds} 局，${r.finished} 场分出整场`)
console.log(`问题 ${r.issues.length} 条`)
for (const i of r.issues.slice(0, 20)) console.log(' -', i.kind, i.detail)
if (r.issues.length > 0) process.exit(1)
