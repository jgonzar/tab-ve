<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { STEP_ICONS } from './icons';

	/**
	 * The tour's welcome: a screen of its own over the whole app (the tour
	 * hides the app until Empezar). The app icon, the eyebrow, the approved
	 * title and text, then the five steps to come, each with the icon its
	 * step card will carry. Empezar at the bottom, in thumb reach, Omitir
	 * under it. Mounted by ./tour, so it only ever loads with a tour.
	 */
	let { onStart, onSkip }: { onStart: () => void; onSkip: () => void } = $props();

	const titles = [m.tour_quick_title(), m.tour_summary_title(), m.tour_ride_title(), m.tour_add_title(), m.tour_history_title()];

	let start: HTMLButtonElement;
	let skip: HTMLButtonElement;

	onMount(() => {
		start.focus({ preventScroll: true });

		// Keys on release, as driver.js reads them: the step that follows
		// Empezar must not see the same arrow press
		function onKeyup(e: KeyboardEvent) {
			if (e.key === 'Escape') onSkip();
			else if (e.key === 'ArrowRight') onStart();
		}
		// Focus stays on the two buttons
		function onKeydown(e: KeyboardEvent) {
			if (e.key !== 'Tab') return;
			e.preventDefault();
			(document.activeElement === start ? skip : start).focus();
		}
		window.addEventListener('keyup', onKeyup);
		window.addEventListener('keydown', onKeydown);
		return () => {
			window.removeEventListener('keyup', onKeyup);
			window.removeEventListener('keydown', onKeydown);
		};
	});
</script>

<div class="screen" role="dialog" aria-modal="true" aria-labelledby="tour-welcome-title" aria-describedby="tour-welcome-text">
	<div class="column">
		<img class="app-icon" src="/icons/icon-192.png" alt="" width="80" height="80" />
		<p class="eyebrow">{m.tour_eyebrow()}</p>
		<h2 id="tour-welcome-title" class="title">{m.tour_welcome_title()}</h2>
		<p id="tour-welcome-text" class="lead">{m.tour_welcome_body()}</p>

		<!-- role="list": Safari drops list semantics once the markers are gone -->
		<ol class="steps" role="list">
			{#each titles as title, i}
				<li style="--delay: {150 + i * 100}ms">
					<span class="num">{i + 1}</span>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d={STEP_ICONS[i]} />
					</svg>
					<span>{title}</span>
				</li>
			{/each}
		</ol>

		<div class="spacer"></div>

		<div class="actions">
			<button bind:this={start} type="button" class="btn btn-accent" onclick={onStart}>{m.tour_start()}</button>
			<button bind:this={skip} type="button" class="btn btn-ghost" onclick={onSkip}>{m.tour_skip()}</button>
		</div>
	</div>
</div>

<style>
	/* Above driver.js's overlay and popover, and every part of the app */
	.screen {
		position: fixed;
		inset: 0;
		z-index: 1000000001;
		overflow-y: auto;
		overscroll-behavior: contain;
		background: radial-gradient(90% 55% at 50% 18%, var(--color-primary) 0%, var(--color-base-300) 45%, var(--color-base-100) 85%);
		color: var(--color-base-content);
		font-family: var(--font-sans);
	}

	.column {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 100%;
		max-width: 24rem;
		margin: 0 auto;
		padding: calc(30px + var(--safe-top)) 22px calc(20px + var(--safe-bottom));
		text-align: center;
	}

	/* Still: the first frame of the glow */
	.app-icon {
		width: 80px;
		height: 80px;
		flex: none;
		border-radius: 20px;
		box-shadow: 0 18px 40px color-mix(in oklab, var(--color-primary) 45%, transparent);
	}

	.eyebrow {
		margin: 22px 0 0;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-accent);
	}

	.title {
		margin: 4px 0 0;
		font-size: 24px;
		font-weight: 700;
		line-height: 1.25;
	}

	.lead {
		margin: 8px 0 0;
		font-size: 13.5px;
		line-height: 1.5;
		color: color-mix(in oklab, var(--color-base-content) 85%, transparent);
	}

	.steps {
		width: 100%;
		margin: 18px 0 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.steps li {
		display: flex;
		align-items: center;
		gap: 12px;
		height: 36px;
		padding: 0 12px;
		border-radius: var(--radius-field);
		background: color-mix(in oklab, var(--color-base-200) 70%, transparent);
		font-size: 13.5px;
		text-align: left;
	}

	.steps svg {
		flex: none;
		color: var(--color-accent);
	}

	.num {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 9999px;
		background: var(--color-primary);
		color: var(--color-primary-content);
		font-size: 11px;
		font-weight: 700;
	}

	/* Phones: the buttons sit at the bottom, in thumb reach */
	.spacer {
		flex: 1 0 18px;
	}

	.actions {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.actions .btn {
		width: 100%;
		height: 46px;
		font-size: 14px;
	}

	.actions .btn-ghost {
		height: 44px;
		color: color-mix(in oklab, var(--color-base-content) 75%, transparent);
	}

	/* Tablets and desktop: the column sits in the middle of the screen */
	@media (min-width: 768px) {
		.column {
			justify-content: center;
		}
		.spacer {
			flex: 0 0 24px;
		}
	}

	/* Short phones (an iPhone SE): everything a size down, so the five steps
	   and Empezar fit without scrolling */
	@media (max-height: 640px) {
		.column {
			padding-top: calc(16px + var(--safe-top));
			padding-bottom: calc(12px + var(--safe-bottom));
		}
		.app-icon {
			width: 56px;
			height: 56px;
			border-radius: 14px;
		}
		.eyebrow {
			margin-top: 14px;
		}
		.title {
			margin-top: 2px;
			font-size: 20px;
		}
		.lead {
			margin-top: 6px;
		}
		.steps {
			margin-top: 12px;
			gap: 4px;
		}
		.steps li {
			height: 32px;
		}
		.spacer {
			flex-basis: 12px;
		}
		.actions {
			gap: 0;
		}
	}

	/* The entrance plays once; only the icon's float and glow loop. With
	   reduced motion, all of it is the still state above. */
	@media (prefers-reduced-motion: no-preference) {
		.screen {
			animation: welcome-in 250ms ease-out both;
		}
		.app-icon {
			animation:
				welcome-float 3s cubic-bezier(0.42, 0, 0.58, 1) infinite,
				welcome-glow 3s cubic-bezier(0.42, 0, 0.58, 1) infinite;
		}
		.steps li {
			animation: welcome-rise 500ms ease-out var(--delay) both;
		}
	}

	@keyframes welcome-in {
		from {
			opacity: 0;
		}
	}

	@keyframes welcome-float {
		50% {
			transform: translateY(-8px);
		}
	}

	@keyframes welcome-glow {
		50% {
			box-shadow:
				0 0 0 10px color-mix(in oklab, var(--color-accent) 10%, transparent),
				0 18px 40px color-mix(in oklab, var(--color-primary) 55%, transparent);
		}
	}

	@keyframes welcome-rise {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
	}
</style>
