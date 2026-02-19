import type { Trip, TripVersion, TripSegment } from "@shared/schema";

interface CalendarData {
  trip: Trip;
  organization: { name: string };
  version: TripVersion;
  segments: TripSegment[];
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function formatAllDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function getMetaValue(metadata: any, key: string): string {
  if (!metadata || typeof metadata !== "object") return "";
  return String(metadata[key] || "");
}

function buildDescription(segment: TripSegment): string {
  const parts: string[] = [];
  const meta = segment.metadata as Record<string, any> || {};

  if (segment.type === "flight") {
    const fn = getMetaValue(meta, "flightNumber");
    const airline = getMetaValue(meta, "airline");
    const dep = getMetaValue(meta, "departureAirport");
    const arr = getMetaValue(meta, "arrivalAirport");
    if (airline) parts.push(`Airline: ${airline}`);
    if (fn) parts.push(`Flight: ${fn}`);
    if (dep && arr) parts.push(`Route: ${dep} → ${arr}`);
  } else if (segment.type === "hotel") {
    const name = getMetaValue(meta, "hotelName");
    const room = getMetaValue(meta, "roomType");
    if (name) parts.push(`Hotel: ${name}`);
    if (room) parts.push(`Room: ${room}`);
  } else if (segment.type === "restaurant") {
    const name = getMetaValue(meta, "restaurantName");
    const cuisine = getMetaValue(meta, "cuisine");
    if (name) parts.push(`Restaurant: ${name}`);
    if (cuisine) parts.push(`Cuisine: ${cuisine}`);
  } else if (segment.type === "activity") {
    const provider = getMetaValue(meta, "provider");
    const meeting = getMetaValue(meta, "meetingPoint");
    if (provider) parts.push(`Provider: ${provider}`);
    if (meeting) parts.push(`Meeting Point: ${meeting}`);
  }

  if (segment.confirmationNumber) parts.push(`Confirmation: ${segment.confirmationNumber}`);
  if (segment.notes) parts.push(`Notes: ${segment.notes}`);
  if (segment.cost != null) parts.push(`Cost: ${segment.currency || "USD"} ${segment.cost}`);

  return parts.join("\\n");
}

function buildLocation(segment: TripSegment): string {
  const meta = segment.metadata as Record<string, any> || {};
  if (segment.type === "flight") {
    const dep = getMetaValue(meta, "departureAirport");
    const arr = getMetaValue(meta, "arrivalAirport");
    if (dep && arr) return `${dep} to ${arr}`;
  } else if (segment.type === "hotel") {
    return getMetaValue(meta, "hotelName") || segment.title;
  } else if (segment.type === "restaurant") {
    return getMetaValue(meta, "restaurantName") || segment.title;
  } else if (segment.type === "activity") {
    return getMetaValue(meta, "meetingPoint") || segment.title;
  }
  return segment.subtitle || "";
}

export function generateCalendar(data: CalendarData): string {
  const { trip, organization, version, segments } = data;
  const lines: string[] = [];

  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push(`PRODID:-//${escapeIcs(organization.name)}//Travel Lab//EN`);
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(`X-WR-CALNAME:${escapeIcs(trip.title)}`);

  for (const segment of segments) {
    const uid = `${segment.id}@travellab`;
    const summary = `[${segment.type.toUpperCase()}] ${segment.title}`;
    const description = buildDescription(segment);
    const location = buildLocation(segment);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`SUMMARY:${escapeIcs(summary)}`);

    if (trip.startDate) {
      const dayDate = new Date(trip.startDate);
      dayDate.setDate(dayDate.getDate() + segment.dayNumber - 1);

      if (segment.startTime) {
        const [hours, minutes] = segment.startTime.split(":").map(Number);
        const start = new Date(dayDate);
        start.setHours(hours || 0, minutes || 0, 0, 0);
        lines.push(`DTSTART:${formatIcsDate(start)}`);

        if (segment.endTime) {
          const [eh, em] = segment.endTime.split(":").map(Number);
          const end = new Date(dayDate);
          end.setHours(eh || 0, em || 0, 0, 0);
          if (end <= start) end.setDate(end.getDate() + 1);
          lines.push(`DTEND:${formatIcsDate(end)}`);
        } else {
          const end = new Date(start);
          end.setHours(end.getHours() + 1);
          lines.push(`DTEND:${formatIcsDate(end)}`);
        }
      } else {
        lines.push(`DTSTART;VALUE=DATE:${formatAllDay(dayDate)}`);
        const next = new Date(dayDate);
        next.setDate(next.getDate() + 1);
        lines.push(`DTEND;VALUE=DATE:${formatAllDay(next)}`);
      }
    }

    if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
    if (location) lines.push(`LOCATION:${escapeIcs(location)}`);
    lines.push(`CATEGORIES:${segment.type.toUpperCase()}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
