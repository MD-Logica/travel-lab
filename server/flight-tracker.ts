import { storage } from "./storage";
import type { FlightTracking } from "@shared/schema";

interface AeroDataBoxFlight {
  number?: string;
  status?: string;
  airline?: { name?: string; iata?: string };
  departure?: {
    airport?: { iata?: string; name?: string };
    scheduledTime?: { utc?: string; local?: string };
    actualTime?: { utc?: string; local?: string };
    revisedTime?: { utc?: string; local?: string };
    terminal?: { name?: string };
    gate?: string;
    delay?: number;
  };
  arrival?: {
    airport?: { iata?: string; name?: string };
    scheduledTime?: { utc?: string; local?: string };
    actualTime?: { utc?: string; local?: string };
    revisedTime?: { utc?: string; local?: string };
    terminal?: { name?: string };
    gate?: string;
    delay?: number;
  };
  aircraft?: { model?: string; reg?: string };
}

export interface FlightStatus {
  status: "scheduled" | "on_time" | "delayed" | "cancelled" | "departed" | "landed" | "unknown";
  departureDelay?: number;
  arrivalDelay?: number;
  departureGate?: string;
  departureTerminal?: string;
  arrivalGate?: string;
  arrivalTerminal?: string;
  scheduledDeparture?: string;
  actualDeparture?: string;
  estimatedDeparture?: string;
  scheduledArrival?: string;
  actualArrival?: string;
  estimatedArrival?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  baggageBelt?: string;
  rawStatus?: string;
}

export interface MeaningfulChange {
  type: "delayed" | "gate_changed" | "cancelled" | "departed" | "landed";
  flightNumber: string;
  route: string;
  description: string;
  newStatus: FlightStatus;
}

function normalizeFlightNumber(fn: string): string {
  return fn.replace(/\s+/g, "").toUpperCase();
}

