import { json, error } from '@sveltejs/kit';
import { getChatManager } from '$lib/server/chatManager.js';

export async function POST({ request }) {
	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { apiKey, liveChatId } = body;
	if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
		throw error(400, 'apiKey is required');
	}
	if (!liveChatId || typeof liveChatId !== 'string' || !liveChatId.trim()) {
		throw error(400, 'liveChatId is required');
	}

	try {
		const mgr = getChatManager();
		const result = await mgr.connectYouTube(apiKey.trim(), liveChatId.trim());
		return json({ success: true, ...result });
	} catch (err) {
		throw error(500, err.message || 'Failed to connect to YouTube');
	}
}
