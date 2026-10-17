/* PeerJS 供给：CDN 模式（与原版一致，index.html 注入 script 标签） */
export function getPeerCtor(): typeof PeerJS {
  const g = window.Peer;
  if (!g) throw new Error('PeerJS CDN 脚本未加载（请检查网络，或使用 bundled 模式构建）');
  return g;
}
