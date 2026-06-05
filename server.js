/**
 * ChatFlow — Custom server entry point
 * Boots SvelteKit (via adapter-node) + WebSocket server on the same HTTP server.
 *
 * Dev:  NODE_ENV=development node server.js  → uses @sveltejs/kit/vite dev handler
 * Prod: NODE_ENV=production  node server.js  → serves built ./build/handler.js
 */

import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'node:url';

const PORT = parseInt(process.env.PORT || '3000', 10);
const isDev = process.env.NODE_ENV !== 'production';

// ── Singleton WebSocket server ────────────────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });

/** Broadcast a typed event to all connected WS clients. */
export function broadcast(event, data) {
	const payload = JSON.stringify({ event, data });
	for (const client of wss.clients) {
		if (client.readyState === WebSocket.OPEN) {
			client.send(payload, (err) => {
				if (err) console.error('[WS] send error:', err.message);
			});
		}
	}
}

// Make broadcast globally accessible so hot-reloaded modules can always reach it
global.__chatflowBroadcast = broadcast;

async function boot() {
	// ── Load chat manager ──────────────────────────────────────────────────────
	const { getChatManager } = await import('./src/lib/server/chatManager.js');

	// ── WS connection handler ─────────────────────────────────────────────────
	wss.on('connection', (ws, req) => {
		const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
		console.log(`[WS] + client (${ip}) — total: ${wss.clients.size}`);

		// Send full current state to the new client immediately
		const mgr = getChatManager();
		const initPayload = JSON.stringify({
			event: 'init',
			data: {
				messages: mgr.getMessages(),
				platforms: mgr.getPlatformStatus()
			}
		});
		ws.send(initPayload);

		ws.on('close', () => {
			console.log(`[WS] - client disconnected — total: ${wss.clients.size}`);
		});
		ws.on('error', (err) => console.error('[WS] client error:', err.message));
	});

	// ── HTTP handler ──────────────────────────────────────────────────────────
	let httpHandler;

	if (isDev) {
		/**
		 * Dev mode: spin up Vite as middleware.
		 * SvelteKit's Vite plugin registers the dev SSR handler automatically.
		 */
		const { createServer: createViteServer } = await import('vite');
		const vite = await createViteServer({
			server: { middlewareMode: true },
			appType: 'custom'
		});

		httpHandler = (req, res) => {
			vite.middlewares(req, res, () => {
				res.writeHead(404).end('Not found');
			});
		};
	} else {
		// Production: import the built handler produced by adapter-node
		const { handler } = await import('./build/handler.js');
		httpHandler = handler;
	}

	// ── Unified HTTP server ───────────────────────────────────────────────────
	const server = createServer((req, res) => {
		httpHandler(req, res);
	});

	// Upgrade HTTP connections to WebSocket only on the /ws path
	server.on('upgrade', (req, socket, head) => {
		const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
		if (pathname === '/ws') {
			wss.handleUpgrade(req, socket, head, (ws) => {
				wss.emit('connection', ws, req);
			});
		} else {
			socket.destroy();
		}
	});

	server.listen(PORT, '0.0.0.0', () => {
		console.log(`\n  ┌─────────────────────────────────────────┐`);
		console.log(`  │  ChatFlow is running                     │`);
		console.log(`  │                                          │`);
		console.log(`  │  Dashboard  →  http://localhost:${PORT}    │`);
		console.log(`  │  Overlay    →  http://localhost:${PORT}/overlay │`);
		console.log(`  │  WebSocket  →  ws://localhost:${PORT}/ws   │`);
		console.log(`  │  Mode: ${isDev ? 'development               ' : 'production                '}│`);
		console.log(`  └─────────────────────────────────────────┘\n`);
	});

	// ── Graceful shutdown ─────────────────────────────────────────────────────
	function shutdown(signal) {
		console.log(`\n[ChatFlow] ${signal} received — shutting down...`);
		const mgr = getChatManager();
		mgr.disconnectAll();

		// Stop accepting new connections
		server.close(() => {
			console.log('[ChatFlow] HTTP server closed. Goodbye.');
			process.exit(0);
		});

		// Force exit after 8 seconds
		setTimeout(() => {
			console.error('[ChatFlow] Forced exit after timeout.');
			process.exit(1);
		}, 8000).unref();
	}

	process.on('SIGTERM', () => shutdown('SIGTERM'));
	process.on('SIGINT', () => shutdown('SIGINT'));
}

boot().catch((err) => {
	console.error('[ChatFlow] Fatal startup error:', err);
	process.exit(1);
});
