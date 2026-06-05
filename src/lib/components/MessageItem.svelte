<script>
	import { togglePin, hideMsg } from '$lib/stores/chat.js';
	import { createEventDispatcher } from 'svelte';

	/** @type {import('$lib/stores/chat.js').ChatMessage} */
	export let message;
	export let showActions = true;
	export let compact = false;

	const dispatch = createEventDispatcher();

	function formatTime(ts) {
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	const BADGE_LABELS = {
		broadcaster: 'LIVE',
		moderator: 'MOD',
		subscriber: 'SUB',
		vip: 'VIP',
		owner: 'OWNER',
		member: 'MEMBER',
		verified: 'VERIFIED'
	};

	const BADGE_COLORS = {
		broadcaster: 'bg-red-600',
		moderator: 'bg-green-700',
		subscriber: 'bg-purple-700',
		vip: 'bg-pink-600',
		owner: 'bg-red-700',
		member: 'bg-green-700',
		verified: 'bg-blue-600'
	};

	$: isTwitch = message.platform === 'twitch';
	$: platformColor = isTwitch ? 'bg-twitch' : 'bg-youtube';
	$: platformLabel = isTwitch ? 'Twitch' : 'YouTube';

	let hovering = false;
</script>

<div
	class="group relative flex gap-3 rounded-lg px-3 py-2.5 transition-all duration-150
    {message.pinned ? 'bg-yellow-500/10 ring-1 ring-yellow-500/40' : 'hover:bg-white/5'}
    {message.hidden ? 'opacity-30' : ''}"
	on:mouseenter={() => (hovering = true)}
	on:mouseleave={() => (hovering = false)}
	role="article"
>
	<!-- Platform badge -->
	<div class="mt-0.5 flex-shrink-0">
		<span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white {platformColor}">
			{platformLabel}
		</span>
	</div>

	<!-- Message content -->
	<div class="min-w-0 flex-1">
		<div class="flex flex-wrap items-center gap-1.5">
			<!-- User badge chips -->
			{#each (message.badges || []) as badge}
				<span class="inline-flex items-center rounded px-1 py-0 text-[9px] font-semibold uppercase text-white {BADGE_COLORS[badge] || 'bg-slate-600'}">
					{BADGE_LABELS[badge] || badge}
				</span>
			{/each}

			<!-- Username -->
			<span
				class="font-bold text-sm leading-tight"
				style="color: {message.color}"
			>
				{message.displayName}
			</span>

			<!-- Timestamp -->
			{#if !compact}
				<span class="text-xs text-slate-500 ml-auto">{formatTime(message.timestamp)}</span>
			{/if}
		</div>

		<!-- Message text -->
		<p class="mt-0.5 text-sm text-slate-200 break-words leading-relaxed">
			{message.message}
		</p>
	</div>

	<!-- Action buttons — visible on hover -->
	{#if showActions && hovering}
		<div class="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
			<!-- Pin -->
			<button
				on:click={() => togglePin(message.id)}
				class="flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-slate-300 hover:bg-yellow-500 hover:text-white transition-colors"
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

			<!-- Hide -->
			<button
				on:click={() => hideMsg(message.id)}
				class="flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-slate-300 hover:bg-red-600 hover:text-white transition-colors"
				title="Hide message"
			>
				<svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
				</svg>
			</button>
		</div>
	{/if}

	<!-- Pin indicator -->
	{#if message.pinned}
		<div class="absolute -top-1 -right-1">
			<span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[8px] text-white">
				&#x1F4CC;
			</span>
		</div>
	{/if}
</div>
