/**
 * WebSocket client helper with auto-reconnect.
 * Returns a controller object; call connect() to start.
 *
 * Usage:
 *   import { createWsClient } from '$lib/ws.js';
 *   const ws = createWsClient({ onMessage, onStatusChange });
 *   ws.connect();
 *   // later: ws.disconnect();
 */

export function createWsClient({ onMessage, onStatusChange } = {}) {
	let socket = null;
	let reconnectTimer = null;
	let reconnectAttempts = 0;
	let intentionalClose = false;
	const MAX_RECONNECT_DELAY_MS = 30_000;
	const BASE_DELAY_MS = 1_000;

	function getWsUrl() {
		const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		return `${proto}//${window.location.host}/ws`;
	}

	function setStatus(status) {
		onStatusChange?.(status);
	}

	function connect() {
		if (socket && socket.readyState === WebSocket.OPEN) return;
		intentionalClose = false;

		setStatus('connecting');
		const url = getWsUrl();

		try {
			socket = new WebSocket(url);
		} catch (err) {
			console.error('[WS] Failed to create socket:', err);
			scheduleReconnect();
			return;
		}

		socket.addEventListener('open', () => {
			reconnectAttempts = 0;
			setStatus('connected');
			console.log('[WS] Connected to', url);
		});

		socket.addEventListener('message', (event) => {
			try {
				const parsed = JSON.parse(event.data);
				onMessage?.(parsed);
			} catch (err) {
				console.error('[WS] Failed to parse message:', err);
			}
		});

		socket.addEventListener('close', (event) => {
			if (intentionalClose) {
				setStatus('disconnected');
				return;
			}
			console.log(`[WS] Connection closed (code: ${event.code}) — reconnecting...`);
			setStatus('reconnecting');
			scheduleReconnect();
		});

		socket.addEventListener('error', (err) => {
			console.error('[WS] Socket error:', err);
			// 'close' will fire after error — reconnect handled there
		});
	}

	function scheduleReconnect() {
		if (reconnectTimer) clearTimeout(reconnectTimer);
		const delay = Math.min(BASE_DELAY_MS * Math.pow(1.5, reconnectAttempts), MAX_RECONNECT_DELAY_MS);
		reconnectAttempts++;
		console.log(`[WS] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts})`);
		reconnectTimer = setTimeout(connect, delay);
	}

	function disconnect() {
		intentionalClose = true;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		if (socket) {
			socket.close(1000, 'Client disconnected');
			socket = null;
		}
		setStatus('disconnected');
	}

	return { connect, disconnect };
}
