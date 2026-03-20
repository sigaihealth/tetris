// @ts-nocheck
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PeerManager } from './PeerManager.js';
import type { PeerMessage } from './PeerManager.js';
import OpponentBoard from './OpponentBoard.js';

/* ==================== CONSTANTS ==================== */
const COLS = 10;
const ROWS = 20;
const getCellSize = () => Math.min(28, Math.floor((window.innerWidth - 20) / (COLS + 8)));
const getIsMobile = () => window.innerWidth < 700;
const DROP_SPEEDS = [800,720,630,550,470,380,300,220,140,100,80,60,50,40,30];
const PREVIEW_COUNT = 3;
const LOCK_DELAY = 500;
const DAS_DELAY = 170;
const DAS_RATE = 50;

const PIECES = {
  I:{shape:[[1,1,1,1]],color:"#00e5ff",key:"I"},
  O:{shape:[[1,1],[1,1]],color:"#ffea00",key:"O"},
  T:{shape:[[0,1,0],[1,1,1]],color:"#d500f9",key:"T"},
  S:{shape:[[0,1,1],[1,1,0]],color:"#00e676",key:"S"},
  Z:{shape:[[1,1,0],[0,1,1]],color:"#ff1744",key:"Z"},
  J:{shape:[[1,0,0],[1,1,1]],color:"#2979ff",key:"J"},
  L:{shape:[[0,0,1],[1,1,1]],color:"#ff9100",key:"L"},
};
const PIECE_KEYS = Object.keys(PIECES);
const BASE_SCORE = [0,100,300,500,800];
const LINE_NAMES = ["","SINGLE","DOUBLE","TRIPLE","TETRIS!"];
const LINE_COLORS = ["","#aaa","#00f0f0","#f0a000","#f00060"];

/* ==================== HELPERS ==================== */
const createBoard = () => Array.from({length:ROWS},()=>Array(COLS).fill(null));
const rotate = (m) => {
  const N = m.length, M = m[0].length;
  return Array.from({length:M},(_,i)=>Array.from({length:N},(_,j)=>m[N-1-j][i]));
};
const collides = (board, shape, oR, oC) => {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[0].length; c++)
      if (shape[r][c]) {
        const nr = r+oR, nc = c+oC;
        if (nr<0||nr>=ROWS||nc<0||nc>=COLS||board[nr][nc]) return true;
      }
  return false;
};
const mergeBoard = (board, shape, color, oR, oC) => {
  const b = board.map(r=>[...r]);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[0].length; c++)
      if (shape[r][c]) b[r+oR][c+oC] = color;
  return b;
};
const clearLines = (board) => {
  const kept = board.filter(row=>row.some(c=>!c));
  const cleared = ROWS - kept.length;
  return {board:[...Array.from({length:cleared},()=>Array(COLS).fill(null)),...kept], cleared};
};
const ghostRow = (board, shape, row, col) => {
  let gr = row;
  while (!collides(board, shape, gr+1, col)) gr++;
  return gr;
};

/* ==================== HOOKS ==================== */
function useQueue() {
  const bag = useRef([]);
  const queue = useRef([]);
  const pull = () => {
    if (bag.current.length === 0) bag.current = [...PIECE_KEYS].sort(()=>Math.random()-0.5);
    return bag.current.pop();
  };
  const init = useCallback(() => {
    bag.current = []; queue.current = [];
    for (let i = 0; i < PREVIEW_COUNT+1; i++) queue.current.push(pull());
  }, []);
  const dequeue = useCallback(() => {
    const k = queue.current.shift();
    queue.current.push(pull());
    return k;
  }, []);
  const peek = useCallback(() => [...queue.current.slice(0,PREVIEW_COUNT)], []);
  return {init, dequeue, peek};
}

function useViewport() {
  const [cell, setCell] = useState(getCellSize);
  const [isMobile, setIsMobile] = useState(getIsMobile);
  useEffect(() => {
    const onResize = () => { setCell(getCellSize()); setIsMobile(getIsMobile()); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return { CELL: cell, isMobile };
}

/* ==================== AUDIO ==================== */
function useAudio() {
  const ctxRef = useRef(null);
  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const playMove = useCallback(() => {
    const ctx = getCtx(); const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.2));
    n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    n.connect(f); f.connect(g); g.connect(ctx.destination);
    n.start(t); n.stop(t + 0.03);
  }, [getCtx]);

  const playRotate = useCallback(() => {
    const ctx = getCtx(); const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(1200, t + 0.06);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.08);
  }, [getCtx]);

  const playSoftDrop = useCallback(() => {
    const ctx = getCtx(); const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.08);
  }, [getCtx]);

  const playHardDrop = useCallback(() => {
    const ctx = getCtx(); const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(100, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.2);
  }, [getCtx]);

  const playClear = useCallback((count) => {
    const ctx = getCtx(); const t = ctx.currentTime;
    const notes = [523, 659, 784, 1047, 1319];
    const num = Math.min(count + 2, notes.length);
    for (let i = 0; i < num; i++) {
      const delay = i * 0.06;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = notes[i];
      const g = ctx.createGain(); g.gain.setValueAtTime(0.15, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.3);
      o.connect(g); g.connect(ctx.destination);
      o.start(t + delay); o.stop(t + delay + 0.3);
    }
  }, [getCtx]);

  const playCombo = useCallback((count) => {
    const ctx = getCtx(); const t = ctx.currentTime;
    const freq = 400 + count * 150;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.15);
  }, [getCtx]);

  const playLevelUp = useCallback(() => {
    const ctx = getCtx(); const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const d = i * 0.08;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.2, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.15);
      o.connect(g); g.connect(ctx.destination);
      o.start(t + d); o.stop(t + d + 0.15);
    });
  }, [getCtx]);

  const playHold = useCallback(() => {
    const ctx = getCtx(); const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(400, t);
    o.frequency.exponentialRampToValueAtTime(250, t + 0.1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.1);
  }, [getCtx]);

  const playGameOver = useCallback(() => {
    const ctx = getCtx(); const t = ctx.currentTime;
    [523, 440, 349, 262].forEach((freq, i) => {
      const d = i * 0.2;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.2, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.35);
      o.connect(g); g.connect(ctx.destination);
      o.start(t + d); o.stop(t + d + 0.35);
    });
  }, [getCtx]);

  const playGarbage = useCallback(() => {
    const ctx = getCtx(); const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(80, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200;
    o.connect(f); f.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.2);
  }, [getCtx]);

  const playWin = useCallback(() => {
    const ctx = getCtx(); const t = ctx.currentTime;
    [523, 659, 784, 1047, 1319, 1568].forEach((freq, i) => {
      const d = i * 0.1;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.2, t + d);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.3);
      o.connect(g); g.connect(ctx.destination);
      o.start(t + d); o.stop(t + d + 0.3);
    });
  }, [getCtx]);

  return { playMove, playRotate, playSoftDrop, playHardDrop, playClear, playCombo, playLevelUp, playHold, playGameOver, playGarbage, playWin };
}

