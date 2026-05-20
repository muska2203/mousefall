/**
 * Seeded pseudo-random number generator (PRNG).
 *
 * Algorithm: Mulberry32 — simple, fast, good distribution, 32-bit state.
 * Reference: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 *
 * CRITICAL RULES:
 * - This is the ONLY source of randomness in the simulation layer.
 * - Never use Math.random() in simulation code.
 * - RNGState is part of GameState and must be serialized with saves.
 * - Same seed + same call sequence = same results (determinism guarantee).
 *
 * Mutation contract:
 * - rngFloat(), rngInt(), rngPick(), rngShuffle(), rngChance() all mutate rng.state.
 * - This is intentional — the state advance IS the randomness.
 * - Callers must pass the same RNGState object throughout a simulation step.
 */

export type { RNGState } from '../simulation/types';
import type { RNGState } from '../simulation/types';

/**
 * Create a new RNG with the given seed.
 * Use Date.now() or a user-provided value as the seed.
 * The seed is stored for display/sharing — it never changes.
 */
export function createRNG(seed: number): RNGState {
  return { seed, state: seed >>> 0 }; // Ensure unsigned 32-bit
}

/**
 * Advance the RNG state and return a float in [0, 1).
 * Mutates rng.state.
 */
export function rngFloat(rng: RNGState): number {
  rng.state += 0x6d2b79f5;
  let z = rng.state;
  z = Math.imul(z ^ (z >>> 15), z | 1);
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
  return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
}

/**
 * Return a random integer in [min, max] inclusive.
 * Mutates rng.state.
 */
export function rngInt(rng: RNGState, min: number, max: number): number {
  return Math.floor(rngFloat(rng) * (max - min + 1)) + min;
}

/**
 * Pick a random element from a non-empty array.
 * Mutates rng.state.
 * Throws if array is empty.
 */
export function rngPick<T>(rng: RNGState, array: readonly T[]): T {
  if (array.length === 0) throw new Error('rngPick: array must not be empty');
  return array[rngInt(rng, 0, array.length - 1)] as T;
}

/**
 * Shuffle an array in place using Fisher-Yates algorithm.
 * Mutates rng.state and the array.
 * Returns the same array (mutated).
 */
export function rngShuffle<T>(rng: RNGState, array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = rngInt(rng, 0, i);
    [array[i], array[j]] = [array[j] as T, array[i] as T];
  }
  return array;
}

/**
 * Roll a percentage chance.
 * Returns true if a random roll in [0, 100) is less than percent.
 * Mutates rng.state.
 *
 * @param percent - 0 = never, 100 = always
 */
export function rngChance(rng: RNGState, percent: number): boolean {
  return rngFloat(rng) * 100 < percent;
}
