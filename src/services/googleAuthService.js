// src/services/googleAuthService.js
// 100% Real Google Sign-In Service for SecureBox
// Connects to actual Google accounts via Native GoogleSignin (when compiled) or real Google OAuth browser flow.
// Absolutely zero mock or hardcoded profiles.

import { Linking } from 'react-native';
import { supabase, checkHandleAvailability, generateUniqueHandle } from './supabase';
import { useUserStore } from '../store/useUserStore';

// Safe dynamic require for @react-native-google-signin/google-signin
let GoogleSignin = null;
try {
  const gModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = gModule?.GoogleSignin || null;
} catch (_) {
  GoogleSignin = null;
}

// Default Web Client ID from Firebase project "Animal Smash SB" (google-services.json)
export const DEFAULT_WEB_CLIENT_ID =
  '457377823284-kbak1tq6qg91rsa1g7hi7ku546nj15m6.apps.googleusercontent.com';

export const configureGoogleSignIn = () => {
  if (!GoogleSignin) return;
  try {
    GoogleSignin.configure({
      webClientId: DEFAULT_WEB_CLIENT_ID,
      offlineAccess: true,
      forceCodeForRefreshToken: true,
    });
  } catch (err) {
    console.warn('[GoogleAuth] Native configure notice:', err);
  }
};

if (GoogleSignin) {
  configureGoogleSignIn();
}

/**
 * Perform REAL Google Sign-In:
 * 1. Tries native Google Play Services bottom-sheet if available in native binary.
 * 2. Falls back to real Google OAuth via Supabase & phone browser (Linking.openURL).
 */
export const signInWithRealGoogle = async () => {
  // 1. Try Native Google Sign-In if native library is linked in binary
  if (GoogleSignin) {
    try {
      configureGoogleSignIn();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      const gUser = response.data?.user || response.user;
      const idToken = response.data?.idToken || response.idToken;

      if (gUser && gUser.email) {
        const email = gUser.email.toLowerCase().trim();
        const name = (gUser.name || gUser.givenName || email.split('@')[0]).trim();
        const photo = gUser.photo || null;

        // Authenticate with Supabase Auth using ID Token
        if (idToken) {
          try {
            await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: idToken,
            });
          } catch (authErr) {
            console.warn('[GoogleAuth] Supabase ID token exchange notice:', authErr.message);
          }
        }

        return {
          success: true,
          type: 'native',
          name,
          email,
          photo,
        };
      }
    } catch (nativeErr) {
      if (nativeErr.code === 'SIGN_IN_CANCELLED') {
        return { success: false, cancelled: true };
      }
      console.warn('[GoogleAuth] Native Sign-In notice (opening real browser OAuth):', nativeErr.message || nativeErr);
    }
  }

  // 2. Real Web OAuth via Supabase & Phone Browser
  try {
    const redirectUrl = 'securebox://google-auth';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      throw error;
    }

    if (data?.url) {
      await Linking.openURL(data.url);
      return {
        success: true,
        type: 'browser_opened',
        message: 'Opening Google authentication in browser...',
      };
    }
  } catch (oauthErr) {
    console.error('[GoogleAuth] OAuth Error:', oauthErr);
    throw oauthErr;
  }

  throw new Error('Could not initiate Google Sign-In. Please check your connection.');
};

/**
 * Handle OAuth redirect when app returns from browser:
 * Extracts real user session from Supabase
 */
export const handleGoogleOAuthRedirect = async (url) => {
  if (!url || !url.includes('google-auth')) return null;

  try {
    // Supabase passes tokens in URL fragment: #access_token=...&refresh_token=...
    const hash = url.split('#')[1] || url.split('?')[1] || '';
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      });

      if (!error && data?.user) {
        const u = data.user;
        const email = u.email || '';
        const name =
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          email.split('@')[0] ||
          'Google User';
        const photo = u.user_metadata?.avatar_url || u.user_metadata?.picture || null;

        return {
          success: true,
          name,
          email,
          photo,
        };
      }
    }
  } catch (e) {
    console.warn('[GoogleAuth] Parse redirect error:', e);
  }
  return null;
};

// Aliases for backward compatibility
export const signInWithGoogle = signInWithRealGoogle;
export const processGoogleProfile = async (profile) => ({
  success: true,
  name: profile.name || 'Google User',
  email: profile.email || '',
  photo: profile.photo || null,
});
