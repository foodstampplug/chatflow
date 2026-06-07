<script>
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { createWsClient } from '$lib/ws.js';
	import { writable } from 'svelte/store';

	$: maxVisible = parseInt($page.url.searchParams.get('maxMessages') || '12', 10);
	$: fadeAfter  = parseInt($page.url.searchParams.get('fadeAfter')  || '25', 10) * 1000;

	// ── Position parameter ─────────────────────────────────────────────────────
	// bottom-right (default) | bottom-left | top-right | top-left
	$: position = $page.url.searchParams.get('position') || 'bottom-right';

	// Map position → CSS for the message stack container
	$: stackStyle = (() => {
		switch (position) {
			case 'bottom-left':
				return 'position:absolute; bottom:18px; left:18px; align-items:flex-start;';
			case 'top-right':
				return 'position:absolute; top:18px; right:18px; align-items:flex-end;';
			case 'top-left':
				return 'position:absolute; top:18px; left:18px; align-items:flex-start;';
			case 'bottom-right':
			default:
				return 'position:absolute; bottom:18px; right:18px; align-items:flex-end;';
		}
	})();

	// Map position → CSS for the branding block
	$: brandingStyle = (() => {
		switch (position) {
			case 'bottom-left':
				return 'position:absolute; bottom:18px; left:18px; display:flex; flex-direction:column; align-items:flex-start; gap:6px;';
			case 'top-right':
				return 'position:absolute; top:18px; right:18px; display:flex; flex-direction:column; align-items:flex-end; gap:6px;';
			case 'top-left':
				return 'position:absolute; top:18px; left:18px; display:flex; flex-direction:column; align-items:flex-start; gap:6px;';
			case 'bottom-right':
			default:
				return 'position:absolute; top:18px; right:18px; display:flex; flex-direction:column; align-items:flex-end; gap:6px;';
		}
	})();

	// For bottom positions, messages stack bottom-to-top (flex-direction: column, newest at bottom visually)
	// For top positions, messages flow downward
	$: stackFlexDir = position.startsWith('top') ? 'column' : 'column';

	const PLATFORM = {
		twitch:  { color:'#9146FF', label:'TW',   textColor:'#fff',    glow:'rgba(145,70,255,0.4)', badgeGlow:'0 0 10px rgba(145,70,255,0.6)' },
		youtube: { color:'#FF0000', label:'YT',   textColor:'#fff',    glow:'rgba(255,0,0,0.4)',   badgeGlow:'0 0 10px rgba(255,0,0,0.6)' },
		kick:    { color:'#53FC18', label:'KICK', textColor:'#000',    glow:'rgba(83,252,24,0.35)', badgeGlow:'0 0 10px rgba(83,252,24,0.6)' },
		x:       { color:'#E2E8F0', label:'X',    textColor:'#0A0A0F', glow:'rgba(226,232,240,0.15)', badgeGlow:'0 0 6px rgba(226,232,240,0.3)' }
	};

	const BADGE_LABELS = { broadcaster:'LIVE', moderator:'MOD', subscriber:'SUB', vip:'VIP', owner:'OWNER', member:'MEM' };
	const BADGE_COLORS = { broadcaster:'#E43D30', moderator:'#00FF88', subscriber:'#9146FF', vip:'#db2777', owner:'#b91c1c', member:'#15803d' };

	const overlayMessages = writable([]);
	let connectedPlatforms = 0;
	let ws, timers = {};

	function addOverlayMessage(msg) {
		if (msg.hidden) return;
		overlayMessages.update(($msgs) => {
			if ($msgs.find((m) => m.id === msg.id)) return $msgs;
			const updated = [...$msgs, { ...msg, fading: false, isNew: true }];
			setTimeout(() => {
				overlayMessages.update((ms) => ms.map((m) => m.id === msg.id ? { ...m, isNew: false } : m));
			}, 500);
			return updated.slice(-maxVisible);
		});
		if (timers[msg.id]) clearTimeout(timers[msg.id]);
		timers[msg.id] = setTimeout(() => {
			overlayMessages.update(($msgs) => $msgs.map((m) => m.id === msg.id ? { ...m, fading: true } : m));
			setTimeout(() => {
				overlayMessages.update(($msgs) => $msgs.filter((m) => m.id !== msg.id));
				delete timers[msg.id];
			}, 500);
		}, fadeAfter);
	}

	function handleWsMessage({ event, data }) {
		if (event === 'init') {
			(data.messages || []).slice(-maxVisible).forEach(addOverlayMessage);
			if (data.platforms) connectedPlatforms = Object.values(data.platforms).filter(p => p.connected).length;
		} else if (event === 'message') {
			addOverlayMessage(data);
		} else if (event === 'message_update') {
			if (data.hidden) overlayMessages.update(($msgs) => $msgs.filter((m) => m.id !== data.id));
		} else if (event === 'platform_status') {
			connectedPlatforms = Object.values(data).filter(p => p.connected).length;
		}
	}

	onMount(() => { ws = createWsClient({ onMessage: handleWsMessage }); ws.connect(); });
	onDestroy(() => { ws?.disconnect(); Object.values(timers).forEach(clearTimeout); });

	function getPlatform(msg) { return PLATFORM[msg.platform] ?? PLATFORM.twitch; }
	function getUsernameColor(msg) {
		const p = getPlatform(msg);
		if (msg.color && msg.color !== '#000000' && msg.color !== '#000') return msg.color;
		return p.color;
	}

	function buildOverlayParts(msg) {
		const raw = msg.message || '';
		const segments = [];

		if (msg.platform === 'twitch' && msg.emotes && typeof msg.emotes === 'object') {
			for (const [id, positions] of Object.entries(msg.emotes)) {
				for (const pos of positions) {
					const [s, e] = pos.split('-').map(Number);
					segments.push({ start: s, end: e + 1, url: `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/1.0`, name: raw.slice(s, e + 1) });
				}
			}
			segments.sort((a, b) => a.start - b.start);
		}

		if (msg.platform === 'kick') {
			const re = /\[emote:(\d+):([^\]]+)\]/g;
			let m;
			while ((m = re.exec(raw)) !== null) {
				segments.push({ start: m.index, end: m.index + m[0].length, url: `https://files.kick.com/emotes/${m[1]}/fullsize`, name: m[2] });
			}
			segments.sort((a, b) => a.start - b.start);
		}

		const parts = [];
		let cursor = 0;
		for (const seg of segments) {
			if (seg.start > cursor) parts.push({ type: 'text', text: raw.slice(cursor, seg.start) });
			parts.push({ type: 'emote', url: seg.url, name: seg.name });
			cursor = seg.end;
		}
		if (cursor < raw.length) parts.push({ type: 'text', text: raw.slice(cursor) });
		if (parts.length === 0) parts.push({ type: 'text', text: raw });
		return parts;
	}

	// Branding text alignment
	$: isLeft = position.endsWith('left');
