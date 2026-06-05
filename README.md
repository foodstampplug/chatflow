# ChatFlow

Multi-platform live chat aggregator for live shows. Pulls Twitch and YouTube Live chat into a single unified feed with a dashboard for show hosts and a transparent OBS overlay for audiences.

## Quick Start

```bash
npm install
npm run dev
```

Then open:
- **Dashboard**: http://localhost:3000
- **Overlay**: http://localhost:3000/overlay

## Setup

### Twitch
1. Enter the channel name in the Twitch card on the dashboard
2. Click Connect — uses anonymous read-only access, no OAuth required

### YouTube Live
You need:
- A **YouTube Data API v3** key ([get one here](https://console.cloud.google.com/))
- The **Live Chat ID** from your YouTube live stream

To find the Live Chat ID:
1. Go to YouTube Studio → Go Live → Live Control Room
2. The Live Chat ID is in the URL: `youtube.com/live_chat?is_popout=1&v=VIDEO_ID`
3. Or use the API: `GET https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet&broadcastStatus=active&key=YOUR_KEY`

## OBS Browser Source

1. In OBS, click `+` in Sources → Browser
2. URL: `http://localhost:3000/overlay`
3. Width: 500, Height: 800 (adjust to your layout)
4. Check "Shutdown source when not visible" for performance

### Overlay URL Parameters

| Parameter | Options | Default | Description |
|-----------|---------|---------|-------------|
| `theme` | `dark`, `light`, `minimal` | `dark` | Visual theme |
| `fontSize` | `small`, `medium`, `large` | `medium` | Text size |
| `maxMessages` | number | `15` | Max visible messages |
| `fadeAfter` | seconds | `30` | Seconds before a message fades |

Example: `http://localhost:3000/overlay?theme=dark&fontSize=large&maxMessages=10`

## Production Build

```bash
npm run build
npm start
```

## Environment Variables

Copy `.env.example` to `.env`:

```env
PORT=3000
NODE_ENV=production
```

## Architecture

```
server.js           — HTTP + WebSocket server (single port)
src/lib/server/
  chatManager.js    — Singleton: manages Twitch + YouTube connections
src/routes/
  +page.svelte      — Dashboard (host control panel)
  overlay/
    +page.svelte    — OBS overlay (audience view)
  api/              — REST endpoints for connect/disconnect/pin/hide
src/lib/
  ws.js             — WebSocket client with auto-reconnect
  stores/chat.js    — Svelte reactive stores
  components/       — MessageItem, PlatformCard
```

## Message Shape

```js
{
  id: string,           // uuid
  platform: 'twitch' | 'youtube',
  username: string,
  displayName: string,
  message: string,
  color: string,        // chat color or platform default
  timestamp: number,    // unix ms
  badges: string[],     // ['moderator', 'subscriber', ...]
  pinned: boolean,
  hidden: boolean,
}
```

## WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `init` | server → client | `{ messages, platforms }` |
| `message` | server → client | Message object |
| `message_update` | server → client | Updated message object |
| `platform_status` | server → client | `{ twitch, youtube }` |
| `youtube_error` | server → client | `{ status, message }` |
