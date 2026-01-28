/**
 * Configuration constants for Moltbot Sandbox
 */

/** Port that the Moltbot gateway listens on inside the container */
export const MOLTBOT_PORT = 18789;

/** Maximum time to wait for Moltbot to start (3 minutes) */
export const STARTUP_TIMEOUT_MS = 180_000;

/** Mount path for R2 persistent storage inside the container */
export const R2_MOUNT_PATH = '/data/moltbot';

/** R2 bucket name for persistent storage */
export const R2_BUCKET_NAME = 'moltbot-data';

/** Minimum length for CDP secret (256 bits = 64 hex chars) */
export const CDP_SECRET_LENGTH = 64;

/**
 * Generate a deterministic CDP secret from the gateway token.
 * 
 * This derives a cryptographically secure secret from the existing MOLTBOT_GATEWAY_TOKEN
 * so that both the worker and container always compute the same secret without needing
 * to store any state. The secret is 256 bits (64 hex chars).
 * 
 * @param gatewayToken - The MOLTBOT_GATEWAY_TOKEN used as seed
 * @returns A 64-character hex string (256 bits)
 */
export async function generateCDPSecret(gatewayToken: string): Promise<string> {
  const encoder = new TextEncoder();
  // Use a domain separator to ensure this is distinct from other derived keys
  const data = encoder.encode(`moltworker:cdp-secret:${gatewayToken}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
