/* ==================== PeerJS 最小类型声明 ====================
 * 覆盖本工程用到的表面；同时声明：
 *  - 全局 window.Peer（CDN 模式使用）
 *  - 模块 'peerjs'（bundled 模式使用）
 */
declare class PeerJS {
  constructor(
    idOrOptions?: string | { debug?: number; [k: string]: unknown },
    options?: { debug?: number; [k: string]: unknown },
  );
  on(event: 'open', handler: (id: string) => void): void;
  on(event: 'error', handler: (err: { type?: string; message?: string }) => void): void;
  on(event: 'connection', handler: (conn: PeerJS.DataConnection) => void): void;
  connect(
    dest: string,
    options?: {
      metadata?: Record<string, unknown>;
      /** 有序可靠信道（默认 false 为无序，本游戏协议必须为 true） */
      reliable?: boolean;
      [k: string]: unknown;
    },
  ): PeerJS.DataConnection;
  destroy(): void;
}

declare namespace PeerJS {
  interface DataConnection {
    peer: string;
    readonly open: boolean;
    metadata?: Record<string, unknown>;
    on(event: 'open', handler: () => void): void;
    on(event: 'data', handler: (data: unknown) => void): void;
    on(event: 'error', handler: (err: unknown) => void): void;
    on(event: 'close', handler: () => void): void;
    send(data: unknown): void;
    close(): void;
  }
}

declare module 'peerjs' {
  export = PeerJS;
}

interface Window {
  Peer: typeof PeerJS;
}
