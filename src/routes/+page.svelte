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
	<header class="flex-shrink-0 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm px-6 py-3 z-10">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<!-- Logo -->
				<div class="flex items-center gap-2">
					<div class="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center">
						<svg class="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
							<path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/>
						</svg>
					</div>
					<span class="text-lg font-bold text-white tracking-tight">ChatFlow</span>
				</div>

				<!-- WS status -->
				<div class="flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1">
					<span class="h-1.5 w-1.5 rounded-full {wsConfig.dotClass}"></span>
					<span class="text-xs font-medium {wsConfig.class}">{wsConfig.label}</span>
				</div>
			</div>

			<!-- Right side stats + actions -->
			<div class="flex items-center gap-4">
				<!-- Platform counters -->
				<div class="hidden sm:flex items-center gap-3 text-sm">
					<div class="flex items-center gap-1.5">
						<span class="h-2 w-2 rounded-full bg-[#9146FF]"></span>
						<span class="text-slate-400">TW</span>
						<span class="font-semibold text-white">{twitchCount}</span>
					</div>
					<div class="h-4 w-px bg-slate-700"></div>
					<div class="flex items-center gap-1.5">
						<span class="h-2 w-2 rounded-full bg-[#FF0000]"></span>
						<span class="text-slate-400">YT</span>
						<span class="font-semibold text-white">{youtubeCount}</span>
					</div>
					<div class="h-4 w-px bg-slate-700"></div>
					<div class="flex items-center gap-1.5">
						<span class="h-2 w-2 rounded-full bg-[#53FC18]"></span>
						<span class="text-slate-400">Kick</span>
						<span class="font-semibold text-white">{kickCount}</span>
					</div>
					<div class="h-4 w-px bg-slate-700"></div>
					<div class="flex items-center gap-1.5">
						<span class="h-2 w-2 rounded-full bg-white"></span>
						<span class="text-slate-400">X</span>
						<span class="font-semibold text-white">{xCount}</span>
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
					class="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-red-600
                 px-3 py-1.5 text-xs font-semibold text-white hover:from-purple-500 hover:to-red-500 transition-all"
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
	</header>

	<!-- ── Main layout ─────────────────────────────────────────────────────── -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Left sidebar: platform controls -->
		<aside class="flex-shrink-0 w-72 xl:w-80 border-r border-slate-800 overflow-y-auto p-4 space-y-4 bg-slate-900">
			<h2 class="text-xs font-semibold uppercase tracking-widest text-slate-500 px-1">Platforms</h2>

			<PlatformCard platform="twitch" />
			<PlatformCard platform="youtube" />
			<PlatformCard platform="kick" />
			<PlatformCard platform="x" />

			<!-- Stats card -->
			<div class="rounded-xl border border-slate-800 bg-slate-800/30 p-4 space-y-3">
				<h3 class="text-xs font-semibold uppercase tracking-widest text-slate-500">Session Stats</h3>
				<div class="grid grid-cols-2 gap-2">
					<div class="rounded-lg bg-slate-800 p-2.5">
						<p class="text-2xl font-bold text-white">{$connectedCount}</p>
						<p class="text-xs text-slate-400">Platforms</p>
					</div>
					<div class="rounded-lg bg-slate-800 p-2.5">
						<p class="text-2xl font-bold text-white">{$visibleMessages.length}</p>
						<p class="text-xs text-slate-400">Messages</p>
					</div>
					<div class="rounded-lg bg-[#9146FF]/20 border border-[#9146FF]/20 p-2.5">
						<p class="text-2xl font-bold text-[#9146FF]">{twitchCount}</p>
						<p class="text-xs text-slate-400">Twitch</p>
					</div>
					<div class="rounded-lg bg-[#FF0000]/20 border border-[#FF0000]/20 p-2.5">
						<p class="text-2xl font-bold text-[#FF0000]">{youtubeCount}</p>
						<p class="text-xs text-slate-400">YouTube</p>
					</div>
					<div class="rounded-lg bg-[#53FC18]/20 border border-[#53FC18]/20 p-2.5">
						<p class="text-2xl font-bold text-[#53FC18]">{kickCount}</p>
						<p class="text-xs text-slate-400">Kick</p>
					</div>
					<div class="rounded-lg bg-slate-700/50 border border-slate-600 p-2.5">
						<p class="text-2xl font-bold text-white">{xCount}</p>
						<p class="text-xs text-slate-400">X</p>
					</div>
				</div>
			</div>

			<!-- Overlay quick config hint -->
			<div class="rounded-xl border border-slate-800 bg-slate-800/30 p-4">
				<h3 class="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">OBS Setup</h3>
				<p class="text-xs text-slate-400 leading-relaxed mb-3">Add a Browser Source in OBS and paste the overlay URL:</p>
				<div class="rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-slate-300 break-all">
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
				<div class="flex-shrink-0 border-b border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
					<div class="flex items-center gap-2 mb-2">
						<span class="text-yellow-400 text-sm">&#x1F4CC;</span>
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
				<div class="flex rounded-lg bg-slate-800 p-0.5 gap-0.5 flex-wrap">
					{#each [
						{ id: 'all', label: 'All', activeClass: 'bg-slate-600 text-white' },
						{ id: 'twitch', label: 'Twitch', activeClass: 'bg-[#9146FF] text-white' },
						{ id: 'youtube', label: 'YT', activeClass: 'bg-[#FF0000] text-white' },
						{ id: 'kick', label: 'Kick', activeClass: 'bg-[#53FC18] text-black' },
						{ id: 'x', label: 'X', activeClass: 'bg-slate-200 text-black' }
					] as f}
						<button
							on:click={() => (filterPlatform = f.id)}
							class="px-3 py-1 rounded-md text-xs font-medium transition-all duration-150
                     {filterPlatform === f.id ? f.activeClass : 'text-slate-400 hover:text-white'}"
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
						class="relative h-5 w-9 rounded-full transition-colors {autoScroll ? 'bg-twitch' : 'bg-slate-700'}"
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

				<span class="text-xs text-slate-500">{filteredMessages.length} shown</span>
			</div>

			<!-- Message feed -->
			<div
				bind:this={messageListEl}
				class="flex-1 overflow-y-auto px-3 py-2 space-y-0.5"
			>
				{#if filteredMessages.length === 0}
					<div class="flex flex-col items-center justify-center h-full text-center py-16">
						<div class="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
							<svg class="h-8 w-8 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
								<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
							</svg>
						</div>
						<p class="text-slate-400 font-medium">No messages yet</p>
						<p class="text-slate-600 text-sm mt-1">
							{$connectedCount === 0
								? 'Connect a platform in the sidebar to start'
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
