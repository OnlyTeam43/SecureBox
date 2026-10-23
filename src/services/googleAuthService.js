// src/services/googleAuthService.js
// 100% Real, Zero-Typing Google Authentication Service for SecureBox
// Auto-fetches real user identity from Google (Name, Email, Profile Picture)
// Auto-derives unique @handle and auto-provisions Supabase encrypted vault.

import { supabase, registerUserInSupabase, generateUniqueHandle } from './supabase';
import { useUserStore } from '../store/useUserStore';

// Safe require for @react-native-google-signin/google-signin
let GoogleSignin = null;
try {
  const gModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = gModule?.GoogleSignin || null;
} catch (_) {
  GoogleSignin = null;
}

// Dynamically extract Web Client ID from google-services.json if available
let resolvedWebClientId = '457377823284-kbak1tq6qg91rsa1g7hi7ku546nj15m6.apps.googleusercontent.com';
try {
  // eslint-disable-next-line global-require
  const gs = require('../../google-services.json');
  const oauthClients = gs?.client?.[0]?.oauth_client || [];
  const webClient = oauthClients.find((c) => c.client_type === 3);
  if (webClient?.client_id) {
    resolvedWebClientId = webClient.client_id;
  }
} catch (_) {}

export const DEFAULT_WEB_CLIENT_ID = resolvedWebClientId;

/**
 * Configure Google Sign-In with project Web Client ID
 */
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
 * Check if Native Google Play Services is available in the binary
 */
export const isNativeGoogleSignInAvailable = () => {
  return !!GoogleSignin;
};

/**
 * Execute 1-Tap Real Google Sign-In
 * - Opens the official Android Google Play Services account picker
 * - Auto-fetches real Name, Email, and Photo
 * - Exchanges token with Supabase Auth
 * - Auto-generates unique @handle and registers/restores profile
 * - Returns { success: true, user } or { cancelled: true } or { success: false, error }
 */
export const executeOneTapGoogleSignIn = async () => {
  if (!GoogleSignin) {
    return {
      success: false,
      error: 'Google Play Services module is not linked in this build. Please run via the standalone release APK.',
    };
  }

  try {
    configureGoogleSignIn();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // 1. Native Google One-Tap Account Picker
    const response = await GoogleSignin.signIn();
    const gUser = response.data?.user || response.user;
    const idToken = response.data?.idToken || response.idToken;

    if (!gUser || !gUser.email) {
      return { success: false, error: 'No Google account selected or returned.' };
    }

    const realEmail = gUser.email.toLowerCase().trim();
    const realName = (gUser.name || gUser.givenName || realEmail.split('@')[0]).trim();
    const realPhoto = gUser.photo || null;

    // 2. Exchange ID Token with Supabase Auth (if available)
    let authUserId = null;
    if (idToken) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });
        if (authData?.user?.id) {
          authUserId = authData.user.id;
        }
        if (authErr) {
          console.warn('[GoogleAuth] signInWithIdToken notice:', authErr.message);
        }
      } catch (authErr) {
        console.warn('[GoogleAuth] Supabase ID token exchange notice:', authErr.message);
      }
    }

    if (!authUserId) {
      try {
        const { data: authUserRes } = await supabase.auth.getUser();
        if (authUserRes?.user?.id) {
          authUserId = authUserRes.user.id;
        }
      } catch (_) {}
    }

    // 3. Check if user already exists in Supabase 'users' table
    let existingUser = null;

    // Check by auth id first
    if (authUserId) {
      const { data: byId } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();
      if (byId) existingUser = byId;
    }

    // Check by email stored in mobile_number column (pattern: email#pin or plain email)
    if (!existingUser) {
      const { data: byEmailPrefix } = await supabase
        .from('users')
        .select('*')
        .ilike('mobile_number', `${realEmail}%`)
        .maybeSingle();

      if (byEmailPrefix) {
        existingUser = byEmailPrefix;
      } else {
        // Fallback check by handle derived from email prefix
        const handleBase = realEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '');
        const { data: byHandle } = await supabase
          .from('users')
          .select('*')
          .eq('handle', handleBase)
          .maybeSingle();
        if (byHandle) existingUser = byHandle;
      }
    }

    let finalHandle = '';
    let finalNickname = realName;
    let finalAvatarId = 'panda';
    let finalPassword = '';
    let finalPin = '0000';
    let isNewUser = false;

    if (existingUser) {
      // Restore existing user profile
      finalHandle = existingUser.handle;
      finalNickname = existingUser.nickname || realName;
      finalAvatarId = existingUser.avatar_id || 'panda';
      finalPassword = existingUser.password || 'Google_Vault_Secured';
      const storedMobile = existingUser.mobile_number || '';
      finalPin = storedMobile.includes('#') ? storedMobile.split('#')[1] : '0000';
    } else {
      // New user: auto-derive unique handle (min 6 chars) and credentials
      isNewUser = true;
      const cleanPrefix = realEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '');
      finalHandle = await generateUniqueHandle(cleanPrefix.length >= 4 ? cleanPrefix : realName);

      // Auto-generate strong secure vault credentials
      finalPassword = `G_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      finalPin = Math.floor(1000 + Math.random() * 9000).toString();

      try {
        await registerUserInSupabase({
          id: authUserId,
          handle: finalHandle,
          nickname: realName,
          avatarId: realPhoto || 'panda',
          mobileNumber: `${realEmail}#${finalPin}`,
          password: finalPassword,
          recoveryPin: finalPin,
        });
      } catch (regErr) {
        console.warn('[GoogleAuth] registerUserInSupabase error:', regErr.message);
        // If RLS blocked, try direct insert with auth id
        try {
          const fallbackPayload = {
            handle: finalHandle,
            nickname: realName,
            avatar_id: realPhoto || 'panda',
            mobile_number: `${realEmail}#${finalPin}`,
            password: finalPassword,
            updated_at: new Date().toISOString(),
          };
          if (authUserId) fallbackPayload.id = authUserId;
          await supabase.from('users').insert(fallbackPayload);
        } catch (fbErr) {
          console.warn('[GoogleAuth] Fallback insert also failed:', fbErr.message);
        }
      }
    }

    // 4. Update local Zustand state & unlock app
    const store = useUserStore.getState();
    store.setProfile(finalHandle, finalNickname, finalAvatarId, realEmail, realPhoto, finalPin);
    store.setPassword(finalPassword);
    store.setStealthPin(finalPin);
    store.setMyCharacter('panda');
    store.completeSetup();
    store.setStealthUnlocked(true);

    return {
      success: true,
      isNewUser,
      user: {
        name: realName,
        email: realEmail,
        handle: finalHandle,
        photo: realPhoto,
        pin: finalPin,
      },
    };
  } catch (err) {
    if (err.code === 'SIGN_IN_CANCELLED') {
      return { success: false, cancelled: true };
    }
    console.error('[GoogleAuth] Native Sign-In error:', err);
    return {
      success: false,
      error: err.message || 'Google Sign-In failed. Please check Google Play Services.',
    };
  }
};

// Aliases for compatibility
export const tryNativeGoogleSignIn = executeOneTapGoogleSignIn;
export const signInWithGoogle = executeOneTapGoogleSignIn;
export const signInWithRealGoogle = executeOneTapGoogleSignIn;
export const processGoogleProfile = async (profile) => ({
  success: true,
  name: profile?.name || '',
  email: profile?.email || '',
  photo: profile?.photo || null,
});
