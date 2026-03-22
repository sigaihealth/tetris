// @ts-nocheck
import Peer from 'peerjs';

export type PeerMessage =
  | { type: 'board'; board: (string | null)[][]; score: number; lines: number; level: number }
  | { type: 'garbage'; count: number }
  | { type: 'game_over'; score: number }
  | { type: 'start' }
  | { type: 'alias'; name: string }
  | { type: 'ready' }
  | { type: 'rematch' };

export class PeerManager {
  private peer: Peer | null = null;
  private conn: any = null;
  private roomCode: string = '';
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
    // 4-digit numeric code (1000-9999) — easy to type on mobile
    return String(1000 + Math.floor(Math.random() * 9000));
  }

  generateAlias(): string {
    const adj = ['Swift','Brave','Cool','Fast','Keen','Bold','Sly','Wild'];
    const noun = ['Fox','Cat','Owl','Bear','Wolf','Hawk','Lion','Lynx'];
    return adj[Math.floor(Math.random() * adj.length)] + noun[Math.floor(Math.random() * noun.length)] + Math.floor(Math.random() * 100);
  }

  async createRoom(alias: string): Promise<string> {
    this._isHost = true;

    // Try up to 3 room codes in case of collision
    for (let attempt = 0; attempt < 3; attempt++) {
      this.roomCode = this.generateRoomCode();
      try {
        return await new Promise((resolve, reject) => {
          const peerId = `tetris-${this.roomCode}`;
          console.log('[PeerManager] Creating room with peer ID:', peerId);
          this.peer = new Peer(peerId);

          const timeout = setTimeout(() => {
            console.warn('[PeerManager] Create room timed out');
            this.peer?.destroy();
            reject(new Error('Connection to signaling server timed out. Check your internet connection.'));
          }, 8000);

          this.peer.on('open', (id) => {
            console.log('[PeerManager] Room created! Peer ID:', id);
            clearTimeout(timeout);
            resolve(this.roomCode);
          });

          this.peer.on('connection', (conn) => {
            console.log('[PeerManager] Incoming connection from opponent!');
            this.conn = conn;
            this.setupConnection(alias);
          });

          this.peer.on('error', (err) => {
            console.error('[PeerManager] Create room error:', err);
            clearTimeout(timeout);
            reject(err);
          });
        });
      } catch (err: any) {
        if (err?.type === 'unavailable-id' && attempt < 2) {
          continue; // try another code
        }
        throw err;
      }
    }
    throw new Error('Failed to create room after multiple attempts');
  }

  async joinRoom(code: string, alias: string): Promise<void> {
    this.roomCode = code.trim();
    this._isHost = false;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn('[PeerManager] Join timed out for room', this.roomCode);
        this.peer?.destroy();
        reject(new Error('Room not found or connection timed out. Make sure the host is still waiting.'));
      }, 12000);

      this.peer = new Peer();

      this.peer.on('open', (myId) => {
        console.log('[PeerManager] Connected to signaling server as', myId);
        const peerId = `tetris-${this.roomCode}`;
        console.log('[PeerManager] Connecting to peer', peerId);
        this.conn = this.peer!.connect(peerId, { reliable: true });

        this.conn.on('open', () => {
          console.log('[PeerManager] Connection established!');
          clearTimeout(timeout);
          this.setupConnection(alias);
          resolve();
        });

        this.conn.on('error', (err: any) => {
          console.error('[PeerManager] Connection error:', err);
          clearTimeout(timeout);
          reject(new Error('Connection failed: ' + (err?.message || err?.type || String(err))));
        });
      });

      this.peer.on('error', (err) => {
        console.error('[PeerManager] Peer error:', err);
        clearTimeout(timeout);
        reject(new Error('Peer error: ' + (err?.message || err?.type || String(err))));
      });

      this.peer.on('disconnected', () => {
        console.warn('[PeerManager] Disconnected from signaling server');
      });
    });
  }

  private setupConnection(myAlias: string): void {
    if (this.conn.open) {
      // Already open (joinRoom case)
      this._isConnected = true;
      this.send({ type: 'alias', name: myAlias });
      this.onConnected?.();
    } else {
      this.conn.on('open', () => {
        this._isConnected = true;
        this.send({ type: 'alias', name: myAlias });
        this.onConnected?.();
      });
    }

    this.conn.on('data', (data: PeerMessage) => {
      if (data.type === 'alias') {
        this._opponentAlias = data.name;
      }
      this.onMessage?.(data);
    });

    this.conn.on('close', () => {
      this._isConnected = false;
      this.onDisconnected?.();
    });
  }

  send(msg: PeerMessage): void {
    if (this.conn && this._isConnected) {
      this.conn.send(msg);
    }
  }

  disconnect(): void {
    this.conn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
    this._isConnected = false;
    this._isHost = false;
  }
}
