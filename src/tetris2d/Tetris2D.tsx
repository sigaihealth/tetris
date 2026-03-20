// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";

const COLS = 10;
const ROWS = 20;
const getCellSize = () => Math.min(28, Math.floor((window.innerWidth - 20) / (COLS + 1)));
const getIsMobile = () => window.innerWidth < 600;
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

const ZEN_COLORS = {
  I: "#7ecfcf", O: "#f0e68c", T: "#c9a0dc", S: "#90d5a0",
  Z: "#f0a0a0", J: "#a0b8e0", L: "#f0c090",
};

const CHALLENGES = [
  {id:"sprint20",name:"SPRINT 20",desc:"Clear 20 lines as fast as you can",goal:"lines",target:20,icon:"⚡",
    difficulties:{easy:{timeLimit:180,startLevel:0,garbageRows:0},medium:{timeLimit:120,startLevel:2,garbageRows:0},
      hard:{timeLimit:75,startLevel:4,garbageRows:3},expert:{timeLimit:50,startLevel:6,garbageRows:5}}},
  {id:"sprint40",name:"SPRINT 40",desc:"Clear 40 lines before time runs out",goal:"lines",target:40,icon:"🔥",
    difficulties:{easy:{timeLimit:360,startLevel:0,garbageRows:0},medium:{timeLimit:240,startLevel:2,garbageRows:0},
      hard:{timeLimit:150,startLevel:5,garbageRows:4},expert:{timeLimit:100,startLevel:7,garbageRows:6}}},
  {id:"scoreAttack",name:"SCORE ATTACK",desc:"Hit the target score within the time limit",goal:"score",icon:"🏆",
    difficulties:{easy:{timeLimit:180,startLevel:0,garbageRows:0,target:3000},medium:{timeLimit:150,startLevel:2,garbageRows:0,target:6000},
      hard:{timeLimit:120,startLevel:4,garbageRows:3,target:10000},expert:{timeLimit:90,startLevel:6,garbageRows:5,target:18000}}},
  {id:"survival",name:"SURVIVAL",desc:"Stay alive as the speed keeps rising",goal:"survive",icon:"💀",
    difficulties:{easy:{timeLimit:90,startLevel:3,garbageRows:0,levelUpEvery:15},medium:{timeLimit:90,startLevel:5,garbageRows:2,levelUpEvery:10},
      hard:{timeLimit:90,startLevel:7,garbageRows:4,levelUpEvery:8},expert:{timeLimit:90,startLevel:10,garbageRows:6,levelUpEvery:5}}},
  {id:"freeplay",name:"FREE PLAY",desc:"Classic endless mode, no time limit",goal:"none",icon:"♾️",
    difficulties:{easy:{timeLimit:0,startLevel:0,garbageRows:0},medium:{timeLimit:0,startLevel:3,garbageRows:0},
      hard:{timeLimit:0,startLevel:6,garbageRows:4},expert:{timeLimit:0,startLevel:9,garbageRows:8}}},
  {id:"zen",name:"ZEN",desc:"No gravity. Place blocks at your own pace. Pure relaxation.",goal:"none",icon:"🧘",
    difficulties:{easy:{timeLimit:0,startLevel:0,garbageRows:0},medium:{timeLimit:0,startLevel:0,garbageRows:0},
      hard:{timeLimit:0,startLevel:0,garbageRows:0},expert:{timeLimit:0,startLevel:0,garbageRows:0}}},
];

const DIFF_COLORS = {easy:"#00f000",medium:"#f0f000",hard:"#f08000",expert:"#f00000"};
const DIFF_LABELS = ["easy","medium","hard","expert"];
const LINE_NAMES = ["","SINGLE","DOUBLE","TRIPLE","TETRIS!"];
const LINE_COLORS = ["","#aaa","#00f0f0","#f0a000","#f00060"];

const createBoard = () => Array.from({length:ROWS},()=>Array(COLS).fill(null));
const createGarbageBoard = (rows) => {
  const b = createBoard();
  const gc = ["#444455","#3a3a4a","#505060"];
  for (let r = ROWS-rows; r < ROWS; r++) {
    const gap = Math.floor(Math.random()*COLS);
    for (let c = 0; c < COLS; c++) if (c !== gap) b[r][c] = gc[Math.floor(Math.random()*gc.length)];
  }
  return b;
};
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
const BASE_SCORE = [0,100,300,500,800];
const ghostRow = (board, shape, row, col) => {
  let gr = row;
  while (!collides(board, shape, gr+1, col)) gr++;
  return gr;
};
const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;

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

