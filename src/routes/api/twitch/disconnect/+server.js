import { json } from '@sveltejs/kit';
import { getChatManager } from '$lib/server/chatManager.js';

export async function POST() {
	const mgr = getChatManager();
	await mgr.disconnectTwitch();
	return json({ success: true });
}
