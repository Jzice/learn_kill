// 无头模拟公共基建：静态服务器 + headless chromium（供 balance / ai-eval / tune-ai 复用）
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export async function waitServer(port, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = http.request(
        { host: '127.0.0.1', port, path: '/', method: 'HEAD', timeout: 1000 },
        (res) => {
          res.resume();
          resolve(true);
        },
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export function findHeadlessShell() {
  const base = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs
    .readdirSync(base)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse();
  for (const d of dirs) {
    const exe = path.join(base, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

/**
 * 启动无头页面并打开指定 dist 文件。
 * @returns {{ browser, page, errors: string[], close: () => Promise<void> }}
 */
export async function launchSim(file = '学堂杀.html', port = 8903) {
  const server = spawn(process.execPath, [path.join(dirname, 'serve-dist.mjs'), String(port)], {
    cwd: path.resolve(dirname, '..'),
    stdio: 'ignore',
  });
  if (!(await waitServer(port))) {
    server.kill();
    throw new Error('❌ 静态服务器未能启动');
  }
  const executablePath = findHeadlessShell();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const url = `http://127.0.0.1:${port}/${encodeURIComponent(file)}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  return {
    browser,
    page,
    errors,
    async close() {
      await browser.close().catch(() => {});
      server.kill();
    },
  };
}

/**
 * 页面内安装可复位的 PRNG（mulberry32），让 A/B 两臂面对**完全相同**的牌序与随机决策，
 * 从而把对比变成「配对比较」，把胜率差的标准误压低一个量级。
 */
export async function installSeededRandom(page) {
  await page.evaluate(() => {
    let s = 0x9e3779b9;
    window.__xtsSeed = (v) => {
      s = (v >>> 0) || 1;
    };
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
}

/** 分块批量跑局（避免单次 evaluate 阻塞过久）。seed 传入后由页面「每局独立重置」，使跨进程可复现且两臂完美配对。 */
export async function runGames(page, { games, seats, policy, seed, chunk = 25 }) {
  const acc = {
    games: 0,
    stalls: 0,
    turns: 0,
    byRole: {
      lord: { games: 0, wins: 0 },
      loyal: { games: 0, wins: 0 },
      rebel: { games: 0, wins: 0 },
      spy: { games: 0, wins: 0 },
    },
  };
  let left = games;
  let done = 0;
  while (left > 0) {
    const n = Math.min(chunk, left);
    // 把「全局种子 + 已完成局序」作为 base 传进去，页面会在每局开头重置为 base+局序
    const base = seed === undefined || seed === null ? null : seed + done;
    const r = await page.evaluate(
      ({ n, seats, policy, seed: s }) => window.xtsAutoRun(n, seats, policy, s),
      { n, seats, policy: policy || null, seed: base },
    );
    acc.games += r.games;
    acc.stalls += r.stalls || 0;
    acc.turns += r.turns || 0;
    for (const k of Object.keys(acc.byRole)) {
      acc.byRole[k].games += r.byRole[k].games;
      acc.byRole[k].wins += r.byRole[k].wins;
    }
    left -= n;
    done += n;
  }
  acc.avgTurns = acc.games ? acc.turns / acc.games : 0;
  return acc;
}

/** 各身份胜率 */
export function winRates(acc) {
  const out = {};
  for (const [k, v] of Object.entries(acc.byRole)) out[k] = v.games ? v.wins / v.games : 0;
  return out;
}

/**
 * 综合目标函数 J：身份胜率贴近理想分布 − 局长惩罚 − 卡死重罚。
 * 理想分布（5 人局）：主忠 45% / 反贼 40% / 内奸 15%（三者之和为 1）。
 */
export const TARGET_WIN = { lord: 0.45, loyal: 0.45, rebel: 0.4, spy: 0.15 };

export function scoreOf(acc) {
  const wr = winRates(acc);
  let fit = 0;
  for (const k of Object.keys(TARGET_WIN)) fit += Math.abs((wr[k] || 0) - TARGET_WIN[k]);
  const stalls = acc.stalls || 0;
  return -fit - 0.002 * (acc.avgTurns || 0) - 5 * stalls;
}
