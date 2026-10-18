/* ==================== 小屏战报区高度拖动调整 ====================
 * 仅 ≤600px（战报独立成块、置于出牌区下方）时可用：
 * 战报面板底部拖动条调整高度，下方的操作提示区/手牌区在文档流中自然跟随下移。
 * 高度记忆到 localStorage（playLogH），宽屏还原侧栏布局时清除内联高度。
 */
const DEFAULT_H = 110;
let userHeight = Number(localStorage.getItem('playLogH')) || 0; // 用户拖拽设定的高度（0=默认110）
const mq = window.matchMedia('(max-width:600px)');

/** 按当前屏宽应用/清除战报面板内联高度 */
function applyHeight(): void {
  const panel = document.getElementById('playLogPanel');
  if (!panel) return;
  if (mq.matches) panel.style.height = (userHeight || DEFAULT_H) + 'px';
  else panel.style.height = ''; // 宽屏高度由侧栏布局控制
}

/** 底部拖动条：向下拖增高、向上拖收窄，并记忆到 localStorage */
function initLogResize(): void {
  const panel = document.getElementById('playLogPanel');
  if (!panel) return;
  const handle = document.createElement('div');
  handle.className = 'log-resize';
  panel.appendChild(handle);
  let startY = 0;
  let startH = 0;
  const onMove = (e: PointerEvent) => {
    e.preventDefault();
    let h = startH + (e.clientY - startY); // 向下拖动 → 增高
    h = Math.max(60, Math.min(window.innerHeight * 0.5, h));
    userHeight = Math.round(h);
    panel.style.height = userHeight + 'px';
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    try { localStorage.setItem('playLogH', String(userHeight)); } catch (_) {}
  };
  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    if (panel.classList.contains('collapsed')) return;
    e.preventDefault();
    startY = e.clientY;
    startH = panel.getBoundingClientRect().height;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
  const apply = () => applyHeight();
  apply();
  try {
    mq.addEventListener('change', apply);
  } catch (e) {
    (mq as unknown as { addListener: (f: () => void) => void }).addListener(apply);
  }
}

/** 初始化绑定（init 时调用一次） */
export function bindLogResize(): void {
  initLogResize();
}
