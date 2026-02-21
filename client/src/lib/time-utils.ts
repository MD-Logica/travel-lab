export function formatTime(
  time: string | null | undefined,
  timeFormat: "12h" | "24h" = "24h"
): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr);
  const m = parseInt(mStr);
  if (isNaN(h) || isNaN(m)) return time;

  if (timeFormat === "24h") {
    return time;
  }

  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function timeFormatString(
  timeFormat: "12h" | "24h"
): string {
  return timeFormat === "12h" ? "h:mm a" : "HH:mm";
}
