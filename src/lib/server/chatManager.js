import tmi from 'tmi.js';
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

function broadcast(event, data) {
	if (typeof global.__chatflowBroadcast === 'function') {
		global.__chatflowBroadcast(event, data);
	}
}

const MAX_MESSAGES = 200;
const CHATTERS_BROADCAST_EVERY = 5; // broadcast leaderboard every N messages
let messagesSinceChattersUpdate = 0;

const state = {
	messages: [],
	chatters: {}, // key: `username_platform` → { username, displayName, platform, count, color }
	twitch: { connected: false, channel: null, client: null, messageCount: 0 },
	youtube: {
		connected: false, liveChatId: null, apiKey: null,
		pollTimer: null, nextPageToken: null, messageCount: 0, pollIntervalMs: 5000
	},
	kick: {
		connected: false, channel: null, chatroomId: null,
		ws: null, pingTimer: null, messageCount: 0,
		reconnectAttempts: 0, reconnectTimer: null, intentionalClose: false
	},
	x: { connected: false, label: 'X Live', messageCount: 0 }
};

// ── Platform default colors ────────────────────────────────────────────────────
const PLATFORM_COLORS = {
	twitch: '#9146FF',
	youtube: '#FF0000',
	kick: '#53FC18',
	x: '#1d9bf0'
};

function makeMessage({ platform, username, displayName, message, color, badges = [], emotes = null }) {
	return {
		id: uuidv4(),
		platform,
		username,
		displayName: displayName || username,
		message,
		color: color || PLATFORM_COLORS[platform] || '#888',
		timestamp: Date.now(),
		badges,
		emotes,
		pinned: false,
		hidden: false
	};
}

// ── Chatters tracking ─────────────────────────────────────────────────────────
function trackChatter({ username, displayName, platform, color }) {
	const key = `${username}_${platform}`;
	if (!state.chatters[key]) {
		state.chatters[key] = { username, displayName: displayName || username, platform, count: 0, color: color || PLATFORM_COLORS[platform] || '#888' };
	} else {
		// keep most recent displayName and color
		state.chatters[key].displayName = displayName || username;
		state.chatters[key].color = color || state.chatters[key].color;
	}
	state.chatters[key].count++;
}

function getChatters() {
	return Object.values(state.chatters)
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);
}

function maybeBroadcastChatters() {
	messagesSinceChattersUpdate++;
	if (messagesSinceChattersUpdate >= CHATTERS_BROADCAST_EVERY) {
		messagesSinceChattersUpdate = 0;
		broadcast('chatters', getChatters());
	}
}

function addMessage(msg) {
	state.messages.push(msg);
	if (state.messages.length > MAX_MESSAGES) {
		state.messages.splice(0, state.messages.length - MAX_MESSAGES);
	}
	trackChatter({ username: msg.username, displayName: msg.displayName, platform: msg.platform, color: msg.color });
	broadcast('message', msg);
	maybeBroadcastChatters();
	return msg;
}

