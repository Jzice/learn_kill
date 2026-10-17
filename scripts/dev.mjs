// 开发服务器：node scripts/dev.mjs [cdn|bundled]
import { createServer } from 'vite';

const mode = process.argv[2] === 'bundled' ? 'bundled' : 'cdn';
process.env.VITE_PEERJS_MODE = mode;

const server = await createServer({ server: { open: false } });
await server.listen();
server.printUrls();
