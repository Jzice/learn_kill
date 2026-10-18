/* ==================== 联机房主分享 ==================== */

/** 当前房间的邀请链接（?room= 形式），由房主创建房间时写入 */
let currentLink = '';

/** 房主创建房间后设置邀请链接，并显示房主面板里的 分享/复制 按钮区 */
export function setInviteLink(link: string): void {
  currentLink = link;
  const box = document.getElementById('inviteBox');
  if (box) box.style.display = 'block';
}

export function getInviteLink(): string {
  return currentLink;
}

/** 将某按钮临时显示为「✅ 已复制」，1.5s 后还原 */
function flashCopied(id: string): void {
  const btn = document.getElementById(id);
  if (!btn) return;
  const old = btn.textContent;
  btn.textContent = '✅ 已复制';
  setTimeout(() => {
    btn.textContent = old;
  }, 1500);
}

/** 复制当前邀请链接到剪贴板（房主面板「复制」按钮） */
export function copyInviteLink(): void {
  const text = currentLink;
  if (!text) return;
  const ok = () => {
    flashCopied('copyInviteBtn');
  };
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      ok();
    } catch {
      /* ignore */
    }
    document.body.removeChild(ta);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(ok, fallback);
  } else {
    fallback();
  }
}

/**
 * 系统原生分享：移动端可拉起微信 / QQ 等系统分享面板。
 * 浏览器不支持 navigator.share（如桌面 Chrome / Edge）时自动降级为复制邀请链接，
 * 保证「分享」按钮在任何环境下都有可用行为。
 */
export function nativeShare(): void {
  const text = currentLink;
  if (!text) return;
  const payload = { title: '学堂杀 · 九科争鸣', text: '一起来玩学堂杀！', url: text };
  if (typeof navigator.share === 'function') {
    navigator.share(payload).catch(() => {
      /* 用户取消分享，忽略 */
    });
  } else {
    copyInviteLink();
  }
}