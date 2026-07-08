import { describe, it, expect } from 'vitest';
import { adminGateDecision } from './gate';

describe('adminGateDecision', () => {
  it('sends anonymous visitors to login', () => {
    expect(adminGateDecision(undefined, null)).toBe('login');
  });
  it('sends a logged-in non-admin to the dashboard', () => {
    expect(adminGateDecision('u1', 'USER')).toBe('dashboard');
  });
  it('bounces a stale-JWT demoted admin by the live-DB role', () => {
    // JWT is irrelevant here — the decision only ever sees the live DB role.
    expect(adminGateDecision('u1', 'USER')).toBe('dashboard');
    expect(adminGateDecision('u1', null)).toBe('dashboard');
  });
  it('allows a live-DB admin', () => {
    expect(adminGateDecision('u1', 'ADMIN')).toBe('allow');
  });
});
