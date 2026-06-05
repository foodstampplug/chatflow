import { json, error } from '@sveltejs/kit';
import { getChatManager } from '$lib/server/chatManager.js';

export async function POST({ request }) {
	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { messageId } = body;
	if (!messageId) throw error(400, 'messageId is required');

	try {
		const mgr = getChatManager();
		const msg = mgr.pinMessage(messageId);
		return json({ success: true, message: msg });
	} catch (err) {
		throw error(404, err.message);
	}
}