</script>

<svelte:head>
	<title>ChatFlow Overlay</title>
	<style>
		html, body { background: transparent !important; margin: 0; padding: 0; overflow: hidden; }

		@keyframes slideIn {
			0%   { transform: translateX(60px) scale(0.97); opacity: 0; }
			65%  { transform: translateX(-3px) scale(1.005); opacity: 1; }
			100% { transform: translateX(0) scale(1); opacity: 1; }
		}
		@keyframes slideInLeft {
			0%   { transform: translateX(-60px) scale(0.97); opacity: 0; }
			65%  { transform: translateX(3px) scale(1.005); opacity: 1; }
			100% { transform: translateX(0) scale(1); opacity: 1; }
		}
		@keyframes slideInFast {
			0%   { transform: translateX(40px) scale(0.98); opacity: 0; }
			100% { transform: translateX(0) scale(1); opacity: 1; }
		}
		@keyframes fadeOut {
			0%   { opacity: 1; transform: translateX(0); }
			100% { opacity: 0; transform: translateX(12px); }
		}
		@keyframes livePulseRed {
			0%, 100% { box-shadow: 0 0 0 0 rgba(228,61,48,0.7); opacity: 1; }
			60%       { box-shadow: 0 0 0 7px rgba(228,61,48,0); opacity: 0.75; }
		}
		@keyframes polyPulse {
			0%, 100% { box-shadow: 0 0 0 0 rgba(46,92,255,0.5); }
			60%       { box-shadow: 0 0 0 5px rgba(46,92,255,0); }
		}

		.msg-new      { animation: slideIn 0.45s cubic-bezier(0.34, 1.4, 0.64, 1) forwards; }
		.msg-new-left { animation: slideInLeft 0.45s cubic-bezier(0.34, 1.4, 0.64, 1) forwards; }
		.msg-in   { animation: slideInFast 0.3s ease-out forwards; }
		.msg-out  { animation: fadeOut 0.45s ease-out forwards; }

		.live-dot-red {
			width: 7px; height: 7px; border-radius: 50%;
			background: #E43D30;
			animation: livePulseRed 1.8s ease-in-out infinite;
			flex-shrink: 0;
		}
		.poly-dot {
			width: 6px; height: 6px; border-radius: 50%;
			background: #2E5CFF;
			animation: polyPulse 2s ease-in-out infinite;
			flex-shrink: 0;
		}
	</style>
</svelte:head>

