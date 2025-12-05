# PI-3-MINIPROJECT-BACK-CALL

Real-time voice call server for the video conference platform. Uses Socket.IO for WebRTC signaling and PeerJS for peer-to-peer audio connections.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           FRONTEND                              │
│                    ┌──────────────┐                             │
│                    │    React     │                             │
│                    │  + PeerJS    │                             │
│                    └──────┬───────┘                             │
│                           │                                     │
│              ┌────────────┴────────────┐                        │
│              │                         │                        │
│              ▼                         ▼                        │
│   ┌─────────────────────┐   ┌─────────────────────┐            │
│   │     BACK-CHAT       │   │     BACK-CALL       │            │
│   │    (Port 4000)      │   │    (Port 5000)      │            │
│   │                     │   │                     │            │
│   │  • Text chat        │   │  • WebRTC           │            │
│   │  • User list        │   │    signaling        │            │
│   │  • Meetings         │   │  • Mic states       │            │
│   └─────────────────────┘   └──────────┬──────────┘            │
│                                        │                        │
│                                        ▼                        │
│                              ┌─────────────────────┐            │
│                              │   WebRTC / PeerJS   │            │
│                              │     (P2P Audio)     │            │
│                              │                     │            │
│                              │  STUN (Google)      │            │
│                              └─────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
# Navigate to the project directory
cd PI-3-MINIPROJECT-BACK-CALL

# Install dependencies
npm install

# Copy environment variables
cp env.example .env

# Start in development mode
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server in development mode with hot-reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start server in production mode |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

## 📡 REST API

### Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Server health check |
| GET | `/api/call/health` | Call service health check |
| GET | `/api/call/stats` | Server statistics |
| GET | `/api/call/ice-servers` | ICE/STUN server configuration |
| GET | `/api/call/room/:meetingId` | Call room information |

### Response Examples

**GET /api/call/stats**
```json
{
  "success": true,
  "data": {
    "activeCalls": 5,
    "totalUsersInCalls": 23,
    "maxParticipantsPerCall": 10,
    "minParticipantsPerCall": 2
  }
}
```

**GET /api/call/ice-servers**
```json
{
  "success": true,
  "data": {
    "iceServers": [
      { "urls": "stun:stun.l.google.com:19302" },
      { "urls": "stun:stun1.l.google.com:19302" }
    ]
  }
}
```

## 🔌 Socket.IO Events

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `call:join` | `{ meetingId, userId, peerId, username }` | Join voice call |
| `call:leave` | `{ meetingId, userId }` | Leave voice call |
| `call:signal` | `{ meetingId, fromUserId, toUserId, fromPeerId, toPeerId, signal, signalType }` | WebRTC signaling |
| `call:mute` | `{ meetingId, userId }` | Mute microphone |
| `call:unmute` | `{ meetingId, userId }` | Unmute microphone |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `call:peers-list` | `{ meetingId, participants, count }` | List of peers on join |
| `call:peer-joined` | `{ userId, peerId, username, timestamp }` | New peer joined |
| `call:peer-left` | `{ userId, peerId, username, timestamp }` | Peer left |
| `call:mute-status` | `{ userId, username, isMuted, timestamp }` | Mic status change |
| `call:signal` | `{ ... }` | Forwarded WebRTC signal |
| `call:ice-servers` | `[{ urls: "stun:..." }]` | ICE servers on connect |
| `call:error` | `{ message, code }` | Error message |

## 🔄 Connection Flow

```
1. USER ENTERS MEETING
   ├── Connect Socket.IO to BACK-CALL
   ├── Emit "call:join" with meetingId, userId, peerId, username
   ├── Receive "call:peers-list" with existing participants
   └── Microphone starts MUTED

2. ESTABLISH P2P CONNECTIONS
   ├── For each peer in the list:
   │   ├── Create PeerJS connection
   │   ├── Exchange signals via "call:signal"
   │   └── Establish audio stream
   └── Listen for "call:peer-joined" for new peers

3. USER UNMUTES
   ├── Activate local audio stream
   ├── Emit "call:unmute"
   └── Audio flows to all peers

4. USER MUTES
   ├── Pause local audio stream
   ├── Emit "call:mute"
   └── P2P connections remain active

5. USER LEAVES
   ├── Emit "call:leave"
   ├── Close PeerJS connections
   └── Disconnect Socket.IO
```

## 🌐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `http://localhost:5173` |
| `MAX_PARTICIPANTS` | Maximum participants per call | `10` |
| `MIN_PARTICIPANTS` | Minimum participants per call | `2` |

## 🚀 Deploy on Render

1. Create a new **Web Service** on Render
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
4. Add environment variables:
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `CORS_ORIGIN`: Your frontend URL on Vercel

## ⚠️ Known Limitations

| Limitation | Description |
|------------|-------------|
| Mesh Architecture | With 10 participants = 90 P2P connections. Quality may degrade with 7+ users |
| STUN Only | ~80% of users can connect. Symmetric NAT requires TURN |
| No Persistence | Real-time audio only, not recorded |
| In-Memory Storage | Call rooms stored in server memory |

## 📁 Project Structure

```
PI-3-MINIPROJECT-BACK-CALL/
├── src/
│   ├── config/
│   │   └── socket.ts         # Socket.IO configuration and events
│   ├── middlewares/
│   │   └── errorHandler.ts   # Error handling middleware
│   ├── routes/
│   │   └── callRoutes.ts     # HTTP routes
│   ├── types/
│   │   └── index.ts          # TypeScript type definitions
│   ├── utils/
│   │   └── logger.ts         # Colored logger utility
│   └── server.ts             # Main entry point
├── dist/                      # Compiled JavaScript
├── package.json
├── tsconfig.json
├── render.yaml
├── env.example
└── README.md
```

## 🔗 Frontend Integration

### Installation

```bash
npm install socket.io-client peerjs
```

### Usage Example

```typescript
import { io } from 'socket.io-client';
import Peer from 'peerjs';

// Connect to BACK-CALL
const socket = io('http://localhost:5000');

// Create PeerJS instance
const peer = new Peer();

peer.on('open', (peerId) => {
  // Join the voice call
  socket.emit('call:join', {
    meetingId: 'meeting-123',
    userId: 'user-456',
    peerId: peerId,
    username: 'John'
  });
});

// Receive list of existing peers
socket.on('call:peers-list', ({ participants }) => {
  participants.forEach(p => {
    // Call each existing peer
    const call = peer.call(p.peerId, localStream);
    call.on('stream', remoteStream => {
      // Play remote audio
    });
  });
});

// Listen for new peers joining
socket.on('call:peer-joined', ({ peerId }) => {
  // The new peer will call us
});

// Answer incoming calls
peer.on('call', call => {
  call.answer(localStream);
  call.on('stream', remoteStream => {
    // Play remote audio
  });
});
```

## 📝 License

ISC
