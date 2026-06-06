<script>
	import { onMount, onDestroy } from 'svelte';
	import { createWsClient } from '$lib/ws.js';
	import {
		messages,
		visibleMessages,
		pinnedMessages,
		platformStatus,
		wsStatus,
		connectedCount,
		addMessage,
		updateMessage,
		initState
	} from '$lib/stores/chat.js';
	import MessageItem from '$lib/components/MessageItem.svelte';
	import PlatformCard from '$lib/components/PlatformCard.svelte';

	let ws;
	let messageListEl;
	let autoScroll = true;
	let filterPlatform = 'all'; // 'all' | 'twitch' | 'youtube' | 'kick' | 'x'
	let searchQuery = '';

	$: filteredMessages = (() => {
		let msgs = $visibleMessages;
		if (filterPlatform !== 'all') {
			msgs = msgs.filter((m) => m.platform === filterPlatform);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			msgs = msgs.filter(
				(m) =>
					m.displayName.toLowerCase().includes(q) ||
					m.message.toLowerCase().includes(q)
			);
		}
		return msgs.slice(0, 50);
	})();

	$: twitchCount = $platformStatus.twitch?.messageCount ?? 0;
	$: youtubeCount = $platformStatus.youtube?.messageCount ?? 0;
	$: kickCount = $platformStatus.kick?.messageCount ?? 0;
	$: xCount = $platformStatus.x?.messageCount ?? 0;

	$: isLive = $connectedCount > 0;

	function handleWsMessage({ event, data }) {
		switch (event) {
			case 'init':
				initState(data);
				break;
			case 'message':
				addMessage(data);
				if (autoScroll && messageListEl) {
					setTimeout(() => {
						messageListEl.scrollTop = 0;
					}, 10);
				}
				break;
			case 'message_update':
				updateMessage(data);
				break;
			case 'platform_status':
				platformStatus.set(data);
				break;
			case 'youtube_error':
				console.error('YouTube error:', data);
				break;
		}
	}

	onMount(() => {
		ws = createWsClient({
			onMessage: handleWsMessage,
			onStatusChange: (status) => wsStatus.set(status)
		});
		ws.connect();
	});

	onDestroy(() => {
		ws?.disconnect();
	});

	const WS_STATUS_CONFIG = {
		connected: { label: 'Connected', class: 'text-green-400', dotClass: 'bg-green-400' },
		connecting: { label: 'Connecting', class: 'text-yellow-400', dotClass: 'bg-yellow-400 animate-pulse' },
		reconnecting: { label: 'Reconnecting', class: 'text-orange-400', dotClass: 'bg-orange-400 animate-pulse' },
		disconnected: { label: 'Disconnected', class: 'text-slate-500', dotClass: 'bg-slate-500' }
	};
	$: wsConfig = WS_STATUS_CONFIG[$wsStatus] || WS_STATUS_CONFIG.disconnected;

	function copyOverlayUrl() {
		const url = `${window.location.origin}/overlay`;
		navigator.clipboard.writeText(url);
	}
</script>

<svelte:head>
	<title>ChatFlow — Dashboard</title>
</svelte:head>

