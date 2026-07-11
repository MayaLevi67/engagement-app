import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('no-gold guard', () => {
  it('no gold hex or accent token remains in app/ or components/', () => {
    const out = execSync(
      `grep -rniE "(bg|text|border|ring|from|to|via|fill|stroke)-accent|--color-accent|#c9a961" app components --include=*.tsx --include=*.ts --include=*.css || true`,
      { encoding: 'utf8' },
    );
    const hits = out.split('\n').filter((l) => l.trim() && !l.includes('globals-nogold.test.ts'));
    expect(hits).toEqual([]);
  });
});
