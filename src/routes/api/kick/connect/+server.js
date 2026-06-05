import { json, error } from '@sveltejs/kit';
import { getChatManager } from '$lib/server/chatManager.js';

export async function POST({ request }) {
	let body;
	try { body = await request.json(); } catch { throw error(400, 'Invalid JSON body'); }

	const { channel } = body;
	if (!channel || typeof channel !== 'string' || !channel.trim()) {
		throw error(400, 'channel is required');
	}

	try {
		const mgr = getChatManager();
		const result = await mgr.connectKick(channel.trim());
		return json({ success: true, ...result });
	} catch (err) {
		throw error(500, err.message || 'Failed to connect to Kick');
	}
}
