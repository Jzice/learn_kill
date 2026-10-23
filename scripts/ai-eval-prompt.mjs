// 提示词版本对照：分别启动无头浏览器读取两个 build 的 window.__PROMPT_VER__，
// 确认前后对照的版本边界（minify 会重命名局部变量，故不能靠正则从 HTML 提取，
// 必须在运行时读取 window.__PROMPT_VER__，与 ai-eval.mjs 一致）。
//
// 用法：node scripts/ai-eval-prompt.mjs <旧build.html> <新build.html>
//
// 重要说明：
//   ai-eval 当前比较的是「启发式 useEv」两臂（无头模拟 isSim 下不触发 LLM），
//   因此它的胜率差与提示词无关。要量化本次提示词改动（RULE_REF / EVAL_PRINCIPLES /
//   deriveHint / 策略化指令 / 差异化温度）对「LLM 接管」决策质量或胜率的影响，
//   需要在已配置好 LLM API 的 build 上、于 LLM 接管模式跑少量对局；每次评测报告
//   与 JSON 都会记录 PROMPT_VER，从而把胜率差与提示词版本对应起来做前后对照。
import path from 'node:path';
import { launchSim } from './_sim.mjs';

const [oldFile, newFile] = process.argv.slice(2);
if (!oldFile || !newFile) {
  console.log('用法：node scripts/ai-eval-prompt.mjs <旧build.html> <新build.html>');
  console.log('  参数可为文件名（默认在 dist/ 下）或含 dist/ 前缀的完整路径，脚本会自动取文件名。');
  process.exit(1);
}

// serve-dist 在 dist/ 目录内按文件名服务，故用 basename 去除可能的 dist/ 前缀。
async function readVer(file, port) {
  const { page, close } = await launchSim(path.basename(file), port);
  const ver = await page.evaluate(() => window.__PROMPT_VER__ || '(未注入 PROMPT_VER)');
  await close();
  return ver;
}

const oldVer = await readVer(oldFile, 8906);
const newVer = await readVer(newFile, 8907);

console.log(`旧 build  (${oldFile})\n  PROMPT_VER = ${oldVer}`);
console.log(`新 build  (${newFile})\n  PROMPT_VER = ${newVer}`);

if (oldVer !== newVer && !oldVer.startsWith('(') && !newVer.startsWith('(')) {
  console.log('\n✅ 版本戳已变化，可作为前后对照的边界标识。');
} else if (oldVer === newVer) {
  console.log('\n⚠️ 两 build 版本戳相同：提示词未变化（或该 build 未注入 PROMPT_VER）。');
}

console.log('\n说明：ai-eval 对比的是启发式 useEv 策略（无头模拟不触发 LLM），故胜率与提示词无关。');
console.log('      要量化提示词改动对 LLM 接管的影响，请在配置好 LLM API 的 build 上，');
console.log('      以 LLM 接管模式跑少量对局；每次报告/JSON 都带 PROMPT_VER，可据此溯源对照。');
