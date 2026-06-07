import { writable, derived } from 'svelte/store';

export const messages = writable([]);

export const visibleMessages = derived(messages, ($msgs) => $msgs.filter((m) => !m.hidden));
export const pinnedMessages = derived(messages, ($msgs) => $msgs.filter((m) => m.pinned && !m.hidden));

export const platformStatus = writable({
	twitch: { connected: false, channel: null, messageCount: 0 },
	youtube: { connected: false, liveChatId: null, messageCount: 0 },
	kick: { connected: false, channel: null, messageCount: 0 },
	x: { connected: false, messageCount: 0 }
});

export const wsStatus = writable('disconnected');

// ── Keywords store (persists to localStorage via +page.svelte) ─────────────────
export const keywords = writable([]);

// ── Top Chatters leaderboard ───────────────────────────────────────────────────
export const topChatters = writable([]);

export const connectedCount = derived(platformStatus, ($p) => {
	let count = 0;
	if ($p.twitch?.connected) count++;
	if ($p.youtube?.connected) count++;
	if ($p.kick?.connected) count++;
	if ($p.x?.connected) count++;
	return count;
});

export function addMessage(msg) {
	messages.update(($msgs) => {
		if ($msgs.find((m) => m.id === msg.id)) return $msgs;
		return [msg, ...$msgs].slice(0, 300);
	});
}

export function updateMessage(updated) {
	messages.update(($msgs) => $msgs.map((m) => (m.id === updated.id ? updated : m)));
}

export function initState(data) {
	if (data.messages) messages.set([...data.messages].reverse());
	if (data.platforms) platformStatus.set({
		twitch: { connected: false, channel: null, messageCount: 0 },
		youtube: { connected: false, liveChatId: null, messageCount: 0 },
		kick: { connected: false, channel: null, messageCount: 0 },
		x: { connected: false, messageCount: 0 },
		...data.platforms
	});
}

export async function togglePin(messageId) {
	messages.update(($msgs) => $msgs.map((m) => (m.id === messageId ? { ...m, pinned: !m.pinned } : m)));
	try {
		const res = await fetch('/api/messages/pin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messageId })
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
	} catch (err) {
		console.error('Failed to pin message:', err);
		messages.update(($msgs) => $msgs.map((m) => (m.id === messageId ? { ...m, pinned: !m.pinned } : m)));
	}
}

export async function hideMsg(messageId) {
	messages.update(($msgs) => $msgs.map((m) => (m.id === messageId ? { ...m, hidden: true } : m)));
	try {
		const res = await fetch('/api/messages/hide', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messageId })
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
	} catch (err) {
		console.error('Failed to hide message:', err);
		messages.update(($msgs) => $msgs.map((m) => (m.id === messageId ? { ...m, hidden: false } : m)));
	}
}
