<script>
	import { onMount, onDestroy } from 'svelte';
	import { messages, platformStatus } from '$lib/stores/chat.js';

	// ── Config ─────────────────────────────────────────────────────────────────
	const TICK_INTERVAL_MS = 2000;   // recalculate every 2s
	const HISTORY_LENGTH   = 30;     // 30 readings = 60s of history
	const WINDOW_MS        = 60000;  // rolling 60-second window
	const MAX_TIMESTAMPS   = 300;    // ring buffer cap

	// ── State ──────────────────────────────────────────────────────────────────
	let collapsed = false;
	let ticker = null;

	// Ring buffer of message timestamps (kept client-side from the store)
	let timestamps = [];

	// History of msg/min readings for the sparkline
	let history = Array(HISTORY_LENGTH).fill(0);
	let sessionPeak = 0;

	// Reactive derived values
	let currentMPM = 0;
	let trend = 'flat'; // 'up' | 'down' | 'flat'

	// Per-platform counts in the last window
	let platformCounts = { twitch: 0, youtube: 0, kick: 0, x: 0 };

	// ── Subscribe to messages to keep timestamp ring buffer ───────────────────
	const unsubscribe = messages.subscribe(($msgs) => {
		// Keep timestamps of all non-hidden messages within the last window + a bit extra
		const now = Date.now();
		const cutoff = now - WINDOW_MS - 2000;
		// Just rebuild from the store since we have all messages
		timestamps = $msgs
			.filter(m => !m.hidden && m.timestamp >= cutoff)
			.map(m => ({ ts: m.timestamp, platform: m.platform }))
			.slice(-MAX_TIMESTAMPS);
	});

	// ── Tick: recalculate every 2s ────────────────────────────────────────────
	function tick() {
		const now = Date.now();
		const windowStart = now - WINDOW_MS;

		const recent = timestamps.filter(t => t.ts >= windowStart);
		// messages per minute = count in last 60s * 1 (already per-minute)
		currentMPM = recent.length;

		// Per-platform breakdown
		platformCounts = { twitch: 0, youtube: 0, kick: 0, x: 0 };
		for (const t of recent) {
			if (t.platform in platformCounts) platformCounts[t.platform]++;
		}

		// Update history ring
		history = [...history.slice(1), currentMPM];

		// Session peak
		if (currentMPM > sessionPeak) sessionPeak = currentMPM;

		// Trend: compare last value to average of history
		const avg = history.reduce((s, v) => s + v, 0) / history.length;
		const last = history[history.length - 1];
		const prev = history[history.length - 2] ?? 0;
		if (last > prev + 1 && last > avg * 1.05) {
			trend = 'up';
		} else if (last < prev - 1 && last < avg * 0.95) {
			trend = 'down';
		} else {
			trend = 'flat';
		}
	}

	onMount(() => {
		tick(); // immediate first reading
		ticker = setInterval(tick, TICK_INTERVAL_MS);
	});

	onDestroy(() => {
		clearInterval(ticker);
		unsubscribe();
	});

	// ── Sparkline SVG path builder ─────────────────────────────────────────────
	const SVG_W = 400;
	const SVG_H = 40;
	const PAD   = 4;

	function buildPath(data) {
		const w = SVG_W - PAD * 2;
		const h = SVG_H - PAD * 2;
		const maxVal = Math.max(...data, 1);

		const points = data.map((v, i) => ({
			x: PAD + (i / (data.length - 1)) * w,
			y: PAD + h - (v / maxVal) * h
		}));

		if (points.length < 2) return { line: '', fill: '' };

		// Smooth cubic bezier
		let d = `M ${points[0].x},${points[0].y}`;
		for (let i = 1; i < points.length; i++) {
			const prev = points[i - 1];
			const curr = points[i];
			const cpx = (prev.x + curr.x) / 2;
			d += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
		}

		// Fill path (close down to baseline)
		const last = points[points.length - 1];
		const first = points[0];
		const fill = d + ` L ${last.x},${SVG_H} L ${first.x},${SVG_H} Z`;

		return { line: d, fill };
	}

	$: paths = buildPath(history);

	$: lineColor = trend === 'up' ? '#00FF88' : trend === 'down' ? '#FF9500' : '#2E5CFF';
	$: fillId    = trend === 'up' ? 'grad-up'  : trend === 'down' ? 'grad-down' : 'grad-flat';
	$: gradStop  = trend === 'up' ? '#00FF88'  : trend === 'down' ? '#FF9500'   : '#2E5CFF';

	// Trend badge config
	$: trendCfg = trend === 'up'
		? { label: 'PUMPING', color: '#00FF88', bg: 'rgba(0,255,136,0.1)', border: 'rgba(0,255,136,0.25)', arrow: '↑' }
		: trend === 'down'
		? { label: 'COOLING', color: '#FF9500', bg: 'rgba(255,149,0,0.1)',  border: 'rgba(255,149,0,0.25)',  arrow: '↓' }
		: { label: 'STEADY',  color: '#2E5CFF', bg: 'rgba(46,92,255,0.1)',  border: 'rgba(46,92,255,0.25)',  arrow: '→' };

	// Platform mini-bar colors
	const P_COLORS = {
		twitch: '#9146FF',
		youtube: '#FF0000',
		kick: '#53FC18',
		x: '#E2E8F0'
	};
	const P_LABELS = { twitch: 'TW', youtube: 'YT', kick: 'KICK', x: 'X' };

	$: platformMax = Math.max(...Object.values(platformCounts), 1);

	// Pulse class when MPM spikes
	$: spiking = currentMPM > 0 && currentMPM >= sessionPeak && sessionPeak > 5;
