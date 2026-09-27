import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadEnvFiles(cwd = process.cwd()) {
  const envFiles = ['.env', '.env.local'];
  const preexisting = new Set(Object.keys(process.env));

  for (const filename of envFiles) {
    const filePath = join(cwd, filename);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (!key) continue;

      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      /* Keep shell / platform env; still let .env.local override .env. */
      if (preexisting.has(key)) continue;
      process.env[key] = value;
    }
  }

  return process.env;
}
