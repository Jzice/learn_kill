/* ==================== 大模型接管：设置界面 ==================== */
import type { LlmProvider } from '../llm/types';
import {
  PROVIDER_DEFAULTS,
  PROVIDER_LABELS,
  getLlmConfig,
  setLlmConfig,
} from '../llm/config';
import { testLlmConnection } from '../llm/client';
import { applyLlmModes } from '../game/setup';
import { SELECTED_COUNT } from './lobby';
import { G } from '../game/state';
import { NET, syncStateToClients } from '../net/network';

const PROVIDERS: LlmProvider[] = ['openai', 'deepseek', 'qwen', 'zhipu', 'ollama', 'custom'];

function cfg() {
  return getLlmConfig();
}

/** 顶栏 / 大厅入口：打开设置弹窗 */
export function openLlmSettings(): void {
  renderLlmSettings();
  document.getElementById('llmSettingsModal')?.classList.add('show');
}

export function closeLlmSettings(): void {
  document.getElementById('llmSettingsModal')?.classList.remove('show');
}

/** 设置弹窗内容渲染 */
export function renderLlmSettings(): void {
  const c = cfg();
  const providerBtns = PROVIDERS.map(
    (p) =>
      `<button class="opt-btn ${c.provider === p ? 'active' : ''}" onclick="llmSetProvider('${p}')">${PROVIDER_LABELS[p]}</button>`,
  ).join('');

  // 接管座位：单机/房主模式下座位 0 通常为真人，其余为 AI 座位
  const seatChecks = [];
  for (let i = 1; i < SELECTED_COUNT; i++) {
    const on = c.takeoverAll || c.takeoverSeats.includes(i);
    seatChecks.push(
      `<label class="llm-seat ${on ? 'on' : ''}"><input type="checkbox" ${on ? 'checked' : ''} onchange="llmToggleSeat(${i})"> 座位${i}（AI）</label>`,
    );
  }

  const box = document.getElementById('llmSettingsBody');
  if (!box) return;
  // 联机客人：只读展示房主设置，禁止修改
  if (NET.mode === 'host' && !NET.isHost) {
    const on = !!G.llmEnabled;
    box.innerHTML = `
      <div class="llm-sec">
        <div class="llm-sec-title">大模型接管 AI（只读）</div>
        <div class="llm-tip">该设置由房主控制，你无需操作；房主开关即时对所有玩家生效。</div>
        <div class="llm-status ${on ? 'on' : ''}" style="margin:8px 0 12px">🤖 ${on ? `已开启（${G.llmTakeoverAll ? '接管全部 AI' : '指定座位'}）` : '未开启'}</div>
        <button class="btn btn-sm" onclick="closeLlmSettings()">关闭</button>
      </div>`;
    return;
  }
  box.innerHTML = `
    <div class="llm-sec">
      <div class="llm-sec-title">① 接入配置</div>
      <div class="opt-row" style="margin-bottom:8px">${providerBtns}</div>
      <div class="llm-field"><span>Base URL</span><input id="llmBase" value="${escapeAttr(c.baseURL)}" oninput="llmSetField('baseURL',this.value)" placeholder="https://.../v1"></div>
      <div class="llm-field"><span>API Key</span><input id="llmKey" type="password" value="${escapeAttr(c.apiKey)}" oninput="llmSetField('apiKey',this.value)" placeholder="仅存本机 localStorage"></div>
      <div class="llm-field"><span>模型名</span><input id="llmModel" value="${escapeAttr(c.model)}" oninput="llmSetField('model',this.value)" placeholder="如 deepseek-chat"></div>
      <div class="llm-field"><span>温度</span><input id="llmTemp" type="range" min="0" max="1.5" step="0.1" value="${c.temperature}" oninput="llmSetField('temperature',this.value);document.getElementById('llmTempV').textContent=this.value"><b id="llmTempV">${c.temperature}</b></div>
      <div class="llm-field"><span>超时(秒)</span><input id="llmTimeout" type="number" min="3" max="120" value="${Math.round(c.timeoutMs / 1000)}" oninput="llmSetField('timeoutMs', String(Number(this.value)*1000))"></div>
      <button class="btn btn-sm" id="llmTestBtn" onclick="llmTestConn()">🔌 测试连接</button>
      <span id="llmTestMsg" class="llm-test-msg"></span>
    </div>

    <div class="llm-sec">
      <div class="llm-sec-title">② 接管范围</div>
      <label class="llm-switch"><input type="checkbox" ${c.enabled ? 'checked' : ''} onchange="llmSetEnabled(this.checked)"> 用大模型接管 AI（开关）</label>
      <label class="llm-switch"><input type="checkbox" ${c.takeoverAll ? 'checked' : ''} onchange="llmSetTakeoverAll(this.checked)"> 接管全部 AI 座位</label>
      <div class="llm-seats">${seatChecks.join('')}</div>
      <label class="llm-switch"><input type="checkbox" ${c.debug ? 'checked' : ''} onchange="llmSetDebug(this.checked)"> 🐞 显示大模型决策 Debug 日志（战报内打印选择与原始输出）</label>
      <div class="llm-tip">密钥仅存本机。浏览器直连若遇 CORS，可将 Base URL 指向本地代理端口（如 http://localhost:8787/v1），复用同一套逻辑。</div>
    </div>
  `;
}