// ==================== ASMR AUDIO ====================
function useAudio() {
  const ctxRef = useRef(null);
  const musicNodesRef = useRef(null);
  const musicOnRef = useRef(false);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  // Soft ASMR move — gentle tap
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

  // Satisfying rotate — soft bubble pop
  const playRotate = useCallback(() => {
    const ctx = getCtx(); const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(1200, t + 0.06);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.08);
    // Add soft pop noise
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.15));
    n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5000; f.Q.value = 1;
    const gn = ctx.createGain(); gn.gain.setValueAtTime(0.08, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    n.connect(f); f.connect(gn); gn.connect(ctx.destination);
    n.start(t); n.stop(t + 0.025);
  }, [getCtx]);

  // Soft drop — gentle thud
  const playSoftDrop = useCallback(() => {
    const ctx = getCtx(); const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.08);
  }, [getCtx]);

  // Hard drop — satisfying deep thump + crunch
  const playHardDrop = useCallback(() => {
    const ctx = getCtx(); const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(100, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.2);
    // Crunch noise
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.3));
    n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 800;
    const gn = ctx.createGain(); gn.gain.setValueAtTime(0.15, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    n.connect(f); f.connect(gn); gn.connect(ctx.destination);
    n.start(t); n.stop(t + 0.08);
  }, [getCtx]);

  // Line clear — sparkly chime cascade
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
    // Shimmer noise
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.4));
    n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 6000; f.Q.value = 0.5;
    const gn = ctx.createGain(); gn.gain.setValueAtTime(0.06, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    n.connect(f); f.connect(gn); gn.connect(ctx.destination);
    n.start(t); n.stop(t + 0.25);
  }, [getCtx]);

  // Combo — rising bubbly tone
  const playCombo = useCallback((count) => {
    const ctx = getCtx(); const t = ctx.currentTime;
    const freq = 400 + count * 150;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.15);
  }, [getCtx]);

  // Level up — ascending arpeggio
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

  // Hold piece — soft whoosh
  const playHold = useCallback(() => {
    const ctx = getCtx(); const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(400, t);
    o.frequency.exponentialRampToValueAtTime(250, t + 0.1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.1);
  }, [getCtx]);

  // Game over — sad descending
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

  // Ambient lo-fi music — soft pads + gentle arpeggios
  const startMusic = useCallback(() => {
    if (musicOnRef.current) return;
    musicOnRef.current = true;
    const ctx = getCtx(); const t = ctx.currentTime;
    const master = ctx.createGain(); master.gain.value = 0.06; master.connect(ctx.destination);

    // Warm pad — two detuned oscillators
    const pad1 = ctx.createOscillator(); pad1.type = 'sine'; pad1.frequency.value = 65.41;
    const pad2 = ctx.createOscillator(); pad2.type = 'sine'; pad2.frequency.value = 98.0;
    const padGain = ctx.createGain(); padGain.gain.value = 1.0;
    const padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 250;
    // LFO for gentle movement
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.25;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 4;
    lfo.connect(lfoGain); lfoGain.connect(pad1.frequency);
    pad1.connect(padFilter); pad2.connect(padFilter); padFilter.connect(padGain); padGain.connect(master);
    pad1.start(t); pad2.start(t); lfo.start(t);

    // Gentle arpeggio loop
    const scale = [130.81, 164.81, 196.0, 261.63, 329.63, 392.0];
    let arpeggioTimer = null;
    const scheduleArpeggio = () => {
      if (!musicOnRef.current) return;
      const ct = ctx.currentTime;
      const tempo = 0.28;
      const numNotes = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < numNotes; i++) {
        const freq = scale[Math.floor(Math.random() * scale.length)];
        const d = i * tempo;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.5, ct + d);
        g.gain.exponentialRampToValueAtTime(0.001, ct + d + tempo * 0.7);
        o.connect(g); g.connect(master);
        o.start(ct + d); o.stop(ct + d + tempo * 0.7);
      }
      arpeggioTimer = setTimeout(scheduleArpeggio, (numNotes * tempo + 0.8 + Math.random() * 0.5) * 1000);
    };
    scheduleArpeggio();

    musicNodesRef.current = { pad1, pad2, lfo, master, arpeggioTimer };
  }, [getCtx]);

  const startZenMusic = useCallback(() => {
    if (musicOnRef.current) return;
    musicOnRef.current = true;
    const ctx = getCtx(); const t = ctx.currentTime;
    const master = ctx.createGain(); master.gain.value = 0.08; master.connect(ctx.destination);

    // Very slow, warm pad with lots of reverb feel
    const pad1 = ctx.createOscillator(); pad1.type = 'sine'; pad1.frequency.value = 55; // A1
    const pad2 = ctx.createOscillator(); pad2.type = 'sine'; pad2.frequency.value = 82.41; // E2
    const pad3 = ctx.createOscillator(); pad3.type = 'sine'; pad3.frequency.value = 110; // A2
    const padGain = ctx.createGain(); padGain.gain.value = 1.0;
    const padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 180;

    // Very slow LFO for dreamy movement
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.1;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 3;
    lfo.connect(lfoGain); lfoGain.connect(pad1.frequency);

    pad1.connect(padFilter); pad2.connect(padFilter); pad3.connect(padFilter);
    padFilter.connect(padGain); padGain.connect(master);
    pad1.start(t); pad2.start(t); pad3.start(t); lfo.start(t);

    // Slow pentatonic chimes with long decay
    const zenScale = [220, 261.63, 329.63, 392, 523.25, 659.25];
    let arpeggioTimer = null;
    const scheduleZenChime = () => {
      if (!musicOnRef.current) return;
      const ct = ctx.currentTime;
      // 1-2 notes per phrase, very sparse
      const numNotes = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < numNotes; i++) {
        const freq = zenScale[Math.floor(Math.random() * zenScale.length)];
        const d = i * 0.8;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.3, ct + d);
        g.gain.exponentialRampToValueAtTime(0.001, ct + d + 1.5); // long decay
        o.connect(g); g.connect(master);
        o.start(ct + d); o.stop(ct + d + 1.5);
      }
      // Long pauses between chimes (2-5 seconds)
      arpeggioTimer = setTimeout(scheduleZenChime, (2000 + Math.random() * 3000));
    };
    scheduleZenChime();

    musicNodesRef.current = { pad1, pad2, pad3, lfo, master, arpeggioTimer };
  }, [getCtx]);

  // Softer zen line clear chime
  const playClearZen = useCallback((count) => {
    const ctx = getCtx(); const t = ctx.currentTime;
    const notes = [392, 523.25, 659.25, 784, 1047];
    const num = Math.min(count + 2, notes.length);
    for (let i = 0; i < num; i++) {
      const delay = i * 0.12;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = notes[i];
      const g = ctx.createGain(); g.gain.setValueAtTime(0.1, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.6);
      o.connect(g); g.connect(ctx.destination);
      o.start(t + delay); o.stop(t + delay + 0.6);
    }
  }, [getCtx]);

  const stopMusic = useCallback(() => {
    musicOnRef.current = false;
    if (musicNodesRef.current) {
      const { pad1, pad2, pad3, lfo, arpeggioTimer } = musicNodesRef.current;
      try { pad1.stop(); } catch {}
      try { pad2.stop(); } catch {}
      try { if (pad3) pad3.stop(); } catch {}
      try { lfo.stop(); } catch {}
      if (arpeggioTimer) clearTimeout(arpeggioTimer);
      musicNodesRef.current = null;
    }
  }, []);

  return { playMove, playRotate, playSoftDrop, playHardDrop, playClear, playClearZen, playCombo, playLevelUp, playHold, playGameOver, startMusic, startZenMusic, stopMusic };
}

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

