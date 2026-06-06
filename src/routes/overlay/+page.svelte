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

		/* Premium entrance: slides from right with vertical settle and scale pop */
		@keyframes overlaySlideIn {
			0%   { transform: translateX(100%) translateY(4px) scale(0.96); opacity: 0; }
			60%  { transform: translateX(-2%) translateY(0) scale(1.01); opacity: 1; }
			100% { transform: translateX(0) translateY(0) scale(1); opacity: 1; }
		}
		@keyframes overlayFadeOut {
			0%   { opacity: 1; transform: translateX(0) scale(1); }
			100% { opacity: 0; transform: translateX(8%) scale(0.96); }
		}
		.overlay-enter {
			animation: overlaySlideIn 0.52s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
		}
		.overlay-enter-energetic {
			animation: overlaySlideIn 0.44s cubic-bezier(0.36, 1.7, 0.58, 1) forwards;
		}
		.overlay-exit {
			animation: overlayFadeOut 0.55s ease-out forwards;
		}

		/* LIVE dot pulse */
		@keyframes livePulse {
			0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.75); opacity: 1; }
			60%  { box-shadow: 0 0 0 7px rgba(239,68,68,0); opacity: 0.75; }
			100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); opacity: 1; }
		}
		.live-pulse-dot {
			width: 7px;
			height: 7px;
			border-radius: 50%;
			background: #ef4444;
			animation: livePulse 1.8s ease-in-out infinite;
			flex-shrink: 0;
		}

		/* Divider line between branding and LIVE pill */
		.brand-divider {
			width: 100%;
			height: 1px;
			background: linear-gradient(90deg, #9146FF 0%, #53FC18 50%, #FF0000 100%);
			opacity: 0.55;
			margin: 5px 0;
		}
	</style>
</svelte:head>

<!-- Full-viewport transparent overlay for OBS browser source -->
<div style="position: fixed; inset: 0; pointer-events: none; overflow: hidden;">

	<!-- Top-right branding block -->
	<div style="
		position: absolute;
		top: 16px;
		right: 16px;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0;
	">
		<!-- Market Bubble wordmark -->
		<div style="
			background: rgba(6, 8, 16, 0.82);
			backdrop-filter: blur(16px);
			-webkit-backdrop-filter: blur(16px);
			border-radius: 10px;
			padding: 8px 14px 6px 14px;
			border: 1px solid rgba(255,255,255,0.06);
			box-shadow: 0 4px 24px rgba(0,0,0,0.6);
			display: flex;
			flex-direction: column;
			align-items: flex-end;
			gap: 0;
			min-width: 140px;
		">
			<span style="
				font-family: 'Space Grotesk', system-ui, sans-serif;
				font-weight: 900;
				font-size: 15px;
				letter-spacing: -0.02em;
				background: linear-gradient(135deg, #fff 0%, #aaa 100%);
				background-clip: text;
				-webkit-background-clip: text;
				color: transparent;
				line-height: 1.2;
				display: block;
			">MARKET BUBBLE</span>

			<div class="brand-divider"></div>

			<span style="
				font-family: 'Space Grotesk', system-ui, sans-serif;
				font-size: 9px;
				font-weight: 600;
				letter-spacing: 0.18em;
				text-transform: uppercase;
				color: #64748b;
				line-height: 1.2;
				display: block;
			">LIVE CHAT</span>
		</div>

		<!-- LIVE indicator pill — sits below the branding block -->
		{#if connectedPlatforms > 0}
			<div style="
				margin-top: 6px;
				display: flex;
				align-items: center;
				gap: 6px;
				border-radius: 20px;
				padding: 5px 12px;
				background: rgba(6, 8, 16, 0.85);
				backdrop-filter: blur(16px);
				-webkit-backdrop-filter: blur(16px);
				border: 1px solid rgba(239,68,68,0.4);
				box-shadow: 0 0 12px rgba(239,68,68,0.2), 0 2px 8px rgba(0,0,0,0.5);
				align-self: flex-end;
			">
				<div class="live-pulse-dot"></div>
				<span style="
					font-family: 'Space Grotesk', system-ui, sans-serif;
					font-size: 11px;
					font-weight: 700;
					color: #ef4444;
					letter-spacing: 0.1em;
					line-height: 1;
				">LIVE</span>
			</div>
		{/if}
	</div>

	<!-- Message stack — bottom right, newest visually at bottom -->
	<div style="
		position: absolute;
		bottom: 16px;
		right: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: flex-end;
		max-width: min(480px, calc(100vw - 2rem));
	">
		{#each $overlayMessages as msg (msg.id)}
			{@const p = getPlatform(msg)}
			{@const platformKey = msg.platform || 'twitch'}
			{@const glowMap = {
				twitch:  'rgba(145,70,255,0.35)',
				youtube: 'rgba(255,0,0,0.35)',
				kick:    'rgba(83,252,24,0.3)',
				x:       'rgba(255,255,255,0.1)'
			}}
			{@const badgeGlowMap = {
				twitch:  '0 0 10px rgba(145,70,255,0.6), 0 0 20px rgba(145,70,255,0.3)',
				youtube: '0 0 10px rgba(255,0,0,0.6), 0 0 20px rgba(255,0,0,0.3)',
				kick:    '0 0 10px rgba(83,252,24,0.6), 0 0 20px rgba(83,252,24,0.3)',
				x:       '0 0 8px rgba(255,255,255,0.3)'
			}}
			{@const usernameGlowMap = {
				twitch:  '0 0 12px rgba(145,70,255,0.8)',
				youtube: '0 0 12px rgba(255,0,0,0.8)',
				kick:    '0 0 12px rgba(83,252,24,0.8)',
				x:       '0 0 12px rgba(255,255,255,0.5)'
			}}
			{@const outerGlow = glowMap[platformKey] ?? glowMap.twitch}
			{@const badgeGlow = badgeGlowMap[platformKey] ?? badgeGlowMap.twitch}
			{@const usernameGlow = usernameGlowMap[platformKey] ?? usernameGlowMap.twitch}
			<div
				class="{msg.fading ? 'overlay-exit' : (msg.isNew ? 'overlay-enter-energetic' : 'overlay-enter')}"
				style="
					width: fit-content;
					max-width: 100%;
					border-radius: 10px;
					overflow: hidden;
					display: flex;
					align-items: stretch;
					box-shadow: 0 4px 28px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04), 0 2px 40px {outerGlow};
					opacity: {msg.fading ? '0' : '1'};
					transition: opacity 0.55s ease;
				"
			>
				<!-- Left border accent — platform color with matching glow -->
				<div style="
					width: 3px;
					background: {p.color};
					flex-shrink: 0;
					box-shadow: 2px 0 12px {outerGlow};
				"></div>

				<!-- Card body -->
				<div style="
					background: rgba(6, 8, 16, 0.88);
					backdrop-filter: blur(16px);
					-webkit-backdrop-filter: blur(16px);
					padding: 10px 14px 10px 12px;
					min-width: 0;
					flex: 1;
					display: flex;
					flex-direction: column;
					gap: 5px;
				">
					<!-- Top row: platform badge + role badges + username -->
					<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">

						<!-- Platform badge — pill with glow -->
						<span style="
							display: inline-flex;
							align-items: center;
							gap: 4px;
							border-radius: 20px;
							padding: 2px 8px 2px 6px;
							font-size: 9px;
							font-weight: 700;
							text-transform: uppercase;
							letter-spacing: 0.07em;
							background: {p.color};
							color: {p.textColor};
							line-height: 1.6;
							flex-shrink: 0;
							font-family: 'Space Grotesk', system-ui, sans-serif;
							box-shadow: {badgeGlow};
							{platformKey === 'x' ? 'border: 1px solid #333;' : ''}
						">
							{@html p.icon}
							{p.label}
						</span>

						<!-- Role badges -->
						{#each (msg.badges || []).slice(0, 2) as badge}
							<span style="
								border-radius: 4px;
								padding: 1px 5px;
								font-size: 9px;
								font-weight: 700;
								text-transform: uppercase;
								letter-spacing: 0.05em;
								color: #fff;
								line-height: 1.6;
								background: {BADGE_COLORS[badge] ?? '#475569'};
								font-family: 'Space Grotesk', system-ui, sans-serif;
							">
								{BADGE_LABELS[badge] ?? badge}
							</span>
						{/each}

						<!-- Username -->
						<span style="
							font-weight: 700;
							font-size: {fontConfig.name === 'text-sm' ? '14px' : fontConfig.name === 'text-xs' ? '12px' : '16px'};
							color: {getUsernameColor(msg)};
							text-shadow: {usernameGlow};
							font-family: 'Space Grotesk', system-ui, sans-serif;
							line-height: 1.3;
						">
							{getDisplayName(msg)}
						</span>
					</div>

					<!-- Message text -->
					<p style="
						margin: 0;
						color: rgba(255,255,255,0.92);
						font-size: {fontConfig.msg === 'text-base' ? '14px' : fontConfig.msg === 'text-sm' ? '13px' : '17px'};
						line-height: 1.5;
						word-break: break-word;
						text-shadow: 0 1px 6px rgba(0,0,0,0.95);
						font-family: 'Space Grotesk', system-ui, sans-serif;
						font-weight: 400;
					">
						{msg.message}
					</p>
				</div>
			</div>
		{/each}
	</div>
</div>
