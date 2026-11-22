/**
 * Whether the person using the app is its owner. The Backup, Sample data and
 * Danger zone cards in Settings only show for them.
 *
 * This only tidies the screen: everyone's data stays in their own browser (and
 * their own cloud account), so nobody else can reach the owner's data anyway.
 */
import { useEffect, useState } from 'react';
import { isEmbedded } from './env';

/**
 * SHA-256 of the owner's sign-in email (lower case), so the address itself
 * isn't published in the site's code. Builds can swap it (the cloud tests do).
 */
const OWNER_EMAIL_SHA256: string =
  import.meta.env.VITE_OWNER_EMAIL_SHA256 || '15551e74483bb14e5b1c8fd5178b75ed0691d84013427aebe5a89ef972caef64';

async function sha256(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function isOwnerEmail(email: string | null | undefined): Promise<boolean> {
  if (!email || !crypto?.subtle) return false;
  return (await sha256(email.trim().toLowerCase())) === OWNER_EMAIL_SHA256;
}

interface ClaudeViewer {
  use?: (name: string) => Promise<{ isOwner?: () => Promise<boolean> } | null>;
}

/** Inside the claude.ai viewer: ask it whether the person looking is the artifact's owner. */
async function isArtifactOwner(): Promise<boolean> {
  try {
    const claude = (window as unknown as { claude?: ClaudeViewer }).claude;
    const user = await claude?.use?.('user');
    return (await user?.isOwner?.()) ?? false;
  } catch {
    return false;
  }
}

/** True for the owner: signed in with their email, or viewing their own claude.ai copy. */
export function useIsOwner(email: string | null | undefined): boolean {
  const testOwner = (window as unknown as { __overloadTestOwner?: boolean }).__overloadTestOwner === true; // e2e tests only
  const [owner, setOwner] = useState(testOwner);
  useEffect(() => {
    if (testOwner) return;
    let live = true;
    void (isEmbedded ? isArtifactOwner() : isOwnerEmail(email)).then((o) => live && setOwner(o));
    return () => {
      live = false;
    };
  }, [email, testOwner]);
  return owner;
}
