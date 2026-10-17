// 开发服务器：node scripts/dev.mjs [cdn|bundled]
import { createServer } from 'vite';

const mode = process.argv[2] === 'bundled' ? 'bundled' : 'cdn';
process.env.VITE_PEERJS_MODE = mode;
const port = Number(process.argv[3]) || undefined;

const server = await createServer({ server: { open: false, port, strictPort: true } });
await server.listen();
server.printUrls();
