import { json, error } from '@sveltejs/kit';
import { getChatManager } from '$lib/server/chatManager.js';

// X live stream chat has no public API.
// This endpoint accepts messages injected by external scripts (browser extensions, etc.)
// and adds them to the unified feed labeled as "X".
export async function POST({ request }) {
	let body;
	try { body = await request.json(); } catch { throw error(400, 'Invalid JSON body'); }

	const { username, displayName, message, color } = body;
	if (!message || typeof message !== 'string' || !message.trim()) {
		throw error(400, 'message is required');
	}
	if (!username || typeof username !== 'string') {
		throw error(400, 'username is required');
	}

	const mgr = getChatManager();
	const msg = mgr.injectXMessage({ username: username.trim(), displayName, message: message.trim(), color });
	return json({ success: true, id: msg.id });
}