/* ==================== MENU ==================== */
function MenuScreen({onStart}) {
  const [selCh, setSelCh] = useState(0);
  const [selDiff, setSelDiff] = useState(1);
  const ch = CHALLENGES[selCh], dk = DIFF_LABELS[selDiff], cfg = ch.difficulties[dk], target = cfg.target||ch.target;
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      background:"linear-gradient(160deg,#0a0a12,#0d0d1a 50%,#0a0a12)",fontFamily:"'JetBrains Mono','Fira Code',monospace",
      color:"#e0e0e0",userSelect:"none",padding:"24px 12px"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes glowPulse{0%,100%{text-shadow:0 0 20px #00f0f0aa,0 0 40px #00f0f066}50%{text-shadow:0 0 30px #00f0f0dd,0 0 60px #00f0f088}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .chal-btn:hover{border-color:#00f0f066!important;color:#00f0f0aa!important}
        .diff-btn:hover{opacity:0.85} .play-btn:hover{background:#00f0f025!important;box-shadow:0 0 32px #00f0f033!important}
        .back-btn:hover{border-color:#444!important;color:#888!important}
      `}</style>
      <button className="back-btn" onClick={() => window.dispatchEvent(new CustomEvent('tetris2d-exit'))} style={{
        position:"absolute",top:20,left:20,fontFamily:"'Orbitron'",fontSize:9,fontWeight:700,letterSpacing:2,
        padding:"6px 12px",border:"1px solid #1a1a2e",borderRadius:4,
        background:"transparent",color:"#333",cursor:"pointer",transition:"all 0.2s",
      }}>{'<'} MAIN MENU</button>
      <h1 style={{fontFamily:"'Orbitron'",fontSize:34,fontWeight:900,letterSpacing:10,color:"#00f0f0",marginBottom:4,
        textShadow:"0 0 20px #00f0f088,0 0 40px #00f0f044",animation:"glowPulse 3s ease-in-out infinite"}}>TETRIS</h1>
      <div style={{fontFamily:"'Orbitron'",fontSize:10,letterSpacing:6,color:"#333",marginBottom:32}}>SELECT CHALLENGE</div>
      <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap",justifyContent:"center",maxWidth:560}}>
        {CHALLENGES.map((c,i) => (
          <button key={c.id} className="chal-btn" onClick={()=>setSelCh(i)} style={{
            fontFamily:"'Orbitron'",fontSize:11,fontWeight:700,padding:"12px 14px",
            border:`2px solid ${selCh===i?"#00f0f0":"#1a1a2e"}`,borderRadius:10,cursor:"pointer",letterSpacing:1,transition:"all 0.2s",
            background:selCh===i?"#00f0f010":"#0a0a16",color:selCh===i?"#00f0f0":"#555",
            boxShadow:selCh===i?"0 0 20px #00f0f018":"none",minWidth:96,textAlign:"center",
          }}><div style={{fontSize:20,marginBottom:5}}>{c.icon}</div>{c.name}</button>
        ))}
      </div>
      <div key={ch.id} style={{background:"#0a0a16",border:"1px solid #1a1a2e",borderRadius:12,padding:"22px 28px",marginBottom:24,maxWidth:420,width:"92%",animation:"fadeIn 0.25s ease-out"}}>
        <div style={{fontFamily:"'Orbitron'",fontSize:15,fontWeight:700,color:"#e0e0e0",marginBottom:5}}>{ch.icon} {ch.name}</div>
        <div style={{fontSize:12,color:"#666",marginBottom:18,lineHeight:1.5}}>{ch.desc}</div>
        {ch.id !== "zen" && (
          <>
            <div style={{fontFamily:"'Orbitron'",fontSize:9,letterSpacing:3,color:"#444",marginBottom:10}}>DIFFICULTY</div>
            <div style={{display:"flex",gap:8,marginBottom:20}}>
              {DIFF_LABELS.map((d,i) => (
                <button key={d} className="diff-btn" onClick={()=>setSelDiff(i)} style={{
                  fontFamily:"'Orbitron'",fontSize:10,fontWeight:700,textTransform:"uppercase",
                  padding:"7px 14px",border:`2px solid ${selDiff===i?DIFF_COLORS[d]:"#1a1a2e"}`,borderRadius:6,cursor:"pointer",transition:"all 0.2s",
                  background:selDiff===i?`${DIFF_COLORS[d]}12`:"transparent",color:selDiff===i?DIFF_COLORS[d]:"#333",
                }}>{d}</button>
              ))}
            </div>
          </>
        )}
        {ch.id === "zen" ? (
          <div style={{textAlign:"center",padding:"8px 0"}}>
            <div style={{fontFamily:"'Orbitron'",fontSize:10,color:"#6a7090",letterSpacing:2}}>No time limit. No score. Just breathe.</div>
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 24px"}}>
            <StatPill label="TIME" value={cfg.timeLimit>0?formatTime(cfg.timeLimit):"Endless"} color="#00f0f0" />
            <StatPill label="START LVL" value={cfg.startLevel} color="#f0a000" />
            {target && <StatPill label="TARGET" value={ch.goal==="score"?target.toLocaleString()+" pts":target+" lines"} color="#a000f0" />}
            {ch.goal==="survive" && <StatPill label="LVL UP" value={`Every ${cfg.levelUpEvery}s`} color="#a000f0" />}
            {cfg.garbageRows>0 && <StatPill label="GARBAGE" value={cfg.garbageRows+" rows"} color="#f04040" />}
            {cfg.garbageRows===0 && !target && ch.goal!=="survive" && <StatPill label="GARBAGE" value="None" color="#333" />}
          </div>
        )}
      </div>
      <button className="play-btn" onClick={()=>onStart(ch,dk,cfg)} style={{
        fontFamily:"'Orbitron'",fontSize:16,fontWeight:900,letterSpacing:5,padding:"14px 52px",
        border:"2px solid #00f0f0",borderRadius:8,background:"#00f0f012",color:"#00f0f0",cursor:"pointer",
        boxShadow:"0 0 24px #00f0f018",transition:"all 0.2s",animation:"slideUp 0.5s ease-out",
      }}>PLAY</button>
      <div style={{fontSize:10,marginTop:20,color:"#2a2a2a",textAlign:"center",lineHeight:1.9}}>
        Arrows: move/rotate &middot; Space: hard drop &middot; C/Shift: hold &middot; P: pause
      </div>
    </div>
  );
}

function StatPill({label, value, color}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0"}}>
      <span style={{fontFamily:"'Orbitron'",fontSize:9,letterSpacing:2,color:"#444"}}>{label}</span>
      <span style={{fontFamily:"'Orbitron'",fontSize:12,fontWeight:700,color,textShadow:`0 0 8px ${color}33`}}>{value}</span>
    </div>
  );
}

/* ==================== RESULT ==================== */
function ResultScreen({won, score, lines, level, elapsed, combo, b2b, challenge, difficulty, onMenu, onRetry}) {
  const cfg = challenge.difficulties[difficulty];
  const target = cfg.target || challenge.target;
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      background:"linear-gradient(160deg,#0a0a12,#0d0d1a 50%,#0a0a12)",fontFamily:"'JetBrains Mono','Fira Code',monospace",color:"#e0e0e0",userSelect:"none"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes victoryGlow{0%,100%{text-shadow:0 0 20px #00f04088,0 0 40px #00f04044}50%{text-shadow:0 0 40px #00f040cc,0 0 80px #00f04066}}
        @keyframes defeatGlow{0%,100%{text-shadow:0 0 20px #f0000088}50%{text-shadow:0 0 40px #f00000cc}}
        @keyframes stagger{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
        .res-btn:hover{opacity:0.85;transform:scale(1.03)}
      `}</style>
      <div style={{fontFamily:"'Orbitron'",fontSize:38,fontWeight:900,marginBottom:6,color:won?"#00f040":"#f04040",
        animation:`${won?"victoryGlow":"defeatGlow"} 2s ease-in-out infinite`,letterSpacing:6}}>
        {won ? (challenge.goal==="none"?"GAME OVER":"CLEARED!") : challenge.goal==="survive"?"SURVIVED!":"FAILED"}
      </div>
      <div style={{fontFamily:"'Orbitron'",fontSize:11,color:"#444",letterSpacing:3,marginBottom:36}}>
        {challenge.name} / {difficulty.toUpperCase()}
      </div>
      <div style={{background:"#0a0a16",border:"1px solid #1a1a2e",borderRadius:12,padding:"28px 40px",marginBottom:36,minWidth:280,animation:"fadeIn 0.4s ease-out"}}>
        <RRow label="SCORE" value={score.toLocaleString()} color="#00f0f0" d={0} />
        <RRow label="LINES" value={lines} color="#a0a0ff" d={1} />
        <RRow label="LEVEL" value={level} color="#f0a000" d={2} />
        <RRow label="TIME" value={formatTime(elapsed)} color="#f0f000" d={3} />
        <RRow label="MAX COMBO" value={combo+"x"} color="#f060a0" d={4} />
        <RRow label="BACK-TO-BACK" value={b2b} color="#a0f0a0" d={5} />
        {target && (
          <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #1a1a2e"}}>
            <RRow label="TARGET"
              value={challenge.goal==="score"?`${score.toLocaleString()} / ${target.toLocaleString()}`:`${lines} / ${target}`}
              color={won?"#00f040":"#f04040"} d={6} />
          </div>
        )}
      </div>
      <div style={{display:"flex",gap:14}}>
        <button className="res-btn" onClick={onRetry} style={{fontFamily:"'Orbitron'",fontSize:14,fontWeight:700,letterSpacing:3,
          padding:"12px 36px",border:"2px solid #00f0f0",borderRadius:8,background:"#00f0f010",color:"#00f0f0",cursor:"pointer",transition:"all 0.15s"}}>RETRY</button>
        <button className="res-btn" onClick={onMenu} style={{fontFamily:"'Orbitron'",fontSize:14,fontWeight:700,letterSpacing:3,
          padding:"12px 36px",border:"2px solid #222",borderRadius:8,background:"transparent",color:"#444",cursor:"pointer",transition:"all 0.15s"}}>MENU</button>
      </div>
    </div>
  );
}

function RRow({label, value, color, d=0}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",gap:40,
      animation:`stagger 0.4s ease-out ${d*0.08}s both`}}>
      <span style={{fontFamily:"'Orbitron'",fontSize:9,letterSpacing:3,color:"#444"}}>{label}</span>
      <span style={{fontFamily:"'Orbitron'",fontSize:18,fontWeight:700,color,textShadow:`0 0 10px ${color}44`}}>{value}</span>
    </div>
  );
}

