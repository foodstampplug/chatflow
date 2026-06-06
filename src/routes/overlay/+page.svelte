<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { createWsClient } from '$lib/ws.js';
	import { writable } from 'svelte/store';

	// URL params
	$: theme = $page.url.searchParams.get('theme') || 'dark';
	$: fontSize = $page.url.searchParams.get('fontSize') || 'medium';
	$: maxVisible = parseInt($page.url.searchParams.get('maxMessages') || '15', 10);
	$: fadeAfter = parseInt($page.url.searchParams.get('fadeAfter') || '30', 10) * 1000;

	const FONT_SIZE = {
		small:  { msg: 'text-sm',   name: 'text-xs',   badge: 'text-[10px]' },
		medium: { msg: 'text-base', name: 'text-sm',   badge: 'text-xs'     },
		large:  { msg: 'text-xl',   name: 'text-base', badge: 'text-sm'     }
	};

	$: fontConfig = FONT_SIZE[fontSize] || FONT_SIZE.medium;

	// Platform config
	const PLATFORM = {
		twitch:  { color: '#9146FF', label: 'TW',   textColor: '#fff', icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>` },
		youtube: { color: '#FF0000', label: 'YT',   textColor: '#fff', icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>` },
		kick:    { color: '#53FC18', label: 'KICK', textColor: '#000', icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><path d="M2 2h4v8.5l6-8.5h5l-7 9.5 7.5 10.5H12l-6-9V22H2V2z"/></svg>` },
		x:       { color: '#111',   label: 'X',    textColor: '#fff', icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>` }
	};

	const BADGE_LABELS = {
		broadcaster: 'LIVE',
		moderator: 'MOD',
		subscriber: 'SUB',
		vip: 'VIP',
		owner: 'OWNER',
		member: 'MEM'
	};

	const BADGE_COLORS = {
		broadcaster: '#dc2626',
		moderator: '#16a34a',
		subscriber: '#7c3aed',
		vip: '#db2777',
		owner: '#b91c1c',
		member: '#15803d'
	};

	// Overlay-local store — separate from dashboard
	const overlayMessages = writable([]);

	// Track connected count for LIVE indicator
	let connectedPlatforms = 0;

	let ws;
	let timers = {};
	// Track which message is "newest" for extra entrance energy
	let newestId = null;

	function addOverlayMessage(msg) {
		if (msg.hidden) return;

		newestId = msg.id;

		overlayMessages.update(($msgs) => {
			if ($msgs.find((m) => m.id === msg.id)) return $msgs;
			const updated = [...$msgs, { ...msg, fading: false, isNew: true }];
			// Remove isNew flag from all but the last after a tick
			setTimeout(() => {
				overlayMessages.update((ms) =>
					ms.map((m) => (m.id === msg.id ? { ...m, isNew: false } : m))
				);
			}, 600);
			return updated.slice(-maxVisible);
		});

		if (timers[msg.id]) clearTimeout(timers[msg.id]);
		timers[msg.id] = setTimeout(() => {
			overlayMessages.update(($msgs) =>
				$msgs.map((m) => (m.id === msg.id ? { ...m, fading: true } : m))
			);
			setTimeout(() => {
				overlayMessages.update(($msgs) => $msgs.filter((m) => m.id !== msg.id));
				delete timers[msg.id];
			}, 600);
		}, fadeAfter);
	}

	function handleWsMessage({ event, data }) {
		if (event === 'init') {
			const msgs = (data.messages || []).slice(-maxVisible);
			msgs.forEach((msg) => addOverlayMessage(msg));
			if (data.platforms) {
				connectedPlatforms = Object.values(data.platforms).filter((p) => p.connected).length;
			}
		} else if (event === 'message') {
			addOverlayMessage(data);
		} else if (event === 'message_update') {
			if (data.hidden) {
				overlayMessages.update(($msgs) => $msgs.filter((m) => m.id !== data.id));
			}
		} else if (event === 'platform_status') {
			connectedPlatforms = Object.values(data).filter((p) => p.connected).length;
		}
	}

	onMount(() => {
		ws = createWsClient({ onMessage: handleWsMessage });
		ws.connect();
	});

	onDestroy(() => {
		ws?.disconnect();
		Object.values(timers).forEach(clearTimeout);
	});

	function getDisplayName(msg) {
		return msg.displayName || msg.username || 'Anonymous';
	}

	function getPlatform(msg) {
		return PLATFORM[msg.platform] ?? PLATFORM.twitch;
	}

	function getUsernameColor(msg) {
		const p = getPlatform(msg);
		if (msg.color && msg.color !== '#000000' && msg.color !== '#000') return msg.color;
		return p.color;
	}
</script>

