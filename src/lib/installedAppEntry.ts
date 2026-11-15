interface InstalledAppEntry {
  pathname: string;
  installed: boolean;
  authReady: boolean;
  signedIn: boolean;
}

/** Only the launch root redirects; notification links and public pages keep their destination. */
export function installedAppEntry({ pathname, installed, authReady, signedIn }: InstalledAppEntry): "pending" | "dashboard" | "public" {
  if (pathname !== "/" || !installed) return "public";
  if (!authReady) return "pending";
  return signedIn ? "dashboard" : "public";
}