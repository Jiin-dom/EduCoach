export const OAUTH_RETURN_PATH_KEY = 'oauth_return_path';
export const DEFAULT_RETURN_PATH = '/dashboard';

/**
 * Saves a clean return path into session storage, rejecting unsafe absolute URLs.
 */
export function saveOAuthReturnPath(path?: string): void {
  if (!path || path.startsWith('http') || path.startsWith('//')) {
    return;
  }
  sessionStorage.setItem(OAUTH_RETURN_PATH_KEY, path);
}

/**
 * Reads the return path from session storage, falling back to a default.
 */
export function getOAuthReturnPath(): string {
  const path = sessionStorage.getItem(OAUTH_RETURN_PATH_KEY);
  if (path && path.startsWith('/') && !path.startsWith('//')) {
    return path;
  }
  return DEFAULT_RETURN_PATH;
}

/**
 * Clears the return path from session storage.
 */
export function clearOAuthReturnPath(): void {
  sessionStorage.removeItem(OAUTH_RETURN_PATH_KEY);
}

/**
 * Extracts provider callback errors from the URL.
 * Supabase typically appends these as `#error=...` or `?error=...`
 */
export function getOAuthCallbackError(): string | null {
  if (typeof window === 'undefined') return null;

  // Check search params
  const urlParams = new URLSearchParams(window.location.search);
  let err = urlParams.get('error_description') || urlParams.get('error');
  
  // Check hash params (Supabase often uses fragment for implicit flow errors)
  if (!err && window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    err = hashParams.get('error_description') || hashParams.get('error');
  }

  if (err) {
    // Basic cleanup of standard oauth error descriptions
    return decodeURIComponent(err).replace(/\+/g, ' ');
  }
  return null;
}
