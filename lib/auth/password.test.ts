import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('produces a hash different from the plaintext', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).not.toBe('correct horse battery');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('s3cret!');
    expect(await verifyPassword('s3cret!', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('s3cret!');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