// ── Twitch ────────────────────────────────────────────────────────────────────
async function connectTwitch(channel) {
	if (state.twitch.connected) await disconnectTwitch();

	const channelName = channel.toLowerCase().replace(/^#/, '');
	console.log(`[Twitch] Connecting to #${channelName}...`);

	const client = new tmi.Client({
		connection: { reconnect: true, secure: true, maxReconnectAttempts: 10 },
		channels: [channelName],
		options: { debug: false }
	});

	client.on('message', (ch, tags, message, self) => {
		if (self) return;
		const badges = [];
		if (tags.badges) {
			if (tags.badges.broadcaster) badges.push('broadcaster');
			if (tags.badges.moderator) badges.push('moderator');
			if (tags.badges.subscriber) badges.push('subscriber');
			if (tags.badges.vip) badges.push('vip');
		}
		const msg = makeMessage({
			platform: 'twitch',
			username: tags.username || tags['display-name'] || 'Anonymous',
			displayName: tags['display-name'] || tags.username || 'Anonymous',
			message,
			color: tags.color || '#9146FF',
			badges,
			emotes: tags.emotes || null
		});
		state.twitch.messageCount++;
		addMessage(msg);
	});

	client.on('connected', () => {
		state.twitch.connected = true;
		broadcast('platform_status', getPlatformStatus());
	});
	client.on('disconnected', () => {
		state.twitch.connected = false;
		broadcast('platform_status', getPlatformStatus());
	});

	try {
		await client.connect();
		state.twitch.client = client;
		state.twitch.channel = channelName;
		state.twitch.connected = true;
		return { success: true, channel: channelName };
	} catch (err) {
		state.twitch.connected = false;
		throw new Error(`Failed to connect to Twitch: ${err.message || err}`);
	}
}

async function disconnectTwitch() {
	if (state.twitch.client) {
		try { await state.twitch.client.disconnect(); } catch {}
		state.twitch.client = null;
	}
	state.twitch.connected = false;
	state.twitch.channel = null;
	state.twitch.messageCount = 0;
	broadcast('platform_status', getPlatformStatus());
}

// ── YouTube ───────────────────────────────────────────────────────────────────
async function connectYouTube(apiKey, liveChatId) {
	if (state.youtube.connected) await disconnectYouTube();

	state.youtube.apiKey = apiKey;
	state.youtube.liveChatId = liveChatId;
	state.youtube.nextPageToken = null;
	state.youtube.connected = true;

	broadcast('platform_status', getPlatformStatus());
	await pollYouTube();
	state.youtube.pollTimer = setInterval(pollYouTube, state.youtube.pollIntervalMs);
	return { success: true, liveChatId };
}

async function pollYouTube() {
	if (!state.youtube.connected) return;
	const { apiKey, liveChatId, nextPageToken } = state.youtube;
	if (!apiKey || !liveChatId) return;

	const params = new URLSearchParams({ liveChatId, part: 'snippet,authorDetails', key: apiKey, maxResults: '200' });
	if (nextPageToken) params.set('pageToken', nextPageToken);

	try {
		const res = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?${params}`);
		if (!res.ok) {
			const body = await res.text();
			console.error(`[YouTube] API error ${res.status}:`, body);
			if (res.status === 403 || res.status === 404) {
				await disconnectYouTube();
				broadcast('youtube_error', { status: res.status, message: `YouTube API error: ${res.status}` });
			}
			return;
		}
		const data = await res.json();
		if (data.nextPageToken) state.youtube.nextPageToken = data.nextPageToken;

		for (const item of (data.items || [])) {
			const snippet = item.snippet;
			const author = item.authorDetails;
			if (!snippet || !author) continue;
			const badges = [];
			if (author.isChatOwner) badges.push('owner');
			if (author.isChatModerator) badges.push('moderator');
			if (author.isChatSponsor) badges.push('member');
			const msg = makeMessage({
				platform: 'youtube',
				username: author.displayName || 'Anonymous',
				displayName: author.displayName || 'Anonymous',
				message: snippet.displayMessage || '',
				color: '#FF4444',
				badges
			});
			state.youtube.messageCount++;
			addMessage(msg);
		}
	} catch (err) {
		console.error('[YouTube] Poll error:', err.message);
	}
}

async function disconnectYouTube() {
	if (state.youtube.pollTimer) { clearInterval(state.youtube.pollTimer); state.youtube.pollTimer = null; }
	state.youtube.connected = false;
	state.youtube.liveChatId = null;
	state.youtube.apiKey = null;
	state.youtube.nextPageToken = null;
	state.youtube.messageCount = 0;
	broadcast('platform_status', getPlatformStatus());
}

// ── Kick (Pusher WebSocket) with auto-reconnect ───────────────────────────────
const KICK_MAX_RECONNECT = 5;
const KICK_BASE_DELAY_MS = 2000;

function scheduleKickReconnect() {
	if (state.kick.reconnectAttempts >= KICK_MAX_RECONNECT) {
		console.error('[Kick] Max reconnect attempts reached. Giving up.');
		broadcast('platform_status', getPlatformStatus());
		broadcast('kick_error', { message: 'Kick disconnected — max reconnect attempts reached. Please reconnect manually.' });
		return;
	}
	const delay = KICK_BASE_DELAY_MS * Math.pow(2, state.kick.reconnectAttempts);
	state.kick.reconnectAttempts++;
	console.log(`[Kick] Reconnecting in ${delay / 1000}s (attempt ${state.kick.reconnectAttempts}/${KICK_MAX_RECONNECT})...`);
	broadcast('kick_reconnecting', { attempt: state.kick.reconnectAttempts, max: KICK_MAX_RECONNECT, delayMs: delay });
	state.kick.reconnectTimer = setTimeout(() => {
		if (!state.kick.intentionalClose && state.kick.channel && state.kick.chatroomId) {
			connectKickWs(state.kick.channel, state.kick.chatroomId);
		}
	}, delay);
}

function connectKickWs(slug, chatroomId) {
	const pusherUrl = 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false';

	const kickWs = new WebSocket(pusherUrl);

	const connTimeout = setTimeout(() => {
		kickWs.close();
	}, 12000);

	kickWs.on('open', () => {
		console.log('[Kick] Pusher WebSocket opened');
	});

	kickWs.on('message', (raw) => {
		let parsed;
		try { parsed = JSON.parse(raw.toString()); } catch { return; }

		if (parsed.event === 'pusher:connection_established') {
			kickWs.send(JSON.stringify({
				event: 'pusher:subscribe',
				data: { auth: '', channel: `chatrooms.${chatroomId}.v2` }
			}));
		} else if (parsed.event === 'pusher_internal:subscription_succeeded') {
			clearTimeout(connTimeout);
			console.log(`[Kick] Subscribed to chatrooms.${chatroomId}.v2`);
			state.kick.connected = true;
			state.kick.ws = kickWs;
			state.kick.reconnectAttempts = 0; // reset on successful connect
			broadcast('platform_status', getPlatformStatus());
		} else if (parsed.event === 'App\\Events\\ChatMessageEvent') {
			let chatData;
			try { chatData = JSON.parse(parsed.data); } catch { return; }
			if (chatData.type !== 'message') return;

			const sender = chatData.sender || {};
			const identity = sender.identity || {};
			const badges = (identity.badges || []).map((b) => b.type || b).filter(Boolean);

			const msg = makeMessage({
				platform: 'kick',
				username: sender.username || sender.slug || 'Anonymous',
				displayName: sender.username || sender.slug || 'Anonymous',
				message: chatData.content || '',
				color: identity.color || '#53FC18',
				badges
			});
			state.kick.messageCount++;
			addMessage(msg);
		} else if (parsed.event === 'pusher:ping') {
			kickWs.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
		}
	});

	kickWs.on('close', (code, reason) => {
		clearTimeout(connTimeout);
		console.log(`[Kick] WebSocket closed (${code}): ${reason}`);
		if (state.kick.pingTimer) { clearInterval(state.kick.pingTimer); state.kick.pingTimer = null; }
		state.kick.ws = null;
		if (state.kick.connected) {
			state.kick.connected = false;
			broadcast('platform_status', getPlatformStatus());
		}
		// Auto-reconnect if not intentionally closed
		if (!state.kick.intentionalClose) {
			scheduleKickReconnect();
		}
	});

	kickWs.on('error', (err) => {
		clearTimeout(connTimeout);
		console.error('[Kick] WebSocket error:', err.message);
		// close event will follow and trigger reconnect
	});

	// Pusher keep-alive ping every 30s
	if (state.kick.pingTimer) clearInterval(state.kick.pingTimer);
	state.kick.pingTimer = setInterval(() => {
		if (kickWs.readyState === WebSocket.OPEN) {
			kickWs.send(JSON.stringify({ event: 'pusher:ping', data: {} }));
		}
	}, 30000);

	return kickWs;
}

async function connectKick(channelSlug, chatroomIdOverride) {
	if (state.kick.connected) await disconnectKick();

	const slug = channelSlug.toLowerCase().trim();
	let chatroomId = chatroomIdOverride ? String(chatroomIdOverride).trim() : null;

	if (!chatroomId) {
		console.log(`[Kick] Looking up channel via API: ${slug}`);
		const channelRes = await fetch(`https://kick.com/api/v2/channels/${slug}`, {
			headers: {
				Accept: 'application/json',
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
				Referer: 'https://kick.com/',
				Origin: 'https://kick.com'
			}
		});

		if (!channelRes.ok) {
			throw new Error(
				`Kick API returned ${channelRes.status}. Kick blocks server-side requests — enter the Chatroom ID directly instead. ` +
				`Find it at kick.com/${slug} → right-click → View Page Source → search "chatroom_id".`
			);
		}

		const channelData = await channelRes.json();
		chatroomId = channelData?.chatroom?.id;
		if (!chatroomId) throw new Error('Could not find Kick chatroom ID in API response');
	}

	console.log(`[Kick] Using chatroom ID: ${chatroomId} for channel: ${slug}`);
	state.kick.chatroomId = chatroomId;
	state.kick.channel = slug;
	state.kick.intentionalClose = false;
	state.kick.reconnectAttempts = 0;

	return new Promise((resolve, reject) => {
		const pusherUrl = 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false';
		const kickWs = new WebSocket(pusherUrl);

		const connTimeout = setTimeout(() => {
			kickWs.close();
			reject(new Error('Kick connection timed out. Check the chatroom ID and try again.'));
		}, 12000);

		kickWs.on('open', () => {
			console.log('[Kick] Pusher WebSocket opened');
		});

		kickWs.on('message', (raw) => {
			let parsed;
			try { parsed = JSON.parse(raw.toString()); } catch { return; }

			if (parsed.event === 'pusher:connection_established') {
				kickWs.send(JSON.stringify({
					event: 'pusher:subscribe',
					data: { auth: '', channel: `chatrooms.${chatroomId}.v2` }
				}));
			} else if (parsed.event === 'pusher_internal:subscription_succeeded') {
				clearTimeout(connTimeout);
				console.log(`[Kick] Subscribed to chatrooms.${chatroomId}.v2`);
				state.kick.connected = true;
				state.kick.ws = kickWs;
				state.kick.reconnectAttempts = 0;
				broadcast('platform_status', getPlatformStatus());
				resolve({ success: true, channel: slug, chatroomId });
			} else if (parsed.event === 'App\\Events\\ChatMessageEvent') {
				let chatData;
				try { chatData = JSON.parse(parsed.data); } catch { return; }
				if (chatData.type !== 'message') return;

				const sender = chatData.sender || {};
				const identity = sender.identity || {};
				const badges = (identity.badges || []).map((b) => b.type || b).filter(Boolean);

				const msg = makeMessage({
					platform: 'kick',
					username: sender.username || sender.slug || 'Anonymous',
					displayName: sender.username || sender.slug || 'Anonymous',
					message: chatData.content || '',
					color: identity.color || '#53FC18',
					badges
				});
				state.kick.messageCount++;
				addMessage(msg);
			} else if (parsed.event === 'pusher:ping') {
				kickWs.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
			}
		});

		kickWs.on('close', (code, reason) => {
			clearTimeout(connTimeout);
			console.log(`[Kick] WebSocket closed (${code}): ${reason}`);
			if (state.kick.pingTimer) { clearInterval(state.kick.pingTimer); state.kick.pingTimer = null; }
			state.kick.ws = null;
			if (state.kick.connected) {
				state.kick.connected = false;
				broadcast('platform_status', getPlatformStatus());
			}
			if (!state.kick.intentionalClose) {
				scheduleKickReconnect();
			}
		});

		kickWs.on('error', (err) => {
			clearTimeout(connTimeout);
			console.error('[Kick] WebSocket error:', err.message);
			// If promise hasn't resolved yet, reject it
			reject(new Error(`Kick connection failed: ${err.message}`));
		});

		// Pusher keep-alive ping every 30s
		if (state.kick.pingTimer) clearInterval(state.kick.pingTimer);
		state.kick.pingTimer = setInterval(() => {
			if (kickWs.readyState === WebSocket.OPEN) {
				kickWs.send(JSON.stringify({ event: 'pusher:ping', data: {} }));
			}
		}, 30000);
	});
}

