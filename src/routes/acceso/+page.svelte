<script lang="ts">
	import { tick } from 'svelte';
	import { applyAction, enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { GATE_COPY, PIN_LENGTH, PIN_PATTERN, isPinFormat } from '$lib/gate';

	let { data, form } = $props();

	let pin = $state('');
	let pending = $state(false);
	let networkError = $state(false);
	let formEl: HTMLFormElement;
	let pinEl: HTMLInputElement;

	const error = $derived.by(() => {
		if (networkError || form?.error === 'unavailable') return GATE_COPY.networkError;
		if (form?.error === 'locked') return GATE_COPY.lockedOut.replace('{min}', String(form.minutes));
		if (form?.error === 'wrong') return GATE_COPY.wrongPin;
		return null;
	});
	// Sent here by a 401 or a cookie that no longer validates; gone after the first try.
	const notice = $derived(!error && !form && data.expired ? GATE_COPY.expired : null);

	// The 6th digit submits, so it stays quick. "Entrar" stays for paste and
	// for assistive tech.
	function onInput() {
		if (isPinFormat(pin) && !pending) formEl.requestSubmit();
	}

	const submitPin: SubmitFunction = ({ cancel }) => {
		if (pending) return cancel();
		pending = true;
		networkError = false;
		return async ({ result, update }) => {
			if (result.type === 'redirect') {
				// Stay busy while the router moves on to the original page.
				await applyAction(result);
				return;
			}
			if (result.type === 'error') networkError = true;
			else await update();
			pending = false;
			pin = '';
			await tick();
			pinEl.focus();
		};
	};
</script>

<main class="pwa-gate min-h-dvh bg-base-100 flex flex-col items-center px-4">
	<div class="flex-1 flex flex-col justify-center gap-10 w-full max-w-xs">
		<div class="text-center">
			<Wordmark class="h-12 mx-auto" />
			<h1 class="mt-6 text-2xl font-semibold">{GATE_COPY.heading}</h1>
			<p class="mt-2 text-sm text-base-content/60">{GATE_COPY.subtext}</p>
		</div>

		<!-- novalidate: the server checks the format and answers in the gate's own
		     copy, instead of the browser's generic bubble. -->
		<form method="POST" novalidate bind:this={formEl} use:enhance={submitPin} class="flex flex-col gap-5">
			<div class="flex flex-col gap-1.5">
				<label for="pin" class="text-sm font-medium text-base-content/80">{GATE_COPY.label}</label>
				<input
					bind:this={pinEl}
					bind:value={pin}
					oninput={onInput}
					id="pin"
					name="pin"
					type="password"
					inputmode="numeric"
					pattern={PIN_PATTERN}
					maxlength={PIN_LENGTH}
					autocomplete="current-password"
					enterkeyhint="go"
					spellcheck="false"
					aria-invalid={error ? 'true' : undefined}
					aria-describedby="pin-message"
					class="input input-bordered input-lg w-full tracking-[0.3em]"
				/>
				<!-- Always rendered, so a message doesn't shift the centred column. -->
				<p
					id="pin-message"
					aria-live="polite"
					class={['min-h-5 text-sm', error ? 'text-error' : 'text-base-content/80']}
				>
					{error ?? notice ?? ''}
				</p>
			</div>

			<button type="submit" class="btn btn-accent h-11 w-full" aria-busy={pending}>
				{#if pending}<span class="loading loading-spinner loading-sm" aria-hidden="true"></span>{/if}
				{GATE_COPY.submit}
			</button>
		</form>
	</div>

	{#if data.demoUrl}
		<p class="mt-6 flex flex-wrap items-center justify-center gap-x-1 text-sm text-base-content/60">
			{GATE_COPY.demoPrompt}
			<a href={data.demoUrl} class="inline-flex min-h-11 items-center px-1 font-semibold text-accent hover:underline">
				{GATE_COPY.demoLink}
			</a>
		</p>
	{/if}
</main>
