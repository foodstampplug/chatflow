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
		keywords,
		topChatters,
		addMessage,
		updateMessage,
		initState
	} from '$lib/stores/chat.js';
	import MessageItem from '$lib/components/MessageItem.svelte';
	import PlatformCard from '$lib/components/PlatformCard.svelte';
	import HypeMeter from '$lib/components/HypeMeter.svelte';
	import PolyTicker from '$lib/components/PolyTicker.svelte';
	import TokenRadar from '$lib/components/TokenRadar.svelte';

	let ws;
	let messageListEl;
	let autoScroll = true;
	let filterPlatform = 'all';
	let searchQuery = '';

	// ── Overlay position picker ────────────────────────────────────────────────
	let overlayPosition = 'bottom-right';
	const POSITIONS = [
		{ id: 'bottom-right', label: '↙', title: 'Bottom Right' },
		{ id: 'bottom-left',  label: '↘', title: 'Bottom Left'  },
		{ id: 'top-right',    label: '↗', title: 'Top Right'    },
		{ id: 'top-left',     label: '↖', title: 'Top Left'     }
	];

	$: overlayUrl = typeof window !== 'undefined'
		? `${window.location.origin}/overlay?position=${overlayPosition}`
		: `http://localhost:3000/overlay?position=${overlayPosition}`;

	function copyOverlayUrl() {
		navigator.clipboard.writeText(overlayUrl);
	}

	// ── Keywords panel ─────────────────────────────────────────────────────────
	let newKeyword = '';

	function addKeyword() {
		const kw = newKeyword.trim();
		if (!kw) return;
		keywords.update($kws => {
			if ($kws.includes(kw)) return $kws;
			const updated = [...$kws, kw];
			try { localStorage.setItem('chatflow_keywords', JSON.stringify(updated)); } catch {}
			return updated;
		});
		newKeyword = '';
	}

	function removeKeyword(kw) {
		keywords.update($kws => {
			const updated = $kws.filter(k => k !== kw);
			try { localStorage.setItem('chatflow_keywords', JSON.stringify(updated)); } catch {}
			return updated;
		});
	}

	function keywordKeydown(e) {
		if (e.key === 'Enter') addKeyword();
	}

	// ── Filtered messages ──────────────────────────────────────────────────────
	$: filteredMessages = (() => {
		let msgs = $visibleMessages;
		if (filterPlatform !== 'all') msgs = msgs.filter((m) => m.platform === filterPlatform);
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			msgs = msgs.filter(
				(m) => m.displayName.toLowerCase().includes(q) || m.message.toLowerCase().includes(q)
			);
		}
		return msgs.slice(0, 60);
	})();

	$: twitchCount  = $platformStatus.twitch?.messageCount  ?? 0;
	$: youtubeCount = $platformStatus.youtube?.messageCount ?? 0;
	$: kickCount    = $platformStatus.kick?.messageCount    ?? 0;
	$: xCount       = $platformStatus.x?.messageCount      ?? 0;
	$: totalCount   = twitchCount + youtubeCount + kickCount + xCount;
	$: isLive       = $connectedCount > 0;

	// ── Top chatters helpers ───────────────────────────────────────────────────
	$: topChattersList = $topChatters.slice(0, 8);
	$: topChatterMax   = topChattersList.length > 0 ? topChattersList[0].count : 1;

	const PLATFORM_COLORS = {
		twitch: '#9146FF', youtube: '#FF0000', kick: '#53FC18', x: '#E2E8F0'
	};
	const PLATFORM_LABELS = {
		twitch: 'TW', youtube: 'YT', kick: 'KICK', x: 'X'
	};

	// ── WebSocket message handler ─────────────────────────────────────────────
	function handleWsMessage({ event, data }) {
		switch (event) {
			case 'init':
				initState(data);
				break;
			case 'message':
				addMessage(data);
				if (autoScroll && messageListEl) setTimeout(() => { messageListEl.scrollTop = 0; }, 10);
				break;
			case 'message_update':
				updateMessage(data);
				break;
			case 'platform_status':
				platformStatus.set(data);
				break;
			case 'chatters':
				topChatters.set(data);
				break;
			case 'kick_reconnecting':
				// Surface reconnect status — the platformStatus will update when it reconnects
				break;
			case 'kick_error':
				console.warn('[Kick]', data.message);
				break;
		}
	}

	onMount(() => {
		// Restore keywords from localStorage
		try {
			const saved = localStorage.getItem('chatflow_keywords');
			if (saved) keywords.set(JSON.parse(saved));
		} catch {}

		ws = createWsClient({ onMessage: handleWsMessage, onStatusChange: (s) => wsStatus.set(s) });
		ws.connect();
	});
	onDestroy(() => ws?.disconnect());

	const WS_CFG = {
		connected:    { label: 'Live',         dot: '#00FF88' },
		connecting:   { label: 'Connecting',   dot: '#FF9500' },
		reconnecting: { label: 'Reconnecting', dot: '#FF9500' },
		disconnected: { label: 'Offline',      dot: '#4B5563' }
	};
	$: wsCfg = WS_CFG[$wsStatus] || WS_CFG.disconnected;

	const FILTERS = [
		{ id: 'all',     label: 'ALL',    color: '#8890AA' },
		{ id: 'twitch',  label: 'TWITCH', color: '#9146FF' },
		{ id: 'youtube', label: 'YT',     color: '#FF0000' },
		{ id: 'kick',    label: 'KICK',   color: '#53FC18' },
		{ id: 'x',       label: 'X',      color: '#FFFFFF' }
	];
