// 构建脚本：node scripts/build.mjs [cdn|bundled]
// 通过环境变量 VITE_PEERJS_MODE 控制 PeerJS 供给模式（免装 cross-env，Windows 友好）
import { build } from 'vite';

const mode = process.argv[2] === 'bundled' ? 'bundled' : 'cdn';
process.env.VITE_PEERJS_MODE = mode;

await build();
console.log(`[build] peerjs mode = ${mode}`);
