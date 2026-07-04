type Role = 'USER' | 'ADMIN' | null;

type Decision =
  | { type: 'next' }
  | { type: 'redirect'; to: string };

const APP_PREFIXES = ['/dashboard'];
const ADMIN_PREFIXES = ['/admin'];
const AUTH_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password'];

/**
 * Strips a leading `/en` locale prefix (Hebrew is unprefixed).
 * Returns the locale segment (or '' for default) and the remaining path.
 */
function splitLocale(pathname: string): { localePrefix: string; rest: string } {
  const match = pathname.match(/^\/(en)(?=\/|$)/);
  if (match) {
    const rest = pathname.slice(match[0].length) || '/';
    return { localePrefix: `/${match[1]}`, rest };
  }
  return { localePrefix: '', rest: pathname || '/' };
}

function startsWithAny(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

export function authorizeRoute(input: {
  pathname: string;
  isLoggedIn: boolean;
  role: Role;
}): Decision {
  const { localePrefix, rest } = splitLocale(input.pathname);
  const to = (path: string) => `${localePrefix}${path}`;

  if (startsWithAny(rest, ADMIN_PREFIXES)) {
    if (!input.isLoggedIn) return { type: 'redirect', to: to('/login') };
    if (input.role !== 'ADMIN') return { type: 'redirect', to: to('/dashboard') };
    return { type: 'next' };
  }

  if (startsWithAny(rest, APP_PREFIXES)) {
    if (!input.isLoggedIn) return { type: 'redirect', to: to('/login') };
    return { type: 'next' };
  }

  if (startsWithAny(rest, AUTH_PREFIXES)) {
    if (input.isLoggedIn) return { type: 'redirect', to: to('/dashboard') };
    return { type: 'next' };
  }

  return { type: 'next' };
}
