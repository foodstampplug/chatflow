import { json } from '@sveltejs/kit';
import { getChatManager } from '$lib/server/chatManager.js';

export function GET() {
	const mgr = getChatManager();
	return json({
		platforms: mgr.getPlatformStatus(),
		messageCount: mgr.getMessages().length
	});
}
