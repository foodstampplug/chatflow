<script>
	import { onMount, onDestroy } from 'svelte';
	import { messages } from '$lib/stores/chat.js';

	const TICK_INTERVAL_MS = 3000;
	const WINDOW_MS = 5 * 60 * 1000;        // 5 minutes total window
	const SPIKE_WINDOW_MS = 60 * 1000;      // 60s for spike detection
	const SPIKE_THRESHOLD = 5;              // 5+ mentions in 60s = spiking
	const MIN_MENTIONS = 2;
	const MAX_SHOWN = 8;

	// Regex for $TICKER pattern
	const TICKER_RE = /\$([A-Z]{2,10})/g;

	// Always-detected known tokens (without $ prefix)
	const KNOWN_TOKENS = new Set([
		'SOL', 'BTC', 'ETH', 'BONK', 'WIF', 'DOGE',
		'PEPE', 'SUI', 'AVAX', 'LINK', 'BNB', 'XRP'
	]);

	// Build regex for known tokens as whole words (case-insensitive)
	const KNOWN_RE = new RegExp(`\\b(${[...KNOWN_TOKENS].join('|')})\\b`, 'gi');

	// tickerMap: Map<string, number[]> — ticker -> array of timestamps
	let tickerMap = new Map();
	let displayList = [];  // [{ticker, recentCount, totalCount, spiking}]
	let tickerInterval = null;

	let lastProcessedCount = 0;

	function extractTickers(text) {
		const found = new Set();

		// $TICKER matches
		const dollarMatches = [...text.matchAll(TICKER_RE)];
		for (const m of dollarMatches) {
			found.add(m[1].toUpperCase());
		}

		// Known tokens without $
		const knownMatches = [...text.matchAll(KNOWN_RE)];
		for (const m of knownMatches) {
			found.add(m[1].toUpperCase());
		}

		return found;
	}

	// Subscribe to messages store — process new messages
	const unsubMessages = messages.subscribe(($msgs) => {
		// Only process messages we haven't seen yet (they're prepended)
		const newCount = $msgs.length - lastProcessedCount;
		if (newCount <= 0) {
			// Store was reset or same — reprocess all
			if ($msgs.length < lastProcessedCount) {
				tickerMap = new Map();
				lastProcessedCount = 0;
			}
			return;
		}

		// New messages are at the front of the array (index 0..newCount-1)
		const newMsgs = $msgs.slice(0, newCount);
		const now = Date.now();

		for (const msg of newMsgs) {
			if (msg.hidden) continue;
			const tickers = extractTickers(msg.message || '');
			for (const ticker of tickers) {
				const ts = msg.timestamp || now;
				if (!tickerMap.has(ticker)) {
					tickerMap = new Map(tickerMap);
					tickerMap.set(ticker, []);
				}
				tickerMap.get(ticker).push(ts);
			}
		}

		lastProcessedCount = $msgs.length;
	});

	function tick() {
		const now = Date.now();
		const windowStart = now - WINDOW_MS;
		const spikeStart = now - SPIKE_WINDOW_MS;

		// Prune old timestamps and build display list
		const entries = [];

		for (const [ticker, timestamps] of tickerMap.entries()) {
			// Prune to window
			const pruned = timestamps.filter(ts => ts >= windowStart);
			if (pruned.length !== timestamps.length) {
				tickerMap.set(ticker, pruned);
			}

			const totalCount = pruned.length;
			if (totalCount < MIN_MENTIONS) continue;

			const recentCount = pruned.filter(ts => ts >= spikeStart).length;
			const spiking = recentCount >= SPIKE_THRESHOLD;

			entries.push({ ticker, recentCount, totalCount, spiking });
		}

		// Sort: spiking first, then by 60s count desc, then total desc
		entries.sort((a, b) => {
			if (a.spiking && !b.spiking) return -1;
			if (!a.spiking && b.spiking) return 1;
			if (b.recentCount !== a.recentCount) return b.recentCount - a.recentCount;
			return b.totalCount - a.totalCount;
		});

		displayList = entries.slice(0, MAX_SHOWN);
	}

	onMount(() => {
		tick();
		tickerInterval = setInterval(tick, TICK_INTERVAL_MS);
	});

	onDestroy(() => {
		clearInterval(tickerInterval);
		unsubMessages();
	});

	// Max recent count for bar scaling
	$: maxRecent = displayList.length > 0 ? Math.max(...displayList.map(d => d.recentCount), 1) : 1;
</script>

<div class="radar-panel">
	<p class="radar-title">TOKEN RADAR</p>

	{#if displayList.length === 0}
		<p class="radar-empty">Monitoring chat...</p>
	{:else}
		<div class="radar-list">
			{#each displayList as item (item.ticker)}
				<div class="radar-row {item.spiking ? 'token-spike' : ''}">
					<!-- Ticker name -->
					<span class="radar-ticker {item.spiking ? 'radar-ticker-spike' : ''}">
						{item.ticker}
					</span>

					<!-- Spike indicator -->
					<span class="radar-spike-icon" style="opacity:{item.spiking ? 1 : 0};">
						↑
					</span>

					<!-- 1min count bar -->
					<div class="radar-bar-wrap">
						<div
							class="radar-bar"
							style="width:{Math.max((item.recentCount / maxRecent) * 100, 4)}%; background:{item.spiking ? '#53FC18' : '#FF9500'};">
						</div>
					</div>

					<!-- Counts -->
					<span class="radar-count-recent" style="color:{item.spiking ? '#53FC18' : '#FF9500'};">
						{item.recentCount}
					</span>
					<span class="radar-count-total">
						{item.totalCount}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.radar-panel {
		background: #0F0F18;
		border: 1px solid rgba(83,252,24,0.1);
		border-radius: 8px;
		padding: 14px;
	}

	.radar-title {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: rgba(83,252,24,0.8);
		margin: 0 0 10px 0;
	}

	.radar-empty {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		color: #2E3650;
		margin: 0;
	}

	.radar-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.radar-row {
		display: flex;
		align-items: center;
		gap: 6px;
		border-radius: 4px;
		padding: 3px 4px;
		transition: background 0.2s;
	}

	.radar-row.token-spike {
		background: rgba(83,252,24,0.05);
		animation: radar-spike 1.2s ease-in-out infinite;
	}

	.radar-ticker {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		font-weight: 700;
		color: #FF9500;
		width: 48px;
		flex-shrink: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: 0.03em;
	}

	.radar-ticker-spike {
		color: #53FC18;
		text-shadow: 0 0 8px rgba(83,252,24,0.6);
	}

	.radar-spike-icon {
		font-size: 9px;
		font-weight: 900;
		color: #53FC18;
		width: 10px;
		flex-shrink: 0;
		line-height: 1;
		transition: opacity 0.2s;
	}

	.radar-bar-wrap {
		flex: 1;
		height: 3px;
		background: rgba(255,255,255,0.05);
		border-radius: 99px;
		overflow: hidden;
	}

	.radar-bar {
		height: 100%;
		border-radius: 99px;
		transition: width 0.5s ease, background 0.3s;
		opacity: 0.85;
	}

	.radar-count-recent {
		font-family: 'JetBrains Mono', monospace;
		font-size: 9px;
		font-weight: 700;
		flex-shrink: 0;
		width: 18px;
		text-align: right;
		line-height: 1;
	}

	.radar-count-total {
		font-family: 'JetBrains Mono', monospace;
		font-size: 9px;
		color: #2E3650;
		flex-shrink: 0;
		width: 20px;
		text-align: right;
		line-height: 1;
	}
</style>
