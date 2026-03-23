import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveOAuthReturnPath,
  getOAuthReturnPath,
  clearOAuthReturnPath,
  getOAuthCallbackError,
  DEFAULT_RETURN_PATH,
} from './oauthRedirect';

describe('oauthRedirect utilities', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('saveOAuthReturnPath and getOAuthReturnPath', () => {
    it('saves and reads a valid in-app path', () => {
      saveOAuthReturnPath('/settings');
      expect(getOAuthReturnPath()).toBe('/settings');
    });

    it('falls back to default for invalid absolute URLs', () => {
      saveOAuthReturnPath('https://evil.com/phishing');
      expect(getOAuthReturnPath()).toBe(DEFAULT_RETURN_PATH);
    });

    it('falls back to default for invalid protocol-relative URLs', () => {
      saveOAuthReturnPath('//evil.com/phishing');
      expect(getOAuthReturnPath()).toBe(DEFAULT_RETURN_PATH);
    });

    it('falls back to default when nothing is saved', () => {
      expect(getOAuthReturnPath()).toBe(DEFAULT_RETURN_PATH);
    });
  });

  describe('clearOAuthReturnPath', () => {
    it('clears the stored path after consumption', () => {
      saveOAuthReturnPath('/profile');
      expect(getOAuthReturnPath()).toBe('/profile');
      clearOAuthReturnPath();
      expect(getOAuthReturnPath()).toBe(DEFAULT_RETURN_PATH);
    });
  });

  describe('getOAuthCallbackError', () => {
    it('extracts error from search string', () => {
      vi.stubGlobal('window', {
        location: { search: '?error=access_denied&error_description=User+canceled+login', hash: '' }
      });
      expect(getOAuthCallbackError()).toBe('User canceled login');
    });

    it('extracts error from hash', () => {
      vi.stubGlobal('window', {
        location: { search: '', hash: '#error=server_error&error_description=Bad+things+happened' }
      });
      expect(getOAuthCallbackError()).toBe('Bad things happened');
    });

    it('returns null when no error is present', () => {
      vi.stubGlobal('window', {
        location: { search: '?code=123', hash: '#access_token=123' }
      });
      expect(getOAuthCallbackError()).toBeNull();
    });
  });
});
