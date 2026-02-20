import { storage } from "./storage";
import type { FlightTracking } from "@shared/schema";

interface FlightLabsFlight {
  flight_status?: string;
  flight?: {
    iata?: string;
    icao?: string;
    number?: string;
  };
  airline?: {
    name?: string;
    iata?: string;
  };
  departure?: {
    airport?: string;
    iata?: string;
    scheduled?: string;
    estimated?: string;
    actual?: string;
    terminal?: string;
    gate?: string;
    delay?: number;
  };
  arrival?: {
    airport?: string;
    iata?: string;
    scheduled?: string;
    estimated?: string;
    actual?: string;
    terminal?: string;
    gate?: string;
    baggage?: string;
    delay?: number;
  };
  aircraft?: {
    registration?: string;
    iata?: string;
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

export async function fetchFlightStatus(flightNumber: string, _date: string): Promise<FlightStatus | null> {
  const apiKey = process.env.FLIGHTLABS_API_KEY;
  if (!apiKey) {
    console.warn("[FlightTracker] FLIGHTLABS_API_KEY not configured");
    return null;
  }

  const { airlineCode, number } = normalizeFlightNumber(flightNumber);
  const flightIata = `${airlineCode}${number}`;

  try {
    const params = new URLSearchParams({
      access_key: apiKey,
      flightIata: flightIata,
      limit: "1",
    });
    const url = `https://www.goflightlabs.com/flights?${params}`;
    const res = await fetch(url);
    const data = await res.json();

    console.log("[FlightTracker] raw:", JSON.stringify(data).slice(0, 500));

    const flights = data?.data || (Array.isArray(data) ? data : []);

    if (flights.length === 0) {
      console.warn(`[FlightTracker] No data for ${flightIata}`);
      return null;
    }

    const flight = flights[0];
    return parseFlightData(flight);
  } catch (err) {
    console.error(`[FlightTracker] Error fetching ${flightIata}:`, err);
    return null;
  }
}

function parseFlightData(flight: FlightLabsFlight): FlightStatus {
  const rawStatus = (flight.flight_status || "").toLowerCase();
  let status: FlightStatus["status"] = "unknown";

  if (rawStatus.includes("cancel")) status = "cancelled";
  else if (rawStatus.includes("landed") || rawStatus.includes("arrived")) status = "landed";
  else if (rawStatus.includes("active") || rawStatus.includes("en-route") || rawStatus.includes("en route")) status = "departed";
  else if (rawStatus.includes("delay")) status = "delayed";
  else if (rawStatus.includes("scheduled")) {
    const depDelay = flight.departure?.delay || 0;
    status = depDelay >= 20 ? "delayed" : depDelay > 0 ? "on_time" : "scheduled";
  } else if (rawStatus.includes("on time")) {
    status = "on_time";
  }

  const depDelay = flight.departure?.delay || 0;
  if (status === "scheduled" && depDelay >= 20) status = "delayed";
  if (status === "scheduled" && depDelay >= 0 && depDelay < 20 && flight.departure?.scheduled) {
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
    scheduledDeparture: flight.departure?.scheduled,
    actualDeparture: flight.departure?.actual,
    estimatedDeparture: flight.departure?.estimated,
    scheduledArrival: flight.arrival?.scheduled,
    actualArrival: flight.arrival?.actual,
    estimatedArrival: flight.arrival?.estimated,
    departureAirport: flight.departure?.iata,
    arrivalAirport: flight.arrival?.iata,
    baggageBelt: flight.arrival?.baggage,
    rawStatus: flight.flight_status,
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
