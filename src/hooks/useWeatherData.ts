import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface WeatherData {
  temperature: number | null;
  pm25: number | null;
  weatherCode: number | null;
  isRainy: boolean;
  recommendations: string[];
}

function getRecommendations(temp: number | null, pm25: number | null, weatherCode: number | null): string[] {
  const recs: string[] = [];

  // Weather code based recommendations (WMO codes)
  // 51-67: drizzle/rain, 71-77: snow, 80-82: rain showers, 95-99: thunderstorm
  if (weatherCode !== null) {
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weatherCode)) {
      recs.push("🌧️ ฝนตก — อย่าลืมพกร่มหรือเสื้อกันฝน");
    }
    if ([95, 96, 99].includes(weatherCode)) {
      recs.push("⛈️ ฝนฟ้าคะนอง — ระวังฟ้าผ่า หลีกเลี่ยงที่โล่งแจ้ง");
    }
  }

  // Temperature recommendations
  if (temp !== null) {
    if (temp >= 38) {
      recs.push("🥵 อากาศร้อนจัด — ดื่มน้ำให้เพียงพอ หลีกเลี่ยงแดดจ้า");
    } else if (temp >= 35) {
      recs.push("☀️ อากาศร้อน — ดื่มน้ำเยอะๆ ทาครีมกันแดด");
    } else if (temp <= 20) {
      recs.push("🧥 อากาศเย็น — ใส่เสื้อกันหนาวด้วยนะ");
    }
  }

  // PM2.5 recommendations (Thai AQI standards)
  if (pm25 !== null) {
    if (pm25 > 150) {
      recs.push("😷 ฝุ่น PM2.5 สูงมาก — ควรสวมหน้ากาก N95 และหลีกเลี่ยงกิจกรรมกลางแจ้ง");
    } else if (pm25 > 75) {
      recs.push("😷 ฝุ่น PM2.5 สูง — ควรสวมหน้ากากอนามัยเมื่ออยู่กลางแจ้ง");
    } else if (pm25 > 37.5) {
      recs.push("😐 ฝุ่น PM2.5 ปานกลาง — กลุ่มเสี่ยงควรสวมหน้ากาก");
    } else if (pm25 <= 25) {
      recs.push("🌿 คุณภาพอากาศดี — เหมาะสำหรับกิจกรรมกลางแจ้ง");
    }
  }

  if (recs.length === 0 && temp !== null) {
    recs.push("😊 สภาพอากาศปกติ — เป็นวันที่ดีสำหรับการเรียนรู้");
  }

  return recs;
}

function getPm25Color(pm25: number | null): string {
  if (pm25 === null) return "text-muted-foreground";
  if (pm25 <= 25) return "text-success";
  if (pm25 <= 37.5) return "text-warning";
  if (pm25 <= 75) return "text-warning";
  return "text-danger";
}

function getPm25Label(pm25: number | null): string {
  if (pm25 === null) return "";
  if (pm25 <= 25) return "ดี";
  if (pm25 <= 37.5) return "ปานกลาง";
  if (pm25 <= 75) return "มีผลต่อสุขภาพ";
  if (pm25 <= 150) return "มีผลต่อสุขภาพมาก";
  return "อันตราย";
}

export function useWeatherData() {
  // Get school coordinates
  const { data: coords } = useQuery({
    queryKey: ["school_coordinates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["clock_latitude", "clock_longitude"]);
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.setting_key] = s.setting_value; });
      return {
        lat: parseFloat(map.clock_latitude || "0"),
        lng: parseFloat(map.clock_longitude || "0"),
      };
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const hasCoords = coords && coords.lat !== 0 && coords.lng !== 0;

  // Fetch weather from Open-Meteo (free, no API key needed)
  const { data: weather, isLoading } = useQuery<WeatherData>({
    queryKey: ["weather_data", coords?.lat, coords?.lng],
    enabled: hasCoords,
    queryFn: async () => {
      try {
        // Fetch current weather
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${coords!.lat}&longitude=${coords!.lng}&current=temperature_2m,weather_code&timezone=Asia/Bangkok`
        );
        const weatherJson = await weatherRes.json();
        const temp = weatherJson?.current?.temperature_2m ?? null;
        const weatherCode = weatherJson?.current?.weather_code ?? null;

        // Fetch PM2.5 from Open-Meteo Air Quality API
        const aqRes = await fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords!.lat}&longitude=${coords!.lng}&current=pm2_5&timezone=Asia/Bangkok`
        );
        const aqJson = await aqRes.json();
        const pm25 = aqJson?.current?.pm2_5 ?? null;

        const isRainy = weatherCode !== null && [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weatherCode);

        return {
          temperature: temp,
          pm25,
          weatherCode,
          isRainy,
          recommendations: getRecommendations(temp, pm25, weatherCode),
        };
      } catch {
        return { temperature: null, pm25: null, weatherCode: null, isRainy: false, recommendations: [] };
      }
    },
    staleTime: 10 * 60 * 1000, // 10 min
    refetchInterval: 15 * 60 * 1000, // 15 min
  });

  return {
    temperature: weather?.temperature ?? null,
    pm25: weather?.pm25 ?? null,
    weatherCode: weather?.weatherCode ?? null,
    isRainy: weather?.isRainy ?? false,
    recommendations: weather?.recommendations ?? [],
    isLoading: isLoading || !hasCoords,
    hasCoords: !!hasCoords,
    getPm25Color,
    getPm25Label,
  };
}
