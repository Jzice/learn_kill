import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// PeerJS 供给模式：cdn = 保留 CDN script 标签（与原版一致）；bundled = npm 包打进产物
const peerjsMode: 'cdn' | 'bundled' =
  process.env.VITE_PEERJS_MODE === 'bundled' ? 'bundled' : 'cdn';
const outName = peerjsMode === 'bundled' ? '学堂杀.bundled.html' : '学堂杀.html';

/** 仅在 CDN 模式向 index.html 注入 PeerJS script 标签 */
function peerjsCdnTag(): Plugin {
  return {
    name: 'xuetangsha-peerjs-cdn',
    transformIndexHtml(html) {
      if (peerjsMode !== 'cdn') return html;
      const tag =
        '<script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>';
      return html.replace('</head>', `  ${tag}\n</head>`);
    },
  };
}

/** 构建结束后把 dist/index.html 重命名为模式对应的中文文件名 */
function renameOutput(): Plugin {
  return {
    name: 'xuetangsha-rename-output',
    closeBundle() {
      const from = path.resolve(dirname, 'dist/index.html');
      const to = path.resolve(dirname, 'dist', outName);
      if (fs.existsSync(from)) fs.renameSync(from, to);
    },
  };
}

export default defineConfig({
  root: path.resolve(dirname, 'src'),
  plugins: [peerjsCdnTag(), renameOutput(), viteSingleFile()],
  resolve: {
    alias: [
      {
        find: /^#peer$/,
        replacement:
          peerjsMode === 'bundled'
            ? path.resolve(dirname, 'src/net/peer.bundled.ts')
            : path.resolve(dirname, 'src/net/peer.cdn.ts'),
      },
    ],
  },
  build: {
    target: 'es2020',
    outDir: path.resolve(dirname, 'dist'),
    // 两种模式产物共存于 dist/，不清空
    emptyOutDir: false,
    chunkSizeWarningLimit: 8192,
  },
});
