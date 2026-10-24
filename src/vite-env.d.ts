/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 自建 PeerJS 信令服务器（可选）：冒烟脚本/自托管时指向本地，默认用公共云 */
  readonly VITE_PEER_HOST?: string
  readonly VITE_PEER_PORT?: string
  readonly VITE_PEER_PATH?: string
  readonly VITE_PEER_SECURE?: string
}
