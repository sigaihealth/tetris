export type PeerMessage =
  | { type: 'board'; board: (string | null)[][]; score: number; lines: number; level: number }
  | { type: 'garbage'; count: number }
  | { type: 'game_over'; score: number }
  | { type: 'start' }
  | { type: 'alias'; name: string }
  | { type: 'ready' }
  | { type: 'rematch' };

// Public rooms that always exist on the server
export const PUBLIC_ROOMS = ['1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999'];

// Server URL — update after deploying server/index.js
// For now, fall back to running the relay locally
const SERVER_URL = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'ws://localhost:8080'
  : (typeof window !== 'undefined' && (window as any).__TETRIS_RELAY_URL__) || 'wss://tetris-relay.onrender.com';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private roomCode = '';
  private _isHost = false;
  private _isConnected = false;
  private _opponentAlias = 'Opponent';

  onMessage: ((msg: PeerMessage) => void) | null = null;
  onConnected: (() => void) | null = null;
  onDisconnected: (() => void) | null = null;

  get isHost() { return this._isHost; }
  get isConnected() { return this._isConnected; }
  get opponentAlias() { return this._opponentAlias; }

  generateRoomCode(): string {
    return String(1000 + Math.floor(Math.random() * 9000));
  }

  generateAlias(): string {
    const adj = ['Swift','Brave','Cool','Fast','Keen','Bold','Sly','Wild'];
    const noun = ['Fox','Cat','Owl','Bear','Wolf','Hawk','Lion','Lynx'];
    return adj[Math.floor(Math.random() * adj.length)] + noun[Math.floor(Math.random() * noun.length)] + Math.floor(Math.random() * 100);
  }

  private connectWs(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(SERVER_URL);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Could not connect to game server'));
      }, 8000);

      ws.onopen = () => {
        clearTimeout(timeout);
        resolve(ws);
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Could not connect to game server. It may be offline.'));
      };
    });
  }

  async createRoom(alias: string): Promise<string> {
    this.roomCode = this.generateRoomCode();
    this._isHost = true;

    this.ws = await this.connectWs();
    this.ws.send(JSON.stringify({ type: 'create', room: this.roomCode }));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server did not confirm room creation'));
      }, 5000);

      this.ws!.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === 'created') {
          clearTimeout(timeout);
          this.setupWsListeners(alias);
          resolve(msg.room);
        } else if (msg.type === 'error') {
          clearTimeout(timeout);
          reject(new Error(msg.message));
        }
      };
    });
  }

  async joinRoom(code: string, alias: string): Promise<void> {
    this.roomCode = code.trim();
    this._isHost = false;

    this.ws = await this.connectWs();
    this.ws.send(JSON.stringify({ type: 'join', room: this.roomCode }));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Could not join room. Make sure the room exists.'));
      }, 8000);

      this.ws!.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === 'joined') {
          clearTimeout(timeout);
          this._isHost = msg.role === 'host';
          if (msg.waiting) {
            // We're the first player — wait for opponent
            // Keep the onmessage handler for opponent_joined
          }
          this.setupWsListeners(alias);
          resolve();
        } else if (msg.type === 'error') {
          clearTimeout(timeout);
          reject(new Error(msg.message));
        }
      };
    });
  }

  private setupWsListeners(myAlias: string): void {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'opponent_joined') {
        this._isConnected = true;
        this.send({ type: 'alias', name: myAlias });
        this.onConnected?.();
      }

      if (msg.type === 'relay') {
        const data = msg.data as PeerMessage;
        if (data.type === 'alias') {
          this._opponentAlias = data.name;
          // If we just joined and they're already here, we're connected
          if (!this._isConnected) {
            this._isConnected = true;
            this.send({ type: 'alias', name: myAlias });
            this.onConnected?.();
          }
        }
        this.onMessage?.(data);
      }

      if (msg.type === 'opponent_disconnected') {
        this._isConnected = false;
        this.onDisconnected?.();
      }
    };

    this.ws.onclose = () => {
      if (this._isConnected) {
        this._isConnected = false;
        this.onDisconnected?.();
      }
    };
  }

  send(msg: PeerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'relay', data: msg }));
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this._isConnected = false;
    this._isHost = false;
  }
}
