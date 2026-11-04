import { generateImage, type ImageConfig } from "./lovableImage.ts";

export const imageSettings: Omit<ImageConfig, "apiKey"> = {
  baseURL: "https://ai.gateway.lovable.dev",
  model: "openai/gpt-image-2.5-sunburst",
  format: "openai",
};

export function generateCreditImage(apiKey: string, prompt: string, stream = true) {
  return generateImage({ ...imageSettings, apiKey }, prompt, stream);
}