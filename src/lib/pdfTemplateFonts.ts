// Available fonts for PDF template filling.
// `url` is fetched server-side in the edge function and embedded via @pdf-lib/fontkit.
export const PDF_FONTS: { value: string; label: string; url: string; boldUrl?: string }[] = [
  {
    value: "sarabun",
    label: "TH Sarabun (ราชการ)",
    url: "https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Regular.ttf",
    boldUrl: "https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Bold.ttf",
  },
  {
    value: "kanit",
    label: "Kanit",
    url: "https://github.com/google/fonts/raw/main/ofl/kanit/Kanit-Regular.ttf",
    boldUrl: "https://github.com/google/fonts/raw/main/ofl/kanit/Kanit-Bold.ttf",
  },
  {
    value: "prompt",
    label: "Prompt",
    url: "https://github.com/google/fonts/raw/main/ofl/prompt/Prompt-Regular.ttf",
    boldUrl: "https://github.com/google/fonts/raw/main/ofl/prompt/Prompt-Bold.ttf",
  },
  {
    value: "mitr",
    label: "Mitr",
    url: "https://github.com/google/fonts/raw/main/ofl/mitr/Mitr-Regular.ttf",
    boldUrl: "https://github.com/google/fonts/raw/main/ofl/mitr/Mitr-Bold.ttf",
  },
  {
    value: "noto",
    label: "Noto Sans Thai",
    url: "https://github.com/google/fonts/raw/main/ofl/notosansthai/NotoSansThai%5Bwdth%2Cwght%5D.ttf",
  },
];

export const DEFAULT_FONT = "sarabun";