export async function fetchFlightStatus(flightNumber: string, _date: string): Promise<FlightStatus | null> {
  const apiKey = process.env.AERODATABOX_RAPIDAPI_KEY;
  if (!apiKey) {
    console.warn("[FlightTracker] AERODATABOX_RAPIDAPI_KEY not configured");
    return null;
  }

  const flightIata = normalizeFlightNumber(flightNumber);
  const date = new Date().toISOString().split("T")[0];

  try {
    const url = `https://aerodatabox.p.rapidapi.com/flights/number/${flightIata}/${date}?withAircraftImage=false&withLocation=false`;
    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
      },
    });

    if (res.status === 204 || res.status === 404) {
      console.warn(`[FlightTracker] No data for ${flightIata} (${res.status})`);
      return null;
    }

    const text = await res.text();
    if (!text || !text.trim()) {
      console.warn(`[FlightTracker] Empty response for ${flightIata}`);
      return null;
    }

    let data: any;
    try { data = JSON.parse(text); } catch {
      console.warn(`[FlightTracker] Invalid JSON for ${flightIata}`);
      return null;
    }

    console.log("[FlightTracker] raw:", JSON.stringify(data).slice(0, 500));

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[FlightTracker] No data for ${flightIata}`);
      return null;
    }

    const flight = data[0] as AeroDataBoxFlight;
    return parseFlightData(flight);
  } catch (err) {
    console.error(`[FlightTracker] Error fetching ${flightIata}:`, err);
    return null;
  }
}

function mapAeroStatus(rawStatus: string, depDelay?: number): FlightStatus["status"] {
  const s = (rawStatus || "").toLowerCase().replace(/[\s_-]/g, "");
  if (s.includes("cancel") || s.includes("divert")) return "cancelled";
  if (s.includes("landed") || s.includes("arrived")) return "landed";
  if (s.includes("departed") || s.includes("enroute") || s.includes("active") || s.includes("airborne") || s.includes("taxiing")) {
    return "departed";
  }
  if (s.includes("delay")) return "delayed";
  if (s.includes("boarding")) return "on_time";
  if (s.includes("ontime")) return "on_time";
  if (s.includes("scheduled") || s === "unknown" || s === "") {
    if (depDelay && depDelay >= 20) return "delayed";
    if (depDelay !== undefined && depDelay >= 0) return "on_time";
    return "scheduled";
  }
  if (depDelay && depDelay >= 20) return "delayed";
  return "unknown";
}

function parseFlightData(flight: AeroDataBoxFlight): FlightStatus {
  const rawStatus = flight.status || "";
  const depDelay = flight.departure?.delay;
  const status = mapAeroStatus(rawStatus, depDelay);

  return {
    status,
    departureDelay: flight.departure?.delay,
    arrivalDelay: flight.arrival?.delay,
    departureGate: flight.departure?.gate,
    departureTerminal: flight.departure?.terminal?.name,
    arrivalGate: flight.arrival?.gate,
    arrivalTerminal: flight.arrival?.terminal?.name,
    scheduledDeparture: flight.departure?.scheduledTime?.utc,
    actualDeparture: flight.departure?.actualTime?.utc,
    estimatedDeparture: flight.departure?.revisedTime?.utc,
    scheduledArrival: flight.arrival?.scheduledTime?.utc,
    actualArrival: flight.arrival?.actualTime?.utc,
    estimatedArrival: flight.arrival?.revisedTime?.utc,
    departureAirport: flight.departure?.airport?.iata,
    arrivalAirport: flight.arrival?.airport?.iata,
    rawStatus,
  };
}

export function detectMeaningfulChanges(
  prev: FlightStatus | null,
  curr: FlightStatus,
  flightNumber: string,
  route: string
): MeaningfulChange[] {
  const changes: MeaningfulChange[] = [];
  const prevStatus = prev?.status || "scheduled";

  if (curr.status === "cancelled" && prevStatus !== "cancelled") {
    changes.push({
      type: "cancelled",
      flightNumber,
      route,
      description: `Flight ${flightNumber} (${route}) has been cancelled.`,
      newStatus: curr,
    });
    return changes;
  }

  if (curr.status === "landed" && prevStatus !== "landed") {
    const arrAirport = curr.arrivalAirport || route.split("\u2192")[1]?.trim() || "";
    changes.push({
      type: "landed",
      flightNumber,
      route,
      description: `Flight ${flightNumber} has landed${arrAirport ? ` in ${arrAirport}` : ""}.`,
      newStatus: curr,
    });
    return changes;
  }

  if (curr.status === "departed" && prevStatus !== "departed" && prevStatus !== "landed") {
    const depDelay = curr.departureDelay || 0;
    const delayText = depDelay >= 20 ? ` (delayed ${depDelay} minutes)` : "";
    changes.push({
      type: "departed",
      flightNumber,
      route,
      description: `Flight ${flightNumber} (${route}) has departed${delayText}.`,
      newStatus: curr,
    });
    return changes;
  }

  if (curr.departureDelay && curr.departureDelay >= 20) {
    const prevDelay = prev?.departureDelay || 0;
    if (prevDelay < 20 || Math.abs(curr.departureDelay - prevDelay) >= 15) {
      const newTime = curr.estimatedDeparture || curr.scheduledDeparture || "";
      changes.push({
        type: "delayed",
        flightNumber,
        route,
        description: `Flight ${flightNumber} (${route}) is delayed by ${curr.departureDelay} minutes.${newTime ? ` New departure: ${formatTimeOnly(newTime)}.` : ""}`,
        newStatus: curr,
      });
    }
  }

  if (curr.departureGate && prev?.departureGate && curr.departureGate !== prev.departureGate) {
    changes.push({
      type: "gate_changed",
      flightNumber,
      route,
      description: `Gate change: flight ${flightNumber} now departs from Gate ${curr.departureGate}.`,
      newStatus: curr,
    });
  }

  return changes;
}

function formatTimeOnly(dt: string): string {
  try {
    const d = new Date(dt);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return dt;
  }
}

function isInMonitoringWindow(tracking: FlightTracking): boolean {
  const now = new Date();
  const lastStatus = tracking.lastStatus as FlightStatus | null;

  let depTime: Date | null = null;
  let arrTime: Date | null = null;

  if (lastStatus?.scheduledDeparture) {
    depTime = new Date(lastStatus.scheduledDeparture);
  } else if (tracking.scheduledDeparture) {
    depTime = new Date(tracking.scheduledDeparture);
  }

  if (lastStatus?.scheduledArrival) {
    arrTime = new Date(lastStatus.scheduledArrival);
  } else if (tracking.scheduledArrival) {
    arrTime = new Date(tracking.scheduledArrival);
  }

  if (!depTime) {
    const todayStr = tracking.flightDate;
    depTime = new Date(`${todayStr}T12:00:00`);
  }

  const windowStart = new Date(depTime.getTime() - 3 * 60 * 60 * 1000);
  const windowEnd = arrTime
    ? new Date(arrTime.getTime() + 1 * 60 * 60 * 1000)
    : new Date(depTime.getTime() + 12 * 60 * 60 * 1000);

  return now >= windowStart && now <= windowEnd;
}

function getRoute(tracking: FlightTracking): string {
  const ls = tracking.lastStatus as FlightStatus | null;
  if (ls?.departureAirport && ls?.arrivalAirport) {
    return `${ls.departureAirport} \u2192 ${ls.arrivalAirport}`;
  }
  return "";
}

async function notifyAdvisors(orgId: string, change: MeaningfulChange, tripId: string, segmentId: string) {
  try {
    const advisors = await storage.getAdvisorProfilesForOrg(orgId);
    for (const advisor of advisors) {
      await storage.createNotification({
        orgId,
        profileId: advisor.id,
        type: `flight_${change.type}`,
        title: `Flight ${change.flightNumber}`,
        message: change.description,
        data: {
          flightNumber: change.flightNumber,
          route: change.route,
          changeType: change.type,
          tripId,
          segmentId,
          status: change.newStatus,
        },
        isRead: false,
      });
    }
  } catch (err) {
    console.error("[FlightTracker] Error notifying advisors:", err);
  }
}

export async function checkSingleFlight(tracking: FlightTracking): Promise<FlightStatus | null> {
  const newStatus = await fetchFlightStatus(tracking.flightNumber, tracking.flightDate);
  if (!newStatus) return null;

  const prevStatus = tracking.lastStatus as FlightStatus | null;
  const route = getRoute(tracking) || `${newStatus.departureAirport || "?"} \u2192 ${newStatus.arrivalAirport || "?"}`;

  const changes = detectMeaningfulChanges(prevStatus, newStatus, tracking.flightNumber, route);

  const updateData: any = {
    lastStatus: newStatus,
    lastCheckedAt: new Date(),
  };

  if (!tracking.scheduledDeparture && newStatus.scheduledDeparture) {
    updateData.scheduledDeparture = newStatus.scheduledDeparture;
  }
  if (!tracking.scheduledArrival && newStatus.scheduledArrival) {
    updateData.scheduledArrival = newStatus.scheduledArrival;
  }

  if (newStatus.status === "landed") {
    updateData.isActive = false;
  }

  await storage.updateFlightTracking(tracking.id, updateData);

  if (changes.length > 0) {
    for (const change of changes) {
      await notifyAdvisors(tracking.orgId, change, tracking.tripId, tracking.segmentId);
    }
  }

  return newStatus;
}

export async function runFlightPollingCycle(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const activeTrackings = await storage.getActiveFlightTrackingForDate(today);

  if (activeTrackings.length === 0) return;

  console.log(`[FlightTracker] Checking ${activeTrackings.length} active flight(s) for ${today}`);

  for (const tracking of activeTrackings) {
    if (!isInMonitoringWindow(tracking)) continue;

    try {
      await checkSingleFlight(tracking);
    } catch (err) {
      console.error(`[FlightTracker] Error checking ${tracking.flightNumber}:`, err);
    }

    await new Promise(r => setTimeout(r, 500));
  }
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export function startFlightPolling(): void {
  if (pollingInterval) return;

  console.log("[FlightTracker] Starting flight polling (every 20 minutes)");
  runFlightPollingCycle().catch(err => console.error("[FlightTracker] Initial poll error:", err));

  pollingInterval = setInterval(() => {
    runFlightPollingCycle().catch(err => console.error("[FlightTracker] Poll error:", err));
  }, 20 * 60 * 1000);
}

export function stopFlightPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[FlightTracker] Stopped flight polling");
  }
}
