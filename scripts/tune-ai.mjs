// AI 策略参数校准：CEM（交叉熵方法 / 无梯度策略搜索）。
// 博弈论意义：把启发式 AI 视为一个**参数化策略 π(θ)**，用自对弈做策略迭代——
// 每代采样 K 个 θ、按目标函数 J 选出精英、用精英更新高斯分布，逐步逼近更优策略。
//
// 用法：node scripts/tune-ai.mjs [html文件名] [每候选局数] [座位数] [代数] [每代候选数] [输出路径]
//   node scripts/tune-ai.mjs "学堂杀.html" 150 5 5 12
import fs from 'node:fs';
import { installSeededRandom, launchSim, runGames, scoreOf, winRates } from './_sim.mjs';

const file = process.argv[2] || '学堂杀.html';
const GAMES = parseInt(process.argv[3] || '150', 10);
const SEATS = parseInt(process.argv[4] || '5', 10);
const GENS = parseInt(process.argv[5] || '5', 10);
const K = parseInt(process.argv[6] || '12', 10);
const outPath = process.argv[7] || 'scripts/tune-ai-result.json';
const ELITE = Math.max(2, Math.round(K * 0.34));

/** 搜索空间：[参数名, 下界, 上界] */
const SPACE = [
  ['wSelf', 1.0, 3.5],
  ['wHand', 0.2, 1.2],
  ['wEquip', 0.2, 1.5],
  ['wSkill', 0.0, 1.2],
  ['spyBeta', 0.2, 2.0],
  ['grudgeW', 0.2, 1.5],
  ['favorW', 0.2, 1.2],
  ['threatW', 0.4, 2.0],
  ['killDenom', 0.3, 2.0],
  ['lowHpW', 0.0, 0.4],
  ['exposureW', 0.0, 0.5],
  ['duelMin', -0.5, 1.0],
  ['huogongMin', -0.5, 1.0],
  ['aoeMin', -0.5, 1.0],
  ['shanMarginal', 0.1, 1.2],
  ['tau0', 0.1, 0.8],
];

const NAMES = SPACE.map((s) => s[0]);
/** 初值：取当前默认策略（保证搜索从「已知可用」的点出发） */
const defaults = await (async () => {
  const tmp = await launchSim(file, 8905);
  const d = await tmp.page.evaluate(() => window.xtsGetAiPolicy());
  await tmp.close();
  return d;
})();

const mean = {};
const std = {};
for (const [k, lo, hi] of SPACE) {
  mean[k] = Math.min(hi, Math.max(lo, defaults[k] ?? (lo + hi) / 2));
  std[k] = (hi - lo) / 4;
}

function gauss() {
  // Box-Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sample() {
  const theta = {};
  for (const [k, lo, hi] of SPACE) {
    const v = mean[k] + gauss() * std[k];
    theta[k] = Math.min(hi, Math.max(lo, v));
  }
  return theta;
}

const { page, errors, close } = await launchSim(file, 8906);
await installSeededRandom(page);

const t0 = Date.now();
let best = { score: -Infinity, theta: { ...mean } };
const history = [];

console.log(`\n=== CEM 参数校准：${GENS} 代 × ${K} 候选 × ${GAMES} 局（${SEATS} 人局）===`);
console.log(`  搜索维度: ${NAMES.length}  精英数: ${ELITE}`);

