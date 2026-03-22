const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  if (req.url === '/health') {
    const roomInfo = {};
    for (const [code, room] of rooms) {
      roomInfo[code] = { players: (room.host ? 1 : 0) + (room.guest ? 1 : 0) };
    }
    res.end(JSON.stringify({ status: 'ok', rooms: roomInfo }));
    return;
  }
  if (req.url === '/rooms') {
    const list = [];
    for (const [code, room] of rooms) {
      const players = (room.host ? 1 : 0) + (room.guest ? 1 : 0);
      list.push({ code, players, open: players < 2 });
    }
    res.end(JSON.stringify(list));
    return;
  }
  res.end(JSON.stringify({ service: 'Tetris Multiplayer Relay' }));
});

const wss = new WebSocketServer({ server });
const rooms = new Map();

// Pre-generate public rooms
const PUBLIC_ROOMS = ['1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999'];
for (const code of PUBLIC_ROOMS) {
  rooms.set(code, { host: null, guest: null, isPublic: true });
}

function sendTo(ws, msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'create': {
        const code = msg.room;
        if (rooms.has(code) && !rooms.get(code).isPublic) {
          sendTo(ws, { type: 'error', message: 'Room already exists' });
          return;
        }
        if (!rooms.has(code)) {
          rooms.set(code, { host: null, guest: null, isPublic: false });
        }
        const room = rooms.get(code);
        room.host = ws;
        ws._room = code;
        ws._role = 'host';
        sendTo(ws, { type: 'created', room: code });
        console.log(`Room ${code}: host joined`);
        break;
      }

      case 'join': {
        const code = msg.room;
        let room = rooms.get(code);
        if (!room) {
          sendTo(ws, { type: 'error', message: 'Room not found' });
          return;
        }

        // For public rooms, assign as host or guest depending on what's available
        if (!room.host) {
          room.host = ws;
          ws._room = code;
          ws._role = 'host';
          sendTo(ws, { type: 'joined', room: code, role: 'host', waiting: true });
          console.log(`Room ${code}: player joined as host (waiting)`);
        } else if (!room.guest) {
          room.guest = ws;
          ws._room = code;
          ws._role = 'guest';
          sendTo(ws, { type: 'joined', room: code, role: 'guest', waiting: false });
          sendTo(room.host, { type: 'opponent_joined' });
          console.log(`Room ${code}: player joined as guest (matched!)`);
        } else {
          sendTo(ws, { type: 'error', message: 'Room is full' });
        }
        break;
      }

      case 'relay': {
        const room = rooms.get(ws._room);
        if (!room) return;
        const target = ws._role === 'host' ? room.guest : room.host;
        sendTo(target, { type: 'relay', data: msg.data });
        break;
      }
    }
  });

  ws.on('close', () => {
    if (!ws._room) return;
    const room = rooms.get(ws._room);
    if (!room) return;

    // Notify other player
    const other = ws._role === 'host' ? room.guest : room.host;
    sendTo(other, { type: 'opponent_disconnected' });

    // Clean up the slot
    if (ws._role === 'host') room.host = null;
    else room.guest = null;

    // Delete non-public rooms when empty
    if (!room.host && !room.guest && !room.isPublic) {
      rooms.delete(ws._room);
    }

    console.log(`Room ${ws._room}: ${ws._role} left`);
  });
});

// Heartbeat
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`Tetris relay server running on port ${PORT}`);
  console.log(`Public rooms: ${PUBLIC_ROOMS.join(', ')}`);
});
