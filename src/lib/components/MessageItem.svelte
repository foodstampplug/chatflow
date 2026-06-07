<script>
	import { togglePin, hideMsg, keywords } from '$lib/stores/chat.js';

	export let message;
	export let showActions = true;
	export let compact = false;

	function formatTime(ts) {
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
	}

	const BADGE_LABELS = { broadcaster:'LIVE', moderator:'MOD', subscriber:'SUB', vip:'VIP', owner:'OWNER', member:'MEM' };
	const BADGE_COLORS = { broadcaster:'#E43D30', moderator:'#00FF88', subscriber:'#9146FF', vip:'#db2777', owner:'#b91c1c', member:'#15803d' };

	const PLATFORM = {
		twitch:  { color:'#9146FF', label:'TW',   textColor:'#fff',    borderColor:'rgba(145,70,255,0.5)' },
		youtube: { color:'#FF0000', label:'YT',   textColor:'#fff',    borderColor:'rgba(255,0,0,0.5)' },
		kick:    { color:'#53FC18', label:'KICK', textColor:'#000',    borderColor:'rgba(83,252,24,0.5)' },
		x:       { color:'#E2E8F0', label:'X',    textColor:'#0A0A0F', borderColor:'rgba(226,232,240,0.3)' }
	};

	$: p = PLATFORM[message.platform] ?? PLATFORM.twitch;
	$: usernameColor = message.color && message.color !== '#000000' && message.color !== '#000'
		? message.color : p.color;

	let hovering = false;

	$: hasKeywordMatch = $keywords.length > 0 && $keywords.some(kw =>
		kw.trim().length > 0 && message.message.toLowerCase().includes(kw.toLowerCase().trim())
	);

	// ── Build unified parts array ─────────────────────────────────────────────
	// Each part: { type: 'text'|'emote', text?, highlight?, url?, name? }
	function buildParts(msg, kws) {
		const raw = msg.message || '';
		const platform = msg.platform;
		const emotes = msg.emotes; // tmi.js emote map: { 'id': ['start-end', ...] }

		let segments = []; // { start, end, type, url, name }

		// ── Twitch emotes from tmi.js position map ──
		if (platform === 'twitch' && emotes && typeof emotes === 'object') {
			for (const [emoteId, positions] of Object.entries(emotes)) {
				for (const pos of positions) {
					const [start, end] = pos.split('-').map(Number);
					segments.push({
						start, end: end + 1,
						type: 'emote',
						url: `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/1.0`,
						name: raw.slice(start, end + 1)
					});
				}
			}
			segments.sort((a, b) => a.start - b.start);
		}

		// ── Kick emotes: [emote:ID:NAME] ──
		if (platform === 'kick') {
			const kickRe = /\[emote:(\d+):([^\]]+)\]/g;
			let m;
			while ((m = kickRe.exec(raw)) !== null) {
				segments.push({
					start: m.index, end: m.index + m[0].length,
					type: 'emote',
					url: `https://files.kick.com/emotes/${m[1]}/fullsize`,
					name: m[2]
				});
			}
			segments.sort((a, b) => a.start - b.start);
		}

		// ── Build parts from segments ──
		const parts = [];
		let cursor = 0;

		for (const seg of segments) {
			if (seg.start > cursor) {
				applyKeywords(raw.slice(cursor, seg.start), kws, parts);
			}
			parts.push({ type: 'emote', url: seg.url, name: seg.name });
			cursor = seg.end;
		}
		if (cursor < raw.length) {
			applyKeywords(raw.slice(cursor), kws, parts);
		}
		if (parts.length === 0) {
			applyKeywords(raw, kws, parts);
		}
		return parts;
	}

	function applyKeywords(text, kws, out) {
		if (!text) return;
		const valid = (kws || []).filter(k => k.trim().length > 0);
		if (valid.length === 0) { out.push({ type: 'text', text, highlight: false }); return; }
		const escaped = valid.map(k => k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		const re = new RegExp(`(${escaped.join('|')})`, 'gi');
		const chunks = text.split(re);
		re.lastIndex = 0;
		for (const chunk of chunks) {
			if (!chunk) continue;
			re.lastIndex = 0;
			out.push({ type: 'text', text: chunk, highlight: re.test(chunk) });
		}
	}

	$: parts = buildParts(message, $keywords);
	$: hasEmotes = parts.some(p => p.type === 'emote');
</script>

<div
	class="msg-enter group relative flex items-start gap-2.5 px-3 py-1.5 rounded transition-all duration-100"
	style="
		border-left: 2px solid {message.pinned ? '#FF9500' : hasKeywordMatch ? '#FFB340' : p.borderColor};
		background: {message.pinned ? 'rgba(255,149,0,0.06)' : hasKeywordMatch ? 'rgba(255,149,0,0.04)' : hovering ? 'rgba(255,255,255,0.03)' : 'transparent'};
		{message.hidden ? 'opacity:0.2; pointer-events:none;' : ''}
		{hasKeywordMatch ? 'box-shadow: inset 3px 0 8px rgba(255,149,0,0.12);' : ''}
	"
	on:mouseenter={() => hovering = true}
	on:mouseleave={() => hovering = false}
	role="article"
>
	<!-- Left column: platform badge + role badges stacked -->
	<div class="flex-shrink-0 flex items-center gap-1 pt-0.5">
		<span class="rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider leading-none select-none badge-glow-{message.platform}"
			style="background:{p.color}; color:{p.textColor}; min-width:26px; text-align:center;">
			{p.label}
		</span>
		{#each (message.badges || []).slice(0, 2) as badge}
			<span class="rounded px-1 py-0.5 text-[8px] font-bold tracking-wide text-white leading-none"
				style="background:{BADGE_COLORS[badge] ?? '#4B5563'};">
				{BADGE_LABELS[badge] ?? badge}
			</span>
		{/each}
	</div>

	<!-- Right column: username + message -->
	<div class="flex-1 min-w-0 flex flex-col gap-0.5">
		<div class="flex items-center gap-1.5 min-w-0">
			<!-- Username -->
			<span class="flex-shrink-0 font-semibold text-[12px] leading-none"
				style="color:{usernameColor};">
				{message.displayName}
			</span>
			<span class="flex-shrink-0 text-[10px]" style="color:#1E2040;">·</span>
			{#if !compact}
				<span class="flex-shrink-0 text-[10px] stat-mono" style="color:#2E3650; opacity:{hovering ? 1 : 0.5};">
					{formatTime(message.timestamp)}
				</span>
			{/if}
		</div>

		<!-- Message text + emotes -->
		<div class="text-[12px] leading-snug {hasEmotes ? '' : 'line-clamp-2'}" style="color:#C8CDD8; word-break:break-word;">
			{#each parts as part}
				{#if part.type === 'emote'}
					<img
						src={part.url}
						alt={part.name}
						title={part.name}
						class="inline-block align-middle"
						style="height:20px; width:auto; vertical-align:-4px; margin:0 1px;"
						loading="lazy"
						onerror="this.style.display='none'; this.insertAdjacentText('afterend', ' ' + this.alt + ' ');"
					/>
				{:else if part.highlight}
					<mark style="background:rgba(255,149,0,0.25); color:#FFB340; border-radius:2px; padding:0 1px;">{part.text}</mark>
				{:else}
					{part.text}
				{/if}
			{/each}
		</div>
	</div>

	<!-- Hover actions -->
	{#if showActions && hovering}
		<div class="flex-shrink-0 flex gap-1 pt-0.5">
			<button on:click|stopPropagation={() => togglePin(message.id)}
				class="h-5 w-5 flex items-center justify-center rounded transition-colors"
				style="background:{message.pinned ? '#FF9500' : 'rgba(255,255,255,0.07)'}; color:{message.pinned ? '#fff' : '#4B5563'};"
				title={message.pinned ? 'Unpin' : 'Pin'}>
				<svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
					<path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
				</svg>
			</button>
			<button on:click|stopPropagation={() => hideMsg(message.id)}
				class="h-5 w-5 flex items-center justify-center rounded transition-colors"
				style="background:rgba(228,61,48,0.15); color:#E43D30;"
				title="Hide">
				<svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27z"/>
				</svg>
			</button>
		</div>
	{/if}
</div>
