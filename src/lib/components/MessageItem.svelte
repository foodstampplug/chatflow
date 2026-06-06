<script>
	import { togglePin, hideMsg } from '$lib/stores/chat.js';

	/** @type {import('$lib/stores/chat.js').ChatMessage} */
	export let message;
	export let showActions = true;
	export let compact = false;

	function formatTime(ts) {
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	const BADGE_LABELS = {
		broadcaster: 'LIVE',
		moderator: 'MOD',
		subscriber: 'SUB',
		vip: 'VIP',
		owner: 'OWNER',
		member: 'MEM',
		verified: 'VER'
	};

	const BADGE_COLORS = {
		broadcaster: '#dc2626',
		moderator: '#16a34a',
		subscriber: '#7c3aed',
		vip: '#db2777',
		owner: '#b91c1c',
		member: '#15803d',
		verified: '#2563eb'
	};

	// Platform config — single source of truth for colors, labels, icons
	const PLATFORM = {
		twitch: {
			color: '#9146FF',
			label: 'TW',
			textColor: '#fff',
			border: '#9146FF',
			icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="9" height="9"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>`
		},
		youtube: {
			color: '#FF0000',
			label: 'YT',
			textColor: '#fff',
			border: '#FF0000',
			icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="9" height="9"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>`
		},
		kick: {
			color: '#53FC18',
			label: 'KICK',
			textColor: '#000',
			border: '#53FC18',
			icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="9" height="9"><path d="M2 2h4v8.5l6-8.5h5l-7 9.5 7.5 10.5H12l-6-9V22H2V2z"/></svg>`
		},
		x: {
			color: '#000',
			label: 'X',
			textColor: '#fff',
			border: '#555',
			icon: `<svg viewBox="0 0 24 24" fill="currentColor" width="9" height="9"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`
		}
	};

	$: p = PLATFORM[message.platform] ?? PLATFORM.twitch;

	// Username color — fallback to platform color if none provided
	$: usernameColor = message.color && message.color !== '#000000' && message.color !== '#000'
		? message.color
		: p.color;

	let hovering = false;
</script>

<div
	class="msg-enter group relative flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all duration-150
		{message.pinned
			? 'border-l-2 bg-yellow-500/10 ring-1 ring-yellow-500/25'
			: 'hover:bg-white/[0.04]'}
		{message.hidden ? 'opacity-25 pointer-events-none' : ''}"
	style={message.pinned ? 'border-left-color: #eab308;' : ''}
	on:mouseenter={() => (hovering = true)}
	on:mouseleave={() => (hovering = false)}
	role="article"
>
	<!-- Platform badge pill -->
	<div class="mt-0.5 flex-shrink-0">
		<span
			class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider leading-none select-none"
			style="background: {p.color}; color: {p.textColor}; {message.platform === 'x' ? 'border: 1px solid #444;' : ''}"
		>
			{@html p.icon}
			{p.label}
		</span>
	</div>

	<!-- Message content -->
	<div class="min-w-0 flex-1">
		<div class="flex flex-wrap items-center gap-1 mb-0.5">
			<!-- Role badges -->
			{#each (message.badges || []) as badge}
				<span
					class="inline-flex items-center rounded px-1 py-0 text-[9px] font-semibold uppercase tracking-wide text-white leading-4"
					style="background: {BADGE_COLORS[badge] ?? '#475569'};"
				>
					{BADGE_LABELS[badge] ?? badge}
				</span>
			{/each}

			<!-- Username -->
			<span
				class="font-semibold text-sm leading-tight"
				style="color: {usernameColor}; text-shadow: 0 1px 4px rgba(0,0,0,0.6);"
			>
				{message.displayName}
			</span>

			<!-- Timestamp — right-aligned, only when not compact -->
			{#if !compact}
				<span class="ml-auto text-[10px] text-slate-600 tabular-nums flex-shrink-0">
					{formatTime(message.timestamp)}
				</span>
			{/if}
		</div>

		<!-- Message text -->
		<p class="text-sm text-slate-200 break-words leading-relaxed">
			{message.message}
		</p>
	</div>

	<!-- Action buttons — appear on hover with fade -->
	{#if showActions}
		<div
			class="absolute right-2 top-2 flex gap-1 transition-all duration-150
				{hovering ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-0.5 pointer-events-none'}"
		>
			<button
				on:click|stopPropagation={() => togglePin(message.id)}
				class="flex h-6 w-6 items-center justify-center rounded bg-slate-800/90 text-slate-400
					hover:bg-yellow-500 hover:text-white transition-colors"
				title={message.pinned ? 'Unpin' : 'Pin message'}
			>
				<svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
					{#if message.pinned}
						<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
					{:else}
						<path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
					{/if}
				</svg>
			</button>

			<button
				on:click|stopPropagation={() => hideMsg(message.id)}
				class="flex h-6 w-6 items-center justify-center rounded bg-slate-800/90 text-slate-400
					hover:bg-red-600 hover:text-white transition-colors"
				title="Hide message"
			>
				<svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
				</svg>
			</button>
		</div>
	{/if}

	<!-- Pinned corner badge -->
	{#if message.pinned}
		<div class="absolute -top-0.5 -right-0.5 flex-shrink-0">
			<span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[8px] text-black font-bold shadow-md">
				&#x1F4CC;
			</span>
		</div>
	{/if}
</div>
