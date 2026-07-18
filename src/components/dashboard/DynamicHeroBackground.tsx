import { useEffect, useState } from "react";
import { useNearbyPlaceImages } from "@/hooks/useNearbyPlaceImages";

interface Props {
  weatherCode: number | null;
  isRainy: boolean;
  temperature: number | null;
}

/**
 * Animated hero background:
 * - Loops through nearby landmark photos (from school GPS via Wikimedia)
 * - Applies a weather-aware color overlay (sunny / rainy / cold / hazy)
 * - Adds an animated rain layer when it's raining
 */
export default function DynamicHeroBackground({ weatherCode, isRainy, temperature }: Props) {
  const { images } = useNearbyPlaceImages();
  const [idx, setIdx] = useState(0);

  // Start at a random image each mount so refresh never sticks on the same one
  useEffect(() => {
    if (images.length > 0) setIdx(Math.floor(Math.random() * images.length));
  }, [images.length]);

  // Auto-rotate every 6s; pick a different random image each tick
  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => {
      setIdx((i) => {
        let n = Math.floor(Math.random() * images.length);
        if (n === i) n = (i + 1) % images.length;
        return n;
      });
    }, 6000);
    return () => clearInterval(t);
  }, [images.length]);

  // Weather-aware tint
  let tint = "from-primary/70 via-primary/55 to-primary/80"; // default
  if (isRainy) tint = "from-neutral/75 via-info/60 to-neutral/80";
  else if (weatherCode !== null && [0, 1].includes(weatherCode) && (temperature ?? 0) >= 32)
    tint = "from-warning/65 via-warning/50 to-danger/70"; // hot & sunny
  else if (weatherCode !== null && [0, 1, 2].includes(weatherCode))
    tint = "from-info/65 via-primary/55 to-info/75"; // clear/mostly clear
  else if (weatherCode !== null && [45, 48].includes(weatherCode))
    tint = "from-neutral/75 via-neutral/60 to-neutral/80"; // fog/haze
  else if ((temperature ?? 99) <= 20)
    tint = "from-info/75 via-info/60 to-info/75"; // cold

  if (images.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {images.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0 bg-cover bg-center transition-opacity ease-in-out"
          style={{
            backgroundImage: `url("${src}")`,
            transitionDuration: "1500ms",
            opacity: i === idx ? 1 : 0,
          }}
          aria-hidden
        />
      ))}
      {/* weather tint */}
      <div className={`absolute inset-0 bg-gradient-to-br ${tint}`} aria-hidden />
      {/* readability gradient bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" aria-hidden />
      {/* rain animation */}
      {isRainy && (
        <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen rain-layer" aria-hidden />
      )}
    </div>
  );
}