async function disconnectKick() {
	state.kick.intentionalClose = true;
	if (state.kick.reconnectTimer) { clearTimeout(state.kick.reconnectTimer); state.kick.reconnectTimer = null; }
	if (state.kick.pingTimer) { clearInterval(state.kick.pingTimer); state.kick.pingTimer = null; }
	if (state.kick.ws) {
		try { state.kick.ws.close(); } catch {}
		state.kick.ws = null;
	}
	state.kick.connected = false;
	state.kick.channel = null;
	state.kick.chatroomId = null;
	state.kick.messageCount = 0;
	state.kick.reconnectAttempts = 0;
	broadcast('platform_status', getPlatformStatus());
	console.log('[Kick] Disconnected.');
}

// ── X (manual injection) ──────────────────────────────────────────────────────
function injectXMessage({ username, displayName, message, color }) {
	const msg = makeMessage({
		platform: 'x',
		username: username || 'Anonymous',
		displayName: displayName || username || 'Anonymous',
		message,
		color: color || '#1d9bf0',
		badges: []
	});
	state.x.messageCount++;
	state.x.connected = true;
	addMessage(msg);
	broadcast('platform_status', getPlatformStatus());
	return msg;
}

function setXStatus(connected) {
	state.x.connected = connected;
	if (!connected) state.x.messageCount = 0;
	broadcast('platform_status', getPlatformStatus());
}

