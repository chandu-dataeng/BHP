/**
 * Google Form file uploads are stored as Drive links ("drive.google.com/open?id=…"), which open a Drive web page —
 * an <img> can't show that. This turns any Drive file link into a direct image link.
 * The file (or its upload folder) must be shared "Anyone with the link can view".
 */
export function directImageUrl(u: string): string {
  const id = /drive\.google\.com\/(?:open\?id=|file\/d\/|uc\?(?:export=\w+&)?id=)([\w-]{20,})/.exec(u)?.[1];
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600` : u;
}
