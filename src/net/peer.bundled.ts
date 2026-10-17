/* PeerJS 供给：bundled 模式（npm 包打进产物，联机可离线运行） */
import Peer from 'peerjs';

export function getPeerCtor(): typeof PeerJS {
  return Peer as unknown as typeof PeerJS;
}
