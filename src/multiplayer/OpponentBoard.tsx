// @ts-nocheck
import { useMemo } from 'react';

const COLS = 10;
const ROWS = 20;

export default function OpponentBoard({ board, alias, score, lines, level, compact = false }) {
  const cellSize = compact ? 8 : 10;
  const gap = 1;

  const boardWidth = COLS * (cellSize + gap);
  const boardHeight = ROWS * (cellSize + gap);

  const cells = useMemo(() => {
    if (!board) return null;
    return board.flat().map((cell, i) => {
      const isGhost = cell && cell.length > 7;
      const baseColor = isGhost ? cell?.slice(0, 7) : cell;
      return (
        <div key={i} style={{
          width: cellSize, height: cellSize,
          borderRadius: cell ? 3 : 1,
          background: cell && !isGhost
            ? `linear-gradient(145deg, ${baseColor}dd, ${baseColor}88)`
            : cell && isGhost
              ? `${baseColor}20`
              : '#12142200',
          boxShadow: cell && !isGhost
            ? `0 0 3px ${baseColor}44`
            : 'none',
        }} />
      );
    });
  }, [board, cellSize]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      {/* Alias */}
      <div style={{
        fontFamily: "'Orbitron'", fontSize: compact ? 9 : 11, fontWeight: 700,
        letterSpacing: 2, color: '#667eea',
        textShadow: '0 0 8px #667eea44',
        textAlign: 'center', maxWidth: boardWidth, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {alias || 'Opponent'}
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: compact ? 8 : 12, justifyContent: 'center',
        fontFamily: "'Orbitron'", fontSize: compact ? 8 : 9, letterSpacing: 1,
      }}>
        <div>
          <span style={{ color: '#444' }}>SCR </span>
          <span style={{ color: '#00f0f0', fontWeight: 700 }}>{(score ?? 0).toLocaleString()}</span>
        </div>
        <div>
          <span style={{ color: '#444' }}>LNS </span>
          <span style={{ color: '#a0a0ff', fontWeight: 700 }}>{lines ?? 0}</span>
        </div>
        <div>
          <span style={{ color: '#444' }}>LVL </span>
          <span style={{ color: '#f0a000', fontWeight: 700 }}>{level ?? 0}</span>
        </div>
      </div>

      {/* Mini board */}
      <div style={{
        border: '1px solid #2a2a4e', borderRadius: 6,
        background: 'linear-gradient(180deg, #10121e, #0c0e18)',
        boxShadow: '0 0 20px rgba(0,200,255,0.04), inset 0 0 30px #00000044',
        padding: 2,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${cellSize}px)`,
          gap: gap,
          backgroundImage: `linear-gradient(rgba(80,100,160,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(80,100,160,0.08) 1px, transparent 1px)`,
          backgroundSize: `${cellSize + gap}px ${cellSize + gap}px`,
        }}>
          {cells ?? Array.from({ length: COLS * ROWS }, (_, i) => (
            <div key={i} style={{ width: cellSize, height: cellSize, borderRadius: 1, background: '#12142200' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