/* ==================== MINI GRID ==================== */
function MiniGrid({shape, color, size=14, dimmed=false}) {
  if (!shape) return <div style={{width:size*4,height:size*2,minHeight:size*2}} />;
  return (
    <div style={{display:"grid",gridTemplateColumns:`repeat(${shape[0].length},${size}px)`,gap:1,opacity:dimmed?0.3:1,transition:"opacity 0.2s"}}>
      {shape.flat().map((v,i) => (
        <div key={i} style={{width:size,height:size,borderRadius:size*0.25,
          background:v?`linear-gradient(145deg, ${color}ee, ${color}88)`:"transparent",
          boxShadow:v?`inset 0 ${size*0.15}px ${size*0.3}px rgba(255,255,255,0.4), inset 0 -${size*0.1}px ${size*0.2}px rgba(0,0,0,0.3), 0 0 ${size*0.4}px ${color}66`:"none"}} />
      ))}
    </div>
  );
}

function SidePanel({title, children, highlight}) {
  return (
    <div style={{background:"#0a0a16",border:`1px solid ${highlight?"#00f0f044":"#1a1a2e"}`,borderRadius:6,padding:"8px 10px",transition:"border-color 0.3s"}}>
      <div style={{fontFamily:"'Orbitron'",fontSize:9,fontWeight:700,letterSpacing:3,color:"#333",marginBottom:5,textAlign:"center"}}>{title}</div>
      {children}
    </div>
  );
}

function ActionLabel({text, color, x, y, id}) {
  return (
    <div key={id} style={{
      position:"absolute",left:x,top:y,transform:"translateX(-50%)",
      fontFamily:"'Orbitron'",fontSize:13,fontWeight:900,color,letterSpacing:2,
      textShadow:`0 0 12px ${color}88, 0 0 24px ${color}44`,
      pointerEvents:"none",zIndex:20,whiteSpace:"nowrap",
      animation:"labelFloat 1.2s ease-out forwards",
    }}>{text}</div>
  );
}

/* ==================== MULTIPLAYER GAME ==================== */
interface MultiplayerGameProps {
  peerManager: PeerManager;
  onBack: () => void;
}

