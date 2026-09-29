<script lang="ts">
	import { userState, USERS, type User } from '$lib/stores/user.svelte';

	function select(user: User) {
		userState.setUser(user);
	}
</script>

<div class="fixed inset-0 z-50 bg-base-100 flex flex-col items-center justify-center p-8 gap-10">
	<div class="text-center">
		<h1 class="text-3xl font-bold tracking-tight">Yummy Track</h1>
		<p class="text-base-content/60 mt-2 text-sm">Selecciona tu usuario para continuar</p>
	</div>

	<div class="flex flex-col gap-3 w-full max-w-xs">
		{#each USERS as user}
			<button
				onclick={() => select(user)}
				class="card bg-base-200 hover:bg-base-300 active:scale-95 transition-all duration-150 cursor-pointer text-left"
			>
				<div class="card-body flex-row items-center gap-4 p-4">
					<div class="avatar placeholder shrink-0">
						<div class="bg-primary text-primary-content rounded-full w-12 flex items-center justify-center">
							<span class="text-base font-bold leading-none">{user.iniciales}</span>
						</div>
					</div>
					<div>
						<p class="font-semibold">{user.nombre}</p>
						<p class="text-xs text-base-content/60 capitalize">{user.rol}</p>
					</div>
				</div>
			</button>
		{/each}
	</div>
</div>
