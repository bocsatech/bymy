import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvFiles } from './load-env.mjs';

test('loadEnvFiles reads .env and .env.local values into process.env', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bymy-env-'));
  const backup = { ...process.env };

  try {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.OTHER_VAR;

    writeFileSync(join(dir, '.env'), 'SUPABASE_URL=https://prod.supabase.co\nOTHER_VAR=base\n');
    writeFileSync(join(dir, '.env.local'), 'SUPABASE_URL=https://local.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=local-key\n');

    loadEnvFiles(dir);

    assert.equal(process.env.SUPABASE_URL, 'https://local.supabase.co');
    assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, 'local-key');
    assert.equal(process.env.OTHER_VAR, 'base');
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in backup)) delete process.env[key];
    }
    for (const [key, value] of Object.entries(backup)) {
      process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