export default function MultiplayerGame({ peerManager, onBack }: MultiplayerGameProps) {
  const { CELL, isMobile } = useViewport();
  const audio = useAudio();

  /* ---- My game state ---- */
  const [board, setBoard] = useState(createBoard);
  const [current, setCurrent] = useState(null);
  const [pos, setPos] = useState({r:0,c:0});
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [flashRows, setFlashRows] = useState([]);
  const [started, setStarted] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [gameRound, setGameRound] = useState(0);
  const [holdKey, setHoldKey] = useState(null);
  const [holdUsed, setHoldUsed] = useState(false);
  const [previewKeys, setPreviewKeys] = useState([]);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [lastWasTetris, setLastWasTetris] = useState(false);
  const [actionLabels, setActionLabels] = useState([]);
  const [shake, setShake] = useState(false);

  /* ---- Opponent state ---- */
  const [opBoard, setOpBoard] = useState(createBoard);
  const [opScore, setOpScore] = useState(0);
  const [opLines, setOpLines] = useState(0);
  const [opLevel, setOpLevel] = useState(0);

  /* ---- Match result ---- */
  const [matchResult, setMatchResult] = useState(null); // 'win' | 'lose' | null
  const [disconnected, setDisconnected] = useState(false);
  const [rematchSent, setRematchSent] = useState(false);
  const [rematchReceived, setRematchReceived] = useState(false);

  /* ---- Garbage queue ---- */
  const garbageQueue = useRef(0);

  /* ---- Refs ---- */
  const labelId = useRef(0);
  const {init:initQueue, dequeue, peek} = useQueue();
  const prevLevel = useRef(0);
  const boardRef = useRef(board);
  const currentRef = useRef(current);
  const posRef = useRef(pos);
  const gameOverRef = useRef(gameOver);
  const pausedRef = useRef(paused);
  const levelRef = useRef(level);
  const scoreRef = useRef(score);
  const linesRef = useRef(lines);
  const holdUsedRef = useRef(false);
  const comboRef = useRef(0);
  const lastWasTetrisRef = useRef(false);
  const maxComboRef = useRef(0);
  const lockTimerRef = useRef(null);
  const lockMovesRef = useRef(0);
  const dasDir = useRef(null);
  const dasTimer = useRef(null);
  const dasRepeat = useRef(null);
  const matchResultRef = useRef(null);
  const sendBoardThrottleRef = useRef(0);

  // Sync refs
  boardRef.current = board;
  currentRef.current = current;
  posRef.current = pos;
  gameOverRef.current = gameOver;
  pausedRef.current = paused;
  levelRef.current = level;
  scoreRef.current = score;
  linesRef.current = lines;
  holdUsedRef.current = holdUsed;
  comboRef.current = combo;
  lastWasTetrisRef.current = lastWasTetris;
  maxComboRef.current = maxCombo;
  matchResultRef.current = matchResult;

  const rematchSentRef = useRef(false);
  const rematchReceivedRef = useRef(false);
  rematchSentRef.current = rematchSent;
  rematchReceivedRef.current = rematchReceived;

  /* ---- Reset all game state for rematch ---- */
  const resetGame = useCallback(() => {
    setBoard(createBoard());
    setCurrent(null);
    setPos({r:0, c:0});
    setScore(0);
    setLines(0);
    setLevel(0);
    setGameOver(false);
    setPaused(false);
    setFlashRows([]);
    setStarted(false);
    setCountdown(3);
    setHoldKey(null);
    setHoldUsed(false);
    setPreviewKeys([]);
    setCombo(0);
    setMaxCombo(0);
    setLastWasTetris(false);
    setActionLabels([]);
    setShake(false);
    setOpBoard(createBoard());
    setOpScore(0);
    setOpLines(0);
    setOpLevel(0);
    setMatchResult(null);
    setDisconnected(false);
    setRematchSent(false);
    setRematchReceived(false);
    garbageQueue.current = 0;
    prevLevel.current = 0;
    setGameRound(r => r + 1);
    comboRef.current = 0;
    lastWasTetrisRef.current = false;
    maxComboRef.current = 0;
    lockMovesRef.current = 0;
    matchResultRef.current = null;
    sendBoardThrottleRef.current = 0;
  }, []);

  const doLockRef = useRef(null);

  const clearLockTimer = useCallback(() => {
    if (lockTimerRef.current) { clearTimeout(lockTimerRef.current); lockTimerRef.current = null; }
  }, []);

  const startLockTimer = useCallback(() => {
    clearLockTimer();
    lockTimerRef.current = setTimeout(() => {
      lockTimerRef.current = null;
      if (doLockRef.current) doLockRef.current();
    }, LOCK_DELAY);
  }, [clearLockTimer]);

  const addLabel = useCallback((text, color, yOffset=0) => {
    const id = ++labelId.current;
    const boardW = COLS * (CELL+1);
    setActionLabels(prev => [...prev, {id, text, color, x: boardW/2, y: ROWS*(CELL+1)/2 - 30 + yOffset}]);
    setTimeout(() => setActionLabels(prev => prev.filter(l => l.id !== id)), 1200);
  }, [CELL]);

  /* ---- Send board state to opponent ---- */
  const sendBoardState = useCallback(() => {
    const now = Date.now();
    if (now - sendBoardThrottleRef.current < 100) return; // throttle to 10 updates/sec max
    sendBoardThrottleRef.current = now;
    // Build display board with current piece
    const display = boardRef.current.map(r => [...r]);
    const c = currentRef.current, p = posRef.current;
    if (c && !gameOverRef.current) {
      for (let r = 0; r < c.shape.length; r++)
        for (let col = 0; col < c.shape[0].length; col++)
          if (c.shape[r][col]) {
            const nr = p.r + r, nc = p.c + col;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
              display[nr][nc] = c.color;
            }
          }
    }
    peerManager.send({
      type: 'board',
      board: display,
      score: scoreRef.current,
      lines: linesRef.current,
      level: levelRef.current,
    });
  }, [peerManager]);

  /* ---- Apply garbage rows ---- */
  const applyGarbage = useCallback((count) => {
    if (count <= 0 || matchResultRef.current) return;
    audio.playGarbage();
    setShake(true);
    setTimeout(() => setShake(false), 300);
    addLabel(`+${count} GARBAGE`, '#f04040', -20);

    setBoard(prev => {
      const b = prev.map(r => [...r]);
      // Remove top rows to make space
      const newBoard = b.slice(count);
      // Add garbage at bottom
      const gc = ['#444455','#3a3a4a','#505060'];
      for (let i = 0; i < count; i++) {
        const row = Array(COLS).fill(null);
        const gap = Math.floor(Math.random() * COLS);
        for (let c = 0; c < COLS; c++) {
          if (c !== gap) row[c] = gc[Math.floor(Math.random() * gc.length)];
        }
        newBoard.push(row);
      }
      return newBoard;
    });
  }, [audio, addLabel]);

  /* ---- Peer message handler ---- */
  useEffect(() => {
    peerManager.onMessage = (msg: PeerMessage) => {
      if (msg.type === 'board') {
        setOpBoard(msg.board);
        setOpScore(msg.score);
        setOpLines(msg.lines);
        setOpLevel(msg.level);
      }
      if (msg.type === 'garbage') {
        garbageQueue.current += msg.count;
      }
      if (msg.type === 'game_over') {
        if (!matchResultRef.current) {
          setMatchResult('win');
          audio.playWin();
        }
      }
      if (msg.type === 'rematch') {
        if (rematchSentRef.current) {
          // Both players want rematch — restart
          resetGame();
        } else {
          setRematchReceived(true);
        }
      }
    };

    peerManager.onDisconnected = () => {
      setDisconnected(true);
      if (!matchResultRef.current) {
        setMatchResult('win');
      }
    };

    return () => {
      peerManager.onMessage = null;
      peerManager.onDisconnected = null;
    };
  }, [peerManager, audio, resetGame]);

  /* ---- Countdown ---- */
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => {
      if (countdown === 1) { setCountdown(0); setStarted(true); }
      else setCountdown(c => c-1);
    }, 700);
    return () => clearTimeout(id);
  }, [countdown, gameRound]);

  /* ---- Spawn first piece ---- */
  useEffect(() => {
    if (!started) return;
    initQueue();
    const first = dequeue();
    setPreviewKeys(peek());
    const p = PIECES[first];
    const sc = Math.floor((COLS - p.shape[0].length) / 2);
    setCurrent({shape:p.shape, color:p.color, key:first});
    setPos({r:0, c:sc});
  }, [started]);

  /* ---- Spawn next ---- */
  const spawnNext = useCallback(() => {
    clearLockTimer();
    lockMovesRef.current = 0;

    const key = dequeue();
    setPreviewKeys(peek());
    const p = PIECES[key];
    const sc = Math.floor((COLS - p.shape[0].length) / 2);
    if (collides(boardRef.current, p.shape, 0, sc)) {
      setGameOver(true);
      audio.playGameOver();
      if (!matchResultRef.current) {
        setMatchResult('lose');
        peerManager.send({ type: 'game_over', score: scoreRef.current });
      }
      return;
    }
    setCurrent({shape:p.shape, color:p.color, key});
    setPos({r:0, c:sc});
    setHoldUsed(false);

    // Apply pending garbage AFTER spawning so the player sees the new piece first
    if (garbageQueue.current > 0) {
      const gc = garbageQueue.current;
      garbageQueue.current = 0;
      // Brief delay so the piece appears before garbage pushes the board up
      setTimeout(() => applyGarbage(gc), 100);
    }
  }, [dequeue, peek, clearLockTimer, applyGarbage, audio, peerManager]);

  /* ---- Lock piece ---- */
  const doLock = useCallback(() => {
    const c = currentRef.current, p = posRef.current;
    if (!c) return;
    clearLockTimer();
    const b = mergeBoard(boardRef.current, c.shape, c.color, p.r, p.c);
    const {board:nb, cleared} = clearLines(b);

    if (cleared > 0) {
      const fullRows = [];
      for (let r = 0; r < ROWS; r++) if (b[r].every(cell => cell)) fullRows.push(r);
      setFlashRows(fullRows);

      const newCombo = comboRef.current + 1;
      setCombo(newCombo);
      setMaxCombo(mc => Math.max(mc, newCombo));

      let pts = BASE_SCORE[cleared] * (levelRef.current + 1);
      if (newCombo > 1) pts += 50 * (newCombo-1) * (levelRef.current+1);

      const isTetris = cleared === 4;
      if (isTetris && lastWasTetrisRef.current) {
        pts = Math.floor(pts * 1.5);
      }
      setLastWasTetris(isTetris);

      addLabel(LINE_NAMES[cleared], LINE_COLORS[cleared]);
      if (newCombo > 1) addLabel(`COMBO x${newCombo}`, "#f060a0", 24);

      audio.playClear(cleared);
      if (newCombo > 1) audio.playCombo(newCombo);

      // Send garbage to opponent: cleared - 1 (1=0, 2=1, 3=2, 4=3)
      const garbageToSend = cleared - 1;
      if (garbageToSend > 0) {
        peerManager.send({ type: 'garbage', count: garbageToSend });
        addLabel(`SENT ${garbageToSend}!`, "#f0a000", 48);
      }

      setTimeout(() => {
        setFlashRows([]);
        setBoard(nb);
        setScore(s => s + pts);
        setLines(l => {
          const nl = l + cleared;
          const newLvl = Math.min(Math.floor(nl/10), DROP_SPEEDS.length-1);
          setLevel(newLvl);
          if (newLvl > prevLevel.current) { audio.playLevelUp(); prevLevel.current = newLvl; }
          return nl;
        });
        sendBoardState();
        spawnNext();
      }, 220);
      setBoard(b);
    } else {
      setCombo(0);
      setLastWasTetris(false);
      setBoard(nb);
      audio.playSoftDrop();
      sendBoardState();
      spawnNext();
    }
  }, [spawnNext, addLabel, clearLockTimer, audio, peerManager, sendBoardState]);

  useEffect(() => { doLockRef.current = doLock; }, [doLock]);

  const isOnGround = useCallback(() => {
    const c = currentRef.current, p = posRef.current;
    if (!c) return false;
    return collides(boardRef.current, c.shape, p.r+1, p.c);
  }, []);

  const touchLock = useCallback(() => {
    if (isOnGround() && lockMovesRef.current < 15) {
      lockMovesRef.current++;
      startLockTimer();
    }
  }, [isOnGround, startLockTimer]);

  const drop = useCallback(() => {
    if (gameOverRef.current || pausedRef.current || !currentRef.current || matchResultRef.current) return;
    const p = posRef.current, c = currentRef.current;
    if (!collides(boardRef.current, c.shape, p.r+1, p.c)) {
      setPos(prev => ({...prev, r: prev.r+1}));
      if (collides(boardRef.current, c.shape, p.r+2, p.c)) startLockTimer();
    } else {
      if (!lockTimerRef.current) startLockTimer();
    }
  }, [startLockTimer]);

  /* ---- Gravity ---- */
  useEffect(() => {
    if (!started || gameOver || paused || matchResult) return;
    const id = setInterval(drop, DROP_SPEEDS[Math.min(level, DROP_SPEEDS.length-1)]);
    return () => clearInterval(id);
  }, [started, gameOver, paused, level, drop, matchResult]);

  const hardDrop = useCallback(() => {
    if (!currentRef.current || pausedRef.current || matchResultRef.current) return;
    clearLockTimer();
    const c = currentRef.current, p = posRef.current;
    let nr = p.r;
    while (!collides(boardRef.current, c.shape, nr+1, p.c)) nr++;
    setScore(s => s + (nr - p.r) * 2);
    setPos({r:nr, c:p.c});
    audio.playHardDrop();
    setTimeout(() => doLock(), 0);
  }, [doLock, clearLockTimer, audio]);

  const move = useCallback((dc) => {
    if (!currentRef.current || pausedRef.current || matchResultRef.current) return;
    if (!collides(boardRef.current, currentRef.current.shape, posRef.current.r, posRef.current.c + dc)) {
      setPos(prev => ({...prev, c: prev.c + dc}));
      touchLock();
      audio.playMove();
    }
  }, [touchLock, audio]);
  const moveRef = useRef(move); moveRef.current = move;

  const rotatePiece = useCallback(() => {
    if (!currentRef.current || pausedRef.current || matchResultRef.current) return;
    const c = currentRef.current, p = posRef.current;
    const rotated = rotate(c.shape);
    for (const kick of [0,-1,1,-2,2]) {
      if (!collides(boardRef.current, rotated, p.r, p.c+kick)) {
        setCurrent({...c, shape:rotated});
        setPos(prev => ({...prev, c: prev.c+kick}));
        touchLock();
        audio.playRotate();
        return;
      }
    }
  }, [touchLock, audio]);

  const holdPiece = useCallback(() => {
    if (!currentRef.current || pausedRef.current || holdUsedRef.current || matchResultRef.current) return;
    clearLockTimer();
    const curKey = currentRef.current.key;
    if (holdKey) {
      const p = PIECES[holdKey];
      const sc = Math.floor((COLS - p.shape[0].length) / 2);
      if (collides(boardRef.current, p.shape, 0, sc)) return;
      setHoldKey(curKey);
      setCurrent({shape:p.shape, color:p.color, key:holdKey});
      setPos({r:0, c:sc});
    } else {
      setHoldKey(curKey);
      spawnNext();
    }
    setHoldUsed(true);
    audio.playHold();
  }, [holdKey, spawnNext, clearLockTimer, audio]);

  /* ---- DAS ---- */
  const stopDas = useCallback(() => {
    if (dasTimer.current) { clearTimeout(dasTimer.current); dasTimer.current = null; }
    if (dasRepeat.current) { clearInterval(dasRepeat.current); dasRepeat.current = null; }
    dasDir.current = null;
  }, []);

  const startDas = useCallback((dir) => {
    stopDas();
    dasDir.current = dir;
    moveRef.current(dir);
    dasTimer.current = setTimeout(() => {
      dasRepeat.current = setInterval(() => moveRef.current(dir), DAS_RATE);
    }, DAS_DELAY);
  }, [stopDas]);

  // Stable refs for keyboard — prevents effect re-registration from killing DAS
  const dropRef = useRef(drop); dropRef.current = drop;
  const rotateRef = useRef(rotatePiece); rotateRef.current = rotatePiece;
  const hardDropRef = useRef(hardDrop); hardDropRef.current = hardDrop;
  const holdRef = useRef(holdPiece); holdRef.current = holdPiece;
  const startDasRef = useRef(startDas); startDasRef.current = startDas;
  const stopDasRef = useRef(stopDas); stopDasRef.current = stopDas;

  // Ref for started state used in keyboard handler
  const startedKbRef = useRef(started); startedKbRef.current = started;

  /* ---- Keyboard — registered ONCE, never re-registers, so DAS is never killed ---- */
  useEffect(() => {
    const down = (e) => {
      if (!startedKbRef.current || gameOverRef.current || matchResultRef.current) return;
      if (e.key === "p" || e.key === "Escape") { setPaused(v => !v); return; }
      if (pausedRef.current) return;
      if (e.repeat) return;
      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); startDasRef.current(-1); break;
        case "ArrowRight": e.preventDefault(); startDasRef.current(1); break;
        case "ArrowDown": e.preventDefault(); dropRef.current(); break;
        case "ArrowUp": e.preventDefault(); rotateRef.current(); break;
        case " ": e.preventDefault(); hardDropRef.current(); break;
        case "c": case "C": case "Shift": e.preventDefault(); holdRef.current(); break;
      }
    };
    const up = (e) => {
      if (e.key === "ArrowLeft" && dasDir.current === -1) stopDasRef.current();
      if (e.key === "ArrowRight" && dasDir.current === 1) stopDasRef.current();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); stopDasRef.current(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Soft drop hold ---- */
  useEffect(() => {
    if (!started || gameOver || paused || matchResult) return;
    let pressing = false, iv = null;
    const down = (e) => { if (e.key === "ArrowDown" && !pressing) { pressing = true; iv = setInterval(() => drop(), DAS_RATE); } };
    const up = (e) => { if (e.key === "ArrowDown") { pressing = false; if (iv) { clearInterval(iv); iv = null; } } };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); if (iv) clearInterval(iv); };
  }, [started, gameOver, paused, matchResult, drop]);

  /* ---- Touch ---- */
  const touchStart = useRef(null);
  const onTouchStart = (e) => { touchStart.current = {x:e.touches[0].clientX, y:e.touches[0].clientY, t:Date.now()}; };
  const onTouchEnd = (e) => {
    if (!touchStart.current || !started || gameOver || paused || matchResult) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.t;
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && dt < 250) { rotatePiece(); return; }
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
    else if (dy > 30) hardDrop();
    touchStart.current = null;
  };

  /* ---- Periodically send board state ---- */
  useEffect(() => {
    if (!started || matchResult) return;
    const iv = setInterval(() => {
      sendBoardState();
    }, 200);
    return () => clearInterval(iv);
  }, [started, matchResult, sendBoardState]);

  /* ==================== RENDER ==================== */
  const display = board.map(r => [...r]);
  if (current && !gameOver) {
    const gr = ghostRow(board, current.shape, pos.r, pos.c);
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[0].length; c++)
        if (current.shape[r][c]) {
          if (gr !== pos.r) display[gr+r][pos.c+c] = current.color + "33";
          display[pos.r+r][pos.c+c] = current.color;
        }
  }

  const holdPieceData = holdKey ? PIECES[holdKey] : null;
  const boardWidth = COLS * (CELL + 1);

  const boardEl = (
    <div style={{
      position:"relative",border:"2px solid #3a4060",borderRadius:8,
      background:"linear-gradient(180deg, #10121e, #0c0e18)",
      boxShadow:"0 0 40px rgba(0,200,255,0.06),inset 0 0 60px #00000055, 0 8px 32px rgba(0,0,0,0.5)",padding:2,
      animation: shake ? "boardShake 0.3s ease-out" : "none",
    }}>
      <div style={{display:"grid",gridTemplateColumns:`repeat(${COLS},${CELL}px)`,gridTemplateRows:`repeat(${ROWS},${CELL}px)`,gap:1,
        backgroundImage:`linear-gradient(rgba(80,100,160,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(80,100,160,0.15) 1px, transparent 1px)`,
        backgroundSize:`${CELL+1}px ${CELL+1}px`}}>
        {display.flat().map((cell, i) => {
          const r = Math.floor(i/COLS);
          const isFlash = flashRows.includes(r);
          const isGhost = cell && cell.length > 7;
          const baseColor = isGhost ? cell?.slice(0,7) : cell;
          return (
            <div key={i} style={{
              width:CELL, height:CELL, borderRadius: cell ? 6 : 3,
              background: isFlash ? "#fff"
                : cell && !isGhost
                  ? `linear-gradient(145deg, ${baseColor}ee, ${baseColor}99)`
                : isGhost
                  ? `linear-gradient(145deg, ${baseColor}20, ${baseColor}10)`
                : (r+(i%COLS))%2===0 ? "#12142200" : "#1618260a",
              boxShadow: cell && !isGhost
                ? `inset 0 4px 6px rgba(255,255,255,0.35), inset 0 -3px 5px rgba(0,0,0,0.3), 0 0 8px ${baseColor}55, 0 2px 4px rgba(0,0,0,0.4)`
                : isGhost ? `inset 0 2px 4px ${baseColor}15` : "none",
              transition: isFlash ? "none" : "background 0.06s",
              animation: isFlash ? "flashRow 0.2s ease-out" : "none",
              border: cell && !isGhost ? `1px solid ${baseColor}44` : "none",
            }} />
          );
        })}
      </div>

      {actionLabels.map(l => <ActionLabel key={l.id} {...l} />)}

      {countdown > 0 && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#000000cc",borderRadius:6,zIndex:10}}>
          <div key={countdown} style={{fontFamily:"'Orbitron'",fontSize:isMobile?48:72,fontWeight:900,color:"#00f0f0",
            textShadow:"0 0 40px #00f0f088",animation:"countPulse 0.7s ease-out"}}>{countdown}</div>
        </div>
      )}
      {paused && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#000000bb",borderRadius:6,zIndex:10}}>
          <div style={{fontFamily:"'Orbitron'",fontSize:22,fontWeight:700,color:"#f0f000",
            animation:"pulse 1.5s ease-in-out infinite",textShadow:"0 0 20px #f0f00066"}}>PAUSED</div>
        </div>
      )}
    </div>
  );

  const holdPanel = (
    <SidePanel title="HOLD" highlight={!holdUsed && !!holdKey}>
      <div style={{display:"flex",justifyContent:"center",padding:"6px 0",minHeight:36}}>
        {holdPieceData
          ? <MiniGrid shape={holdPieceData.shape} color={holdPieceData.color} size={13} dimmed={holdUsed} />
          : <div style={{fontFamily:"'Orbitron'",fontSize:8,color:"#222",letterSpacing:1}}>C / SHIFT</div>}
      </div>
    </SidePanel>
  );

  const statsPanel = (
    <>
      <SidePanel title="SCORE">
        <div style={{fontFamily:"'Orbitron'",fontSize:14,fontWeight:700,color:"#00f0f0",textAlign:"center",
          textShadow:"0 0 10px #00f0f033"}}>{score.toLocaleString()}</div>
      </SidePanel>
      <SidePanel title="LINES">
        <div style={{fontFamily:"'Orbitron'",fontSize:12,fontWeight:700,color:"#a0a0ff",textAlign:"center"}}>{lines}</div>
      </SidePanel>
      <SidePanel title="LEVEL">
        <div style={{fontFamily:"'Orbitron'",fontSize:12,fontWeight:700,color:"#f0a000",textAlign:"center",
          textShadow:"0 0 10px #f0a00033"}}>{level}</div>
      </SidePanel>
      {combo > 1 && (
        <SidePanel title="COMBO">
          <div style={{fontFamily:"'Orbitron'",fontSize:14,fontWeight:900,color:"#f060a0",textAlign:"center",
            textShadow:"0 0 12px #f060a044"}}>{combo}x</div>
        </SidePanel>
      )}
    </>
  );

  const nextPanel = (
    <SidePanel title="NEXT">
      <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center",padding:"4px 0"}}>
        {previewKeys.map((k, i) => {
          const p = PIECES[k];
          return <MiniGrid key={`${k}-${i}`} shape={p.shape} color={p.color} size={i===0?14:11} dimmed={i>0} />;
        })}
        {previewKeys.length === 0 && <div style={{height:80}} />}
      </div>
    </SidePanel>
  );

  /* ---- Match result overlay ---- */
  const resultOverlay = matchResult && (
    <div style={{
      position:'fixed', inset:0, zIndex:200,
      background:'rgba(0,0,0,0.85)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      animation:'fadeIn 0.5s ease-out',
    }}>
      <div style={{
        fontFamily:"'Orbitron'", fontSize: isMobile ? 36 : 52, fontWeight:900, letterSpacing:8,
        color: matchResult === 'win' ? '#00f040' : '#f04040',
        textShadow: `0 0 40px ${matchResult === 'win' ? '#00f040' : '#f04040'}88`,
        marginBottom: 16,
        animation: matchResult === 'win' ? 'glowPulseGreen 2s ease-in-out infinite' : 'glowPulseRed 2s ease-in-out infinite',
      }}>
        {matchResult === 'win' ? (disconnected ? 'OPPONENT LEFT' : 'YOU WIN!') : 'YOU LOSE'}
      </div>
      <div style={{
        fontFamily:"'Orbitron'", fontSize:11, color:'#555', letterSpacing:3, marginBottom:32,
      }}>
        vs {peerManager.opponentAlias}
      </div>

      <div style={{
        background:'#0a0a16', border:'1px solid #1a1a2e', borderRadius:12,
        padding:'24px 36px', marginBottom:28, minWidth:240,
      }}>
        <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',gap:30}}>
          <span style={{fontFamily:"'Orbitron'",fontSize:9,letterSpacing:2,color:'#444'}}>SCORE</span>
          <span style={{fontFamily:"'Orbitron'",fontSize:16,fontWeight:700,color:'#00f0f0'}}>{score.toLocaleString()}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',gap:30}}>
          <span style={{fontFamily:"'Orbitron'",fontSize:9,letterSpacing:2,color:'#444'}}>LINES</span>
          <span style={{fontFamily:"'Orbitron'",fontSize:16,fontWeight:700,color:'#a0a0ff'}}>{lines}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',gap:30}}>
          <span style={{fontFamily:"'Orbitron'",fontSize:9,letterSpacing:2,color:'#444'}}>LEVEL</span>
          <span style={{fontFamily:"'Orbitron'",fontSize:16,fontWeight:700,color:'#f0a000'}}>{level}</span>
        </div>
      </div>

      {disconnected && (
        <div style={{
          fontFamily:"'Orbitron'", fontSize:10, color:'#f04040', letterSpacing:2, marginBottom:16,
        }}>
          OPPONENT DISCONNECTED
        </div>
      )}

      <div style={{display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center'}}>
        {!disconnected && (
          <button onClick={() => {
            if (!rematchSent) {
              setRematchSent(true);
              peerManager.send({ type: 'rematch' });
              if (rematchReceived) {
                // Opponent already requested rematch, restart now
                resetGame();
              }
            }
          }} disabled={rematchSent} style={{
            fontFamily:"'Orbitron'", fontSize:14, fontWeight:700, letterSpacing:3,
            padding:'12px 36px', border:'2px solid #00f040', borderRadius:8,
            background: rematchSent ? '#00f04008' : '#00f04012',
            color: rematchSent ? '#00f04066' : '#00f040', cursor: rematchSent ? 'default' : 'pointer',
            transition:'all 0.2s',
          }}>
            {rematchSent
              ? (rematchReceived ? 'STARTING...' : 'WAITING...')
              : (rematchReceived ? 'ACCEPT REMATCH' : 'REMATCH')}
          </button>
        )}
        <button onClick={() => { peerManager.disconnect(); onBack(); }} style={{
          fontFamily:"'Orbitron'", fontSize:14, fontWeight:700, letterSpacing:3,
          padding:'12px 36px', border:'2px solid #667eea', borderRadius:8,
          background:'#667eea12', color:'#667eea', cursor:'pointer',
          transition:'all 0.2s',
        }}>
          BACK TO MENU
        </button>
      </div>

      {rematchReceived && !rematchSent && (
        <div style={{
          fontFamily:"'Orbitron'", fontSize:10, color:'#00f040', letterSpacing:2, marginTop:12,
          textShadow:'0 0 8px #00f04044',
        }}>
          OPPONENT WANTS A REMATCH!
        </div>
      )}
      {rematchSent && !rematchReceived && (
        <div style={{
          fontFamily:"'Orbitron'", fontSize:10, color:'#444', letterSpacing:2, marginTop:12,
        }}>
          WAITING FOR OPPONENT...
        </div>
      )}
    </div>
  );

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:isMobile?"flex-start":"center",
      background:"linear-gradient(160deg,#0a0a12,#0d0d1a 50%,#0a0a12)",fontFamily:"'JetBrains Mono','Fira Code',monospace",
      color:"#e0e0e0",userSelect:"none",overflow:"hidden",padding:isMobile?"6px 4px":"12px 8px",
      touchAction:"none",WebkitTouchCallout:"none"}}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes pulse{0%,100%{opacity:0.6}50%{opacity:1}}
        @keyframes flashRow{0%{background:#fff;opacity:1}100%{background:transparent;opacity:0}}
        @keyframes countPulse{0%{transform:scale(1.4);opacity:1}100%{transform:scale(0.9);opacity:0.5}}
        @keyframes labelFloat{0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}60%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-60px) scale(1.15)}}
        @keyframes boardShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glowPulseGreen{0%,100%{text-shadow:0 0 20px #00f040aa,0 0 40px #00f04066}50%{text-shadow:0 0 40px #00f040dd,0 0 80px #00f04088}}
        @keyframes glowPulseRed{0%,100%{text-shadow:0 0 20px #f04040aa,0 0 40px #f0404066}50%{text-shadow:0 0 40px #f04040dd,0 0 80px #f0404088}}
        .touch-btn{-webkit-tap-highlight-color:transparent}
        .touch-btn:active{opacity:0.7;transform:scale(0.93)}
      `}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8,
        width:'100%',maxWidth:"98vw",justifyContent:"center",flexWrap:"wrap"}}>
        <div style={{fontFamily:"'Orbitron'",fontSize:10,letterSpacing:3,color:"#667eea",
          textShadow:'0 0 8px #667eea33'}}>
          MULTIPLAYER
        </div>
        <div style={{fontFamily:"'Orbitron'",fontSize:9,color:"#333",letterSpacing:2}}>
          vs {peerManager.opponentAlias}
        </div>
      </div>

      {/* Main game area */}
      {!isMobile ? (
        /* Desktop: left panel + board + opponent board */
        <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
          {/* Left: Hold + Stats */}
          <div style={{display:'flex',flexDirection:'column',gap:12,minWidth:80}}>
            {holdPanel}
            {statsPanel}
          </div>

          {/* My Board */}
          {boardEl}

          {/* Right: Next */}
          <div style={{display:'flex',flexDirection:'column',gap:12,minWidth:80}}>
            {nextPanel}
          </div>

          {/* Separator */}
          <div style={{width:1,background:'#1a1a2e',alignSelf:'stretch',margin:'0 4px'}} />

          {/* Opponent's mini board */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
            <OpponentBoard
              board={opBoard}
              alias={peerManager.opponentAlias}
              score={opScore}
              lines={opLines}
              level={opLevel}
            />
          </div>
        </div>
      ) : (
        /* Mobile: board + opponent overlay in corner */
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:'100%',maxWidth:'98vw',position:'relative'}}>
          {boardEl}

          {/* Info panels below board */}
          <div style={{display:'flex',gap:6,marginTop:6,width:boardWidth+4,justifyContent:'center',flexWrap:'wrap'}}>
            <div style={{flex:'0 0 auto',minWidth:60}}>{holdPanel}</div>
            <div style={{flex:'0 0 auto',minWidth:60}}>{nextPanel}</div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap',flex:'1 1 auto',minWidth:0}}>
              <SidePanel title="SCORE">
                <div style={{fontFamily:"'Orbitron'",fontSize:11,fontWeight:700,color:"#00f0f0",textAlign:"center"}}>{score.toLocaleString()}</div>
              </SidePanel>
              <SidePanel title="LNS">
                <div style={{fontFamily:"'Orbitron'",fontSize:10,fontWeight:700,color:"#a0a0ff",textAlign:"center"}}>{lines}</div>
              </SidePanel>
              <SidePanel title="LVL">
                <div style={{fontFamily:"'Orbitron'",fontSize:10,fontWeight:700,color:"#f0a000",textAlign:"center"}}>{level}</div>
              </SidePanel>
            </div>
          </div>

          {/* Mobile touch controls */}
          <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:8,width:'100%',maxWidth:320,padding:'0 4px'}}>
            <div style={{display:'flex',gap:6}}>
              <MobileTouchBtn label={"\u25C0"} onClick={() => move(-1)} />
              <MobileTouchBtn label={"\u25BC"} onClick={drop} />
              <MobileTouchBtn label={"\u21BB"} onClick={rotatePiece} />
              <MobileTouchBtn label={"\u25B6"} onClick={() => move(1)} />
            </div>
            <div style={{display:'flex',gap:6}}>
              <MobileTouchBtn label="HOLD" onClick={holdPiece} />
              <MobileTouchBtn label={"\u2B07 DROP"} onClick={hardDrop} wide />
            </div>
          </div>

          {/* Opponent mini-board overlay on mobile */}
          <div style={{
            position:'fixed', top:8, right:8, zIndex:30,
            background:'rgba(10,10,22,0.9)', border:'1px solid #1a1a2e', borderRadius:8,
            padding:6,
          }}>
            <OpponentBoard
              board={opBoard}
              alias={peerManager.opponentAlias}
              score={opScore}
              lines={opLines}
              level={opLevel}
              compact
            />
          </div>
        </div>
      )}

      {resultOverlay}
    </div>
  );
}

function MobileTouchBtn({label, onClick, wide}) {
  return (
    <button className="touch-btn"
      onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{
        fontFamily:"'Orbitron'",fontSize:label.length>2?11:18,fontWeight:700,
        flex:wide?"2 1 0":"1 1 0",height:52,minWidth:48,
        border:"1px solid #2a2a3e",borderRadius:8,
        background:"rgba(15,15,30,0.85)",color:"#8888aa",
        display:"flex",alignItems:"center",justifyContent:"center",
        cursor:"pointer",letterSpacing:label.length>2?1:0,
        WebkitTapHighlightColor:"transparent",touchAction:"manipulation",
        transition:"opacity 0.1s, transform 0.1s",
      }}>{label}</button>
  );
}
