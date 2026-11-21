/** Plain-language messages for Firebase sign-in errors. */
export function explainAuthError(e: unknown): string | null {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null; // you closed it; nothing to say
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'That email and password don’t match an account. Check them, or create an account.';
    case 'auth/email-already-in-use':
      return 'There’s already an account with that email. Sign in instead.';
    case 'auth/invalid-email':
      return 'That email address doesn’t look right.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'Choose a password with at least 6 characters.';
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'You’re offline. Connect to the internet to sign in.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups, or sign in with email instead.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method isn’t switched on in Firebase yet (Authentication → Sign-in method).';
    case 'auth/unauthorized-domain':
      return 'This site isn’t allowed to sign in yet. Add its address in Firebase (Authentication → Settings → Authorized domains).';
    default:
      return 'Something went wrong signing in. Try again, or use the other sign-in option.';
  }
}
