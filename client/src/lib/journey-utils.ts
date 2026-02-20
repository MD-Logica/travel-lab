import { differenceInMinutes, parseISO } from "date-fns";

export interface LayoverInfo {
  minutes: number;
  display: string;
  flag: "tight" | "long" | "normal";
  airportChange: boolean;
  leg1ArrivalIata: string;
  leg2DepartureIata: string;
}

export function calculateLayover(
  leg1Meta: Record<string, any>,
  leg2Meta: Record<string, any>
): LayoverInfo | null {
  const arrUtc = leg1Meta.arrivalTimeUtc;
  const depUtc = leg2Meta.departureTimeUtc;

  if (!arrUtc || !depUtc) return null;

  const arr = parseISO(arrUtc);
  const dep = parseISO(depUtc);
  const minutes = differenceInMinutes(dep, arr);

  if (minutes < 0) return null;

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const display = h > 0 ? `${h}h ${m}m` : `${m}m`;

  const flag: LayoverInfo["flag"] =
    minutes < 60 ? "tight" :
    minutes > 240 ? "long" : "normal";

  const leg1ArrivalIata = leg1Meta.arrivalAirport || "";
  const leg2DepartureIata = leg2Meta.departureAirport || "";
  const airportChange = (
    !!leg1ArrivalIata &&
    !!leg2DepartureIata &&
    leg1ArrivalIata !== leg2DepartureIata
  );

  return { minutes, display, flag, airportChange,
           leg1ArrivalIata, leg2DepartureIata };
}

export function isRedEye(localTimeString: string): boolean {
  const timePart = localTimeString.includes(" ")
    ? localTimeString.split(" ")[1]?.slice(0, 5)
    : localTimeString.slice(0, 5);
  if (!timePart) return false;
  const [h] = timePart.split(":").map(Number);
  return h >= 20 || h < 5;
}

export function journeyTotalTime(
  firstLegMeta: Record<string, any>,
  lastLegMeta: Record<string, any>
): string | null {
  const depUtc = firstLegMeta.departureTimeUtc;
  const arrUtc = lastLegMeta.arrivalTimeUtc;
  if (!depUtc || !arrUtc) return null;
  const mins = differenceInMinutes(parseISO(arrUtc), parseISO(depUtc));
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
