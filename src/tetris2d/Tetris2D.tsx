// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";

const COLS = 10;
const ROWS = 20;
const CELL = 28;
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
      `}</style>
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
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 24px"}}>
          <StatPill label="TIME" value={cfg.timeLimit>0?formatTime(cfg.timeLimit):"Endless"} color="#00f0f0" />
          <StatPill label="START LVL" value={cfg.startLevel} color="#f0a000" />
          {target && <StatPill label="TARGET" value={ch.goal==="score"?target.toLocaleString()+" pts":target+" lines"} color="#a000f0" />}
          {ch.goal==="survive" && <StatPill label="LVL UP" value={`Every ${cfg.levelUpEvery}s`} color="#a000f0" />}
          {cfg.garbageRows>0 && <StatPill label="GARBAGE" value={cfg.garbageRows+" rows"} color="#f04040" />}
          {cfg.garbageRows===0 && !target && ch.goal!=="survive" && <StatPill label="GARBAGE" value="None" color="#333" />}
        </div>
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
  }, []);

  // Countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => {
      if (countdown === 1) { setCountdown(0); setStarted(true); }
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
    setCurrent({shape:p.shape, color:p.color, key:first});
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
      setTimeout(() => onResult(true, score, lines, level, elapsed, maxComboRef.current, totalB2bRef.current), 500);
    }
    if (challenge.goal === "score" && target && score >= target) {
      setResultSent(true);
      setTimeout(() => onResult(true, score, lines, level, elapsed, maxComboRef.current, totalB2bRef.current), 500);
    }
  }, [score, lines, started, gameOver, challenge, target, level, elapsed, onResult]);

  const spawnNext = useCallback(() => {
    clearLockTimer();
    lockMovesRef.current = 0;
    const key = dequeue();
    setPreviewKeys(peek());
    const p = PIECES[key];
    const sc = Math.floor((COLS - p.shape[0].length) / 2);
    if (collides(boardRef.current, p.shape, 0, sc)) {
      setGameOver(true);
      if (!resultSentRef.current) {
        setResultSent(true);
        const won = challenge.goal === "none";
        setTimeout(() => onResult(won, scoreRef.current, linesRef.current, levelRef.current, elapsedRef.current, maxComboRef.current, totalB2bRef.current), 600);
      }
      return;
    }
    setCurrent({shape:p.shape, color:p.color, key});
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

      setTimeout(() => {
        setFlashRows([]);
        setBoard(nb);
        setScore(s => s + pts);
        setLines(l => {
          const nl = l + cleared;
          if (challenge.goal !== "survive") setLevel(Math.max(config.startLevel, Math.min(Math.floor(nl/10), DROP_SPEEDS.length-1)));
          return nl;
        });
        spawnNext();
      }, 220);
      setBoard(b);
    } else {
      setCombo(0);
      setLastWasTetris(false);
      setBoard(nb);
      spawnNext();
    }
  }, [spawnNext, config.startLevel, challenge.goal, addLabel, clearLockTimer]);

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
    const id = setInterval(drop, DROP_SPEEDS[Math.min(level, DROP_SPEEDS.length-1)]);
    return () => clearInterval(id);
  }, [started, gameOver, paused, level, drop]);

  const hardDrop = useCallback(() => {
    if (!currentRef.current || pausedRef.current) return;
    clearLockTimer();
    const c = currentRef.current, p = posRef.current;
    let nr = p.r;
    while (!collides(boardRef.current, c.shape, nr+1, p.c)) nr++;
    setScore(s => s + (nr - p.r) * 2);
    setPos({r:nr, c:p.c});
    setTimeout(() => doLock(), 0);
  }, [doLock, clearLockTimer]);

  const move = useCallback((dc) => {
    if (!currentRef.current || pausedRef.current) return;
    if (!collides(boardRef.current, currentRef.current.shape, posRef.current.r, posRef.current.c + dc)) {
      setPos(prev => ({...prev, c: prev.c + dc}));
      touchLock();
    }
  }, [touchLock]);

  const rotatePiece = useCallback(() => {
    if (!currentRef.current || pausedRef.current) return;
    const c = currentRef.current, p = posRef.current;
    const rotated = rotate(c.shape);
    for (const kick of [0,-1,1,-2,2]) {
      if (!collides(boardRef.current, rotated, p.r, p.c+kick)) {
        setCurrent({...c, shape:rotated});
        setPos(prev => ({...prev, c: prev.c+kick}));
        touchLock();
        return;
      }
    }
  }, [touchLock]);

  const holdPiece = useCallback(() => {
    if (!currentRef.current || pausedRef.current || holdUsedRef.current) return;
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
  }, [holdKey, spawnNext, clearLockTimer]);

  // DAS
  const stopDas = useCallback(() => {
    if (dasTimer.current) { clearTimeout(dasTimer.current); dasTimer.current = null; }
    if (dasRepeat.current) { clearInterval(dasRepeat.current); dasRepeat.current = null; }
    dasDir.current = null;
  }, []);

  const startDas = useCallback((dir) => {
    stopDas();
    dasDir.current = dir;
    move(dir);
    dasTimer.current = setTimeout(() => {
      dasRepeat.current = setInterval(() => move(dir), DAS_RATE);
    }, DAS_DELAY);
  }, [move, stopDas]);

  // Keyboard
  useEffect(() => {
    const down = (e) => {
      if (!started || gameOver) return;
      if (e.key === "p" || e.key === "Escape") { setPaused(v => !v); return; }
      if (paused) return;
      if (e.repeat) return;
      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); startDas(-1); break;
        case "ArrowRight": e.preventDefault(); startDas(1); break;
        case "ArrowDown": e.preventDefault(); drop(); break;
        case "ArrowUp": e.preventDefault(); rotatePiece(); break;
        case " ": e.preventDefault(); hardDrop(); break;
        case "c": case "C": case "Shift": e.preventDefault(); holdPiece(); break;
      }
    };
    const up = (e) => {
      if (e.key === "ArrowLeft" && dasDir.current === -1) stopDas();
      if (e.key === "ArrowRight" && dasDir.current === 1) stopDas();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); stopDas(); };
  }, [started, gameOver, paused, startDas, stopDas, drop, rotatePiece, hardDrop, holdPiece]);

  // Soft drop hold
  useEffect(() => {
    if (!started || gameOver || paused) return;
    let pressing = false, iv = null;
    const down = (e) => { if (e.key === "ArrowDown" && !pressing) { pressing = true; iv = setInterval(() => drop(), DAS_RATE); } };
    const up = (e) => { if (e.key === "ArrowDown") { pressing = false; if (iv) { clearInterval(iv); iv = null; } } };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); if (iv) clearInterval(iv); };
  }, [started, gameOver, paused, drop]);

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

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      background:"linear-gradient(160deg,#0a0a12,#0d0d1a 50%,#0a0a12)",fontFamily:"'JetBrains Mono','Fira Code',monospace",
      color:"#e0e0e0",userSelect:"none",overflow:"hidden",padding:"12px 8px"}}
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
        .menu-btn:hover{color:#888!important;border-color:#333!important}
      `}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8,
        width:COLS*(CELL+1)+270,maxWidth:"98vw",justifyContent:"space-between"}}>
        <button className="menu-btn" onClick={onMenu} style={{fontFamily:"'Orbitron'",fontSize:9,fontWeight:700,letterSpacing:2,
          padding:"4px 10px",border:"1px solid #1a1a2e",borderRadius:4,background:"transparent",color:"#333",cursor:"pointer",transition:"all 0.15s"}}>← MENU</button>
        <div style={{fontFamily:"'Orbitron'",fontSize:10,color:"#444",letterSpacing:2,textAlign:"center"}}>
          {challenge.icon} {challenge.name}{" "}
          <span style={{color:DIFF_COLORS[difficulty],fontSize:9}}>{difficulty.toUpperCase()}</span>
        </div>
        {config.timeLimit > 0 ? (
          <div style={{fontFamily:"'Orbitron'",fontSize:18,fontWeight:900,color:timerColor,
            textShadow:`0 0 12px ${timerColor}55`,animation:timerUrgent?"urgentPulse 0.5s ease-in-out infinite":"none",
            minWidth:56,textAlign:"right"}}>{formatTime(timeLeft)}</div>
        ) : (
          <div style={{fontFamily:"'Orbitron'",fontSize:14,fontWeight:700,color:"#282828",minWidth:56,textAlign:"right"}}>{formatTime(elapsed)}</div>
        )}
      </div>

      {/* Progress */}
      {challenge.goal !== "none" && (
        <div style={{width:COLS*(CELL+1)+270,maxWidth:"98vw",height:3,background:"#0e0e18",borderRadius:2,marginBottom:8}}>
          <div style={{height:"100%",borderRadius:2,transition:"width 0.35s ease-out",width:`${progress*100}%`,
            background:progress>0.85?"linear-gradient(90deg,#00f0f0,#00f040)":"#00f0f0",
            boxShadow:`0 0 8px ${progress>0.85?"#00f040":"#00f0f0"}44`}} />
        </div>
      )}

      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>

        {/* Left: Hold + Stats */}
        <div style={{display:"flex",flexDirection:"column",gap:12,minWidth:80}}>
          <SidePanel title="HOLD" highlight={!holdUsed && !!holdKey}>
            <div style={{display:"flex",justifyContent:"center",padding:"6px 0",minHeight:36}}>
              {holdPieceData
                ? <MiniGrid shape={holdPieceData.shape} color={holdPieceData.color} size={13} dimmed={holdUsed} />
                : <div style={{fontFamily:"'Orbitron'",fontSize:8,color:"#222",letterSpacing:1}}>C / SHIFT</div>}
            </div>
          </SidePanel>
          <SidePanel title="SCORE">
            <div style={{fontFamily:"'Orbitron'",fontSize:14,fontWeight:700,color:"#00f0f0",textAlign:"center",
              textShadow:"0 0 10px #00f0f033"}}>{score.toLocaleString()}</div>
          </SidePanel>
          <SidePanel title="LINES">
            <div style={{fontFamily:"'Orbitron'",fontSize:12,fontWeight:700,color:"#a0a0ff",textAlign:"center"}}>
              {target && challenge.goal === "lines" ? `${lines}/${target}` : lines}
            </div>
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
        </div>

        {/* Board */}
        <div style={{
          position:"relative",border:"2px solid #3a4060",borderRadius:8,
          background:"linear-gradient(180deg, #10121e, #0c0e18)",boxShadow:"0 0 40px rgba(0,200,255,0.06),inset 0 0 60px #00000055, 0 8px 32px rgba(0,0,0,0.5)",padding:2,
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
              <div key={countdown} style={{fontFamily:"'Orbitron'",fontSize:72,fontWeight:900,color:"#00f0f0",
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

        {/* Right: Next + Controls */}
        <div style={{display:"flex",flexDirection:"column",gap:12,minWidth:80}}>
          <SidePanel title="NEXT">
            <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center",padding:"4px 0"}}>
              {previewKeys.map((k, i) => {
                const p = PIECES[k];
                return <MiniGrid key={`${k}-${i}`} shape={p.shape} color={p.color} size={i===0?14:11} dimmed={i>0} />;
              })}
              {previewKeys.length === 0 && <div style={{height:80}} />}
            </div>
          </SidePanel>

          <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:4}}>
            <div style={{display:"flex",justifyContent:"center"}}><CtrlBtn label="▲" onClick={rotatePiece} /></div>
            <div style={{display:"flex",gap:5,justifyContent:"center"}}>
              <CtrlBtn label="◀" onClick={() => move(-1)} />
              <CtrlBtn label="▼" onClick={drop} />
              <CtrlBtn label="▶" onClick={() => move(1)} />
            </div>
            <div style={{display:"flex",gap:5,justifyContent:"center",marginTop:2}}>
              <CtrlBtn label="HOLD" onClick={holdPiece} wide />
            </div>
            <div style={{display:"flex",justifyContent:"center",marginTop:2}}>
              <CtrlBtn label="DROP" onClick={hardDrop} wide />
            </div>
          </div>
        </div>
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