<svelte:head>
	<title>ChatFlow Overlay</title>
	<style>
		html, body {
			background: transparent !important;
			margin: 0;
			padding: 0;
			overflow: hidden;
		}
		/* Overlay-specific entrance animation with bounce overshoot */
		@keyframes overlaySlideIn {
			0%   { transform: translateX(110%) scale(0.94); opacity: 0; }
			55%  { transform: translateX(-3%) scale(1.01);  opacity: 1; }
			75%  { transform: translateX(1%) scale(1.00);  opacity: 1; }
			100% { transform: translateX(0)   scale(1);     opacity: 1; }
		}
		@keyframes overlayFadeOut {
			0%   { opacity: 1; transform: translateX(0) scale(1); }
			100% { opacity: 0; transform: translateX(6%) scale(0.97); }
		}
		.overlay-enter {
			animation: overlaySlideIn 0.48s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
		}
		.overlay-enter-energetic {
			animation: overlaySlideIn 0.44s cubic-bezier(0.36, 1.7, 0.58, 1) forwards;
		}
		.overlay-exit {
			animation: overlayFadeOut 0.55s ease-out forwards;
		}
		/* Overlay live pulse */
		@keyframes livePulse {
			0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); opacity: 1; }
			60%  { box-shadow: 0 0 0 6px rgba(239,68,68,0); opacity: 0.7; }
			100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); opacity: 1; }
		}
		.live-pulse-dot {
			width: 7px;
			height: 7px;
			border-radius: 50%;
			background: #ef4444;
			animation: livePulse 1.8s ease-in-out infinite;
		}
	</style>
</svelte:head>

<!-- Full-viewport transparent overlay for OBS browser source -->
<div class="fixed inset-0 pointer-events-none overflow-hidden">

	<!-- LIVE indicator — top right corner -->
	{#if connectedPlatforms > 0}
		<div class="absolute top-4 right-4 flex items-center gap-1.5 rounded-full px-3 py-1.5"
			style="background: rgba(0,0,0,0.65); backdrop-filter: blur(8px); border: 1px solid rgba(239,68,68,0.3);">
			<div class="live-pulse-dot"></div>
			<span style="font-family: Inter, system-ui, sans-serif; font-size: 11px; font-weight: 700; color: #ef4444; letter-spacing: 0.08em;">LIVE</span>
		</div>
	{/if}

	<!-- Message stack — bottom right, newest on top (visually at bottom) -->
	<div class="absolute bottom-4 right-4 flex flex-col gap-2 items-end" style="max-width: min(500px, calc(100vw - 2rem));">
		{#each $overlayMessages as msg (msg.id)}
			{@const p = getPlatform(msg)}
			<div
				class="{msg.fading ? 'overlay-exit' : (msg.isNew ? 'overlay-enter-energetic' : 'overlay-enter')}"
				style="
					width: fit-content;
					max-width: 100%;
					border-radius: 12px;
					overflow: hidden;
					display: flex;
					align-items: stretch;
					box-shadow: 0 4px 24px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.4);
					opacity: {msg.fading ? '0' : '1'};
					transition: opacity 0.55s ease;
				"
			>
				<!-- Colored left border accent -->
				<div style="width: 3px; background: {p.color}; flex-shrink: 0; border-radius: 0;"></div>

				<!-- Card body -->
				<div style="
					background: rgba(8, 10, 18, 0.82);
					backdrop-filter: blur(12px);
					-webkit-backdrop-filter: blur(12px);
					padding: 9px 14px 9px 12px;
					min-width: 0;
					flex: 1;
				">
					<!-- Top row: platform badge + username + role badges -->
					<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
						<!-- Platform badge -->
						<span style="
							display: inline-flex;
							align-items: center;
							gap: 3px;
							border-radius: 20px;
							padding: 1px 7px;
							font-size: 9px;
							font-weight: 800;
							text-transform: uppercase;
							letter-spacing: 0.06em;
							background: {p.color};
							color: {p.textColor};
							line-height: 1.6;
							flex-shrink: 0;
							{msg.platform === 'x' ? 'border: 1px solid #444;' : ''}
							font-family: Inter, system-ui, sans-serif;
						">
							{@html p.icon}
							{p.label}
						</span>

						<!-- Role badges -->
						{#each (msg.badges || []).slice(0, 2) as badge}
							<span style="
								border-radius: 4px;
								padding: 0 5px;
								font-size: 9px;
								font-weight: 700;
								text-transform: uppercase;
								letter-spacing: 0.04em;
								color: #fff;
								line-height: 1.6;
								background: {BADGE_COLORS[badge] ?? '#475569'};
								font-family: Inter, system-ui, sans-serif;
							">
								{BADGE_LABELS[badge] ?? badge}
							</span>
						{/each}

						<!-- Username -->
						<span style="
							font-weight: 700;
							font-size: {fontConfig.name === 'text-sm' ? '14px' : fontConfig.name === 'text-xs' ? '12px' : '16px'};
							color: {getUsernameColor(msg)};
							text-shadow: 0 1px 5px rgba(0,0,0,0.9);
							font-family: Inter, system-ui, sans-serif;
							line-height: 1.3;
						">
							{getDisplayName(msg)}
						</span>
					</div>

					<!-- Message text -->
					<p style="
						margin: 0;
						color: #f1f5f9;
						font-size: {fontConfig.msg === 'text-base' ? '15px' : fontConfig.msg === 'text-sm' ? '13px' : '18px'};
						line-height: 1.45;
						word-break: break-word;
						text-shadow: 0 1px 6px rgba(0,0,0,0.95);
						font-family: Inter, system-ui, sans-serif;
						font-weight: 400;
					">
						{msg.message}
					</p>
				</div>
			</div>
		{/each}
	</div>
</div>