// ── Shared operations ─────────────────────────────────────────────────────────
function pinMessage(messageId) {
	const msg = state.messages.find((m) => m.id === messageId);
	if (!msg) throw new Error(`Message ${messageId} not found`);
	msg.pinned = !msg.pinned;
	broadcast('message_update', msg);
	return msg;
}

function hideMessage(messageId) {
	const msg = state.messages.find((m) => m.id === messageId);
	if (!msg) throw new Error(`Message ${messageId} not found`);
	msg.hidden = true;
	broadcast('message_update', msg);
	return msg;
}

function getPlatformStatus() {
	return {
		twitch: { connected: state.twitch.connected, channel: state.twitch.channel, messageCount: state.twitch.messageCount },
		youtube: { connected: state.youtube.connected, liveChatId: state.youtube.liveChatId, messageCount: state.youtube.messageCount },
		kick: { connected: state.kick.connected, channel: state.kick.channel, messageCount: state.kick.messageCount },
		x: { connected: state.x.connected, messageCount: state.x.messageCount }
	};
}

function getMessages() {
	return state.messages.filter((m) => !m.hidden);
}

function disconnectAll() {
	disconnectTwitch().catch(() => {});
	disconnectYouTube().catch(() => {});
	disconnectKick().catch(() => {});
}

const chatManager = {
	connectTwitch, disconnectTwitch,
	connectYouTube, disconnectYouTube,
	connectKick, disconnectKick,
	injectXMessage, setXStatus,
	pinMessage, hideMessage,
	getPlatformStatus, getMessages,
	getChatters,
	disconnectAll
};

export function getChatManager() { return chatManager; }
export default chatManager;
