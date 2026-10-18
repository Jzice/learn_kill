/* ==================== 联机房主分享 ==================== */
import QRCode from 'qrcode';

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

/** 复制当前邀请链接到剪贴板（房主面板与分享对话框内的复制按钮共用） */
export function copyInviteLink(): void {
  const text = currentLink;
  if (!text) return;
  const ok = () => {
    flashCopied('copyInviteBtn');
    flashCopied('shareCopyBtn');
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

/** 打开分享对话框：生成二维码 + 展示链接 + 提供系统分享/复制 */
export function openShareDialog(): void {
  if (!currentLink) return;
  const dlg = document.getElementById('shareDialog');
  if (!dlg) return;
  const linkEl = document.getElementById('shareLinkText');
  if (linkEl) linkEl.textContent = currentLink;
  const qrBox = document.getElementById('shareQr');
  if (qrBox) {
    qrBox.innerHTML = '';
    QRCode.toString(currentLink, {
      type: 'svg',
      margin: 1,
      width: 180,
      color: { dark: '#1a1030', light: '#ffffff' },
    })
      .then((svg: string) => {
        qrBox.innerHTML = svg;
      })
      .catch(() => {
        qrBox.textContent = '二维码生成失败';
      });
  }
  dlg.classList.add('show');
}

export function closeShareDialog(): void {
  document.getElementById('shareDialog')?.classList.remove('show');
}

/** 系统原生分享（移动端可拉起微信/QQ 等）；不支持时降级为复制并关闭对话框 */
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
    closeShareDialog();
  }
}