/** 大厅「对局设置」内的紧凑面板（显示状态 + 入口） */
export function renderLlmSetupPanel(): void {
  const el = document.getElementById('llmSetupPanel');
  if (!el) return;
  // 联机客人：只读展示「由房主控制」
  if (NET.mode === 'host' && !NET.isHost) {
    el.innerHTML = `
      <h3>◈ 大模型接管 AI ◈</h3>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span class="llm-status">🤖 由房主控制（只读）</span>
      </div>`;
    return;
  }
  const c = cfg();
  const status = c.enabled ? `已开启（${c.takeoverAll ? '接管全部 AI' : '指定座位'}）` : '未开启';
  el.innerHTML = `
    <h3>◈ 大模型接管 AI ◈ <span style="font-size:10px;color:var(--muted);font-weight:400;letter-spacing:0;">（可选：用大模型与你对战）</span></h3>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span class="llm-status ${c.enabled ? 'on' : ''}">🤖 ${status}</span>
      <button class="btn btn-sm" onclick="openLlmSettings()">⚙ 配置大模型</button>
    </div>`;
}

/* ---------------- 内联事件处理（挂 window，main.ts 挂载） ---------------- */
function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function llmSetProvider(p: LlmProvider): void {
  const c = cfg();
  const d = PROVIDER_DEFAULTS[p];
  c.provider = p;
  if (p !== 'custom') {
    if (d.baseURL) c.baseURL = d.baseURL;
    if (d.model) c.model = d.model;
  }
  setLlmConfig(c);
  renderLlmSettings();
  renderLlmSetupPanel();
}

export function llmSetEnabled(on: boolean): void {
  if (NET.mode === 'host' && !NET.isHost) return;
  const c = cfg();
  c.enabled = on;
  setLlmConfig(c);
  applyLlmModes(); // 对局进行中实时生效：开→指定座位转 llm，关→全部回退启发式
  if (NET.isHost) syncStateToClients(); // 立即同步给客人端
  renderLlmSetupPanel();
}

export function llmSetTakeoverAll(on: boolean): void {
  if (NET.mode === 'host' && !NET.isHost) return;
  const c = cfg();
  c.takeoverAll = on;
  setLlmConfig(c);
  applyLlmModes();
  if (NET.isHost) syncStateToClients();
  renderLlmSettings();
}

export function llmSetDebug(on: boolean): void {
  const c = cfg();
  c.debug = on;
  setLlmConfig(c);
  renderLlmSettings();
}

export function llmToggleSeat(i: number): void {
  if (NET.mode === 'host' && !NET.isHost) return;
  const c = cfg();
  const has = c.takeoverSeats.includes(i);
  if (has) c.takeoverSeats = c.takeoverSeats.filter((x) => x !== i);
  else c.takeoverSeats.push(i);
  setLlmConfig(c);
  applyLlmModes();
  if (NET.isHost) syncStateToClients();
  renderLlmSettings();
}

export function llmSetField(field: 'baseURL' | 'apiKey' | 'model' | 'temperature' | 'timeoutMs', value: string): void {
  const c = cfg();
  if (field === 'temperature') c.temperature = Math.max(0, Math.min(1.5, Number(value) || 0));
  else if (field === 'timeoutMs') c.timeoutMs = Math.max(3000, Math.min(120000, Number(value) || 20000));
  else (c as unknown as Record<string, string>)[field] = value;
  setLlmConfig(c);
  // 不重渲染，避免打断输入
}

export async function llmTestConn(): Promise<void> {
  const btn = document.getElementById('llmTestBtn');
  const msg = document.getElementById('llmTestMsg');
  if (btn) (btn as HTMLButtonElement).disabled = true;
  if (msg) msg.textContent = '连接中…';
  const r = await testLlmConnection();
  if (msg) {
    msg.textContent = r.msg;
    msg.style.color = r.ok ? '#5fd07a' : '#ff6b4a';
  }
  if (btn) (btn as HTMLButtonElement).disabled = false;
}
