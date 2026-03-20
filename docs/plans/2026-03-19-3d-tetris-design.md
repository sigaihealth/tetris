# 3D Tetris — Design Document

## Overview

A true 3D Tetris game running in the browser. Pieces are 3D polycubes that fall into a volumetric well. Players fill horizontal planes to clear them. Rendered with translucent glass-style blocks, procedural audio, and full-featured UI.

**Tech stack:** Three.js + Vite + TypeScript + Web Audio API

## Architecture

```
src/
  main.ts              — entry point, initializes everything
  game/
    GameState.ts       — core game logic, tick loop, scoring
    Well.ts            — 3D grid (NxNxH), collision detection, plane clearing
    Piece.ts           — polycube definitions, rotation on all 3 axes
    PieceGenerator.ts  — bag randomizer for fair piece distribution
    Input.ts           — keyboard handler, key bindings, DAS support
  renderer/
    SceneManager.ts    — Three.js scene, camera, lights, render loop
    BlockMesh.ts       — glass/translucent block creation & materials
    GhostPiece.ts      — transparent shadow showing landing position
    Effects.ts         — particle effects for plane clears, bloom post-processing
    CameraController.ts — keyboard-driven orbit camera around well
  audio/
    AudioEngine.ts     — Web Audio API synth for all sounds
    SoundEffects.ts    — move, rotate, drop, clear, level-up, game-over sounds
    MusicGenerator.ts  — procedural ambient/electronic background music
  ui/
    HUD.ts             — score, level, next piece preview (HTML overlay)
    MenuScreen.ts      — start screen, settings (well size), pause, game over
    Leaderboard.ts     — local storage high scores
```

**Key principle:** Game logic is completely decoupled from rendering. `GameState` works on a pure 3D grid of numbers — the renderer reads that grid and creates/updates meshes.

## The 3D Well

- Configurable NxNxH grid:
  - Small: 4x4x10
  - Medium: 5x5x12
  - Large: 6x6x15
- Stored as a 3D array — each cell is empty or holds a color/piece-type ID
- When an entire horizontal plane (NxN) is filled, it clears — blocks above drop down
- Multi-plane clears score more points
- The well is rendered as a subtle wireframe or translucent box

## 3D Polycubes (Tetracubes)

8 distinct shapes made of 4 unit cubes:
- **I** — straight line
- **O** — 2x2 square
- **T** — T-shape
- **S / Z** — skew pieces
- **L / J** — L-shapes
- **Tower** — L-shape with a cube going up (the unique 3D piece)

All pieces rotate on all 3 axes (X, Y, Z) in 90-degree increments. Rotations use a rotation matrix on cube positions, snapped to grid. Wall kick system: try rotation, if collision try shifting in each direction, deny if nothing works.

**Piece preview:** Next 3 upcoming pieces rendered in 3D beside the well.

**Ghost piece:** Faint wireframe at the landing position.

## Rendering & Visual Style

**Glass/translucent blocks:**
- `MeshPhysicalMaterial` with `transmission: 0.85`, `roughness: 0.1`, `thickness: 0.5`
- Each piece type gets a distinct hue (tinted glass — blue, green, pink, amber, etc.)
- Subtle `ior` (index of refraction) for realistic light bending
- Environment map for reflections — procedural gradient skybox

**Lighting:**
- Directional key light with soft shadows
- Ambient light for visibility through glass
- Optional point light inside the well for inner glow

**Post-processing (EffectComposer):**
- Bloom — glass edges glow softly
- SSAO — depth where blocks meet
- Tone mapping — cinematic feel

**Plane clear effects:**
- Blocks shatter into glass particle fragments that fade out
- Brief white flash on the cleared plane
- Subtle camera shake

**Camera:**
- ~45-degree angle looking down into the well
- Keyboard-controlled orbit (Q/E)
- Smooth interpolated transitions

**Background:** Dark gradient or subtle starfield.

## Controls

### Piece Movement
| Key | Action |
|-----|--------|
| W / Up | Move forward (-Z) |
| S / Down | Move backward (+Z) |
| A / Left | Move left (-X) |
| D / Right | Move right (+X) |
| Space | Hard drop |
| Shift | Soft drop (accelerate) |

### Piece Rotation
| Key | Action |
|-----|--------|
| I | Rotate X axis (forward tilt) |
| K | Rotate X axis (reverse) |
| J | Rotate Y axis (spin left) |
| L | Rotate Y axis (spin right) |
| U | Rotate Z axis (roll left) |
| O | Rotate Z axis (roll right) |

### Camera
| Key | Action |
|-----|--------|
| Q | Orbit camera left |
| E | Orbit camera right |

### System
| Key | Action |
|-----|--------|
| Escape | Pause / unpause |
| M | Mute audio |

Movement keys support DAS (Delayed Auto Shift).

## Scoring & Progression

**Scoring:**
- Single plane clear: 100 x level
- Double: 300 x level
- Triple: 500 x level
- Quad+: 800 x level
- Combo multiplier: consecutive clears multiply score (1.5x, 2x, 2.5x...)
- Hard drop bonus: 2 pts per cell
- Soft drop bonus: 1 pt per cell

**Levels:**
- Level up every 10 planes cleared
- Fall speed increases each level — gentle ramp 1-10, steeper after
- Max speed capped for playability

**Game over:**
- New piece spawns and immediately collides
- Slow-motion camera pull-back, all blocks shatter
- Final score screen with stats

**Leaderboard:**
- Top 10 scores in localStorage
- Name, score, level, well size
- Separate leaderboards per well size

## Audio

**Procedural SFX (Web Audio API):**
- Move: short click (filtered noise burst)
- Rotate: quick whoosh (frequency sweep)
- Soft drop: low thud per step
- Hard drop: punchy impact (oscillator + noise)
- Plane clear: crystalline chime (glass break + harmonic sweep), layered for multi-clears
- Combo: escalating pitch per consecutive clear
- Level up: ascending arpeggio
- Game over: descending tones with reverb

**Procedural Music:**
- Ambient generative soundtrack via Web Audio API
- Layered oscillators with LFO modulation, filtered pads, arpeggiated patterns
- Tempo/intensity increases with level
- Reverb and delay for spacious atmosphere
- Seamless looping with shifting patterns

**Volume:** M to mute, settings screen has separate music/SFX sliders.

## UI

All UI is HTML/CSS overlays on top of the Three.js canvas.

**Start screen:**
- Game title with glass-styled text
- "Press Enter to Start"
- Settings (well size, volume), Leaderboard, Controls reference
- Background: empty well slowly rotating

**HUD (in-game):**
- Top-left: Score, Level, Planes cleared
- Top-right: Next 3 pieces preview
- Semi-transparent dark panels
- Combo indicator flashes when active

**Pause screen:**
- Darkened overlay, Resume / Restart / Quit options
- Settings accessible

**Game over screen:**
- Stats: score, level, planes, time
- Name entry for high scores
- Restart / Menu buttons
- Frozen shattered well in background
