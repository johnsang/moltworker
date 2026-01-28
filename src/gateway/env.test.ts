import { describe, it, expect } from 'vitest';
import { buildEnvVars } from './env';
import { createMockEnv } from '../test-utils';

describe('buildEnvVars', () => {
  it('returns empty object when no env vars set', async () => {
    const env = createMockEnv();
    const result = await buildEnvVars(env);
    expect(result).toEqual({});
  });

  it('includes ANTHROPIC_API_KEY when set directly', async () => {
    const env = createMockEnv({ ANTHROPIC_API_KEY: 'sk-test-key' });
    const result = await buildEnvVars(env);
    expect(result.ANTHROPIC_API_KEY).toBe('sk-test-key');
  });

  it('maps AI_GATEWAY_API_KEY to ANTHROPIC_API_KEY', async () => {
    const env = createMockEnv({ AI_GATEWAY_API_KEY: 'sk-gateway-key' });
    const result = await buildEnvVars(env);
    expect(result.ANTHROPIC_API_KEY).toBe('sk-gateway-key');
  });

  it('maps AI_GATEWAY_BASE_URL to ANTHROPIC_BASE_URL', async () => {
    const env = createMockEnv({ AI_GATEWAY_BASE_URL: 'https://gateway.ai.cloudflare.com/v1/123/my-gw/anthropic' });
    const result = await buildEnvVars(env);
    expect(result.ANTHROPIC_BASE_URL).toBe('https://gateway.ai.cloudflare.com/v1/123/my-gw/anthropic');
  });

  it('AI_GATEWAY_* takes precedence over ANTHROPIC_*', async () => {
    const env = createMockEnv({
      AI_GATEWAY_API_KEY: 'gateway-key',
      AI_GATEWAY_BASE_URL: 'https://gateway.example.com',
      ANTHROPIC_API_KEY: 'direct-key',
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
    });
    const result = await buildEnvVars(env);
    expect(result.ANTHROPIC_API_KEY).toBe('gateway-key');
    expect(result.ANTHROPIC_BASE_URL).toBe('https://gateway.example.com');
  });

  it('falls back to ANTHROPIC_* when AI_GATEWAY_* not set', async () => {
    const env = createMockEnv({
      ANTHROPIC_API_KEY: 'direct-key',
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
    });
    const result = await buildEnvVars(env);
    expect(result.ANTHROPIC_API_KEY).toBe('direct-key');
    expect(result.ANTHROPIC_BASE_URL).toBe('https://api.anthropic.com');
  });

  it('includes OPENAI_API_KEY when set', async () => {
    const env = createMockEnv({ OPENAI_API_KEY: 'sk-openai-key' });
    const result = await buildEnvVars(env);
    expect(result.OPENAI_API_KEY).toBe('sk-openai-key');
  });

  it('maps MOLTBOT_GATEWAY_TOKEN to CLAWDBOT_GATEWAY_TOKEN for container', async () => {
    const env = createMockEnv({ MOLTBOT_GATEWAY_TOKEN: 'my-token' });
    const result = await buildEnvVars(env);
    expect(result.CLAWDBOT_GATEWAY_TOKEN).toBe('my-token');
  });

  it('includes all channel tokens when set', async () => {
    const env = createMockEnv({
      TELEGRAM_BOT_TOKEN: 'tg-token',
      TELEGRAM_DM_POLICY: 'pairing',
      DISCORD_BOT_TOKEN: 'discord-token',
      DISCORD_DM_POLICY: 'open',
      SLACK_BOT_TOKEN: 'slack-bot',
      SLACK_APP_TOKEN: 'slack-app',
    });
    const result = await buildEnvVars(env);
    
    expect(result.TELEGRAM_BOT_TOKEN).toBe('tg-token');
    expect(result.TELEGRAM_DM_POLICY).toBe('pairing');
    expect(result.DISCORD_BOT_TOKEN).toBe('discord-token');
    expect(result.DISCORD_DM_POLICY).toBe('open');
    expect(result.SLACK_BOT_TOKEN).toBe('slack-bot');
    expect(result.SLACK_APP_TOKEN).toBe('slack-app');
  });

  it('maps DEV_MODE to CLAWDBOT_DEV_MODE for container', async () => {
    const env = createMockEnv({
      DEV_MODE: 'true',
      CLAWDBOT_BIND_MODE: 'lan',
    });
    const result = await buildEnvVars(env);
    
    // DEV_MODE is passed to container as CLAWDBOT_DEV_MODE
    expect(result.CLAWDBOT_DEV_MODE).toBe('true');
    expect(result.CLAWDBOT_BIND_MODE).toBe('lan');
  });

  it('combines all env vars correctly', async () => {
    const env = createMockEnv({
      ANTHROPIC_API_KEY: 'sk-key',
      MOLTBOT_GATEWAY_TOKEN: 'token',
      TELEGRAM_BOT_TOKEN: 'tg',
    });
    const result = await buildEnvVars(env);
    
    expect(result).toEqual({
      ANTHROPIC_API_KEY: 'sk-key',
      CLAWDBOT_GATEWAY_TOKEN: 'token',
      TELEGRAM_BOT_TOKEN: 'tg',
    });
  });

  it('uses workerUrl from options when provided', async () => {
    const env = createMockEnv();
    const result = await buildEnvVars(env, { workerUrl: 'https://my-worker.workers.dev' });
    expect(result.WORKER_URL).toBe('https://my-worker.workers.dev');
  });

  it('generates CDP_SECRET when BROWSER binding and MOLTBOT_GATEWAY_TOKEN are set', async () => {
    const env = createMockEnv({
      MOLTBOT_GATEWAY_TOKEN: 'my-gateway-token',
      BROWSER: {} as Fetcher, // Mock BROWSER binding
    });
    const result = await buildEnvVars(env);
    
    // CDP_SECRET should be a 64-character hex string (256 bits)
    expect(result.CDP_SECRET).toBeDefined();
    expect(result.CDP_SECRET).toHaveLength(64);
    expect(result.CDP_SECRET).toMatch(/^[0-9a-f]+$/);
  });

  it('does not generate CDP_SECRET when BROWSER binding is missing', async () => {
    const env = createMockEnv({
      MOLTBOT_GATEWAY_TOKEN: 'my-gateway-token',
    });
    const result = await buildEnvVars(env);
    expect(result.CDP_SECRET).toBeUndefined();
  });

  it('does not generate CDP_SECRET when MOLTBOT_GATEWAY_TOKEN is missing', async () => {
    const env = createMockEnv({
      BROWSER: {} as Fetcher,
    });
    const result = await buildEnvVars(env);
    expect(result.CDP_SECRET).toBeUndefined();
  });

  it('generates deterministic CDP_SECRET for same gateway token', async () => {
    const env = createMockEnv({
      MOLTBOT_GATEWAY_TOKEN: 'same-token',
      BROWSER: {} as Fetcher,
    });
    const result1 = await buildEnvVars(env);
    const result2 = await buildEnvVars(env);
    
    expect(result1.CDP_SECRET).toBe(result2.CDP_SECRET);
  });

  it('generates different CDP_SECRET for different gateway tokens', async () => {
    const env1 = createMockEnv({
      MOLTBOT_GATEWAY_TOKEN: 'token-1',
      BROWSER: {} as Fetcher,
    });
    const env2 = createMockEnv({
      MOLTBOT_GATEWAY_TOKEN: 'token-2',
      BROWSER: {} as Fetcher,
    });
    
    const result1 = await buildEnvVars(env1);
    const result2 = await buildEnvVars(env2);
    
    expect(result1.CDP_SECRET).not.toBe(result2.CDP_SECRET);
  });
});
