import { json, error } from '@sveltejs/kit';
import { getChatManager } from '$lib/server/chatManager.js';

export async function POST({ request }) {
	let body;
	try { body = await request.json(); } catch { throw error(400, 'Invalid JSON body'); }
	const mgr = getChatManager();
	mgr.setXStatus(!!body.connected);
	return json({ success: true });
}
