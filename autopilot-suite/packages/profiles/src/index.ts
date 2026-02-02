/**
 * @autopilot/profiles
 * 
 * Shared profile system for Autopilot modules.
 * 
 * Provides base profile with sensible defaults plus per-app overlays
 * for Settler, AIAS, Keys, ReadyLayer, and JobForge.
 */

export * from './base.js';
export * from './overlays/index.js';
export * from './registry.js';