<script>
	import { onMount, onDestroy } from 'svelte';

	const API_URL = 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=30&order=volume&ascending=false';
	const REFRESH_MS = 60000;
	const MAX_QUESTION_LEN = 40;

	let markets = [];
	let visible = false;
	let interval = null;

	function truncate(str, len) {
		if (!str) return '';
		return str.length > len ? str.slice(0, len - 1) + '…' : str;
	}

	function parseYesPct(outcomePrices) {
		try {
			const arr = typeof outcomePrices === 'string' ? JSON.parse(outcomePrices) : outcomePrices;
			if (Array.isArray(arr) && arr.length > 0) {
				return Math.round(parseFloat(arr[0]) * 100);
			}
		} catch {}
		return null;
	}

	function pctColor(pct) {
		if (pct === null) return '#8890AA';
		if (pct > 60) return '#00FF88';
		if (pct < 40) return '#E43D30';
		return '#FF9500';
	}

	async function fetchMarkets() {
		try {
			const res = await fetch(API_URL);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			const parsed = (Array.isArray(data) ? data : [])
				.filter(m => m.active !== false)
				.map(m => ({
					question: truncate(m.question, MAX_QUESTION_LEN),
					yesPct: parseYesPct(m.outcomePrices)
				}))
				.filter(m => m.yesPct !== null);

			if (parsed.length > 0) {
				markets = parsed;
				visible = true;
			}
		} catch {
			// silent fail — spec says hide on error
		}
	}

	onMount(() => {
		fetchMarkets();
		interval = setInterval(fetchMarkets, REFRESH_MS);
	});

	onDestroy(() => clearInterval(interval));

	// Build the ticker string: duplicate for seamless loop
	$: tickerItems = markets;
</script>

{#if visible && tickerItems.length > 0}
<div class="poly-ticker-wrap">
	<!-- Fixed left label -->
	<div class="poly-label">
		<span>POLYMARKET</span>
	</div>

	<!-- Scrolling track -->
	<div class="poly-track-outer">
		<div class="poly-track">
			<!-- Original set -->
			{#each tickerItems as item}
				<span class="poly-item">
					<span class="poly-question">{item.question}</span>
					<span class="poly-pct" style="color:{pctColor(item.yesPct)};">{item.yesPct}%</span>
					<span class="poly-sep">·</span>
				</span>
			{/each}
			<!-- Duplicate for seamless loop -->
			{#each tickerItems as item}
				<span class="poly-item">
					<span class="poly-question">{item.question}</span>
					<span class="poly-pct" style="color:{pctColor(item.yesPct)};">{item.yesPct}%</span>
					<span class="poly-sep">·</span>
				</span>
			{/each}
		</div>
	</div>
</div>
{/if}

<style>
	.poly-ticker-wrap {
		display: flex;
		align-items: center;
		height: 32px;
		background: #050508;
		border-top: 1px solid rgba(46,92,255,0.08);
		border-bottom: 1px solid rgba(46,92,255,0.15);
		overflow: hidden;
		flex-shrink: 0;
		position: relative;
		z-index: 5;
	}

	.poly-label {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		height: 100%;
		padding: 0 10px 0 12px;
		background: rgba(46,92,255,0.12);
		border-right: 1px solid rgba(46,92,255,0.25);
	}

	.poly-label span {
		font-family: 'JetBrains Mono', monospace;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #2E5CFF;
		white-space: nowrap;
	}

	.poly-track-outer {
		flex: 1;
		overflow: hidden;
		height: 100%;
		display: flex;
		align-items: center;
	}

	.poly-track {
		display: flex;
		align-items: center;
		white-space: nowrap;
		animation: ticker-scroll 60s linear infinite;
		will-change: transform;
	}

	.poly-item {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 0 4px;
	}

	.poly-question {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		font-weight: 400;
		letter-spacing: 0.04em;
		color: #8890AA;
		white-space: nowrap;
	}

	.poly-pct {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.05em;
		white-space: nowrap;
	}

	.poly-sep {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		color: rgba(46,92,255,0.4);
		margin-left: 6px;
		white-space: nowrap;
	}
</style>
