import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vercel runs api/* as plain Node ES modules, where a relative import must
// name the file it loads ('./x.js'). Vite resolves './x' for the browser, so a
// missing extension only shows up in production, as a function that crashes
// before it runs (it took /api/signup down once). This walks every import
// reachable from api/ and checks each one.

const ROOT = resolve(__dirname, '../..');
const SPECIFIER = /(?:import|export)\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

const entries = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? entries(path) : path.endsWith('.ts') ? [path] : [];
  });

describe('server functions load in Node', () => {
  it('import every local file with its .js extension', () => {
    const seen = new Set<string>();
    const problems: string[] = [];
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const source = readFileSync(file, 'utf8').replace(/^\s*import type .*$/gm, '');
      for (const match of source.matchAll(SPECIFIER)) {
        const specifier = match[1] ?? match[2];
        if (!specifier.endsWith('.js')) {
          problems.push(`${file.replace(`${ROOT}/`, '')}: '${specifier}'`);
          continue;
        }
        const target = resolve(dirname(file), specifier.replace(/\.js$/, '.ts'));
        try {
          statSync(target);
          visit(target);
        } catch {
          // a real .js file, or a .tsx the server never loads
        }
      }
    };
    entries(join(ROOT, 'api')).forEach(visit);
    expect(seen.size).toBeGreaterThan(20);
    expect(problems).toEqual([]);
  });
});
