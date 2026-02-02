/**
 * @autopilot/jobforge-client
 * 
 * Thin JobForge request generator - validates and serializes job requests
 * without executing them. This is a runnerless client that only produces
 * JSON payloads for JobForge to consume.
 * 
 * IMPORTANT: This client does NOT:
 * - Execute jobs
 * - Connect to JobForge network endpoints
 * - Manage secrets or credentials
 * - Poll for job status
 * 
 * It ONLY generates and validates request payloads.
 */

export * from './client.js';
export * from './builders.js';
export * from './validation.js';