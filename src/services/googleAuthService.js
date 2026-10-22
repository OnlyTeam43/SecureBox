// src/services/googleAuthService.js
// Google Sign-In Service for SecureBox using Supabase OAuth & Expo AuthSession
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase, generateUniqueHandle } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Perform Google Sign-In via Supabase OAuth with fallback for offline/development
 */
export const signInWithGoogle = async () => {
  try {
    const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'securebox' });

    // 1. Attempt Supabase Google OAuth
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (!error && data?.url) {
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (res.type === 'success' && res.url) {
        // Parse access_token from URL hash or query params
        const urlParams = new URLSearchParams(res.url.split('#')[1] || res.url.split('?')[1]);
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');

        if (accessToken) {
          const { data: sessionData } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          const user = sessionData?.user;
          const fullName =
            user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            user?.email?.split('@')[0] ||
            'Google User';

          return {
            success: true,
            email: user?.email,
            name: fullName,
            suggestedHandle: await generateUniqueHandle(fullName),
          };
        }
      }
    }
  } catch (err) {
    console.warn('Supabase Google OAuth error (falling back to direct account selector):', err);
  }

  // Fallback trigger: return fallback signal so UI can show 1-tap Google account selector
  return {
    success: false,
    needsAccountPicker: true,
  };
};

/**
 * Handle simulated or selected Google Account
 */
export const processGoogleProfile = async (googleUser) => {
  const name = googleUser.name || 'Google User';
  const email = googleUser.email || 'user@gmail.com';
  const suggestedHandle = await generateUniqueHandle(name);

  return {
    success: true,
    name,
    email,
    suggestedHandle,
  };
};