<div style="position:fixed; inset:0; pointer-events:none; overflow:hidden; font-family:'Inter',system-ui,sans-serif;">

	<!-- ── Branding block — position-aware ── -->
	<div style="{brandingStyle}">

		<!-- Main brand card -->
		<div style="
			background: rgba(10,10,15,0.88);
			backdrop-filter: blur(20px);
			-webkit-backdrop-filter: blur(20px);
			border-radius: 8px;
			padding: 10px 16px;
			border: 1px solid rgba(46,92,255,0.2);
			box-shadow: 0 4px 30px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03);
			min-width: 160px;
		">
			<!-- Polymarket blue accent line top -->
			<div style="height:2px; background:linear-gradient(90deg,#2E5CFF,#00D4FF,transparent); border-radius:1px; margin-bottom:8px;"></div>

			<div style="display:flex; flex-direction:column; align-items:{isLeft ? 'flex-start' : 'flex-end'}; gap:3px;">
				<span style="
					font-size: 10px; font-weight: 800; letter-spacing: 0.2em;
					text-transform: uppercase; color: #2E5CFF;
					font-family: 'JetBrains Mono', monospace;
				">MARKET BUBBLE</span>
				<span style="
					font-size: 18px; font-weight: 900; letter-spacing: -0.03em;
					color: #fff; line-height: 1;
				">ChatFlow</span>
				<span style="font-size:9px; color:#4B5563; letter-spacing:0.1em; text-transform:uppercase; font-weight:600;">LIVE CHAT</span>
			</div>
		</div>

		<!-- LIVE indicator -->
		{#if connectedPlatforms > 0}
			<div style="
				display: flex; align-items: center; gap: 6px;
				background: rgba(228,61,48,0.12);
				border: 1px solid rgba(228,61,48,0.35);
				border-radius: 20px; padding: 5px 12px;
				backdrop-filter: blur(16px);
				box-shadow: 0 0 14px rgba(228,61,48,0.2), 0 2px 8px rgba(0,0,0,0.5);
			">
				<div class="live-dot-red"></div>
				<span style="font-size:11px; font-weight:800; color:#E43D30; letter-spacing:0.12em;">LIVE</span>
			</div>
		{/if}

		<!-- Active platforms row -->
		{#if connectedPlatforms > 0}
			<div style="display:flex; align-items:center; gap:4px;">
				{#each Object.entries(PLATFORM) as [key, p]}
					<span style="
						border-radius: 4px; padding: 2px 6px;
						font-size: 8px; font-weight: 800; letter-spacing: 0.08em;
						background: {p.color}; color: {p.textColor};
						opacity: 0.85;
					">{p.label}</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ── Message stack — position-aware ── -->
	<div style="
		{stackStyle}
		display: flex; flex-direction: column; gap: 6px;
		max-width: min(500px, calc(100vw - 2rem));
	">
		{#each $overlayMessages as msg (msg.id)}
			{@const p = getPlatform(msg)}
			<div
				class="{msg.fading ? 'msg-out' : msg.isNew ? (isLeft ? 'msg-new-left' : 'msg-new') : 'msg-in'}"
				style="
					width: fit-content; max-width: 100%;
					border-radius: 8px; overflow: hidden;
					display: flex; align-items: stretch;
					box-shadow: 0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), 0 2px 32px {p.glow};
				"
			>
				<!-- Platform color stripe -->
				<div style="width:3px; background:{p.color}; flex-shrink:0; box-shadow:2px 0 10px {p.glow};"></div>

				<!-- Card body -->
				<div style="
					background: rgba(10,10,15,0.92);
					backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
					padding: 9px 14px 9px 11px;
					min-width: 0; flex: 1;
					display: flex; flex-direction: column; gap: 4px;
				">
					<!-- Header: badge + role badges + username -->
					<div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
						<!-- Platform badge -->
						<span style="
							display:inline-flex; align-items:center;
							border-radius: 4px; padding: 1px 6px;
							font-size: 9px; font-weight: 800; letter-spacing: 0.08em;
							background: {p.color}; color: {p.textColor};
							box-shadow: {p.badgeGlow};
							flex-shrink: 0;
						">{p.label}</span>

						<!-- Role badges -->
						{#each (msg.badges || []).slice(0,2) as badge}
							<span style="
								border-radius: 3px; padding: 1px 5px;
								font-size: 8px; font-weight: 700; letter-spacing: 0.05em;
								color: #fff; background: {BADGE_COLORS[badge] ?? '#4B5563'};
							">{BADGE_LABELS[badge] ?? badge}</span>
						{/each}

						<!-- Username -->
						<span style="
							font-weight: 700; font-size: 13px;
							color: {getUsernameColor(msg)};
							text-shadow: 0 0 10px {p.glow};
							line-height: 1;
						">{msg.displayName || msg.username || 'Anonymous'}</span>
					</div>

					<!-- Message text + emotes -->
					<p style="margin:0; color:rgba(240,240,245,0.95); font-size:13px; font-weight:400; line-height:1.45; word-break:break-word; text-shadow:0 1px 8px rgba(0,0,0,0.9);">
						{#each buildOverlayParts(msg) as part}
							{#if part.type === 'emote'}
								<img src={part.url} alt={part.name} title={part.name}
									style="display:inline-block; height:22px; width:auto; vertical-align:-5px; margin:0 1px;"
									loading="lazy"
									onerror="this.style.display='none';" />
							{:else}
								{part.text}
							{/if}
						{/each}
					</p>
				</div>
			</div>
		{/each}
	</div>
</div>
