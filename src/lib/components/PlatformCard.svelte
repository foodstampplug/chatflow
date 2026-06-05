<script>
	import { platformStatus } from '$lib/stores/chat.js';

	export let platform = 'twitch'; // 'twitch' | 'youtube' | 'kick' | 'x'

	let twitchChannel = '';
	let youtubeApiKey = '';
	let youtubeLiveChatId = '';
	let kickChannel = '';
	let loading = false;
	let errorMsg = '';

	$: status = $platformStatus[platform] ?? { connected: false, messageCount: 0 };
	$: isConnected = status.connected ?? false;

	const PLATFORM_CONFIG = {
		twitch: {
			label: 'Twitch', colorClass: 'twitch',
			border: 'border-[#9146FF]/30', bg: 'bg-[#9146FF]/10', text: 'text-[#9146FF]',
			btnBg: 'bg-[#9146FF] hover:bg-[#6B2ECC]',
			icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>`
		},
		youtube: {
			label: 'YouTube', colorClass: 'youtube',
			border: 'border-[#FF0000]/30', bg: 'bg-[#FF0000]/10', text: 'text-[#FF0000]',
			btnBg: 'bg-[#FF0000] hover:bg-[#CC0000]',
			icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>`
		},
		kick: {
			label: 'Kick', colorClass: 'kick',
			border: 'border-[#53FC18]/30', bg: 'bg-[#53FC18]/10', text: 'text-[#53FC18]',
			btnBg: 'bg-[#53FC18] hover:bg-[#3BC410] text-black',
			icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M2 2h4v8.5l6-8.5h5l-7 9.5 7.5 10.5H12l-6-9V22H2V2z"/></svg>`
		},
		x: {
			label: 'X (Twitter)', colorClass: 'xtwitter',
			border: 'border-slate-600', bg: 'bg-slate-800/50', text: 'text-white',
			btnBg: 'bg-slate-700 hover:bg-slate-600',
			icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`
		}
	};

	$: config = PLATFORM_CONFIG[platform];

	async function handleConnect() {
		errorMsg = '';
		loading = true;
		try {
			let endpoint, body;

			if (platform === 'twitch') {
				if (!twitchChannel.trim()) { errorMsg = 'Channel name is required'; return; }
				endpoint = '/api/twitch/connect';
				body = { channel: twitchChannel.trim() };
			} else if (platform === 'youtube') {
				if (!youtubeApiKey.trim()) { errorMsg = 'API key is required'; return; }
				if (!youtubeLiveChatId.trim()) { errorMsg = 'Live Chat ID is required'; return; }
				endpoint = '/api/youtube/connect';
				body = { apiKey: youtubeApiKey.trim(), liveChatId: youtubeLiveChatId.trim() };
			} else if (platform === 'kick') {
				if (!kickChannel.trim()) { errorMsg = 'Channel name is required'; return; }
				endpoint = '/api/kick/connect';
				body = { channel: kickChannel.trim() };
			}

			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.message || `Server error: ${res.status}`);
			}
		} catch (err) {
			errorMsg = err.message || 'Connection failed';
		} finally {
			loading = false;
		}
	}

	async function handleDisconnect() {
		errorMsg = '';
		loading = true;
		try {
			const endpointMap = {
				twitch: '/api/twitch/disconnect',
				youtube: '/api/youtube/disconnect',
				kick: '/api/kick/disconnect',
				x: '/api/x/status'
			};
			const body = platform === 'x' ? JSON.stringify({ connected: false }) : undefined;
			await fetch(endpointMap[platform], { method: 'POST', headers: body ? { 'Content-Type': 'application/json' } : {}, body });
		} catch (err) {
			errorMsg = err.message || 'Disconnect failed';
		} finally {
			loading = false;
		}
	}
</script>

<div class="rounded-xl border {config.border} {config.bg} p-5 transition-all duration-200">
	<div class="flex items-center justify-between mb-4">
		<div class="flex items-center gap-2.5">
			<span class="{config.text}">{@html config.icon}</span>
			<h3 class="text-base font-semibold text-white">{config.label}</h3>
		</div>
		<div class="flex items-center gap-2">
			{#if isConnected}
				<span class="flex items-center gap-1.5 rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-medium text-green-400">
					<span class="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse"></span>Live
				</span>
			{:else}
				<span class="flex items-center gap-1.5 rounded-full bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-400">
					<span class="h-1.5 w-1.5 rounded-full bg-slate-500"></span>Offline
				</span>
			{/if}
		</div>
	</div>

	{#if isConnected}
		<div class="mb-4 rounded-lg bg-slate-800/60 px-3 py-2.5">
			{#if platform === 'twitch'}
				<p class="text-sm text-slate-300">Connected to <span class="font-semibold text-[#9146FF]">#{status.channel}</span></p>
			{:else if platform === 'youtube'}
				<p class="text-sm text-slate-300">Polling live chat <span class="font-mono text-xs text-slate-400">{status.liveChatId?.slice(0, 20)}...</span></p>
			{:else if platform === 'kick'}
				<p class="text-sm text-slate-300">Connected to <span class="font-semibold text-[#53FC18]">{status.channel}</span></p>
			{:else if platform === 'x'}
				<p class="text-sm text-slate-300">Receiving injected <span class="font-semibold text-white">X</span> messages</p>
			{/if}
			<p class="text-xs text-slate-500 mt-1">{status.messageCount} message{status.messageCount !== 1 ? 's' : ''} received</p>
		</div>

		{#if platform === 'x'}
			<div class="mb-4 rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-400 leading-relaxed">
				Inject URL: <span class="font-mono text-slate-300 break-all">{typeof window !== 'undefined' ? window.location.origin : ''}/api/x/inject</span>
				<p class="mt-1 text-slate-500">POST with <code>&#123;username, message&#125;</code></p>
			</div>
		{/if}

		<button
			on:click={handleDisconnect}
			disabled={loading}
			class="w-full rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300
             hover:bg-red-600/80 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
		>
			{loading ? 'Disconnecting...' : 'Disconnect'}
		</button>

	{:else if platform === 'x'}
		<!-- X: no connect flow, just show injection info -->
		<div class="space-y-3 mb-4">
			<p class="text-xs text-slate-400 leading-relaxed">
				X live stream chat doesn't have a public API. Use the injection endpoint below from a browser script or extension watching Banks' stream.
			</p>
			<div class="rounded-lg bg-slate-900 px-3 py-2.5">
				<p class="text-[11px] font-mono text-slate-500 mb-1">POST {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/x/inject</p>
				<pre class="text-[11px] text-slate-400 leading-relaxed">&#123; "username": "...", "message": "..." &#125;</pre>
			</div>
			<p class="text-[11px] text-slate-500">Messages posted here appear in the feed labeled with the X badge.</p>
		</div>

	{:else}
		<div class="space-y-3 mb-4">
			{#if platform === 'twitch'}
				<div>
					<label for="twitch-channel" class="block text-xs font-medium text-slate-400 mb-1">Channel name</label>
					<input id="twitch-channel" bind:value={twitchChannel} type="text" placeholder="e.g. Banks"
						class="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white
                   placeholder:text-slate-600 focus:border-[#9146FF] focus:outline-none focus:ring-1 focus:ring-[#9146FF] transition-colors"
						on:keydown={(e) => e.key === 'Enter' && handleConnect()} />
				</div>

			{:else if platform === 'youtube'}
				<div>
					<label for="yt-api-key" class="block text-xs font-medium text-slate-400 mb-1">YouTube Data API v3 Key</label>
					<input id="yt-api-key" bind:value={youtubeApiKey} type="password" placeholder="AIza..."
						class="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white
                   placeholder:text-slate-600 focus:border-[#FF0000] focus:outline-none transition-colors" />
				</div>
				<div>
					<label for="yt-chat-id" class="block text-xs font-medium text-slate-400 mb-1">Live Chat ID</label>
					<input id="yt-chat-id" bind:value={youtubeLiveChatId} type="text" placeholder="Lc..."
						class="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white
                   placeholder:text-slate-600 focus:border-[#FF0000] focus:outline-none transition-colors" />
					<p class="mt-1 text-[11px] text-slate-500">YouTube Studio → Live Control Room → Chat</p>
				</div>

			{:else if platform === 'kick'}
				<div>
					<label for="kick-channel" class="block text-xs font-medium text-slate-400 mb-1">Channel name</label>
					<input id="kick-channel" bind:value={kickChannel} type="text" placeholder="e.g. Ansem"
						class="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white
                   placeholder:text-slate-600 focus:border-[#53FC18] focus:outline-none focus:ring-1 focus:ring-[#53FC18] transition-colors"
						on:keydown={(e) => e.key === 'Enter' && handleConnect()} />
					<p class="mt-1 text-[11px] text-slate-500">The channel slug from kick.com/&lt;channel&gt;</p>
				</div>
			{/if}
		</div>

		{#if errorMsg}
			<p class="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 border border-red-500/20">{errorMsg}</p>
		{/if}

		<button on:click={handleConnect} disabled={loading}
			class="w-full rounded-lg px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed {config.btnBg} {platform === 'kick' ? 'text-black' : 'text-white'}"
		>
			{loading ? 'Connecting...' : `Connect ${config.label}`}
		</button>
	{/if}
</div>
