/**
 * Night detection for the automatic (night) theme.
 *
 * Instead of a fixed 18:00–06:00 window, the app uses the real sunset/sunrise
 * of an Arab city (computed with the NOAA solar equations) evaluated in that
 * city's own timezone, so dark mode flips when it actually gets dark there.
 */

export type NightCity = {
  id: string;
  en: string;
  ar: string;
  tz: string;
  lat: number;
  lon: number;
};

export const NIGHT_CITIES: NightCity[] = [
  { id: "cairo", en: "Cairo", ar: "القاهرة", tz: "Africa/Cairo", lat: 30.0444, lon: 31.2357 },
  { id: "riyadh", en: "Riyadh", ar: "الرياض", tz: "Asia/Riyadh", lat: 24.7136, lon: 46.6753 },
  { id: "mecca", en: "Mecca", ar: "مكة المكرمة", tz: "Asia/Riyadh", lat: 21.3891, lon: 39.8579 },
  { id: "dubai", en: "Dubai", ar: "دبي", tz: "Asia/Dubai", lat: 25.2048, lon: 55.2708 },
  { id: "doha", en: "Doha", ar: "الدوحة", tz: "Asia/Qatar", lat: 25.2854, lon: 51.531 },
  { id: "kuwait", en: "Kuwait City", ar: "الكويت", tz: "Asia/Kuwait", lat: 29.3759, lon: 47.9774 },
  { id: "baghdad", en: "Baghdad", ar: "بغداد", tz: "Asia/Baghdad", lat: 33.3152, lon: 44.3661 },
  { id: "amman", en: "Amman", ar: "عمّان", tz: "Asia/Amman", lat: 31.9454, lon: 35.9284 },
  { id: "beirut", en: "Beirut", ar: "بيروت", tz: "Asia/Beirut", lat: 33.8938, lon: 35.5018 },
  { id: "damascus", en: "Damascus", ar: "دمشق", tz: "Asia/Damascus", lat: 33.5138, lon: 36.2765 },
  { id: "jerusalem", en: "Jerusalem", ar: "القدس", tz: "Asia/Hebron", lat: 31.7683, lon: 35.2137 },
  { id: "sanaa", en: "Sanaa", ar: "صنعاء", tz: "Asia/Aden", lat: 15.3694, lon: 44.191 },
  { id: "muscat", en: "Muscat", ar: "مسقط", tz: "Asia/Muscat", lat: 23.588, lon: 58.3829 },
  { id: "manama", en: "Manama", ar: "المنامة", tz: "Asia/Bahrain", lat: 26.2285, lon: 50.586 },
  { id: "khartoum", en: "Khartoum", ar: "الخرطوم", tz: "Africa/Khartoum", lat: 15.5007, lon: 32.5599 },
  { id: "tripoli", en: "Tripoli", ar: "طرابلس", tz: "Africa/Tripoli", lat: 32.8872, lon: 13.1913 },
  { id: "tunis", en: "Tunis", ar: "تونس", tz: "Africa/Tunis", lat: 36.8065, lon: 10.1815 },
  { id: "algiers", en: "Algiers", ar: "الجزائر", tz: "Africa/Algiers", lat: 36.7538, lon: 3.0588 },
  { id: "casablanca", en: "Casablanca", ar: "الدار البيضاء", tz: "Africa/Casablanca", lat: 33.5731, lon: -7.5898 },
  { id: "rabat", en: "Rabat", ar: "الرباط", tz: "Africa/Casablanca", lat: 34.0209, lon: -6.8416 },
  { id: "nouakchott", en: "Nouakchott", ar: "نواكشوط", tz: "Africa/Nouakchott", lat: 18.0735, lon: -15.9582 },
  { id: "mogadishu", en: "Mogadishu", ar: "مقديشو", tz: "Africa/Mogadishu", lat: 2.0469, lon: 45.3182 },
];

export const DEFAULT_NIGHT_CITY = "cairo";

export function findCity(id: string): NightCity | null {
  return NIGHT_CITIES.find((c) => c.id === id) ?? null;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function dayOfYear(at: Date): number {
  const start = Date.UTC(at.getUTCFullYear(), 0, 1);
  return Math.floor((Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()) - start) / 86_400_000) + 1;
}

/** Sunrise/sunset for a coordinate, in minutes from UTC midnight. */
export function sunTimesUTC(lat: number, lon: number, at = new Date()): { sunrise: number; sunset: number } | null {
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear(at) - 1 + (at.getUTCHours() - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const cosHa =
    Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(decl)) - Math.tan(rad(lat)) * Math.tan(decl);
  if (cosHa > 1 || cosHa < -1) return null; // polar day/night
  const ha = deg(Math.acos(cosHa));

  return {
    sunrise: 720 - 4 * (lon + ha) - eqTime,
    sunset: 720 - 4 * (lon - ha) - eqTime,
  };
}

/** Minutes since midnight *in the given timezone* for an instant. */
export function minutesInZone(tz: string, at = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(at);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return h * 60 + m;
  } catch {
    return at.getHours() * 60 + at.getMinutes();
  }
}

/** Timezone offset in minutes (east positive) for a zone at an instant. */
function zoneOffsetMinutes(tz: string, at = new Date()): number {
  const local = minutesInZone(tz, at);
  const utc = at.getUTCHours() * 60 + at.getUTCMinutes();
  let diff = local - utc;
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

export type CitySun = { sunriseMinutes: number; sunsetMinutes: number; nowMinutes: number };

/** Local (city time) sunrise/sunset in minutes since midnight, plus "now". */
export function citySun(city: NightCity, at = new Date()): CitySun | null {
  const utc = sunTimesUTC(city.lat, city.lon, at);
  if (!utc) return null;
  const off = zoneOffsetMinutes(city.tz, at);
  const wrap = (m: number) => ((Math.round(m + off) % 1440) + 1440) % 1440;
  return {
    sunriseMinutes: wrap(utc.sunrise),
    sunsetMinutes: wrap(utc.sunset),
    nowMinutes: minutesInZone(city.tz, at),
  };
}

/** True when it is currently dark in the selected city. */
export function isCityNight(cityId: string, at = new Date()): boolean | null {
  const city = findCity(cityId);
  if (!city) return null;
  const sun = citySun(city, at);
  if (!sun) return null;
  return sun.nowMinutes < sun.sunriseMinutes || sun.nowMinutes >= sun.sunsetMinutes;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
