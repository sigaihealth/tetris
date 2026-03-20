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
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  generateAlias(): string {
    const adj = ['Swift','Brave','Cool','Fast','Keen','Bold','Sly','Wild'];
    const noun = ['Fox','Cat','Owl','Bear','Wolf','Hawk','Lion','Lynx'];
    return adj[Math.floor(Math.random() * adj.length)] + noun[Math.floor(Math.random() * noun.length)] + Math.floor(Math.random() * 100);
  }

  async createRoom(alias: string): Promise<string> {
    this.roomCode = this.generateRoomCode();
    this._isHost = true;

    return new Promise((resolve, reject) => {
      const peerId = `tetris-${this.roomCode}`;
      this.peer = new Peer(peerId);

      this.peer.on('open', () => {
        resolve(this.roomCode);
      });

      this.peer.on('connection', (conn) => {
        this.conn = conn;
        this.setupConnection(alias);
      });

      this.peer.on('error', (err) => {
        reject(err);
      });
    });
  }

  async joinRoom(code: string, alias: string): Promise<void> {
    this.roomCode = code.toUpperCase();
    this._isHost = false;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.peer?.destroy();
        reject(new Error('Room not found or connection timed out'));
      }, 10000);

      this.peer = new Peer();

      this.peer.on('open', () => {
        const peerId = `tetris-${this.roomCode}`;
        this.conn = this.peer!.connect(peerId, { reliable: true });

        this.conn.on('open', () => {
          clearTimeout(timeout);
          this.setupConnection(alias);
          resolve();
        });

        this.conn.on('error', (err: any) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
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