</script>

<svelte:head>
	<title>ChatFlow — Market Bubble</title>
</svelte:head>

<div class="scanline-bg flex h-screen flex-col overflow-hidden" style="background:#0A0A0F; color:#F0F0F5;">

	<!-- ── Header ── -->
	<header class="camo-texture flex-shrink-0 z-10" style="background:#0A0A0F; border-bottom:1px solid rgba(46,92,255,0.12);">
		<div class="flex items-center justify-between px-5 py-3">

			<!-- Brand -->
			<div class="flex items-center gap-4">
				<div class="flex flex-col leading-none">
					<div class="flex items-center gap-1.5">
						<span class="live-dot-red" style="width:6px; height:6px;"></span>
						<span class="text-[11px] font-semibold tracking-[0.22em] uppercase" style="color:#2E5CFF; font-family:'JetBrains Mono',monospace;">MARKET BUBBLE</span>
					</div>
					<span class="font-black tracking-tight text-white mt-0.5" style="font-size:20px; font-weight:900; letter-spacing:-0.03em;">ChatFlow</span>
				</div>

				<div class="h-6 w-px" style="background:rgba(46,92,255,0.2);"></div>

				<!-- WS + LIVE status -->
				<div class="flex items-center gap-2">
					{#if isLive}
						<span class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-black tracking-widest"
							style="background:rgba(228,61,48,0.15); border:1px solid rgba(228,61,48,0.5); color:#E43D30; letter-spacing:0.18em;">
							<span class="live-dot-red"></span>LIVE
						</span>
					{/if}
					<span class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
						style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07);">
						<span class="h-1.5 w-1.5 rounded-full" style="background:{wsCfg.dot};"></span>
						<span style="color:#8890AA;">{wsCfg.label}</span>
					</span>
				</div>
			</div>

			<!-- Right: counters + actions -->
			<div class="flex items-center gap-3">
				<!-- Platform message counters -->
				<div class="hidden sm:flex items-center gap-1.5">
					{#each [
						{ label:'TW',   color:'#9146FF', count: twitchCount  },
						{ label:'YT',   color:'#FF0000', count: youtubeCount },
						{ label:'KICK', color:'#53FC18', count: kickCount    },
						{ label:'X',    color:'#E2E8F0', count: xCount       }
					] as p}
						<div class="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-semibold stat-mono"
							style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); color:{p.color};">
							{p.label}
							<span class="text-white font-bold">{p.count}</span>
						</div>
					{/each}
					<div class="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold stat-mono"
						style="background:rgba(46,92,255,0.12); border:1px solid rgba(46,92,255,0.25); color:#2E5CFF;">
						TOTAL <span class="text-white ml-0.5">{totalCount}</span>
					</div>
				</div>

				<button on:click={copyOverlayUrl}
					class="flex items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-semibold transition-all"
					style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#8890AA;"
					onmouseenter="this.style.borderColor='rgba(46,92,255,0.4)'; this.style.color='#2E5CFF';"
					onmouseleave="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.color='#8890AA';">
					<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="9" y="9" width="13" height="13" rx="2"></rect>
						<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
					</svg>
					Overlay URL
				</button>

				<a href="/overlay" target="_blank" rel="noopener noreferrer"
					class="flex items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-bold text-white transition-all"
					style="background:#2E5CFF;">
					<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
						<polyline points="15 3 21 3 21 9"></polyline>
						<line x1="10" y1="14" x2="21" y2="3"></line>
					</svg>
					Open Overlay
				</a>
			</div>
		</div>
		<div class="mb-accent-line"></div>
	</header>

	<!-- ── Polymarket Live Odds Ticker ── -->
	<PolyTicker />

	<!-- ── Hype Meter (full-width, between header and body) ── -->
	<HypeMeter />

	<!-- ── Body ── -->
	<div class="flex flex-1 overflow-hidden">

		<!-- Sidebar -->
		<aside class="flex-shrink-0 w-72 xl:w-80 overflow-y-auto p-4 space-y-3"
			style="background:#0A0A0F; border-right:1px solid rgba(46,92,255,0.1);">

			<p class="text-[10px] font-bold tracking-[0.2em] uppercase px-1" style="color:#2E5CFF; font-family:'JetBrains Mono',monospace;">PLATFORMS</p>

			<PlatformCard platform="twitch" />
			<PlatformCard platform="youtube" />
			<PlatformCard platform="kick" />
			<PlatformCard platform="x" />

			<!-- Stats -->
			<div class="rounded-lg p-4 space-y-3" style="background:#0F0F18; border:1px solid rgba(46,92,255,0.1);">
				<p class="text-[10px] font-bold tracking-[0.2em] uppercase" style="color:#2E5CFF; font-family:'JetBrains Mono',monospace;">SESSION</p>
				<div class="grid grid-cols-2 gap-2">
					{#each [
						{ label:'Connected',  val: $connectedCount,          color:'#2E5CFF' },
						{ label:'Messages',   val: $visibleMessages.length,  color:'#F0F0F5' },
						{ label:'Twitch',     val: twitchCount,              color:'#9146FF' },
						{ label:'YouTube',    val: youtubeCount,             color:'#FF4444' },
						{ label:'Kick',       val: kickCount,                color:'#53FC18' },
						{ label:'X',          val: xCount,                   color:'#8890AA' }
					] as s}
						<div class="rounded p-2.5" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);">
							<p class="text-xl font-black stat-mono leading-none" style="color:{s.color};">{s.val}</p>
							<p class="text-[10px] mt-1 font-medium" style="color:#4B5563;">{s.label}</p>
						</div>
					{/each}
				</div>
			</div>

			<!-- OBS Setup + Position Picker -->
			<div class="rounded-lg p-4 space-y-2.5" style="background:#0F0F18; border:1px solid rgba(46,92,255,0.1);">
				<p class="text-[10px] font-bold tracking-[0.2em] uppercase" style="color:#2E5CFF; font-family:'JetBrains Mono',monospace;">OBS SETUP</p>
				<p class="text-xs leading-relaxed" style="color:#4B5563;">Add Browser Source in OBS with this URL:</p>

				<!-- Position picker -->
				<div class="flex items-center gap-1.5 mb-1">
					<span class="text-[9px] font-semibold tracking-wider uppercase mr-1" style="color:#4B5563;">POS:</span>
					{#each POSITIONS as pos}
						<button
							on:click={() => overlayPosition = pos.id}
							class="h-6 w-6 flex items-center justify-center rounded text-sm transition-all"
							title={pos.title}
							style="
								background: {overlayPosition === pos.id ? 'rgba(46,92,255,0.2)' : 'rgba(255,255,255,0.04)'};
								border: 1px solid {overlayPosition === pos.id ? 'rgba(46,92,255,0.5)' : 'rgba(255,255,255,0.08)'};
								color: {overlayPosition === pos.id ? '#2E5CFF' : '#4B5563'};
							">
							{pos.label}
						</button>
					{/each}
				</div>

				<div class="rounded px-3 py-2 text-[10px] break-all font-mono"
					style="background:#0A0A0F; border:1px solid rgba(46,92,255,0.15); color:#8890AA;">
					{overlayUrl}
				</div>
				<button
					on:click={copyOverlayUrl}
					class="w-full rounded px-3 py-1.5 text-[10px] font-semibold transition-all"
					style="background:rgba(46,92,255,0.1); border:1px solid rgba(46,92,255,0.2); color:#2E5CFF;">
					Copy Overlay URL
				</button>
			</div>

			<!-- Keywords Panel -->
			<div class="rounded-lg p-4 space-y-2.5" style="background:#0F0F18; border:1px solid rgba(46,92,255,0.1);">
				<p class="text-[10px] font-bold tracking-[0.2em] uppercase" style="color:#2E5CFF; font-family:'JetBrains Mono',monospace;">KEYWORDS</p>
				<p class="text-[10px] leading-relaxed" style="color:#4B5563;">Messages containing these words get highlighted in amber.</p>

				<!-- Input row -->
				<div class="flex gap-1.5">
					<input
						bind:value={newKeyword}
						on:keydown={keywordKeydown}
						type="text"
						placeholder="e.g. moon, pump, rug..."
						class="flex-1 min-w-0 rounded px-2.5 py-1.5 text-[11px] text-white outline-none transition-all"
						style="background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08);"
						onfocus="this.style.borderColor='rgba(255,149,0,0.5)'"
						onblur="this.style.borderColor='rgba(255,255,255,0.08)'" />
					<button
						on:click={addKeyword}
						class="flex-shrink-0 rounded px-2.5 py-1.5 text-[11px] font-bold transition-all"
						style="background:rgba(255,149,0,0.15); border:1px solid rgba(255,149,0,0.3); color:#FF9500;">
						Add
					</button>
				</div>

				<!-- Keyword tags -->
				{#if $keywords.length > 0}
					<div class="flex flex-wrap gap-1.5 mt-1">
						{#each $keywords as kw}
							<span class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
								style="background:rgba(255,149,0,0.12); border:1px solid rgba(255,149,0,0.25); color:#FF9500;">
								{kw}
								<button
									on:click={() => removeKeyword(kw)}
									class="flex items-center justify-center h-3 w-3 rounded-full ml-0.5 transition-colors"
									style="color:rgba(255,149,0,0.6);"
									title="Remove">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="h-2 w-2">
										<line x1="18" y1="6" x2="6" y2="18"></line>
										<line x1="6" y1="6" x2="18" y2="18"></line>
									</svg>
								</button>
							</span>
						{/each}
					</div>
				{:else}
					<p class="text-[10px]" style="color:#2E3650;">No keywords yet.</p>
				{/if}
			</div>

			<!-- Top Chatters Panel -->
			<div class="rounded-lg p-4 space-y-2.5" style="background:#0F0F18; border:1px solid rgba(46,92,255,0.1);">
				<p class="text-[10px] font-bold tracking-[0.2em] uppercase" style="color:#2E5CFF; font-family:'JetBrains Mono',monospace;">TOP CHATTERS</p>

				{#if topChattersList.length === 0}
					<p class="text-[10px]" style="color:#2E3650;">Chat activity will appear here.</p>
				{:else}
					<div class="space-y-1.5">
						{#each topChattersList as chatter, i}
							{@const pColor = PLATFORM_COLORS[chatter.platform] ?? '#8890AA'}
							{@const pLabel = PLATFORM_LABELS[chatter.platform] ?? chatter.platform.toUpperCase()}
							{@const barPct = (chatter.count / topChatterMax) * 100}
							<div class="flex items-center gap-2">
								<!-- Rank -->
								<span class="text-[9px] stat-mono w-3 flex-shrink-0 text-right" style="color:{i === 0 ? '#FF9500' : '#2E3650'};">{i + 1}</span>

								<!-- Platform badge -->
								<span class="rounded px-1 py-0.5 text-[7px] font-black tracking-wide flex-shrink-0"
									style="background:{pColor}; color:{chatter.platform === 'kick' ? '#000' : chatter.platform === 'x' ? '#0A0A0F' : '#fff'}; min-width:20px; text-align:center;">
									{pLabel}
								</span>

								<!-- Username + count bar -->
								<div class="flex-1 min-w-0 flex flex-col gap-0.5">
									<div class="flex items-center justify-between">
										<span class="text-[10px] font-semibold truncate" style="color:{chatter.color && chatter.color !== '#000000' ? chatter.color : pColor};">
											{chatter.displayName}
										</span>
										<span class="text-[9px] stat-mono flex-shrink-0 ml-1" style="color:#4B5563;">{chatter.count}</span>
									</div>
									<!-- Count bar -->
									<div class="relative rounded-full overflow-hidden" style="height:2px; background:rgba(255,255,255,0.05);">
										<div class="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
											style="width:{barPct}%; background:{pColor}; opacity:0.7;">
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Token Radar Panel -->
			<TokenRadar />
		</aside>

		<!-- Main chat area -->
		<main class="flex flex-1 flex-col overflow-hidden">

			<!-- Pinned messages -->
			{#if $pinnedMessages.length > 0}
				<div class="flex-shrink-0 px-4 py-3"
					style="background:rgba(255,149,0,0.06); border-bottom:1px solid rgba(255,149,0,0.15);">
					<div class="flex items-center gap-2 mb-2">
						<svg class="h-3 w-3" viewBox="0 0 24 24" fill="#FF9500"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
						<span class="text-[10px] font-bold tracking-widest uppercase" style="color:#FF9500;">PINNED ({$pinnedMessages.length})</span>
					</div>
					<div class="space-y-1">
						{#each $pinnedMessages as msg (msg.id)}
							<MessageItem message={msg} />
						{/each}
					</div>
				</div>
			{/if}

			<!-- Filter + search bar -->
			<div class="flex-shrink-0 flex items-center gap-3 px-4 py-2"
				style="border-bottom:1px solid rgba(46,92,255,0.1); background:#0A0A0F;">

				<!-- Platform filter pills -->
				<div class="flex items-center rounded p-0.5 gap-0.5" style="background:rgba(255,255,255,0.04);">
					{#each FILTERS as f}
						<button on:click={() => filterPlatform = f.id}
							class="px-2.5 py-1 rounded text-[11px] font-bold tracking-wider transition-all"
							style={filterPlatform === f.id
								? `background:${f.color === '#FFFFFF' ? '#1E2040' : f.color + '33'}; color:${f.color}; border:1px solid ${f.color + '55'};`
								: 'color:#4B5563; border:1px solid transparent;'}>
							{f.label}
						</button>
					{/each}
				</div>

				<!-- Search -->
				<div class="relative flex-1 max-w-xs">
					<svg class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="#4B5563" stroke-width="2">
						<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
					</svg>
					<input bind:value={searchQuery} type="text" placeholder="Search..."
						class="w-full rounded pl-7 pr-3 py-1.5 text-xs transition-colors outline-none"
						style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:#F0F0F5;"
						onfocus="this.style.borderColor='rgba(46,92,255,0.4)'"
						onblur="this.style.borderColor='rgba(255,255,255,0.08)'" />
					{#if searchQuery}
						<button on:click={() => searchQuery = ''} class="absolute right-2 top-1/2 -translate-y-1/2" style="color:#4B5563;">
							<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</button>
					{/if}
				</div>

				<!-- Auto-scroll -->
				<div class="flex items-center gap-2 ml-auto">
					<span class="text-[11px]" style="color:#4B5563;">Auto-scroll</span>
					<button class="relative h-5 w-9 rounded-full transition-colors"
						style="background:{autoScroll ? '#2E5CFF' : '#1E2040'};"
						on:click={() => autoScroll = !autoScroll}
						role="switch" aria-checked={autoScroll}>
						<span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform
							{autoScroll ? 'translate-x-4' : 'translate-x-0.5'}"></span>
					</button>
				</div>

				<span class="text-[11px] stat-mono" style="color:#4B5563;">{filteredMessages.length}</span>
			</div>

			<!-- Message feed -->
			<div bind:this={messageListEl} class="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
				{#if filteredMessages.length === 0}
					<div class="flex flex-col items-center justify-center h-full text-center py-16 select-none">
						<div class="h-16 w-16 rounded-xl flex items-center justify-center mb-5"
							style="background:rgba(46,92,255,0.08); border:1px solid rgba(46,92,255,0.15);">
							<svg class="h-7 w-7" viewBox="0 0 24 24" fill="#2E5CFF" opacity="0.5">
								<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
							</svg>
						</div>
						<p class="font-semibold text-sm text-white">No messages</p>
						<p class="text-xs mt-1.5 max-w-[180px] leading-relaxed" style="color:#4B5563;">
							{$connectedCount === 0 ? 'Connect a platform to start the feed' : 'Waiting for chat...'}
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
