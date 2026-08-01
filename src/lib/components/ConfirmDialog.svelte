<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The standard confirmation dialog. Use this instead of an inline
	 * "¿Seguro? No / Sí" row — those are cramped, easy to mis-tap, and each one
	 * ends up with its own slightly different behaviour.
	 *
	 * Not for the quick-route chips: those confirm by tapping the same chip
	 * twice, which is the point of the shortcut.
	 */
	let {
		open = $bindable(false),
		title,
		confirmLabel,
		confirmClass = 'btn-primary',
		busy = false,
		onConfirm,
		children
	}: {
		open?: boolean;
		title: string;
		confirmLabel: string;
		/** Full DaisyUI class, written literally at the call site so Tailwind sees it. */
		confirmClass?: string;
		busy?: boolean;
		onConfirm: () => void;
		children?: Snippet;
	} = $props();

	function close() {
		if (busy) return; // never dismissable mid-request
		open = false;
	}

	$effect(() => {
		if (!open) return;
		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') close();
		}
		document.addEventListener('keydown', onKeydown);
		return () => document.removeEventListener('keydown', onKeydown);
	});
</script>

<div class="modal" class:modal-open={open} role="dialog" aria-modal="true">
	<div class="modal-box relative">
		<button
			class="btn btn-circle bg-base-300 border-none text-base-content hover:bg-base-100 absolute right-3 top-3"
			onclick={close}
			disabled={busy}
			aria-label="Cerrar"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>

		<h3 class="font-bold text-lg pr-14">{title}</h3>

		{#if children}
			<p class="pt-3 text-base text-base-content/70">{@render children()}</p>
		{/if}

		<div class="modal-action">
			<button class="btn btn-ghost" onclick={close} disabled={busy}>Cancelar</button>
			<button class="btn {confirmClass}" onclick={onConfirm} disabled={busy}>
				{#if busy}
					<span class="loading loading-spinner loading-sm"></span>
				{:else}
					{confirmLabel}
				{/if}
			</button>
		</div>
	</div>

	<div class="modal-backdrop" role="none">
		<button type="button" onclick={close} disabled={busy}>cerrar</button>
	</div>
</div>