/* ==================== GAME ==================== */
function GameScreen({challenge, difficulty, config, onResult, onMenu}) {
  const { CELL, isMobile } = useViewport();
  const target = config.target || challenge.target;

  const [board, setBoard] = useState(() => config.garbageRows>0 ? createGarbageBoard(config.garbageRows) : createBoard());
  const [current, setCurrent] = useState(null);
  const [pos, setPos] = useState({r:0,c:0});
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(config.startLevel);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [flashRows, setFlashRows] = useState([]);
  const [timeLeft, setTimeLeft] = useState(config.timeLimit);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [resultSent, setResultSent] = useState(false);
  const [holdKey, setHoldKey] = useState(null);
  const [holdUsed, setHoldUsed] = useState(false);
  const [previewKeys, setPreviewKeys] = useState([]);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [b2bCount, setB2bCount] = useState(0);
  const [lastWasTetris, setLastWasTetris] = useState(false);
  const [totalB2b, setTotalB2b] = useState(0);
  const [actionLabels, setActionLabels] = useState([]);
  const [shake, setShake] = useState(false);

  const labelId = useRef(0);
  const {init:initQueue, dequeue, peek} = useQueue();
  const audio = useAudio();
  const prevLevel = useRef(config.startLevel);

  // Refs for accessing latest state in callbacks
  const boardRef = useRef(board);
  const currentRef = useRef(current);
  const posRef = useRef(pos);
  const gameOverRef = useRef(gameOver);
  const pausedRef = useRef(paused);
  const levelRef = useRef(level);
  const scoreRef = useRef(score);
  const linesRef = useRef(lines);
  const elapsedRef = useRef(elapsed);
  const resultSentRef = useRef(false);
  const holdUsedRef = useRef(false);
  const comboRef = useRef(0);
  const lastWasTetrisRef = useRef(false);
  const maxComboRef = useRef(0);
  const totalB2bRef = useRef(0);
  const lockTimerRef = useRef(null);
  const lockMovesRef = useRef(0);
  const dasDir = useRef(null);
  const dasTimer = useRef(null);
  const dasRepeat = useRef(null);

  // Keep refs in sync
  boardRef.current = board;
  currentRef.current = current;
  posRef.current = pos;
  gameOverRef.current = gameOver;
  pausedRef.current = paused;
  levelRef.current = level;
  scoreRef.current = score;
  linesRef.current = lines;
  elapsedRef.current = elapsed;
  resultSentRef.current = resultSent;
  holdUsedRef.current = holdUsed;
  comboRef.current = combo;
  lastWasTetrisRef.current = lastWasTetris;
  maxComboRef.current = maxCombo;
  totalB2bRef.current = totalB2b;

  // ---- doLockRef pattern: breaks circular dep between startLockTimer <-> doLock ----
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

  // Cleanup audio on unmount
  useEffect(() => {
    return () => { audio.stopMusic(); };
  }, [audio]);

  // Countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => {
      if (countdown === 1) { setCountdown(0); setStarted(true); challenge.id === "zen" ? audio.startZenMusic() : audio.startMusic(); }
      else setCountdown(c => c-1);
    }, 700);
    return () => clearTimeout(id);
  }, [countdown]);

  // Spawn first piece
  useEffect(() => {
    if (!started) return;
    initQueue();
    const first = dequeue();
    setPreviewKeys(peek());
    const p = PIECES[first];
    const sc = Math.floor((COLS - p.shape[0].length) / 2);
    const color = challenge.id === "zen" ? ZEN_COLORS[first] : p.color;
    setCurrent({shape:p.shape, color, key:first});
    setPos({r:0, c:sc});
  }, [started]);

  // Timer
  useEffect(() => {
    if (!started || gameOver || paused) return;
    const id = setInterval(() => {
      setElapsed(e => {
        const ne = e+1;
        if (challenge.goal === "survive" && config.levelUpEvery && ne > 0 && ne % config.levelUpEvery === 0)
          setLevel(l => Math.min(l+1, DROP_SPEEDS.length-1));
        return ne;
      });
      if (config.timeLimit > 0) {
        setTimeLeft(t => {
          if (t <= 1) {
            if (!resultSentRef.current) {
              setResultSent(true);
              const survived = challenge.goal === "survive";
              setTimeout(() => onResult(survived, scoreRef.current, linesRef.current, levelRef.current, elapsedRef.current+1, maxComboRef.current, totalB2bRef.current), 400);
            }
            return 0;
          }
          return t-1;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [started, gameOver, paused, config, challenge, onResult]);

  // Win check
  useEffect(() => {
    if (!started || gameOver || resultSentRef.current) return;
    if (challenge.goal === "lines" && target && lines >= target) {
      setResultSent(true);
      audio.stopMusic();
      setTimeout(() => onResult(true, score, lines, level, elapsed, maxComboRef.current, totalB2bRef.current), 500);
    }
    if (challenge.goal === "score" && target && score >= target) {
      setResultSent(true);
      audio.stopMusic();
      setTimeout(() => onResult(true, score, lines, level, elapsed, maxComboRef.current, totalB2bRef.current), 500);
    }
  }, [score, lines, started, gameOver, challenge, target, level, elapsed, onResult]);

  const spawnNext = useCallback(() => {
    clearLockTimer();
    lockMovesRef.current = 0;
    const key = dequeue();
    setPreviewKeys(peek());
    const p = PIECES[key];
    const zenColor = challenge.id === "zen" ? ZEN_COLORS[key] : p.color;
    const sc = Math.floor((COLS - p.shape[0].length) / 2);
    if (collides(boardRef.current, p.shape, 0, sc)) {
      if (challenge.id === "zen") {
        // Dissolve bottom 5 rows instead of game over
        setBoard(prev => {
          const cleared = prev.slice(0, ROWS - 5);
          const empty = Array.from({length: 5}, () => Array(COLS).fill(null));
          return [...empty, ...cleared];
        });
        // Try spawning again
        setCurrent({shape:p.shape, color:zenColor, key});
        setPos({r:0, c:sc});
        setHoldUsed(false);
        return;
      }
      setGameOver(true);
      audio.playGameOver();
      audio.stopMusic();
      if (!resultSentRef.current) {
        setResultSent(true);
        const won = challenge.goal === "none";
        setTimeout(() => onResult(won, scoreRef.current, linesRef.current, levelRef.current, elapsedRef.current, maxComboRef.current, totalB2bRef.current), 600);
      }
      return;
    }
    setCurrent({shape:p.shape, color:zenColor, key});
    setPos({r:0, c:sc});
    setHoldUsed(false);
  }, [dequeue, peek, challenge, onResult, clearLockTimer]);

  // The actual lock function
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

      const isTetris = cleared === 4;
      const newCombo = comboRef.current + 1;
      setCombo(newCombo);
      setMaxCombo(mc => Math.max(mc, newCombo));

      let pts = BASE_SCORE[cleared] * (levelRef.current + 1);
      if (newCombo > 1) pts += 50 * (newCombo-1) * (levelRef.current+1);

      let isB2b = false;
      if (isTetris && lastWasTetrisRef.current) {
        pts = Math.floor(pts * 1.5);
        isB2b = true;
        setB2bCount(bc => bc+1);
        setTotalB2b(tb => tb+1);
      }
      setLastWasTetris(isTetris);

      addLabel(LINE_NAMES[cleared], LINE_COLORS[cleared]);
      if (newCombo > 1) addLabel(`COMBO x${newCombo}`, "#f060a0", 24);
      if (isB2b) addLabel("BACK-TO-BACK", "#a0f0ff", 48);
      if (cleared === 4) { setShake(true); setTimeout(() => setShake(false), 300); }

      challenge.id === "zen" ? audio.playClearZen(cleared) : audio.playClear(cleared);
      if (newCombo > 1) audio.playCombo(newCombo);

      setTimeout(() => {
        setFlashRows([]);
        setBoard(nb);
        setScore(s => s + pts);
        setLines(l => {
          const nl = l + cleared;
          const newLvl = Math.max(config.startLevel, Math.min(Math.floor(nl/10), DROP_SPEEDS.length-1));
          if (challenge.goal !== "survive") setLevel(newLvl);
          if (newLvl > prevLevel.current) { audio.playLevelUp(); prevLevel.current = newLvl; }
          return nl;
        });
        spawnNext();
      }, 220);
      setBoard(b);
    } else {
      setCombo(0);
      setLastWasTetris(false);
      setBoard(nb);
      if (challenge.id !== "zen") audio.playSoftDrop();
      spawnNext();
    }
  }, [spawnNext, config.startLevel, challenge.goal, addLabel, clearLockTimer, audio]);

  // Keep doLockRef in sync so startLockTimer always calls the latest version
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
    if (gameOverRef.current || pausedRef.current || !currentRef.current) return;
    const p = posRef.current, c = currentRef.current;
    if (!collides(boardRef.current, c.shape, p.r+1, p.c)) {
      setPos(prev => ({...prev, r: prev.r+1}));
      if (collides(boardRef.current, c.shape, p.r+2, p.c)) startLockTimer();
    } else {
      if (!lockTimerRef.current) startLockTimer();
    }
  }, [startLockTimer]);

  // Gravity
  useEffect(() => {
    if (!started || gameOver || paused) return;
    if (challenge.id === "zen") return; // no gravity interval
    const id = setInterval(drop, DROP_SPEEDS[Math.min(level, DROP_SPEEDS.length-1)]);
    return () => clearInterval(id);
  }, [started, gameOver, paused, level, drop, challenge.id]);

  const hardDrop = useCallback(() => {
    if (!currentRef.current || pausedRef.current) return;
    clearLockTimer();
    const c = currentRef.current, p = posRef.current;
    let nr = p.r;
    while (!collides(boardRef.current, c.shape, nr+1, p.c)) nr++;
    setScore(s => s + (nr - p.r) * 2);
    setPos({r:nr, c:p.c});
    if (challenge.id !== "zen") audio.playHardDrop(); else audio.playMove();
    setTimeout(() => doLock(), 0);
  }, [doLock, clearLockTimer, audio, challenge.id]);

  const move = useCallback((dc) => {
    if (!currentRef.current || pausedRef.current) return;
    if (!collides(boardRef.current, currentRef.current.shape, posRef.current.r, posRef.current.c + dc)) {
      setPos(prev => ({...prev, c: prev.c + dc}));
      touchLock();
      audio.playMove();
    }
  }, [touchLock, audio]);
  const moveRef = useRef(move);
  moveRef.current = move;

  const rotatePiece = useCallback(() => {
    if (!currentRef.current || pausedRef.current) return;
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
    if (!currentRef.current || pausedRef.current || holdUsedRef.current) return;
    clearLockTimer();
    const curKey = currentRef.current.key;
    if (holdKey) {
      const p = PIECES[holdKey];
      const sc = Math.floor((COLS - p.shape[0].length) / 2);
      if (collides(boardRef.current, p.shape, 0, sc)) return;
      const hColor = challenge.id === "zen" ? ZEN_COLORS[holdKey] : p.color;
      setHoldKey(curKey);
      setCurrent({shape:p.shape, color:hColor, key:holdKey});
      setPos({r:0, c:sc});
    } else {
      setHoldKey(curKey);
      spawnNext();
    }
    setHoldUsed(true);
    audio.playHold();
  }, [holdKey, spawnNext, clearLockTimer, audio, challenge.id]);

  // DAS
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

  // Stable refs for keyboard handler — prevents effect re-registration from killing DAS
  const dropRef = useRef(drop); dropRef.current = drop;
  const rotateRef = useRef(rotatePiece); rotateRef.current = rotatePiece;
  const hardDropRef = useRef(hardDrop); hardDropRef.current = hardDrop;
  const holdRef = useRef(holdPiece); holdRef.current = holdPiece;
  const startDasRef = useRef(startDas); startDasRef.current = startDas;
  const stopDasRef = useRef(stopDas); stopDasRef.current = stopDas;

  // Refs for state used in keyboard handler — so effect never re-registers
  const startedRef = useRef(started); startedRef.current = started;
  const pausedKbRef = useRef(paused); pausedKbRef.current = paused;

  // Keyboard — registered ONCE, never re-registers, so DAS is never killed
  useEffect(() => {
    const down = (e) => {
      if (!startedRef.current || gameOverRef.current) return;
      if (e.key === "p" || e.key === "Escape") { setPaused(v => !v); return; }
      if (pausedKbRef.current) return;
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

  // Soft drop hold (disabled in zen mode — zen uses single-press drop only)
  useEffect(() => {
    if (!started || gameOver || paused || challenge.id === "zen") return;
    let pressing = false, iv = null;
    const down = (e) => { if (e.key === "ArrowDown" && !pressing) { pressing = true; iv = setInterval(() => drop(), DAS_RATE); } };
    const up = (e) => { if (e.key === "ArrowDown") { pressing = false; if (iv) { clearInterval(iv); iv = null; } } };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); if (iv) clearInterval(iv); };
  }, [started, gameOver, paused, drop, challenge.id]);

  // Touch
  const touchStart = useRef(null);
  const onTouchStart = (e) => { touchStart.current = {x:e.touches[0].clientX, y:e.touches[0].clientY, t:Date.now()}; };
  const onTouchEnd = (e) => {
    if (!touchStart.current || !started || gameOver || paused) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.t;
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && dt < 250) { rotatePiece(); return; }
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
    else if (dy > 30) hardDrop();
    touchStart.current = null;
  };

  // Render board
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
  const timerUrgent = config.timeLimit > 0 && timeLeft <= 15;
  const timerColor = timerUrgent ? "#f04040" : "#00f0f0";
  let progress = 0;
  if (challenge.goal === "lines" && target) progress = Math.min(lines/target, 1);
  else if (challenge.goal === "score" && target) progress = Math.min(score/target, 1);
  else if (challenge.goal === "survive" && config.timeLimit > 0) progress = Math.min(elapsed/config.timeLimit, 1);

  const boardWidth = COLS * (CELL + 1);
  const totalWidth = isMobile ? boardWidth + 8 : boardWidth + 270;
  const mFs = isMobile ? 0.85 : 1; // mobile font scale

  // -- Hold panel content --
  const isZen = challenge.id === "zen";
  const holdPanel = (
    <SidePanel title="HOLD" highlight={!holdUsed && !!holdKey}>
      <div style={{display:"flex",justifyContent:"center",padding:"6px 0",minHeight:isMobile?24:36}}>
        {holdPieceData
          ? <MiniGrid shape={holdPieceData.shape} color={isZen ? ZEN_COLORS[holdKey] : holdPieceData.color} size={isMobile?10:13} dimmed={holdUsed} />
          : <div style={{fontFamily:"'Orbitron'",fontSize:8,color:"#222",letterSpacing:1}}>{isMobile?"":"C / SHIFT"}</div>}
      </div>
    </SidePanel>
  );

  // -- Stats panels content --
  const statsPanel = isZen ? (
    <>
      <SidePanel title="ZEN">
        <div style={{fontFamily:"'Orbitron'",fontSize:Math.round(16*mFs),fontWeight:900,color:"#c9a0dc",textAlign:"center",
          textShadow:"0 0 12px #c9a0dc44"}}>🧘</div>
      </SidePanel>
      <SidePanel title="LINES">
        <div style={{fontFamily:"'Orbitron'",fontSize:Math.round(12*mFs),fontWeight:700,color:"#a0b8e0",textAlign:"center"}}>
          {lines}
        </div>
      </SidePanel>
    </>
  ) : (
    <>
      <SidePanel title="SCORE">
        <div style={{fontFamily:"'Orbitron'",fontSize:Math.round(14*mFs),fontWeight:700,color:"#00f0f0",textAlign:"center",
          textShadow:"0 0 10px #00f0f033"}}>{score.toLocaleString()}</div>
      </SidePanel>
      <SidePanel title="LINES">
        <div style={{fontFamily:"'Orbitron'",fontSize:Math.round(12*mFs),fontWeight:700,color:"#a0a0ff",textAlign:"center"}}>
          {target && challenge.goal === "lines" ? `${lines}/${target}` : lines}
        </div>
      </SidePanel>
      <SidePanel title="LEVEL">
        <div style={{fontFamily:"'Orbitron'",fontSize:Math.round(12*mFs),fontWeight:700,color:"#f0a000",textAlign:"center",
          textShadow:"0 0 10px #f0a00033"}}>{level}</div>
      </SidePanel>
      {combo > 1 && (
        <SidePanel title="COMBO">
          <div style={{fontFamily:"'Orbitron'",fontSize:Math.round(14*mFs),fontWeight:900,color:"#f060a0",textAlign:"center",
            textShadow:"0 0 12px #f060a044"}}>{combo}x</div>
        </SidePanel>
      )}
    </>
  );

  // -- Next panel content --
  const nextPanel = (
    <SidePanel title="NEXT">
      <div style={{display:"flex",flexDirection:isMobile?"row":"column",gap:isMobile?6:10,alignItems:"center",padding:"4px 0"}}>
        {previewKeys.map((k, i) => {
          const p = PIECES[k];
          const nColor = isZen ? ZEN_COLORS[k] : p.color;
          return <MiniGrid key={`${k}-${i}`} shape={p.shape} color={nColor} size={isMobile?(i===0?11:9):(i===0?14:11)} dimmed={i>0} />;
        })}
        {previewKeys.length === 0 && <div style={{height:isMobile?30:80}} />}
      </div>
    </SidePanel>
  );

  // -- Board content --
  const boardEl = (
    <div style={{
      position:"relative",border:`2px solid ${isZen ? "#4a5580" : "#3a4060"}`,borderRadius:8,
      background: isZen ? "linear-gradient(180deg, #1a2035, #1e2540)" : "linear-gradient(180deg, #10121e, #0c0e18)",
      boxShadow:"0 0 40px rgba(0,200,255,0.06),inset 0 0 60px #00000055, 0 8px 32px rgba(0,0,0,0.5)",padding:2,
      animation: shake ? "boardShake 0.3s ease-out" : isZen ? "zenBoardGlow 4s ease-in-out infinite" : "none",
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
              width:CELL, height:CELL, borderRadius: cell ? (isZen ? 8 : 6) : 3,
              background: isFlash ? "#fff"
                : cell && !isGhost
                  ? `linear-gradient(145deg, ${baseColor}ee, ${baseColor}99)`
                : isGhost
                  ? `linear-gradient(145deg, ${baseColor}20, ${baseColor}10)`
                : (r+(i%COLS))%2===0 ? "#12142200" : "#1618260a",
              boxShadow: cell && !isGhost
                ? isZen
                  ? `inset 0 4px 8px rgba(255,255,255,0.3), inset 0 -3px 6px rgba(0,0,0,0.2), 0 0 12px ${baseColor}44, 0 2px 6px rgba(0,0,0,0.3)`
                  : `inset 0 4px 6px rgba(255,255,255,0.35), inset 0 -3px 5px rgba(0,0,0,0.3), 0 0 8px ${baseColor}55, 0 2px 4px rgba(0,0,0,0.4)`
                : isGhost ? `inset 0 2px 4px ${baseColor}15` : "none",
              transition: isFlash ? "none" : "background 0.06s, transform 0.15s",
              animation: isFlash ? "flashRow 0.2s ease-out"
                : cell && !isGhost ? "jelloIdle 3s ease-in-out infinite" : "none",
              animationDelay: cell && !isGhost ? `${(i * 0.1) % 2}s` : "0s",
              border: cell && !isGhost ? `1px solid ${baseColor}44` : "none",
            }} />
          );
        })}
      </div>

      {/* Action labels */}
      {actionLabels.map(l => <ActionLabel key={l.id} {...l} />)}

      {countdown > 0 && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#000000cc",borderRadius:6,zIndex:10}}>
          <div key={countdown} style={{fontFamily:"'Orbitron'",fontSize:isMobile?48:72,fontWeight:900,color:"#00f0f0",
            textShadow:"0 0 40px #00f0f088",animation:"countPulse 0.7s ease-out"}}>{countdown}</div>
        </div>
      )}
      {paused && (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#000000bb",borderRadius:6,zIndex:10}}>
          <div style={{fontFamily:"'Orbitron'",fontSize:22,fontWeight:700,color:"#f0f000",
            animation:"pulse 1.5s ease-in-out infinite",textShadow:"0 0 20px #f0f00066"}}>PAUSED</div>
          <div style={{fontFamily:"'Orbitron'",fontSize:10,color:"#888",marginTop:12,letterSpacing:1}}>P / ESC to resume</div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('tetris2d-exit'))} style={{
            fontFamily:"'Orbitron'",fontSize:10,fontWeight:700,letterSpacing:2,marginTop:20,
            padding:"8px 20px",border:"1px solid #f0f00066",borderRadius:6,
            background:"transparent",color:"#f0f000",cursor:"pointer",transition:"all 0.2s",
          }}>MENU</button>
        </div>
      )}
    </div>
  );

  // -- Desktop control buttons (right panel) --
  const desktopControls = (
    <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:4}}>
      <div style={{display:"flex",justifyContent:"center"}}><CtrlBtn label="\u25B2" onClick={rotatePiece} /></div>
      <div style={{display:"flex",gap:5,justifyContent:"center"}}>
        <CtrlBtn label="\u25C0" onClick={() => move(-1)} />
        <CtrlBtn label="\u25BC" onClick={drop} />
        <CtrlBtn label="\u25B6" onClick={() => move(1)} />
      </div>
      <div style={{display:"flex",gap:5,justifyContent:"center",marginTop:2}}>
        <CtrlBtn label="HOLD" onClick={holdPiece} wide />
      </div>
      <div style={{display:"flex",justifyContent:"center",marginTop:2}}>
        <CtrlBtn label="DROP" onClick={hardDrop} wide />
      </div>
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
        @keyframes urgentPulse{0%,100%{color:#f04040}50%{color:#f0404055}}
        @keyframes labelFloat{0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}60%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-60px) scale(1.15)}}
        @keyframes boardShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
        @keyframes jelloLand{0%{transform:scaleY(0.7) scaleX(1.15)}30%{transform:scaleY(1.12) scaleX(0.92)}50%{transform:scaleY(0.95) scaleX(1.04)}70%{transform:scaleY(1.03) scaleX(0.98)}100%{transform:scaleY(1) scaleX(1)}}
        @keyframes jelloIdle{0%,100%{transform:scaleY(1) scaleX(1)}50%{transform:scaleY(1.015) scaleX(0.99)}}
        @keyframes zenFloat{0%{transform:translateY(0) scale(1);opacity:0.3}50%{transform:translateY(-40px) scale(1.3);opacity:0.6}100%{transform:translateY(0) scale(1);opacity:0.3}}
        @keyframes zenBoardGlow{0%,100%{box-shadow:0 0 20px rgba(100,150,200,0.15),inset 0 0 60px #00000055, 0 8px 32px rgba(0,0,0,0.5)}50%{box-shadow:0 0 40px rgba(100,150,200,0.3),inset 0 0 60px #00000055, 0 8px 32px rgba(0,0,0,0.5)}}
        .menu-btn:hover{color:#888!important;border-color:#333!important}
        .touch-btn{-webkit-tap-highlight-color:transparent}
        .touch-btn:active{opacity:0.7;transform:scale(0.93)}
      `}</style>

      {/* Zen floating particles */}
      {isZen && (
        <div style={{position:'fixed', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden'}}>
          {Array.from({length: isMobile ? 10 : 20}, (_, i) => (
            <div key={i} style={{
              position:'absolute',
              width: 4 + (((i * 7 + 3) % 9)),
              height: 4 + (((i * 7 + 3) % 9)),
              borderRadius: '50%',
              background: `rgba(${150+(i*17)%106}, ${180+(i*13)%76}, ${200+(i*11)%56}, ${0.15 + ((i*7)%20)*0.01})`,
              left: `${(i * 5.3) % 100}%`,
              top: `${(i * 4.7 + 10) % 100}%`,
              animation: `zenFloat ${8 + (i % 5) * 2.4}s ease-in-out infinite`,
              animationDelay: `${(i * 0.5) % 10}s`,
            }} />
          ))}
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:isMobile?6:12,marginBottom:isMobile?4:8,
        width:totalWidth,maxWidth:"98vw",justifyContent:"space-between",flexWrap:"wrap"}}>
        <button className="menu-btn" onClick={onMenu} style={{fontFamily:"'Orbitron'",fontSize:9,fontWeight:700,letterSpacing:2,
          padding:"4px 10px",border:"1px solid #1a1a2e",borderRadius:4,background:"transparent",color:"#333",cursor:"pointer",transition:"all 0.15s"}}>{"\u2190"} MENU</button>
        <div style={{fontFamily:"'Orbitron'",fontSize:isMobile?8:10,color:isZen?"#6a7090":"#444",letterSpacing:isMobile?1:2,textAlign:"center",flex:isMobile?1:undefined,minWidth:0}}>
          {challenge.icon} {challenge.name}{" "}
          {!isZen && <span style={{color:DIFF_COLORS[difficulty],fontSize:isMobile?7:9}}>{difficulty.toUpperCase()}</span>}
        </div>
        {isZen ? (
          <div style={{minWidth:isMobile?44:56}} />
        ) : config.timeLimit > 0 ? (
          <div style={{fontFamily:"'Orbitron'",fontSize:isMobile?14:18,fontWeight:900,color:timerColor,
            textShadow:`0 0 12px ${timerColor}55`,animation:timerUrgent?"urgentPulse 0.5s ease-in-out infinite":"none",
            minWidth:isMobile?44:56,textAlign:"right"}}>{formatTime(timeLeft)}</div>
        ) : (
          <div style={{fontFamily:"'Orbitron'",fontSize:isMobile?11:14,fontWeight:700,color:"#282828",minWidth:isMobile?44:56,textAlign:"right"}}>{formatTime(elapsed)}</div>
        )}
      </div>

      {/* Progress */}
      {challenge.goal !== "none" && (
        <div style={{width:totalWidth,maxWidth:"98vw",height:3,background:"#0e0e18",borderRadius:2,marginBottom:isMobile?4:8}}>
          <div style={{height:"100%",borderRadius:2,transition:"width 0.35s ease-out",width:`${progress*100}%`,
            background:progress>0.85?"linear-gradient(90deg,#00f0f0,#00f040)":"#00f0f0",
            boxShadow:`0 0 8px ${progress>0.85?"#00f040":"#00f0f0"}44`}} />
        </div>
      )}

      {/* ==== DESKTOP LAYOUT ==== */}
      {!isMobile && (
        <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
          {/* Left: Hold + Stats */}
          <div style={{display:"flex",flexDirection:"column",gap:12,minWidth:80}}>
            {holdPanel}
            {statsPanel}
          </div>

          {/* Board */}
          {boardEl}

          {/* Right: Next + Controls */}
          <div style={{display:"flex",flexDirection:"column",gap:12,minWidth:80}}>
            {nextPanel}
            {desktopControls}
          </div>
        </div>
      )}

      {/* ==== MOBILE LAYOUT ==== */}
      {isMobile && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%",maxWidth:"98vw"}}>
          {/* Board centered */}
          {boardEl}

          {/* Info panels below board in horizontal row */}
          <div style={{display:"flex",gap:6,marginTop:6,width:boardWidth+4,justifyContent:"center",flexWrap:"wrap"}}>
            <div style={{flex:"0 0 auto",minWidth:60}}>{holdPanel}</div>
            <div style={{flex:"0 0 auto",minWidth:60}}>{nextPanel}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:"1 1 auto",minWidth:0}}>
              {isZen ? (
                <>
                  <SidePanel title="ZEN">
                    <div style={{fontFamily:"'Orbitron'",fontSize:12,fontWeight:900,color:"#c9a0dc",textAlign:"center"}}>🧘</div>
                  </SidePanel>
                  <SidePanel title="LNS">
                    <div style={{fontFamily:"'Orbitron'",fontSize:10,fontWeight:700,color:"#a0b8e0",textAlign:"center"}}>{lines}</div>
                  </SidePanel>
                </>
              ) : (
                <>
                  <SidePanel title="SCORE">
                    <div style={{fontFamily:"'Orbitron'",fontSize:11,fontWeight:700,color:"#00f0f0",textAlign:"center"}}>{score.toLocaleString()}</div>
                  </SidePanel>
                  <SidePanel title="LNS">
                    <div style={{fontFamily:"'Orbitron'",fontSize:10,fontWeight:700,color:"#a0a0ff",textAlign:"center"}}>
                      {target && challenge.goal === "lines" ? `${lines}/${target}` : lines}
                    </div>
                  </SidePanel>
                  <SidePanel title="LVL">
                    <div style={{fontFamily:"'Orbitron'",fontSize:10,fontWeight:700,color:"#f0a000",textAlign:"center"}}>{level}</div>
                  </SidePanel>
                  {combo > 1 && (
                    <SidePanel title="CMB">
                      <div style={{fontFamily:"'Orbitron'",fontSize:10,fontWeight:900,color:"#f060a0",textAlign:"center"}}>{combo}x</div>
                    </SidePanel>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Mobile touch control buttons */}
          <MobileTouchControls
            onMove={move} onRotate={rotatePiece} onDrop={drop}
            onHardDrop={hardDrop} onHold={holdPiece}
          />
        </div>
      )}
    </div>
  );
}

function MobileTouchControls({onMove, onRotate, onDrop, onHardDrop, onHold}) {
  const tb = (label, action, flex) => (
    <button className="touch-btn"
      onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); action(); }}
      onMouseDown={(e) => { e.preventDefault(); action(); }}
      style={{
        fontFamily:"'Orbitron'",fontSize:label.length>2?11:18,fontWeight:700,
        flex:flex||"1 1 0",height:52,minWidth:48,
        border:"1px solid #2a2a3e",borderRadius:8,
        background:"rgba(15,15,30,0.85)",color:"#8888aa",
        display:"flex",alignItems:"center",justifyContent:"center",
        cursor:"pointer",letterSpacing:label.length>2?1:0,
        WebkitTapHighlightColor:"transparent",touchAction:"manipulation",
        transition:"opacity 0.1s, transform 0.1s",
      }}>{label}</button>
  );
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8,width:"100%",maxWidth:320,padding:"0 4px"}}>
      <div style={{display:"flex",gap:6}}>
        {tb("\u25C0", () => onMove(-1))}
        {tb("\u25BC", onDrop)}
        {tb("\u21BB", onRotate)}
        {tb("\u25B6", () => onMove(1))}
      </div>
      <div style={{display:"flex",gap:6}}>
        {tb("HOLD", onHold)}
        {tb("\u2B07 DROP", onHardDrop, "2 1 0")}
      </div>
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

function CtrlBtn({label, onClick, wide}) {
  return (
    <button onClick={onClick} style={{
      fontFamily:"'Orbitron'",fontSize:wide?9:13,fontWeight:700,
      width:wide?78:34,height:30,border:"1px solid #1a1a2e",borderRadius:5,
      background:"#0a0a16",color:"#444",cursor:"pointer",
      display:"flex",alignItems:"center",justifyContent:"center",letterSpacing:wide?1:0,
    }}>{label}</button>
  );
}

/* ==================== MAIN ==================== */
export default function Tetris() {
  const [screen, setScreen] = useState("menu");
  const [challenge, setChallenge] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [config, setConfig] = useState(null);
  const [result, setResult] = useState(null);
  const [gameKey, setGameKey] = useState(0);

  const handleStart = useCallback((ch, diff, cfg) => {
    setChallenge(ch); setDifficulty(diff); setConfig(cfg);
    setGameKey(k => k+1); setScreen("game");
  }, []);

  const handleResult = useCallback((won, score, lines, level, elapsed, maxCombo, totalB2b) => {
    setResult({won, score, lines, level, elapsed, combo: maxCombo||0, b2b: totalB2b||0});
    setScreen("result");
  }, []);

  const handleRetry = useCallback(() => { setGameKey(k => k+1); setScreen("game"); }, []);

  if (screen === "menu") return <MenuScreen onStart={handleStart} />;
  if (screen === "result") return (
    <ResultScreen won={result.won} score={result.score} lines={result.lines}
      level={result.level} elapsed={result.elapsed} combo={result.combo} b2b={result.b2b}
      challenge={challenge} difficulty={difficulty}
      onMenu={() => setScreen("menu")} onRetry={handleRetry} />
  );
  return (
    <GameScreen key={gameKey} challenge={challenge} difficulty={difficulty} config={config}
      onResult={handleResult} onMenu={() => setScreen("menu")} />
  );
}
