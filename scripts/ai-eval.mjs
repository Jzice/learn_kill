// AI 策略 A/B 评估：对比「原启发式基线（useEv=false）」与「EV 增强（useEv=true）」。
// 两臂使用**同一随机种子**（配对比较），把胜率差的标准误压低一个量级。
//
// 用法：node scripts/ai-eval.mjs [html文件名] [每臂局数] [座位数] [JSON输出路径]
//   node scripts/ai-eval.mjs "学堂杀.html" 300 5
import fs from 'node:fs';
import { installSeededRandom, launchSim, runGames, scoreOf, winRates } from './_sim.mjs';

const file = process.argv[2] || '学堂杀.html';
const N = parseInt(process.argv[3] || '300', 10);
const SEATS = parseInt(process.argv[4] || '5', 10);
const jsonPath = process.argv[5];
const SEED = 0x5eed1234;

const { page, errors, close } = await launchSim(file, 8904);
await installSeededRandom(page);

const ARMS = [
  { key: 'baseline', label: '基线 useEv=false', policy: { useEv: false } },
  { key: 'ev', label: 'EV   useEv=true ', policy: { useEv: true } },
];

const results = {};
for (const arm of ARMS) {
  const t0 = Date.now();
  const acc = await runGames(page, { games: N, seats: SEATS, policy: arm.policy, seed: SEED });
  results[arm.key] = { acc, ms: Date.now() - t0, label: arm.label };
}

const A = results.baseline;
const B = results.ev;
const wa = winRates(A.acc);
const wb = winRates(B.acc);

console.log(`\n=== AI 策略 A/B 对比：${N} 局/臂 · ${SEATS} 人局 · 同种子配对 ===`);
console.log('  指标              基线          EV          差值');
const row = (name, a, b, digits = 1, unit = '%') => {
  const d = (b - a) * (unit === '%' ? 100 : 1);
  const sign = d >= 0 ? '+' : '';
  console.log(
    `  ${name.padEnd(16)} ${(a * (unit === '%' ? 100 : 1)).toFixed(digits).padStart(6)}${unit}  ` +
      `${(b * (unit === '%' ? 100 : 1)).toFixed(digits).padStart(6)}${unit}  ${sign}${d.toFixed(digits)}${unit}`,
  );
};
row('主公胜率', wa.lord, wb.lord);
row('忠臣胜率', wa.loyal, wb.loyal);
row('反贼胜率', wa.rebel, wb.rebel);
row('内奸胜率', wa.spy, wb.spy);
row('平均局长(回合)', A.acc.avgTurns, B.acc.avgTurns, 1, '');
row('卡死局数', A.acc.stalls, B.acc.stalls, 0, '');

const sa = scoreOf(A.acc);
const sb = scoreOf(B.acc);
console.log(
  `\n  综合目标 J       ${sa.toFixed(4).padStart(8)}    ${sb.toFixed(4).padStart(8)}    ` +
    `${sb >= sa ? '✅ EV 更优' : '⚠️ 基线更优'}（差值 ${(sb - sa >= 0 ? '+' : '') + (sb - sa).toFixed(4)}）`,
);
console.log(`  耗时：基线 ${A.ms}ms / EV ${B.ms}ms`);
console.log(
  `  注：J = −Σ|身份胜率 − 理想(主忠45%/反40%/内奸15%)| − 0.002×局长 − 5×卡死局`,
);

console.log(`\n=== 控制台错误 ===`);
if (errors.length) {
  console.log(`❌ ${errors.length} 条:`);
  for (const e of errors.slice(0, 20)) console.log('   ' + e);
} else {
  console.log('✅ 无 console error / pageerror');
}

if (jsonPath) {
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        games: N,
        seats: SEATS,
        seed: SEED,
        baseline: { winRates: wa, avgTurns: A.acc.avgTurns, stalls: A.acc.stalls, score: sa, ms: A.ms },
        ev: { winRates: wb, avgTurns: B.acc.avgTurns, stalls: B.acc.stalls, score: sb, ms: B.ms },
      },
      null,
      2,
    ),
  );
  console.log(`\n✅ 已写入 ${jsonPath}`);
}

await close();
process.exit(errors.length || B.acc.stalls ? 1 : 0);
