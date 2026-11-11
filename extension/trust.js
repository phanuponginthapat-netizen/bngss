// Shared trust boundary: never trust arbitrary pages on a hosting provider.
self.SB_SCHOOL_ORIGINS = [
  "https://bngss.online",
  "https://www.bngss.online",
  "https://bngss.lovable.app",
  "https://id-preview--f656e919-7df7-479f-8f52-d6572399e1b5.lovable.app",
  "https://bngss.vercel.app",
  "http://localhost:8080",
];
self.sbTrustedSchoolUrl = (url) => {
  try { return self.SB_SCHOOL_ORIGINS.includes(new URL(url).origin); }
  catch { return false; }
};