for (let g = 1; g <= GENS; g++) {
  // 同一代内所有候选共用同一随机种子（配对比较，压低方差）；代与代之间换种子以防过拟合
  const seed = 0x5eed0000 + g * 7919;
  const cands = [];
  for (let i = 0; i < K; i++) {
    const theta = sample();
    const acc = await runGames(page, {
      games: GAMES,
      seats: SEATS,
      policy: { ...theta, useEv: true },
      seed,
    });
    const sc = scoreOf(acc);
    cands.push({ theta, score: sc, wr: winRates(acc), turns: acc.avgTurns, stalls: acc.stalls });
  }
  cands.sort((a, b) => b.score - a.score);
  const elite = cands.slice(0, ELITE);
  if (elite[0].score > best.score) best = { score: elite[0].score, theta: { ...elite[0].theta } };
  // 用精英更新高斯：均值 = 精英均值；标准差 = 精英标准差（带 0.3 下限，防早熟收敛）
  for (const [k, lo, hi] of SPACE) {
    const vs = elite.map((e) => e.theta[k]);
    const m = vs.reduce((a, b) => a + b, 0) / vs.length;
    const sd = Math.sqrt(vs.reduce((a, b) => a + (b - m) ** 2, 0) / vs.length);
    mean[k] = m;
    std[k] = Math.max((hi - lo) * 0.05, sd);
  }
  const e0 = elite[0];
  history.push({ gen: g, bestScore: e0.score, meanScore: cands.reduce((a, b) => a + b.score, 0) / K });
  console.log(
    `  第${g}代  最优J=${e0.score.toFixed(4)}  均值J=${history[g - 1].meanScore.toFixed(4)}  ` +
      `主${(e0.wr.lord * 100).toFixed(0)}% 忠${(e0.wr.loyal * 100).toFixed(0)}% ` +
      `反${(e0.wr.rebel * 100).toFixed(0)}% 内${(e0.wr.spy * 100).toFixed(0)}% ` +
      `局长${e0.turns.toFixed(1)} 卡死${e0.stalls}`,
  );
}

// 复核：用**新种子**把「最优 θ」与「默认 θ」各跑一轮，确认增益不是种子过拟合
const VS = Math.max(GAMES, 200);
const finalSeed = 0xabcDEF01;
const baseAcc = await runGames(page, { games: VS, seats: SEATS, policy: { useEv: true }, seed: finalSeed });
const bestAcc = await runGames(page, {
  games: VS,
  seats: SEATS,
  policy: { ...best.theta, useEv: true },
  seed: finalSeed,
});
const sb = scoreOf(baseAcc);
const st = scoreOf(bestAcc);
console.log(`\n=== 复核（新种子 ${VS} 局）===`);
console.log(`  默认 θ  J=${sb.toFixed(4)}  胜率 主${(winRates(baseAcc).lord * 100).toFixed(1)}% 反${(winRates(baseAcc).rebel * 100).toFixed(1)}% 内${(winRates(baseAcc).spy * 100).toFixed(1)}%`);
console.log(`  最优 θ  J=${st.toFixed(4)}  胜率 主${(winRates(bestAcc).lord * 100).toFixed(1)}% 反${(winRates(bestAcc).rebel * 100).toFixed(1)}% 内${(winRates(bestAcc).spy * 100).toFixed(1)}%`);
console.log(st >= sb ? `  ✅ 采用最优 θ（+${(st - sb).toFixed(4)}）` : `  ⚠️ 最优 θ 未超过默认，建议保留默认（${(st - sb).toFixed(4)}）`);

console.log(`\n=== 建议参数（可粘贴进 src/game/aipolicy.ts 的 DEFAULT_POLICY）===`);
for (const k of NAMES) {
  const d = defaults[k];
  const b = best.theta[k];
  console.log(`  ${k.padEnd(14)} ${d} → ${Number(b.toFixed(3))}`);
}

fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      games: GAMES,
      seats: SEATS,
      gens: GENS,
      k: K,
      ms: Date.now() - t0,
      history,
      baselineScore: sb,
      bestScore: st,
      adopt: st >= sb,
      best: Object.fromEntries(NAMES.map((k) => [k, Number(best.theta[k].toFixed(3))])),
      defaults: Object.fromEntries(NAMES.map((k) => [k, defaults[k]])),
    },
    null,
    2,
  ),
);
console.log(`\n✅ 已写入 ${outPath}（耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s）`);

if (errors.length) {
  console.log(`\n❌ 控制台错误 ${errors.length} 条:`);
  for (const e of errors.slice(0, 10)) console.log('   ' + e);
}

await close();
