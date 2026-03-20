// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react';
import { PeerManager } from './PeerManager.js';

interface MultiplayerLobbyProps {
  peerManager: PeerManager;
  initialRoomCode?: string;
  onGameStart: () => void;
  onBack: () => void;
}

export default function MultiplayerLobby({ peerManager, initialRoomCode, onGameStart, onBack }: MultiplayerLobbyProps) {
  const [alias, setAlias] = useState(() => peerManager.generateAlias());
  const [mode, setMode] = useState<'choose' | 'creating' | 'joining' | 'waiting' | 'connected'>(
    initialRoomCode ? 'joining' : 'choose'
  );
  const [roomCode, setRoomCode] = useState(initialRoomCode ?? '');
  const [displayCode, setDisplayCode] = useState('');
  const [error, setError] = useState('');
  const [opponentAlias, setOpponentAlias] = useState('');
  const [myReady, setMyReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const joinInputRef = useRef<HTMLInputElement>(null);

  // Auto-join if initialRoomCode provided
  useEffect(() => {
    if (initialRoomCode) {
      handleJoin(initialRoomCode);
    }
  }, []);

  // Set up peer manager callbacks
  useEffect(() => {
    peerManager.onConnected = () => {
      setMode('connected');
      setOpponentAlias(peerManager.opponentAlias);
    };

    peerManager.onDisconnected = () => {
      setMode('choose');
      setError('Opponent disconnected');
      setMyReady(false);
      setOpponentReady(false);
    };

    peerManager.onMessage = (msg) => {
      if (msg.type === 'alias') {
        setOpponentAlias(msg.name);
      }
      if (msg.type === 'ready') {
        setOpponentReady(true);
      }
      if (msg.type === 'start') {
        onGameStart();
      }
    };

    return () => {
      peerManager.onConnected = null;
      peerManager.onDisconnected = null;
      peerManager.onMessage = null;
    };
  }, [peerManager, onGameStart]);

  // When both ready, host sends start
  useEffect(() => {
    if (myReady && opponentReady && peerManager.isHost) {
      peerManager.send({ type: 'start' });
      onGameStart();
    }
  }, [myReady, opponentReady, peerManager, onGameStart]);

  const handleCreate = useCallback(async () => {
    setError('');
    setMode('creating');
    try {
      const code = await peerManager.createRoom(alias);
      setDisplayCode(code);
      setMode('waiting');
    } catch (err) {
      setError(`Failed to create room: ${err}`);
      setMode('choose');
    }
  }, [alias, peerManager]);

  const handleJoin = useCallback(async (codeOverride?: string) => {
    const code = (codeOverride ?? roomCode).trim().toUpperCase();
    if (!code || code.length < 4) {
      setError('Enter a valid room code');
      return;
    }
    setError('');
    setMode('joining');
    try {
      await peerManager.joinRoom(code.toUpperCase(), alias);
      setDisplayCode(code.toUpperCase());
    } catch (err) {
      setError(`Failed to join room: ${err}`);
      setMode('choose');
    }
  }, [roomCode, alias, peerManager]);

  const handleCopy = useCallback(() => {
    const link = `${window.location.origin}${window.location.pathname}?room=${displayCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback: select the invite link text for manual copy
      try {
        const ta = document.createElement('textarea');
        ta.value = link;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError('Failed to copy link — please copy it manually');
      }
    });
  }, [displayCode]);

  const handleReady = useCallback(() => {
    setMyReady(true);
    peerManager.send({ type: 'ready' });
  }, [peerManager]);

  const handleBack = useCallback(() => {
    peerManager.disconnect();
    onBack();
  }, [peerManager, onBack]);

  const inviteLink = displayCode ? `${window.location.origin}${window.location.pathname}?room=${displayCode}` : '';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0a0a12, #0d0d1a 50%, #0a0a12)',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: '#e0e0e0', userSelect: 'none', padding: '24px 12px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes glowPulse{0%,100%{text-shadow:0 0 20px #667eeaaa,0 0 40px #667eea66}50%{text-shadow:0 0 30px #667eeadd,0 0 60px #667eea88}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dotPulse{0%,80%,100%{opacity:0}40%{opacity:1}}
        .mp-btn:hover{background:#667eea20!important;border-color:#667eea!important;color:#e0e0ff!important}
        .mp-btn-secondary:hover{border-color:#444!important;color:#888!important}
        .mp-input:focus{border-color:#667eea!important;box-shadow:0 0 15px #667eea33!important;outline:none}
      `}</style>

      {/* Title */}
      <div style={{
        fontFamily: "'Orbitron'", fontSize: 28, fontWeight: 900, letterSpacing: 8,
        color: '#667eea', marginBottom: 4,
        textShadow: '0 0 20px #667eea88, 0 0 40px #667eea44',
        animation: 'glowPulse 3s ease-in-out infinite',
      }}>
        MULTIPLAYER
      </div>
      <div style={{
        fontFamily: "'Orbitron'", fontSize: 10, letterSpacing: 4, color: '#333', marginBottom: 32,
      }}>
        PEER-TO-PEER
      </div>

      {/* Back button */}
      <button className="mp-btn-secondary" onClick={handleBack} style={{
        position: 'absolute', top: 20, left: 20,
        fontFamily: "'Orbitron'", fontSize: 9, fontWeight: 700, letterSpacing: 2,
        padding: '6px 12px', border: '1px solid #1a1a2e', borderRadius: 4,
        background: 'transparent', color: '#333', cursor: 'pointer', transition: 'all 0.2s',
      }}>
        {'<'} BACK
      </button>

      {/* Main content area */}
      <div style={{
        background: '#0a0a16', border: '1px solid #1a1a2e', borderRadius: 12,
        padding: '28px 32px', maxWidth: 440, width: '92%',
        animation: 'fadeIn 0.3s ease-out',
      }}>

        {/* Alias input - always visible unless in game */}
        {(mode === 'choose' || mode === 'waiting' || mode === 'connected') && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: "'Orbitron'", fontSize: 9, letterSpacing: 3, color: '#444', marginBottom: 8,
            }}>
              YOUR ALIAS
            </div>
            <input
              className="mp-input"
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value.slice(0, 16))}
              disabled={mode !== 'choose'}
              style={{
                width: '100%', padding: '10px 14px',
                background: 'rgba(20, 20, 40, 0.8)',
                border: '1px solid #2a2a4e', borderRadius: 6,
                color: '#e0e0ff', fontFamily: 'inherit', fontSize: 14,
                textAlign: 'center', letterSpacing: 2,
                transition: 'all 0.2s',
                opacity: mode !== 'choose' ? 0.5 : 1,
              }}
            />
          </div>
        )}

        {/* Choose mode */}
        {mode === 'choose' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <button className="mp-btn" onClick={handleCreate} style={{
              width: '100%', padding: '14px',
              fontFamily: "'Orbitron'", fontSize: 14, fontWeight: 700, letterSpacing: 3,
              border: '2px solid #667eea', borderRadius: 8,
              background: '#667eea12', color: '#667eea', cursor: 'pointer',
              transition: 'all 0.2s', marginBottom: 12,
            }}>
              CREATE ROOM
            </button>

            <div style={{
              fontFamily: "'Orbitron'", fontSize: 9, letterSpacing: 3, color: '#333',
              textAlign: 'center', marginBottom: 12,
            }}>
              OR
            </div>

            <div style={{
              fontFamily: "'Orbitron'", fontSize: 9, letterSpacing: 3, color: '#444', marginBottom: 8,
            }}>
              JOIN ROOM
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={joinInputRef}
                className="mp-input"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ROOM CODE"
                style={{
                  flex: 1, padding: '10px 14px',
                  background: 'rgba(20, 20, 40, 0.8)',
                  border: '1px solid #2a2a4e', borderRadius: 6,
                  color: '#e0e0ff', fontFamily: "'Orbitron'", fontSize: 16, fontWeight: 700,
                  textAlign: 'center', letterSpacing: 4,
                  transition: 'all 0.2s',
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
              />
              <button className="mp-btn" onClick={() => handleJoin()} style={{
                padding: '10px 20px',
                fontFamily: "'Orbitron'", fontSize: 11, fontWeight: 700, letterSpacing: 2,
                border: '2px solid #667eea', borderRadius: 6,
                background: '#667eea12', color: '#667eea', cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
                JOIN
              </button>
            </div>
          </div>
        )}

        {/* Creating / Joining loading */}
        {(mode === 'creating' || mode === 'joining') && (
          <div style={{ textAlign: 'center', padding: '20px 0', animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{
              fontFamily: "'Orbitron'", fontSize: 12, color: '#667eea', letterSpacing: 2,
            }}>
              {mode === 'creating' ? 'CREATING ROOM' : 'JOINING ROOM'}
              <span style={{ animation: 'dotPulse 1.4s infinite 0s' }}>.</span>
              <span style={{ animation: 'dotPulse 1.4s infinite 0.2s' }}>.</span>
              <span style={{ animation: 'dotPulse 1.4s infinite 0.4s' }}>.</span>
            </div>
          </div>
        )}

        {/* Waiting for opponent */}
        {mode === 'waiting' && (
          <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{
              fontFamily: "'Orbitron'", fontSize: 9, letterSpacing: 3, color: '#444', marginBottom: 12,
            }}>
              ROOM CODE
            </div>
            <div style={{
              fontFamily: "'Orbitron'", fontSize: 36, fontWeight: 900, letterSpacing: 8,
              color: '#667eea', marginBottom: 16,
              textShadow: '0 0 20px #667eea44',
            }}>
              {displayCode}
            </div>

            <div style={{
              fontFamily: "'Orbitron'", fontSize: 10, color: '#444', letterSpacing: 2, marginBottom: 16,
            }}>
              WAITING FOR OPPONENT
              <span style={{ animation: 'dotPulse 1.4s infinite 0s' }}>.</span>
              <span style={{ animation: 'dotPulse 1.4s infinite 0.2s' }}>.</span>
              <span style={{ animation: 'dotPulse 1.4s infinite 0.4s' }}>.</span>
            </div>

            {/* Invite link */}
            <div style={{
              background: 'rgba(20, 20, 40, 0.6)', border: '1px solid #1a1a2e', borderRadius: 6,
              padding: '10px 12px', marginBottom: 12,
            }}>
              <div style={{
                fontFamily: "'Orbitron'", fontSize: 8, letterSpacing: 2, color: '#333', marginBottom: 6,
              }}>
                INVITE LINK
              </div>
              <div style={{
                fontSize: 10, color: '#555', wordBreak: 'break-all', lineHeight: 1.5, marginBottom: 8,
              }}>
                {inviteLink}
              </div>
              <button className="mp-btn" onClick={handleCopy} style={{
                padding: '6px 16px',
                fontFamily: "'Orbitron'", fontSize: 9, fontWeight: 700, letterSpacing: 2,
                border: '1px solid #667eea55', borderRadius: 4,
                background: copied ? '#667eea22' : 'transparent',
                color: copied ? '#00f040' : '#667eea', cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
                {copied ? 'COPIED!' : 'COPY LINK'}
              </button>
            </div>
          </div>
        )}

        {/* Connected - ready up */}
        {mode === 'connected' && (
          <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{
              fontFamily: "'Orbitron'", fontSize: 9, letterSpacing: 3, color: '#444', marginBottom: 8,
            }}>
              OPPONENT CONNECTED
            </div>
            <div style={{
              fontFamily: "'Orbitron'", fontSize: 20, fontWeight: 700, letterSpacing: 4,
              color: '#00f040', marginBottom: 4,
              textShadow: '0 0 12px #00f04044',
            }}>
              {opponentAlias || peerManager.opponentAlias || 'Opponent'}
            </div>
            <div style={{
              fontFamily: "'Orbitron'", fontSize: 9, letterSpacing: 2,
              color: '#333', marginBottom: 24,
            }}>
              ROOM {displayCode}
            </div>

            {/* Ready status */}
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 20,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: "'Orbitron'", fontSize: 8, letterSpacing: 2, color: '#444', marginBottom: 4,
                }}>YOU</div>
                <div style={{
                  fontFamily: "'Orbitron'", fontSize: 12, fontWeight: 700,
                  color: myReady ? '#00f040' : '#444',
                  textShadow: myReady ? '0 0 8px #00f04044' : 'none',
                }}>
                  {myReady ? 'READY' : 'NOT READY'}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: "'Orbitron'", fontSize: 8, letterSpacing: 2, color: '#444', marginBottom: 4,
                }}>OPPONENT</div>
                <div style={{
                  fontFamily: "'Orbitron'", fontSize: 12, fontWeight: 700,
                  color: opponentReady ? '#00f040' : '#444',
                  textShadow: opponentReady ? '0 0 8px #00f04044' : 'none',
                }}>
                  {opponentReady ? 'READY' : 'WAITING'}
                </div>
              </div>
            </div>

            {!myReady && (
              <button className="mp-btn" onClick={handleReady} style={{
                width: '100%', padding: '14px',
                fontFamily: "'Orbitron'", fontSize: 16, fontWeight: 900, letterSpacing: 5,
                border: '2px solid #00f040', borderRadius: 8,
                background: '#00f04012', color: '#00f040', cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 0 20px #00f04018',
              }}>
                READY
              </button>
            )}

            {myReady && !opponentReady && (
              <div style={{
                fontFamily: "'Orbitron'", fontSize: 10, color: '#444', letterSpacing: 2,
              }}>
                WAITING FOR OPPONENT
                <span style={{ animation: 'dotPulse 1.4s infinite 0s' }}>.</span>
                <span style={{ animation: 'dotPulse 1.4s infinite 0.2s' }}>.</span>
                <span style={{ animation: 'dotPulse 1.4s infinite 0.4s' }}>.</span>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            marginTop: 16, padding: '10px 14px',
            background: '#f0404012', border: '1px solid #f0404033', borderRadius: 6,
            fontFamily: "'Orbitron'", fontSize: 10, color: '#f04040', textAlign: 'center',
            letterSpacing: 1,
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
