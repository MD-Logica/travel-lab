import { storage } from "./storage";
import type { FlightTracking } from "@shared/schema";

interface AeroDataBoxFlight {
  status?: string;
  departure?: {
    airport?: { iata?: string; name?: string };
    scheduledTime?: { local?: string; utc?: string };
    actualTime?: { local?: string; utc?: string };
    estimatedTime?: { local?: string; utc?: string };
    terminal?: string;
    gate?: string;
    delay?: number;
  };
  arrival?: {
    airport?: { iata?: string; name?: string };
    scheduledTime?: { local?: string; utc?: string };
    actualTime?: { local?: string; utc?: string };
    estimatedTime?: { local?: string; utc?: string };
    terminal?: string;
    gate?: string;
    baggageBelt?: string;
    delay?: number;
  };
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

function normalizeFlightNumber(fn: string): { airlineCode: string; number: string } {
  const cleaned = fn.replace(/\s+/g, "").toUpperCase();
  const match = cleaned.match(/^([A-Z]{2,3})(\d+)$/);
  if (match) return { airlineCode: match[1], number: match[2] };
  return { airlineCode: "", number: cleaned };
}

export async function fetchFlightStatus(flightNumber: string, date: string): Promise<FlightStatus | null> {
  const apiKey = process.env.AERODATABOX_API_KEY;
  if (!apiKey) {
    console.warn("[FlightTracker] AERODATABOX_API_KEY not configured");
    return null;
  }

  const { airlineCode, number } = normalizeFlightNumber(flightNumber);
  const fullNumber = `${airlineCode}${number}`;

  try {
    const url = `https://aerodatabox.p.rapidapi.com/flights/number/${fullNumber}/${date}`;
    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
      },
    });

    if (!res.ok) {
      console.warn(`[FlightTracker] API returned ${res.status} for ${fullNumber} on ${date}`);
      return null;
    }

    const data: AeroDataBoxFlight[] = await res.json();
    if (!data || data.length === 0) return null;

    const flight = data[0];
    return parseFlightData(flight);
  } catch (err) {
    console.error(`[FlightTracker] Error fetching ${fullNumber}:`, err);
    return null;
  }
}

function parseFlightData(flight: AeroDataBoxFlight): FlightStatus {
  const rawStatus = (flight.status || "").toLowerCase();
  let status: FlightStatus["status"] = "unknown";

  if (rawStatus.includes("cancel")) status = "cancelled";
  else if (rawStatus.includes("landed") || rawStatus.includes("arrived")) status = "landed";
  else if (rawStatus.includes("departed") || rawStatus.includes("airborne") || rawStatus.includes("en route")) status = "departed";
  else if (rawStatus.includes("delay")) status = "delayed";
  else if (rawStatus.includes("scheduled") || rawStatus.includes("expected")) {
    const depDelay = flight.departure?.delay || 0;
    status = depDelay >= 20 ? "delayed" : depDelay > 0 ? "on_time" : "scheduled";
  } else if (rawStatus.includes("on time") || rawStatus === "active") {
    status = "on_time";
  }

  const depDelay = flight.departure?.delay || 0;
  if (status === "scheduled" && depDelay >= 20) status = "delayed";
  if (status === "scheduled" && depDelay >= 0 && depDelay < 20 && flight.departure?.scheduledTime) {
    status = "on_time";
  }

  return {
    status,
    departureDelay: flight.departure?.delay,
    arrivalDelay: flight.arrival?.delay,
    departureGate: flight.departure?.gate,
    departureTerminal: flight.departure?.terminal,
    arrivalGate: flight.arrival?.gate,
    arrivalTerminal: flight.arrival?.terminal,
    scheduledDeparture: flight.departure?.scheduledTime?.local || flight.departure?.scheduledTime?.utc,
    actualDeparture: flight.departure?.actualTime?.local || flight.departure?.actualTime?.utc,
    estimatedDeparture: flight.departure?.estimatedTime?.local || flight.departure?.estimatedTime?.utc,
    scheduledArrival: flight.arrival?.scheduledTime?.local || flight.arrival?.scheduledTime?.utc,
    actualArrival: flight.arrival?.actualTime?.local || flight.arrival?.actualTime?.utc,
    estimatedArrival: flight.arrival?.estimatedTime?.local || flight.arrival?.estimatedTime?.utc,
    departureAirport: flight.departure?.airport?.iata,
    arrivalAirport: flight.arrival?.airport?.iata,
    baggageBelt: flight.arrival?.baggageBelt,
    rawStatus: flight.status,
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
    const arrAirport = curr.arrivalAirport || route.split("→")[1]?.trim() || "";
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
    return `${ls.departureAirport} → ${ls.arrivalAirport}`;
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
  const route = getRoute(tracking) || `${newStatus.departureAirport || "?"} → ${newStatus.arrivalAirport || "?"}`;

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
