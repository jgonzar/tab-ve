/**
 * Defaults for ride fields that no longer have a form input.
 *
 * "Para quién" (clientes) and "Conductor" were removed from the ride form —
 * they added friction without adding usable context for this household, where
 * every ride is MC driving JA and Marcela. See the "Diferido" section of
 * docs/prd.md for the rationale and the conditions for bringing them back.
 *
 * The database still has `viaje_clientes` and `viajes.conductor_nombre`, and
 * both are still read and displayed. Only the inputs are gone, so restoring
 * them is a UI change, not a migration.
 */

/** JA + Marcela. Every new ride is shared between both clients. */
export const DEFAULT_CLIENT_IDS = [1, 2];

/** Matches the `conductor_nombre` column default, so this is only a fallback. */
export const DEFAULT_CONDUCTOR = 'MC';
