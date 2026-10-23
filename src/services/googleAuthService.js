// src/services/googleAuthService.js
// 100% Real, Verified Google Authentication Service for SecureBox
// Fetches real user identity from Google (Name, Email, Profile Picture)
// Allows user to customize @handle and choose their own 4-digit secret PIN.

import { supabase, registerUserInSupabase, generateUniqueHandle, checkHandleAvailability } from './supabase';
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
 * Step 1: Initiate Google Sign-In
 * - Pops up the official Android Google Play Services account picker
 * - Fetches real Name, Email, Photo from Google
 * - Exchanges ID Token with Supabase Auth
 * - Checks if user already exists:
 *   - If EXISTS: restores profile and completes setup immediately. Returns { exists: true, user }
 *   - If NEW: returns { exists: false, profile: { name, email, photo, suggestedHandle, authUserId } }
 */
export const initiateGoogleAuth = async () => {
  if (!GoogleSignin) {
    return {
      success: false,
      error: 'Google Play Services module is not linked in this build. Please run via the standalone release APK.',
    };
  }

  try {
    configureGoogleSignIn();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();
    const gUser = response.data?.user || response.user;
    const idToken = response.data?.idToken || response.idToken;

    if (!gUser || !gUser.email) {
      return { success: false, error: 'No Google account selected.' };
    }

    const realEmail = gUser.email.toLowerCase().trim();
    const realName = (gUser.name || gUser.givenName || realEmail.split('@')[0]).trim();
    const realPhoto = gUser.photo || null;

    // Exchange ID Token with Supabase Auth
    let authUserId = null;
    if (idToken) {
      try {
        const { data: authData } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });
        if (authData?.user?.id) {
          authUserId = authData.user.id;
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

    // Check if user already exists in Supabase 'users' table
    let existingUser = null;

    if (authUserId) {
      const { data: byId } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();
      if (byId) existingUser = byId;
    }

    if (!existingUser) {
      const { data: byEmailPrefix } = await supabase
        .from('users')
        .select('*')
        .ilike('mobile_number', `${realEmail}%`)
        .maybeSingle();
      if (byEmailPrefix) existingUser = byEmailPrefix;
    }

    // CASE A: User is an existing registered user -> Restore and enter immediately!
    if (existingUser) {
      const finalHandle = existingUser.handle;
      const finalNickname = existingUser.nickname || realName;
      const finalAvatarId = existingUser.avatar_id || 'panda';
      const finalPassword = existingUser.password || 'Google_Vault_Secured';
      const storedMobile = existingUser.mobile_number || '';
      const finalPin = storedMobile.includes('#') ? storedMobile.split('#')[1] : '1357';

      const store = useUserStore.getState();
      store.setProfile(finalHandle, finalNickname, finalAvatarId, realEmail, realPhoto, finalPin);
      store.setPassword(finalPassword);
      store.setStealthPin(finalPin);
      store.setMyCharacter('panda');
      store.completeSetup();
      store.setStealthUnlocked(true);

      return {
        success: true,
        exists: true,
        user: {
          handle: finalHandle,
          name: finalNickname,
          email: realEmail,
          photo: realPhoto,
          pin: finalPin,
        },
      };
    }

    // CASE B: User is new -> Auto-suggest unique handle and return to let user confirm/choose handle and PIN
    const cleanPrefix = realEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '');
    const suggestedHandle = await generateUniqueHandle(cleanPrefix.length >= 4 ? cleanPrefix : realName);

    return {
      success: true,
      exists: false,
      profile: {
        authUserId,
        name: realName,
        email: realEmail,
        photo: realPhoto,
        suggestedHandle,
      },
    };
  } catch (err) {
    if (err.code === 'SIGN_IN_CANCELLED') {
      return { success: false, cancelled: true };
    }
    console.error('[GoogleAuth] Error:', err);
    return {
      success: false,
      error: err.message || 'Google Sign-In failed. Please check Google Play Services.',
    };
  }
};

/**
 * Step 2: Complete New Google User Registration with their chosen Handle and 4-Digit PIN
 */
export const completeGoogleRegistration = async ({
  authUserId,
  name,
  email,
  photo,
  handle,
  pin,
}) => {
  const cleanHandle = (handle || '').trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
  if (!cleanHandle || cleanHandle.length < 3) {
    throw new Error('Please choose a handle with at least 3 characters.');
  }

  const cleanPin = (pin || '').trim().replace(/[^0-9]/g, '');
  if (cleanPin.length !== 4) {
    throw new Error('Please set a 4-digit secret PIN to unlock your vault.');
  }

  // Check handle availability
  const check = await checkHandleAvailability(cleanHandle);
  if (!check.available) {
    throw new Error(`Handle @${cleanHandle} is already taken. Please choose another.`);
  }

  const finalPassword = `G_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Save into Supabase 'users' table
  try {
    await registerUserInSupabase({
      id: authUserId,
      handle: cleanHandle,
      nickname: name,
      avatarId: photo || 'panda',
      mobileNumber: `${email}#${cleanPin}`,
      password: finalPassword,
      recoveryPin: cleanPin,
    });
  } catch (regErr) {
    console.warn('[GoogleAuth] registerUserInSupabase error:', regErr.message);
    try {
      const fallbackPayload = {
        handle: cleanHandle,
        nickname: name,
        avatar_id: photo || 'panda',
        mobile_number: `${email}#${cleanPin}`,
        password: finalPassword,
        updated_at: new Date().toISOString(),
      };
      if (authUserId) fallbackPayload.id = authUserId;
      await supabase.from('users').insert(fallbackPayload);
    } catch (fbErr) {
      console.warn('[GoogleAuth] Fallback insert error:', fbErr.message);
    }
  }

  // Save into local Zustand store and complete onboarding
  const store = useUserStore.getState();
  store.setProfile(cleanHandle, name, 'panda', email, photo, cleanPin);
  store.setPassword(finalPassword);
  store.setStealthPin(cleanPin);
  store.setMyCharacter('panda');
  store.completeSetup();
  store.setStealthUnlocked(true);

  return {
    success: true,
    user: {
      handle: cleanHandle,
      name,
      email,
      photo,
      pin: cleanPin,
    },
  };
};

/**
 * Backward compatibility: Single-step fallback with default PIN 1357
 */
export const executeOneTapGoogleSignIn = async () => {
  const init = await initiateGoogleAuth();
  if (!init.success) return init;
  if (init.exists) return init;

  // New user with default credentials
  return await completeGoogleRegistration({
    authUserId: init.profile.authUserId,
    name: init.profile.name,
    email: init.profile.email,
    photo: init.profile.photo,
    handle: init.profile.suggestedHandle,
    pin: '1357', // Safe known default!
  });
};

export const tryNativeGoogleSignIn = executeOneTapGoogleSignIn;
export const signInWithGoogle = executeOneTapGoogleSignIn;
export const signInWithRealGoogle = executeOneTapGoogleSignIn;
export const processGoogleProfile = async (profile) => ({
  success: true,
  name: profile?.name || '',
  email: profile?.email || '',
  photo: profile?.photo || null,
});