</script>

<div class="hype-panel flex-shrink-0" style="border-bottom: 1px solid rgba(46,92,255,0.12);">

	<!-- ── Collapsed bar ── -->
	{#if collapsed}
		<div class="flex items-center justify-between px-5 py-2 cursor-pointer select-none"
			on:click={() => collapsed = false}
			on:keydown={(e) => e.key === 'Enter' && (collapsed = false)}
			role="button" tabindex="0"
			style="min-height:36px;">
			<div class="flex items-center gap-3">
				<span class="text-[10px] font-bold tracking-[0.2em] uppercase stat-mono" style="color:#2E5CFF;">HYPE METER</span>
				<span class="stat-mono text-sm font-black" style="color:{lineColor};">{currentMPM} <span class="text-[10px] font-normal" style="color:#4B5563;">MSG/MIN</span></span>
				<span class="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider"
					style="background:{trendCfg.bg}; border:1px solid {trendCfg.border}; color:{trendCfg.color};">
					{trendCfg.arrow} {trendCfg.label}
				</span>
			</div>
			<svg class="h-3.5 w-3.5 rotate-180" viewBox="0 0 24 24" fill="none" stroke="#4B5563" stroke-width="2">
				<polyline points="6 9 12 15 18 9"></polyline>
			</svg>
		</div>

	<!-- ── Expanded panel ── -->
	{:else}
		<div class="flex items-center gap-6 px-5" style="height:72px;">

			<!-- Left: big MPM number -->
			<div class="flex-shrink-0 flex flex-col justify-center" style="min-width:90px;">
				<div class="flex items-baseline gap-1.5">
					<span
						class="stat-mono font-black leading-none {spiking ? 'hype-pulse' : ''}"
						style="font-size:28px; color:{lineColor}; letter-spacing:-0.03em;">
						{currentMPM}
					</span>
					<span class="text-[9px] font-bold tracking-widest uppercase" style="color:#4B5563;">MSG/MIN</span>
				</div>
				<div class="flex items-center gap-2 mt-1">
					<!-- Trend badge -->
					<span class="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider flex-shrink-0"
						style="background:{trendCfg.bg}; border:1px solid {trendCfg.border}; color:{trendCfg.color};">
						{trendCfg.arrow} {trendCfg.label}
					</span>
				</div>
				<div class="mt-1 text-[9px] stat-mono" style="color:#2E3650;">
					PEAK: <span style="color:#4B5563;">{sessionPeak}</span>
				</div>
			</div>

			<!-- Divider -->
			<div class="flex-shrink-0 self-stretch w-px my-3" style="background:rgba(46,92,255,0.15);"></div>

			<!-- Platform mini breakdown -->
			<div class="flex-shrink-0 flex flex-col gap-1 justify-center" style="min-width:120px;">
				{#each Object.entries(P_LABELS) as [key, label]}
					<div class="flex items-center gap-1.5">
						<span class="text-[8px] font-bold w-7 text-right stat-mono flex-shrink-0" style="color:{P_COLORS[key]};">{label}</span>
						<div class="flex-1 relative rounded-full overflow-hidden" style="height:3px; background:rgba(255,255,255,0.05);">
							<div class="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
								style="width:{(platformCounts[key] / platformMax) * 100}%; background:{P_COLORS[key]}; opacity:0.8;">
							</div>
						</div>
						<span class="text-[8px] stat-mono flex-shrink-0 w-5 text-right" style="color:#4B5563;">{platformCounts[key]}</span>
					</div>
				{/each}
			</div>

			<!-- Divider -->
			<div class="flex-shrink-0 self-stretch w-px my-3" style="background:rgba(46,92,255,0.15);"></div>

			<!-- Sparkline -->
			<div class="flex-1 min-w-0 flex items-center">
				<svg
					viewBox="0 0 {SVG_W} {SVG_H}"
					preserveAspectRatio="none"
					style="width:100%; max-width:{SVG_W}px; height:{SVG_H}px; display:block; overflow:visible;">

					<defs>
						<linearGradient id="grad-up" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="#00FF88" stop-opacity="0.3"/>
							<stop offset="100%" stop-color="#00FF88" stop-opacity="0"/>
						</linearGradient>
						<linearGradient id="grad-down" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="#FF9500" stop-opacity="0.3"/>
							<stop offset="100%" stop-color="#FF9500" stop-opacity="0"/>
						</linearGradient>
						<linearGradient id="grad-flat" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="#2E5CFF" stop-opacity="0.3"/>
							<stop offset="100%" stop-color="#2E5CFF" stop-opacity="0"/>
						</linearGradient>
					</defs>

					<!-- Baseline -->
					<line
						x1="{PAD}" y1="{SVG_H - PAD}"
						x2="{SVG_W - PAD}" y2="{SVG_H - PAD}"
						stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

					<!-- Fill area -->
					{#if paths.fill}
						<path d="{paths.fill}" fill="url(#{fillId})"/>
					{/if}

					<!-- Sparkline -->
					{#if paths.line}
						<path
							d="{paths.line}"
							fill="none"
							stroke="{lineColor}"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							style="filter: drop-shadow(0 0 3px {lineColor}66);"/>
					{/if}

					<!-- Current value dot -->
					{#if history.length > 0}
						{@const dotMaxVal = Math.max(...history, 1)}
						{@const dotX = SVG_W - PAD}
						{@const dotY = PAD + (SVG_H - PAD * 2) - (history[history.length - 1] / dotMaxVal) * (SVG_H - PAD * 2)}
						<circle cx="{dotX}" cy="{dotY}" r="3" fill="{lineColor}" style="filter: drop-shadow(0 0 4px {lineColor});"/>
					{/if}
				</svg>
			</div>

			<!-- Collapse chevron -->
			<button
				class="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded transition-colors ml-2"
				style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07);"
				on:click={() => collapsed = true}
				title="Collapse">
				<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="#4B5563" stroke-width="2">
					<polyline points="6 9 12 15 18 9"></polyline>
				</svg>
			</button>
		</div>
	{/if}
</div>
