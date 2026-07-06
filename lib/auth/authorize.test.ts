import { describe, it, expect } from 'vitest';
import { authorizeRoute } from './authorize';

describe('authorizeRoute', () => {
  it('allows a logged-out user to view marketing pages', () => {
    expect(
      authorizeRoute({ pathname: '/', isLoggedIn: false, role: null }),
    ).toEqual({ type: 'next' });
  });

  it('redirects a logged-out user away from the app area to login', () => {
    expect(
      authorizeRoute({
        pathname: '/dashboard',
        isLoggedIn: false,
        role: null,
      }),
    ).toEqual({ type: 'redirect', to: '/login' });
  });

  it('handles the en-prefixed app area too', () => {
    expect(
      authorizeRoute({
        pathname: '/en/dashboard',
        isLoggedIn: false,
        role: null,
      }),
    ).toEqual({ type: 'redirect', to: '/en/login' });
  });

  it('allows a logged-in USER into the app area', () => {
    expect(
      authorizeRoute({
        pathname: '/dashboard',
        isLoggedIn: true,
        role: 'USER',
      }),
    ).toEqual({ type: 'next' });
  });

  it('blocks a non-admin from the admin area', () => {
    expect(
      authorizeRoute({ pathname: '/admin', isLoggedIn: true, role: 'USER' }),
    ).toEqual({ type: 'redirect', to: '/dashboard' });
  });

  it('allows an ADMIN into the admin area', () => {
    expect(
      authorizeRoute({ pathname: '/admin', isLoggedIn: true, role: 'ADMIN' }),
    ).toEqual({ type: 'next' });
  });

  it('redirects an already-logged-in user away from auth pages', () => {
    expect(
      authorizeRoute({ pathname: '/login', isLoggedIn: true, role: 'USER' }),
    ).toEqual({ type: 'redirect', to: '/dashboard' });
  });

  it('login-gates the onboarding route', () => {
    expect(authorizeRoute({ pathname: '/onboarding', isLoggedIn: false, role: null }))
      .toEqual({ type: 'redirect', to: '/login' });
    expect(authorizeRoute({ pathname: '/onboarding', isLoggedIn: true, role: 'USER' }))
      .toEqual({ type: 'next' });
  });

  it('login-gates the settings route (incl. /en prefix)', () => {
    expect(authorizeRoute({ pathname: '/en/settings/wedding', isLoggedIn: false, role: null }))
      .toEqual({ type: 'redirect', to: '/en/login' });
  });

  it('login-gates the checklist route', () => {
    expect(authorizeRoute({ pathname: '/checklist', isLoggedIn: false, role: null }))
      .toEqual({ type: 'redirect', to: '/login' });
    expect(authorizeRoute({ pathname: '/checklist', isLoggedIn: true, role: 'USER' }))
      .toEqual({ type: 'next' });
  });

  it('redirects logged-out users away from /concepts', () => {
    expect(authorizeRoute({ pathname: '/concepts', isLoggedIn: false, role: null }))
      .toEqual({ type: 'redirect', to: '/login' });
  });

  it('allows logged-in users to reach /concepts', () => {
    expect(authorizeRoute({ pathname: '/concepts', isLoggedIn: true, role: 'USER' }))
      .toEqual({ type: 'next' });
  });
});