<div class="flex h-screen flex-col bg-slate-900 overflow-hidden">
	<!-- ── Top bar ──────────────────────────────────────────────────────────── -->
	<header class="flex-shrink-0 bg-slate-900/95 backdrop-blur-sm z-10">
		<div class="flex items-center justify-between px-6 py-3">
			<div class="flex items-center gap-3">
				<!-- CF monogram logo -->
				<div class="flex items-center gap-2.5">
					<div
						class="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
						style="background: linear-gradient(135deg, #9146FF 0%, #53FC18 100%); box-shadow: 0 0 20px rgba(145,70,255,0.4), 0 0 40px rgba(83,252,24,0.2);"
					>
						<span class="text-[13px] font-black text-white tracking-tighter leading-none select-none"
							style="text-shadow: 0 1px 3px rgba(0,0,0,0.4);">CF</span>
					</div>
					<div class="flex flex-col gap-0">
						<span class="text-lg font-bold text-white tracking-tight leading-tight" style="font-family: 'Space Grotesk', system-ui, sans-serif;">ChatFlow</span>
						<span class="text-slate-500 leading-tight select-none" style="font-size: 10px; font-family: 'Space Grotesk', system-ui, sans-serif;">for Market Bubble</span>
					</div>
				</div>

				<!-- LIVE indicator -->
				{#if isLive}
					<div class="flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/25 px-2.5 py-1">
						<span class="live-dot"></span>
						<span class="text-xs font-bold text-red-400 tracking-wider">LIVE</span>
					</div>
				{/if}

				<!-- WS status -->
				<div class="flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1">
					<span class="h-1.5 w-1.5 rounded-full {wsConfig.dotClass}"></span>
					<span class="text-xs font-medium {wsConfig.class}">{wsConfig.label}</span>
				</div>
			</div>

			<!-- Right side stats + actions -->
			<div class="flex items-center gap-4">
				<!-- Platform counters — pill badges with platform colors -->
				<div class="hidden sm:flex items-center gap-2">
					<div class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-200 cursor-default"
						style="background: rgba(145,70,255,0.15); border: 1px solid rgba(145,70,255,0.3); color: #9146FF; font-family: 'Space Grotesk', system-ui, sans-serif;"
						onmouseenter="this.style.boxShadow='0 0 10px rgba(145,70,255,0.6), 0 0 20px rgba(145,70,255,0.3)'"
						onmouseleave="this.style.boxShadow='none'">
						<span class="h-1.5 w-1.5 rounded-full flex-shrink-0" style="background:#9146FF;"></span>
						TW <span class="text-white font-bold ml-0.5">{twitchCount}</span>
					</div>
					<div class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-200 cursor-default"
						style="background: rgba(255,0,0,0.12); border: 1px solid rgba(255,0,0,0.3); color: #FF4444; font-family: 'Space Grotesk', system-ui, sans-serif;"
						onmouseenter="this.style.boxShadow='0 0 10px rgba(255,0,0,0.6), 0 0 20px rgba(255,0,0,0.3)'"
						onmouseleave="this.style.boxShadow='none'">
						<span class="h-1.5 w-1.5 rounded-full flex-shrink-0" style="background:#FF0000;"></span>
						YT <span class="text-white font-bold ml-0.5">{youtubeCount}</span>
					</div>
					<div class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-200 cursor-default"
						style="background: rgba(83,252,24,0.1); border: 1px solid rgba(83,252,24,0.3); color: #53FC18; font-family: 'Space Grotesk', system-ui, sans-serif;"
						onmouseenter="this.style.boxShadow='0 0 10px rgba(83,252,24,0.6), 0 0 20px rgba(83,252,24,0.3)'"
						onmouseleave="this.style.boxShadow='none'">
						<span class="h-1.5 w-1.5 rounded-full flex-shrink-0" style="background:#53FC18;"></span>
						Kick <span class="text-white font-bold ml-0.5">{kickCount}</span>
					</div>
					<div class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-200 cursor-default"
						style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: #aaa; font-family: 'Space Grotesk', system-ui, sans-serif;"
						onmouseenter="this.style.boxShadow='0 0 8px rgba(255,255,255,0.3)'"
						onmouseleave="this.style.boxShadow='none'">
						<span class="h-1.5 w-1.5 rounded-full flex-shrink-0 bg-slate-300"></span>
						X <span class="text-white font-bold ml-0.5">{xCount}</span>
					</div>
				</div>

				<!-- Overlay URL copy button -->
				<button
					on:click={copyOverlayUrl}
					class="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium
                 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
					title="Copy OBS overlay URL"
				>
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
						<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
					</svg>
					Copy Overlay URL
				</button>

				<!-- Open overlay -->
				<a
					href="/overlay"
					target="_blank"
					rel="noopener noreferrer"
					class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white
                 hover:opacity-90 transition-all"
					style="background: linear-gradient(135deg, #7c3aed, #dc2626);"
				>
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
						<polyline points="15 3 21 3 21 9"></polyline>
						<line x1="10" y1="14" x2="21" y2="3"></line>
					</svg>
					Open Overlay
				</a>
			</div>
		</div>

		<!-- Platform gradient accent line -->
		<div class="platform-gradient-line"></div>
	</header>

	<!-- ── Main layout ─────────────────────────────────────────────────────── -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Left sidebar: platform controls -->
		<aside class="sidebar-texture flex-shrink-0 w-72 xl:w-80 border-r border-slate-800 overflow-y-auto p-4 space-y-4 bg-slate-900/80">
			<h2 class="text-[11px] font-semibold uppercase tracking-widest text-slate-500 px-1">Platforms</h2>

			<PlatformCard platform="twitch" />
			<PlatformCard platform="youtube" />
			<PlatformCard platform="kick" />
			<PlatformCard platform="x" />

			<!-- Stats card -->
			<div class="rounded-xl border border-slate-800 bg-slate-800/30 p-4 space-y-3">
				<h3 class="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Session Stats</h3>
				<div class="grid grid-cols-2 gap-2">
					<div class="rounded-lg bg-slate-800 p-2.5">
						<p class="text-2xl font-bold text-white">{$connectedCount}</p>
						<p class="text-xs text-slate-400 mt-0.5">Platforms</p>
					</div>
					<div class="rounded-lg bg-slate-800 p-2.5">
						<p class="text-2xl font-bold text-white">{$visibleMessages.length}</p>
						<p class="text-xs text-slate-400 mt-0.5">Messages</p>
					</div>
					<div class="rounded-lg p-2.5" style="background: rgba(145,70,255,0.12); border: 1px solid rgba(145,70,255,0.2);">
						<p class="text-2xl font-bold" style="color:#9146FF;">{twitchCount}</p>
						<p class="text-xs text-slate-400 mt-0.5">Twitch</p>
					</div>
					<div class="rounded-lg p-2.5" style="background: rgba(255,0,0,0.1); border: 1px solid rgba(255,0,0,0.2);">
						<p class="text-2xl font-bold" style="color:#FF4444;">{youtubeCount}</p>
						<p class="text-xs text-slate-400 mt-0.5">YouTube</p>
					</div>
					<div class="rounded-lg p-2.5" style="background: rgba(83,252,24,0.08); border: 1px solid rgba(83,252,24,0.2);">
						<p class="text-2xl font-bold" style="color:#53FC18;">{kickCount}</p>
						<p class="text-xs text-slate-400 mt-0.5">Kick</p>
					</div>
					<div class="rounded-lg bg-slate-800/60 border border-slate-700 p-2.5">
						<p class="text-2xl font-bold text-white">{xCount}</p>
						<p class="text-xs text-slate-400 mt-0.5">X</p>
					</div>
				</div>
			</div>

			<!-- OBS Setup hint -->
			<div class="rounded-xl border border-slate-800 bg-slate-800/30 p-4">
				<h3 class="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">OBS Setup</h3>
				<p class="text-xs text-slate-400 leading-relaxed mb-3">Add a Browser Source in OBS and paste the overlay URL:</p>
				<div class="rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-slate-300 break-all border border-slate-800">
					{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/overlay
				</div>
				<p class="mt-2 text-xs text-slate-500">
					Tip: append <code class="text-slate-400">?theme=dark</code> or <code class="text-slate-400">?fontSize=large</code>
				</p>
			</div>
		</aside>

		<!-- Main content: pinned + chat feed -->
		<main class="flex flex-1 flex-col overflow-hidden">
			<!-- Pinned messages section -->
			{#if $pinnedMessages.length > 0}
				<div class="flex-shrink-0 border-b border-yellow-500/20 bg-gradient-to-r from-yellow-500/10 to-transparent px-4 py-3">
					<div class="flex items-center gap-2 mb-2">
						<svg class="h-3.5 w-3.5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
							<path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
						</svg>
						<h3 class="text-xs font-semibold uppercase tracking-wider text-yellow-400">
							Pinned ({$pinnedMessages.length})
						</h3>
					</div>
					<div class="space-y-1">
						{#each $pinnedMessages as msg (msg.id)}
							<MessageItem message={msg} />
						{/each}
					</div>
				</div>
			{/if}

			<!-- Filter + search bar -->
			<div class="flex-shrink-0 border-b border-slate-800 bg-slate-900/80 px-4 py-2.5 flex items-center gap-3">
				<!-- Filter tabs -->
				<div class="flex rounded-lg bg-slate-800/80 p-0.5 gap-0.5">
					{#each [
						{ id: 'all', label: 'All', activeStyle: 'background:#475569; color:#fff;' },
						{ id: 'twitch', label: 'Twitch', activeStyle: 'background:#9146FF; color:#fff;' },
						{ id: 'youtube', label: 'YT', activeStyle: 'background:#FF0000; color:#fff;' },
						{ id: 'kick', label: 'Kick', activeStyle: 'background:#53FC18; color:#000;' },
						{ id: 'x', label: 'X', activeStyle: 'background:#e2e8f0; color:#000;' }
					] as f}
						<button
							on:click={() => (filterPlatform = f.id)}
							class="px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150"
							style={filterPlatform === f.id ? f.activeStyle : 'color: #64748b;'}
						>
							{f.label}
						</button>
					{/each}
				</div>

				<!-- Search -->
				<div class="relative flex-1 max-w-xs">
					<svg class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
					</svg>
					<input
						bind:value={searchQuery}
						type="text"
						placeholder="Search messages..."
						class="w-full rounded-lg bg-slate-800 border border-slate-700 pl-8 pr-3 py-1.5 text-xs text-white
                   placeholder:text-slate-600 focus:border-slate-500 focus:outline-none transition-colors"
					/>
					{#if searchQuery}
						<button
							on:click={() => (searchQuery = '')}
							aria-label="Clear search"
							class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
						>
							<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</button>
					{/if}
				</div>

				<!-- Auto-scroll toggle -->
				<div class="flex items-center gap-2 ml-auto cursor-pointer">
					<span class="text-xs text-slate-400">Auto-scroll</span>
					<button
						class="relative h-5 w-9 rounded-full transition-colors"
						style={autoScroll ? 'background:#9146FF;' : 'background:#334155;'}
						on:click={() => (autoScroll = !autoScroll)}
						role="switch"
						aria-checked={autoScroll}
						aria-label="Toggle auto-scroll"
					>
						<span
							class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform
                     {autoScroll ? 'translate-x-4' : 'translate-x-0.5'}"
						></span>
					</button>
				</div>

				<span class="text-xs text-slate-600 tabular-nums">{filteredMessages.length}</span>
			</div>

			<!-- Message feed -->
			<div
				bind:this={messageListEl}
				class="flex-1 overflow-y-auto px-3 py-2 space-y-0.5"
			>
				{#if filteredMessages.length === 0}
					<div class="flex flex-col items-center justify-center h-full text-center py-16 select-none">
						<!-- Polished empty state -->
						<div class="relative mb-6">
							<div class="h-20 w-20 rounded-2xl flex items-center justify-center"
								style="background: linear-gradient(135deg, rgba(145,70,255,0.15), rgba(83,252,24,0.08)); border: 1px solid rgba(145,70,255,0.2);">
								<svg class="h-9 w-9 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
									<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
								</svg>
							</div>
							<!-- Decorative dots -->
							<div class="absolute -top-1 -right-1 h-3 w-3 rounded-full" style="background:#9146FF; opacity:0.5;"></div>
							<div class="absolute -bottom-1 -left-1 h-2 w-2 rounded-full" style="background:#53FC18; opacity:0.5;"></div>
						</div>
						<p class="text-slate-300 font-semibold text-sm">No messages yet</p>
						<p class="text-slate-600 text-xs mt-1.5 max-w-[200px] leading-relaxed">
							{$connectedCount === 0
								? 'Connect a platform in the sidebar to get started'
								: 'Waiting for chat messages...'}
						</p>
					</div>
				{:else}
					{#each filteredMessages as msg (msg.id)}
						<MessageItem message={msg} />
					{/each}
				{/if}
			</div>
		</main>
	</div>
</div>
