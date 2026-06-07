<script>
	import { platformStatus } from '$lib/stores/chat.js';

	export let platform = 'twitch';

	let twitchChannel = '';
	let youtubeApiKey = '';
	let youtubeLiveChatId = '';
	let kickChannel = '';
	let kickChatroomId = '';
	let loading = false;
	let errorMsg = '';

	$: status = $platformStatus[platform] ?? { connected: false, messageCount: 0 };
	$: isConnected = status.connected ?? false;

	const CFG = {
		twitch:  { label:'Twitch',    short:'TW',   color:'#9146FF', textOnBg:'#fff',   bg:'rgba(145,70,255,0.08)', border:'rgba(145,70,255,0.2)' },
		youtube: { label:'YouTube',   short:'YT',   color:'#FF0000', textOnBg:'#fff',   bg:'rgba(255,0,0,0.07)',    border:'rgba(255,0,0,0.2)' },
		kick:    { label:'Kick',      short:'KICK', color:'#53FC18', textOnBg:'#000',   bg:'rgba(83,252,24,0.06)',  border:'rgba(83,252,24,0.2)' },
		x:       { label:'X (Twitter)',short:'X',   color:'#E2E8F0', textOnBg:'#0A0A0F',bg:'rgba(226,232,240,0.04)', border:'rgba(226,232,240,0.12)' }
	};
	$: c = CFG[platform];

	async function handleConnect() {
		errorMsg = ''; loading = true;
		try {
			let endpoint, body;
			if (platform === 'twitch') {
				if (!twitchChannel.trim()) { errorMsg = 'Channel name required'; return; }
				endpoint = '/api/twitch/connect';
				body = { channel: twitchChannel.trim() };
			} else if (platform === 'youtube') {
				if (!youtubeApiKey.trim()) { errorMsg = 'API key required'; return; }
				if (!youtubeLiveChatId.trim()) { errorMsg = 'Live Chat ID required'; return; }
				endpoint = '/api/youtube/connect';
				body = { apiKey: youtubeApiKey.trim(), liveChatId: youtubeLiveChatId.trim() };
			} else if (platform === 'kick') {
				if (!kickChannel.trim()) { errorMsg = 'Channel name required'; return; }
				endpoint = '/api/kick/connect';
				body = { channel: kickChannel.trim(), chatroomId: kickChatroomId.trim() || undefined };
			}
			const res = await fetch(endpoint, {
				method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.message || `Error ${res.status}`);
			}
		} catch (err) {
			errorMsg = err.message || 'Connection failed';
		} finally { loading = false; }
	}

	async function handleDisconnect() {
		errorMsg = ''; loading = true;
		try {
			const map = { twitch:'/api/twitch/disconnect', youtube:'/api/youtube/disconnect', kick:'/api/kick/disconnect', x:'/api/x/status' };
			const body = platform === 'x' ? JSON.stringify({ connected: false }) : undefined;
			await fetch(map[platform], { method:'POST', headers: body ? {'Content-Type':'application/json'} : {}, body });
		} catch (err) { errorMsg = err.message; }
		finally { loading = false; }
	}
</script>

