// src/services/googleAuthService.js
// 1-Tap Google Sign-In Service for SecureBox
// Auto-fetches identity (Name, Gmail, Profile Photo) & auto-derives unique @handle

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase, checkHandleAvailability } from './supabase';
import { useUserStore } from '../store/useUserStore';

// Default Web Client ID (can be configured dynamically or via env)
let currentWebClientId = '';

/**
 * Process a raw or mock Google profile into a standard object
 */
export const processGoogleProfile = async ({ name, email, photo = null }) => {
  return {
    success: true,
    name: name || 'Google User',
    email: email || '',
    photo: photo,
  };
};

/**
 * Configure Google Sign-In with Web Client ID from Firebase / Google Cloud
 */
export const configureGoogleSignIn = (webClientId) => {
  currentWebClientId = webClientId;
  try {
    GoogleSignin.configure({
      webClientId: webClientId || undefined,
      offlineAccess: true,
      forceCodeForRefreshToken: true,
    });
  } catch (err) {
    console.warn('[GoogleAuth] Configure warning:', err);
  }
};

/**
 * Auto-generate a clean, unique @handle from an email address
 * e.g., "alex.smith42@gmail.com" -> "@alexsmith" (or "@alexsmith99" if taken)
 */
export const autoDeriveUniqueHandle = async (email, name = '') => {
  let base = '';

  if (email && email.includes('@')) {
    base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '');
  } else if (name) {
    base = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  if (base.length < 3) base = 'user_' + Math.floor(1000 + Math.random() * 9000);
  if (base.length > 18) base = base.substring(0, 18);

  // Check availability
  let candidate = base;
  let status = await checkHandleAvailability(candidate);
  let attempts = 0;

  while (!status.available && attempts < 10) {
    attempts++;
    const suffix = Math.floor(10 + Math.random() * 90);
    candidate = `${base.substring(0, 15)}${suffix}`;
    status = await checkHandleAvailability(candidate);
  }

  return candidate;
};

/**
 * Perform 1-Tap Google Sign-In
 * Returns { success: true, user } or throws Error
 */
export const signInWithGoogle = async (webClientId = null) => {
  try {
    if (webClientId && webClientId !== currentWebClientId) {
      configureGoogleSignIn(webClientId);
    }

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // 1. Native Google One-Tap Bottom Sheet
    const response = await GoogleSignin.signIn();
    const gUser = response.data?.user || response.user;
    const idToken = response.data?.idToken || response.idToken;

    if (!gUser || !gUser.email) {
      throw new Error('Google Sign-In failed: No account email returned.');
    }

    const email = gUser.email.toLowerCase().trim();
    const displayName = (gUser.name || gUser.givenName || 'SecureBox User').trim();
    const photoUrl = gUser.photo || null;

    // 2. Check if user already exists in Supabase users table (by email or mobile_number prefix)
    let existingUser = null;
    const { data: foundByEmail } = await supabase
      .from('users')
      .select('*')
      .ilike('mobile_number', `google:${email}%`)
      .maybeSingle();

    if (foundByEmail) {
      existingUser = foundByEmail;
    } else {
      // Also check standard mobile_number or handle matches
      const { data: foundDirect } = await supabase
        .from('users')
        .select('*')
        .eq('mobile_number', email)
        .maybeSingle();
      if (foundDirect) existingUser = foundDirect;
    }

    let finalHandle = existingUser?.handle;
    let finalNickname = existingUser?.nickname || displayName;
    let finalAvatarId = existingUser?.avatar_id || photoUrl || 'avatar_rose';

    // 3. If new user, auto-derive unique handle and upsert into Supabase
    if (!existingUser) {
      finalHandle = await autoDeriveUniqueHandle(email, displayName);

      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .upsert(
          {
            handle: finalHandle,
            nickname: finalNickname,
            avatar_id: finalAvatarId,
            mobile_number: `google:${email}`,
            password: 'google_oauth_verified',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'handle' }
        )
        .select()
        .single();

      if (insertError) {
        console.warn('[GoogleAuth] DB Insert warning:', insertError);
      }
    }

    // 4. Optionally authenticate with Supabase Auth if ID token is present
    if (idToken) {
      try {
        await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });
      } catch (authErr) {
        // Log auth warning but don't block user profile login
        console.warn('[GoogleAuth] Supabase Auth exchange notice:', authErr.message);
      }
    }

    // 5. Store profile in local Zustand store and unlock app instantly!
    const store = useUserStore.getState();
    store.setProfile({
      handle: finalHandle,
      nickname: finalNickname,
      avatarId: finalAvatarId,
      avatarUri: photoUrl || null,
      mobileNumber: email,
    });
    store.completeSetup();

    return {
      success: true,
      handle: finalHandle,
      nickname: finalNickname,
      email: email,
      photo: photoUrl,
    };
  } catch (error) {
    if (error.code === 'SIGN_IN_CANCELLED') {
      console.log('[GoogleAuth] User cancelled Google Sign-In');
      return { cancelled: true };
    }
    console.error('[GoogleAuth] Error:', error);
    throw error;
  }
};
