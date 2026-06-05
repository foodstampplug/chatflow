<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { createWsClient } from '$lib/ws.js';
	import { writable, derived } from 'svelte/store';
	import { fly, fade } from 'svelte/transition';

	// URL params — theme and fontSize
	$: theme = $page.url.searchParams.get('theme') || 'dark';
	$: fontSize = $page.url.searchParams.get('fontSize') || 'medium';
	$: maxVisible = parseInt($page.url.searchParams.get('maxMessages') || '15', 10);
	$: fadeAfter = parseInt($page.url.searchParams.get('fadeAfter') || '30', 10) * 1000; // ms

	const FONT_SIZE = {
		small: { msg: 'text-sm', name: 'text-xs', badge: 'text-[10px]' },
		medium: { msg: 'text-base', name: 'text-sm', badge: 'text-xs' },
		large: { msg: 'text-xl', name: 'text-base', badge: 'text-sm' }
	};

	const THEME_CLASSES = {
		dark: {
			container: 'bg-transparent',
			msgBg: 'bg-black/75 backdrop-blur-sm',
			text: 'text-white',
			subtext: 'text-gray-300',
			border: 'border-white/10'
		},
		light: {
			container: 'bg-transparent',
			msgBg: 'bg-white/90 backdrop-blur-sm',
			text: 'text-gray-900',
			subtext: 'text-gray-600',
			border: 'border-black/10'
		},
		minimal: {
			container: 'bg-transparent',
			msgBg: 'bg-transparent',
			text: 'text-white drop-shadow-lg',
			subtext: 'text-gray-200 drop-shadow-md',
			border: 'border-transparent'
		}
	};

	$: fontConfig = FONT_SIZE[fontSize] || FONT_SIZE.medium;
	$: themeConfig = THEME_CLASSES[theme] || THEME_CLASSES.dark;

	// Overlay message store — separate from dashboard, no hidden messages
	const overlayMessages = writable([]);

	let ws;
	let timers = {}; // messageId → timeout for fade-out

	function addOverlayMessage(msg) {
		if (msg.hidden) return;

		overlayMessages.update(($msgs) => {
			// Avoid duplicates
			if ($msgs.find((m) => m.id === msg.id)) return $msgs;

			const updated = [...$msgs, { ...msg, fading: false }];
			// Keep only maxVisible most recent
			return updated.slice(-maxVisible);
		});

		// Schedule fade-out
		if (timers[msg.id]) clearTimeout(timers[msg.id]);
		timers[msg.id] = setTimeout(() => {
			overlayMessages.update(($msgs) =>
				$msgs.map((m) => (m.id === msg.id ? { ...m, fading: true } : m))
			);
			// Remove after fade animation completes
			setTimeout(() => {
				overlayMessages.update(($msgs) => $msgs.filter((m) => m.id !== msg.id));
				delete timers[msg.id];
			}, 600);
		}, fadeAfter);
	}

	function handleWsMessage({ event, data }) {
		if (event === 'init') {
			// Show only last maxVisible messages on connect
			const msgs = (data.messages || []).slice(-maxVisible);
			msgs.forEach((msg) => addOverlayMessage(msg));
		} else if (event === 'message') {
			addOverlayMessage(data);
		} else if (event === 'message_update') {
			if (data.hidden) {
				overlayMessages.update(($msgs) => $msgs.filter((m) => m.id !== data.id));
			}
		}
	}

	onMount(() => {
		ws = createWsClient({
			onMessage: handleWsMessage
		});
		ws.connect();
	});

	onDestroy(() => {
		ws?.disconnect();
		Object.values(timers).forEach(clearTimeout);
	});

	function getDisplayName(msg) {
		return msg.displayName || msg.username || 'Anonymous';
	}

	const BADGE_LABELS = {
		broadcaster: 'LIVE',
		moderator: 'MOD',
		subscriber: 'SUB',
		vip: 'VIP',
		owner: 'OWNER',
		member: 'MEMBER'
	};
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
	</style>
</svelte:head>

<!-- Full viewport transparent overlay — meant to be used as OBS browser source -->
<div class="fixed inset-0 flex flex-col justify-end pointer-events-none overflow-hidden p-4 gap-1.5">
	{#each $overlayMessages as msg (msg.id)}
		<div
			in:fly={{ x: 400, duration: 380, opacity: 0 }}
			out:fade={{ duration: 500 }}
			class="flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 border max-w-xl self-end
             transition-opacity duration-300
             {themeConfig.msgBg} {themeConfig.border}
             {msg.fading ? 'opacity-0' : 'opacity-100'}"
			style="width: fit-content; max-width: min(480px, calc(100vw - 2rem));"
		>
			<!-- Platform pill -->
			<div class="flex-shrink-0 mt-0.5">
				{#if msg.platform === 'twitch'}
					<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider {fontConfig.badge} text-white" style="background:#9146FF;">
						<svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
						TW
					</span>
				{:else if msg.platform === 'youtube'}
					<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider {fontConfig.badge} text-white" style="background:#FF0000;">
						<svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
						YT
					</span>
				{:else if msg.platform === 'kick'}
					<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider {fontConfig.badge} text-black" style="background:#53FC18;">
						<svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M2 2h4v8.5l6-8.5h5l-7 9.5 7.5 10.5H12l-6-9V22H2V2z"/></svg>
						KICK
					</span>
				{:else if msg.platform === 'x'}
					<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider {fontConfig.badge} text-white" style="background:#000;border:1px solid #333;">
						<svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
						X
					</span>
				{/if}
			</div>

			<!-- Content -->
			<div class="min-w-0 flex-1">
				<!-- Username + badges row -->
				<div class="flex flex-wrap items-center gap-1 mb-0.5">
					{#if msg.badges && msg.badges.length > 0}
						{#each msg.badges.slice(0, 2) as badge}
							<span class="rounded px-1 py-0 font-semibold uppercase tracking-wide text-white {fontConfig.badge}"
								style="background: {badge === 'moderator' ? '#00ad03' : badge === 'broadcaster' ? '#e91916' : '#636363'}; font-size: 0.6rem;">
								{BADGE_LABELS[badge] || badge}
							</span>
						{/each}
					{/if}
					<span
						class="font-extrabold leading-tight {fontConfig.name}"
						style="color: {msg.color || (msg.platform === 'twitch' ? '#9146FF' : '#FF4444')}; text-shadow: 0 1px 3px rgba(0,0,0,0.8);"
					>
						{getDisplayName(msg)}
					</span>
				</div>

				<!-- Message text -->
				<p
					class="leading-snug break-words {fontConfig.msg} {themeConfig.text}"
					style="text-shadow: 0 1px 4px rgba(0,0,0,0.9);"
				>
					{msg.message}
				</p>
			</div>
		</div>
	{/each}
</div>