<div class="rounded-lg p-4 transition-all"
	style="background:{c.bg}; border:1px solid {isConnected ? c.border.replace('0.2)','0.4)') : c.border};">

	<!-- Header row -->
	<div class="flex items-center justify-between mb-3">
		<div class="flex items-center gap-2">
			<span class="rounded px-1.5 py-0.5 text-[9px] font-black tracking-widest" style="background:{c.color}; color:{c.textOnBg};">{c.short}</span>
			<span class="text-sm font-semibold text-white">{c.label}</span>
		</div>
		<div class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
			style="background:{isConnected ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.04)'}; border:1px solid {isConnected ? 'rgba(0,255,136,0.25)' : 'rgba(255,255,255,0.08)'}; color:{isConnected ? '#00FF88' : '#4B5563'};">
			<span class="h-1.5 w-1.5 rounded-full {isConnected ? 'animate-pulse' : ''}" style="background:{isConnected ? '#00FF88' : '#4B5563'};"></span>
			{isConnected ? 'Live' : 'Offline'}
		</div>
	</div>

	{#if isConnected}
		<!-- Connected state -->
		<div class="rounded px-2.5 py-2 mb-3 text-xs" style="background:rgba(0,0,0,0.3);">
			{#if platform === 'twitch'}
				<span style="color:#8890AA;">Channel: </span><span class="font-semibold" style="color:{c.color};">#{status.channel}</span>
			{:else if platform === 'youtube'}
				<span style="color:#8890AA;">Live Chat ID: </span><span class="font-mono text-[10px]" style="color:#8890AA;">{status.liveChatId?.slice(0,24)}…</span>
			{:else if platform === 'kick'}
				<span style="color:#8890AA;">Channel: </span><span class="font-semibold" style="color:{c.color};">{status.channel}</span>
			{:else if platform === 'x'}
				<span style="color:#8890AA;">Receiving injected X messages</span>
			{/if}
			<span class="float-right font-mono text-[10px]" style="color:#4B5563;">{status.messageCount} msgs</span>
		</div>

		{#if platform === 'x'}
			<div class="rounded px-2.5 py-2 mb-3 text-[10px]" style="background:rgba(0,0,0,0.3); color:#4B5563;">
				<span class="font-mono" style="color:#8890AA;">POST</span> {typeof window !== 'undefined' ? window.location.origin : ''}/api/x/inject
				<br/><span class="mt-1 block">Body: <code style="color:#8890AA;">&#123;"username","message"&#125;</code></span>
			</div>
		{/if}

		<button on:click={handleDisconnect} disabled={loading}
			class="w-full rounded px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50"
			style="background:rgba(228,61,48,0.1); border:1px solid rgba(228,61,48,0.2); color:#E43D30;">
			{loading ? 'Disconnecting…' : 'Disconnect'}
		</button>

	{:else if platform === 'x'}
		<!-- X info -->
		<div class="space-y-2 text-xs" style="color:#4B5563;">
			<p class="leading-relaxed">No public API — inject messages via the endpoint below:</p>
			<div class="rounded px-2.5 py-2 font-mono text-[10px]" style="background:rgba(0,0,0,0.3); color:#8890AA;">
				POST {typeof window !== 'undefined' ? window.location.origin : ''}/api/x/inject<br/>
				<span style="color:#4B5563;">&#123; "username": "...", "message": "..." &#125;</span>
			</div>
		</div>

	{:else}
		<!-- Connect form -->
		<div class="space-y-2.5 mb-3">
			{#if platform === 'twitch'}
				<div>
					<label class="block text-[10px] font-semibold mb-1 tracking-wider uppercase" style="color:#4B5563;">Channel</label>
					<input bind:value={twitchChannel} type="text" placeholder="e.g. Banks"
						class="w-full rounded px-2.5 py-2 text-sm text-white outline-none transition-all"
						style="background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08);"
						onfocus="this.style.borderColor='{c.color}44'"
						onblur="this.style.borderColor='rgba(255,255,255,0.08)'"
						on:keydown={(e) => e.key === 'Enter' && handleConnect()} />
				</div>

			{:else if platform === 'youtube'}
				<div>
					<label class="block text-[10px] font-semibold mb-1 tracking-wider uppercase" style="color:#4B5563;">YouTube API Key</label>
					<input bind:value={youtubeApiKey} type="password" placeholder="AIza…"
						class="w-full rounded px-2.5 py-2 text-sm text-white outline-none transition-all"
						style="background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08);"
						onfocus="this.style.borderColor='rgba(255,0,0,0.4)'"
						onblur="this.style.borderColor='rgba(255,255,255,0.08)'" />
				</div>
				<div>
					<label class="block text-[10px] font-semibold mb-1 tracking-wider uppercase" style="color:#4B5563;">Live Chat ID</label>
					<input bind:value={youtubeLiveChatId} type="text" placeholder="Lc…"
						class="w-full rounded px-2.5 py-2 text-sm text-white outline-none transition-all"
						style="background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08);"
						onfocus="this.style.borderColor='rgba(255,0,0,0.4)'"
						onblur="this.style.borderColor='rgba(255,255,255,0.08)'" />
					<p class="mt-1 text-[10px]" style="color:#4B5563;">YouTube Studio → Live Control Room → Chat</p>
				</div>

			{:else if platform === 'kick'}
				<div>
					<label class="block text-[10px] font-semibold mb-1 tracking-wider uppercase" style="color:#4B5563;">Channel Slug</label>
					<input bind:value={kickChannel} type="text" placeholder="e.g. blknoiz06"
						class="w-full rounded px-2.5 py-2 text-sm text-white outline-none transition-all"
						style="background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08);"
						onfocus="this.style.borderColor='rgba(83,252,24,0.4)'"
						onblur="this.style.borderColor='rgba(255,255,255,0.08)'"
						on:keydown={(e) => e.key === 'Enter' && handleConnect()} />
				</div>
				<div>
					<label class="block text-[10px] font-semibold mb-1 tracking-wider uppercase" style="color:#53FC18;">
						Chatroom ID <span style="color:#4B5563;">(required)</span>
					</label>
					<input bind:value={kickChatroomId} type="text" placeholder="blknoiz06 = 1620530 · banks = 86037190"
						class="w-full rounded px-2.5 py-2 text-sm text-white outline-none transition-all"
						style="background:rgba(0,0,0,0.4); border:1px solid rgba(83,252,24,0.15);"
						onfocus="this.style.borderColor='rgba(83,252,24,0.5)'"
						onblur="this.style.borderColor='rgba(83,252,24,0.15)'"
						on:keydown={(e) => e.key === 'Enter' && handleConnect()} />
					<p class="mt-1 text-[10px]" style="color:#4B5563;">View Source on kick.com/channel → search <code style="color:#8890AA;">chatroomId</code></p>
				</div>
			{/if}
		</div>

		{#if errorMsg}
			<p class="mb-3 rounded px-2.5 py-2 text-[11px] leading-snug" style="background:rgba(228,61,48,0.1); border:1px solid rgba(228,61,48,0.25); color:#E43D30;">{errorMsg}</p>
		{/if}

		<button on:click={handleConnect} disabled={loading}
			class="w-full rounded px-3 py-2 text-xs font-bold transition-all disabled:opacity-50"
			style="background:{c.color}; color:{c.textOnBg};">
			{loading ? 'Connecting…' : `Connect ${c.label}`}
		</button>
	{/if}
</div>
