import React from "react";
import ReactPDF, { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import type { Trip, TripVersion, TripSegment } from "@shared/schema";
import { formatDestinations } from "@shared/schema";
import { differenceInMinutes, parseISO } from "date-fns";

Font.register({
  family: "Serif",
  fonts: [
    { src: "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiukDQ.ttf", fontWeight: 700 },
  ],
});

Font.register({
  family: "Sans",
  fonts: [
    { src: "https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopxhTg.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAfJthTg.ttf", fontWeight: 600 },
  ],
});

const colors = {
  primary: "#B85C38",
  text: "#1a1a1a",
  muted: "#6b7280",
  light: "#f5f0eb",
  border: "#e5e0db",
  white: "#ffffff",
  flight: "#3b82f6",
  hotel: "#8b5cf6",
  restaurant: "#f59e0b",
  activity: "#10b981",
  note: "#6b7280",
  transport: "#06b6d4",
  charter: "#ec4899",
  charter_flight: "#6366f1",
};

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Sans", fontSize: 10, color: colors.text },
  coverPage: { padding: 0, fontFamily: "Sans" },
  coverOverlay: {
    backgroundColor: colors.primary,
    height: "100%",
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 60,
  },
  coverTitle: { fontFamily: "Serif", fontSize: 36, fontWeight: 700, color: colors.white, textAlign: "center", marginBottom: 12 },
  coverSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.85)", textAlign: "center", marginBottom: 6 },
  coverDate: { fontSize: 11, color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: 16 },
  coverBranding: { fontSize: 9, color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 40, letterSpacing: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerOrg: { fontSize: 8, color: colors.muted, letterSpacing: 1.5, textTransform: "uppercase" },
  headerTrip: { fontSize: 8, color: colors.muted },
  dayHeader: { fontFamily: "Serif", fontSize: 18, fontWeight: 700, marginBottom: 10, marginTop: 16, color: colors.primary },
  segmentCard: { marginBottom: 8, padding: 10, borderLeftWidth: 3, backgroundColor: colors.light, borderRadius: 3 },
  segmentTitle: { fontSize: 11, fontWeight: 600, marginBottom: 3 },
  segmentType: { fontSize: 7, letterSpacing: 1.2, textTransform: "uppercase", color: colors.muted, marginBottom: 4 },
  segmentDetail: { fontSize: 9, color: colors.muted, marginBottom: 1.5 },
  segmentConfirmation: { fontSize: 9, fontWeight: 600, color: colors.primary, marginTop: 3 },
  segmentNotes: { fontSize: 9, color: colors.muted, fontStyle: "italic", marginTop: 3 },
  footer: { position: "absolute", bottom: 25, left: 40, right: 40, textAlign: "center", fontSize: 7, color: colors.muted },
});

function formatDate(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function getSegmentColor(type: string): string {
  return (colors as any)[type] || colors.muted;
}

function getMetaValue(metadata: any, key: string): string {
  if (!metadata || typeof metadata !== "object") return "";
  return String(metadata[key] || "");
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

async function fetchPhotoAsBase64(ref: string): Promise<string | null> {
  try {
    const baseUrl = `http://localhost:${process.env.PORT || 5000}`;
    const photoRes = await fetch(`${baseUrl}/api/places/photo?ref=${encodeURIComponent(ref)}`);
    if (!photoRes.ok) return null;
    const buffer = await photoRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return null;
  }
}

interface ResolvedPhoto {
  dataUri: string;
}

async function resolveSegmentPhotos(segments: TripSegment[]): Promise<Map<string, ResolvedPhoto[]>> {
  const photoMap = new Map<string, ResolvedPhoto[]>();
  const tasks: Promise<void>[] = [];

  for (const seg of segments) {
    const meta = (seg.metadata || {}) as Record<string, any>;
    const refs: string[] = meta.photos || meta.photoRefs || [];
    if (!Array.isArray(refs) || refs.length === 0) continue;

    const limit = seg.type === "hotel" ? 3 : 2;
    const segRefs = refs.slice(0, limit);

    tasks.push(
      (async () => {
        const resolved: ResolvedPhoto[] = [];
        for (const ref of segRefs) {
          const dataUri = await fetchPhotoAsBase64(ref);
          if (dataUri) resolved.push({ dataUri });
        }
        if (resolved.length > 0) photoMap.set(seg.id, resolved);
      })()
    );
  }

  await Promise.all(tasks);
  return photoMap;
}

const bookingClassLabels: Record<string, string> = { first: "First", business: "Business", premium_economy: "Premium Economy", economy: "Economy" };

function SegmentView({ segment, photos, showPricing = true }: { segment: TripSegment; photos?: ResolvedPhoto[]; showPricing?: boolean }) {
  const meta = (segment.metadata || {}) as Record<string, any>;
  const typeColor = getSegmentColor(segment.type);
  const details: string[] = [];
  let title = "";

  try {
    if (segment.type === "flight") {
      title = meta.flightNumber || segment.title || "Flight";
      const depIata = meta.departure?.iata || meta.departureAirport || "";
      const arrIata = meta.arrival?.iata || meta.arrivalAirport || "";
      if (depIata && arrIata) details.push(`${depIata} > ${arrIata}`);
      const depCity = meta.departure?.city || meta.departureAirportName || "";
      const arrCity = meta.arrival?.city || meta.arrivalAirportName || "";
      if (depCity && arrCity) details.push(`${depCity} > ${arrCity}`);
      const depTime = meta.departure?.scheduledTime || meta.departureTime || "";
      if (depTime) details.push(`Departs: ${depTime}`);
      const arrTime = meta.arrival?.scheduledTime || meta.arrivalTime || "";
      if (arrTime) details.push(`Arrives: ${arrTime}`);
      if (meta.bookingClass) details.push(`Class: ${bookingClassLabels[meta.bookingClass] || meta.bookingClass}`);
      if (meta.status && meta.status !== "Scheduled") details.push(`Status: ${meta.status}`);
      if (meta.aircraft) details.push(`Aircraft: ${meta.aircraft}`);
    } else if (segment.type === "charter" || segment.type === "charter_flight") {
      title = meta.operator || "Private Charter";
      const dep = meta.departureLocation || "";
      const arr = meta.arrivalLocation || "";
      if (dep && arr) details.push(`${dep} > ${arr}`);
      if (meta.departureTime) details.push(`Departs: ${meta.departureTime}`);
      if (meta.arrivalTime) details.push(`Arrives: ${meta.arrivalTime}`);
      if (meta.aircraftType) details.push(`Aircraft: ${meta.aircraftType}`);
      if (meta.fboHandler) details.push(`FBO: ${meta.fboHandler}`);
      details.push("Charter");
    } else if (segment.type === "hotel") {
      title = meta.hotelName || segment.title || "Hotel";
      if (meta.checkIn && meta.checkOut) details.push(`${meta.checkIn} > ${meta.checkOut}`);
      if (meta.roomType) details.push(`Room: ${meta.roomType}`);
      if (meta.address) details.push(meta.address);
      if (meta.starRating && Number(meta.starRating) > 0) details.push(`${"*".repeat(Number(meta.starRating))} star`);
    } else if (segment.type === "restaurant") {
      title = meta.restaurantName || segment.title || "Restaurant";
      if (segment.startTime) details.push(`Time: ${segment.startTime}`);
      if (meta.partySize) details.push(`Party: ${meta.partySize} guests`);
      if (meta.address) details.push(meta.address);
      if (meta.cuisine) details.push(`Cuisine: ${meta.cuisine}`);
    } else if (segment.type === "activity") {
      title = meta.activityName || segment.title || "Activity";
      if (segment.startTime) details.push(`Time: ${segment.startTime}`);
      if (meta.location) details.push(meta.location);
      if (meta.duration) details.push(`Duration: ${meta.duration}`);
    } else if (segment.type === "transport") {
      title = meta.provider || meta.transportType || segment.title || "Transport";
      const pickup = meta.pickupLocation || "";
      const dropoff = meta.dropoffLocation || "";
      if (pickup && dropoff) details.push(`${pickup} > ${dropoff}`);
      if (segment.startTime) details.push(`Time: ${segment.startTime}`);
      if (meta.driverName) details.push(`Driver: ${meta.driverName}`);
    } else if (segment.type === "note") {
      title = meta.noteTitle || segment.title || "Note";
      if (meta.noteType) details.push(`[${meta.noteType.toUpperCase()}]`);
      if (meta.content) details.push(meta.content.slice(0, 200));
    } else {
      title = segment.title || segment.type || "Segment";
      if (segment.startTime) details.push(`Time: ${segment.startTime}${segment.endTime ? ` - ${segment.endTime}` : ""}`);
    }
  } catch {
    details.push("(details unavailable)");
  }

  const confNum = meta.confirmationNumber || segment.confirmationNumber || "";
  const typeLabel = segment.type === "charter_flight" ? "private flight" : (segment.type === "charter" ? "private flight" : segment.type || "other");

  return (
    <View style={[s.segmentCard, { borderLeftColor: typeColor }]}>
      <Text style={s.segmentType}>{typeLabel}</Text>
      <Text style={s.segmentTitle}>{title}</Text>
      {segment.subtitle ? <Text style={s.segmentDetail}>{segment.subtitle}</Text> : null}
      {details.map((d, i) => (
        <Text key={i} style={s.segmentDetail}>{d}</Text>
      ))}
      {confNum ? (
        <Text style={s.segmentConfirmation}>Confirmation: {confNum}</Text>
      ) : null}
      {showPricing && segment.cost != null && segment.cost > 0 ? (
        <Text style={s.segmentDetail}>Cost: {formatCurrency(segment.cost, segment.currency || "USD")}</Text>
      ) : null}
      {segment.notes ? <Text style={s.segmentNotes}>{segment.notes}</Text> : null}
      {photos && photos.length > 0 ? (
        <View style={{ flexDirection: "row", gap: 4, marginTop: 6 }}>
          {photos.map((p, i) => (
            <Image key={i} src={p.dataUri} style={{ width: 60, height: 60, borderRadius: 3 }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function pdfLayoverDisplay(leg1Meta: Record<string, any>, leg2Meta: Record<string, any>): string | null {
  const arrUtc = leg1Meta.arrivalTimeUtc;
  const depUtc = leg2Meta.departureTimeUtc;
  if (!arrUtc || !depUtc) return null;
  try {
    const mins = differenceInMinutes(parseISO(depUtc), parseISO(arrUtc));
    if (mins < 0) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  } catch { return null; }
}

function JourneyPdfView({ legs, showPricing = true }: { legs: TripSegment[]; showPricing?: boolean }) {
  const firstMeta = (legs[0].metadata || {}) as Record<string, any>;
  const lastMeta = (legs[legs.length - 1].metadata || {}) as Record<string, any>;
  const originIata = firstMeta.departure?.iata || firstMeta.departureAirport || "";
  const destIata = lastMeta.arrival?.iata || lastMeta.arrivalAirport || "";
  const stopsCount = legs.length - 1;

  return (
    <View style={[s.segmentCard, { borderLeftColor: colors.flight }]}>
      <Text style={s.segmentType}>connecting flight - {stopsCount} stop{stopsCount > 1 ? "s" : ""}</Text>
      <Text style={s.segmentTitle}>{originIata} {">"} {destIata}</Text>
      {legs.map((leg, i) => {
        const meta = (leg.metadata || {}) as Record<string, any>;
        const depIata = meta.departure?.iata || meta.departureAirport || "";
        const arrIata = meta.arrival?.iata || meta.arrivalAirport || "";
        const flightNum = meta.flightNumber || leg.title || "";
        const airline = meta.airline || "";
        const depTime = meta.departure?.scheduledTime || meta.departureTime || "";
        const arrTime = meta.arrival?.scheduledTime || meta.arrivalTime || "";
        const confNum = meta.confirmationNumber || leg.confirmationNumber || "";
        const bClass = meta.bookingClass ? bookingClassLabels[meta.bookingClass] || meta.bookingClass : "";

        const layoverDisplay = i > 0 ? pdfLayoverDisplay(
          (legs[i - 1].metadata || {}) as Record<string, any>, meta
        ) : null;

        return (
          <View key={leg.id}>
            {layoverDisplay && (
              <Text style={{ fontSize: 8, color: colors.primary, marginTop: 4, marginBottom: 2 }}>
                {layoverDisplay} layover
              </Text>
            )}
            {i > 0 && !layoverDisplay && (
              <Text style={{ fontSize: 8, color: colors.muted, marginTop: 4, marginBottom: 2 }}>Connection</Text>
            )}
            <View style={{ paddingLeft: 6, marginTop: i === 0 ? 2 : 0 }}>
              <Text style={s.segmentDetail}>
                {flightNum}{airline ? ` (${airline})` : ""}{bClass ? ` - ${bClass}` : ""}
              </Text>
              {depIata && arrIata && (
                <Text style={s.segmentDetail}>{depIata} {">"} {arrIata}{depTime ? ` | ${depTime}` : ""}{arrTime ? ` - ${arrTime}` : ""}</Text>
              )}
              {confNum ? <Text style={s.segmentConfirmation}>Confirmation: {confNum}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

type PdfDayRenderItem =
  | { kind: "segment"; segment: TripSegment }
  | { kind: "journey"; journeyId: string; legs: TripSegment[] };

function buildPdfDayItems(daySegments: TripSegment[]): PdfDayRenderItem[] {
  const items: PdfDayRenderItem[] = [];
  const seenJourneyIds = new Set<string>();
  const journeyGroups = new Map<string, TripSegment[]>();

  for (const seg of daySegments) {
    if (seg.journeyId) {
      if (!journeyGroups.has(seg.journeyId)) journeyGroups.set(seg.journeyId, []);
      journeyGroups.get(seg.journeyId)!.push(seg);
    }
  }

  for (const seg of daySegments) {
    if (seg.journeyId && journeyGroups.get(seg.journeyId)!.length > 1) {
      if (!seenJourneyIds.has(seg.journeyId)) {
        seenJourneyIds.add(seg.journeyId);
        const legs = journeyGroups.get(seg.journeyId)!;
        legs.sort((a, b) => {
          const aLeg = (a.metadata as any)?.legNumber || 0;
          const bLeg = (b.metadata as any)?.legNumber || 0;
          return aLeg - bLeg;
        });
        items.push({ kind: "journey", journeyId: seg.journeyId, legs });
      }
    } else {
      items.push({ kind: "segment", segment: seg });
    }
  }
  return items;
}

interface PdfData {
  trip: Trip;
  organization: { name: string; logoUrl: string | null };
  advisor: { fullName: string } | null;
  client: { fullName: string } | null;
  version: TripVersion;
  segments: TripSegment[];
}

function TripPdfDocument({ data, photoMap }: { data: PdfData; photoMap: Map<string, ResolvedPhoto[]> }) {
  const { trip, organization, advisor, client, version, segments } = data;
  const showPricing = version.showPricing ?? true;

  const dayNumbers = Array.from(new Set(segments.map(s => s.dayNumber))).sort((a, b) => a - b);

  const dateRange = [trip.startDate, trip.endDate]
    .filter(Boolean)
    .map(d => formatDate(d))
    .join(" - ");

  return (
    <Document>
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverOverlay}>
          <Text style={s.coverTitle}>{trip.title}</Text>
          <Text style={s.coverSubtitle}>{formatDestinations((trip as any).destinations, trip.destination)}</Text>
          {client && <Text style={s.coverSubtitle}>Prepared for {client.fullName}</Text>}
          {dateRange && <Text style={s.coverDate}>{dateRange}</Text>}
          <Text style={s.coverBranding}>
            {advisor ? `CURATED BY ${advisor.fullName.toUpperCase()} AT ` : "PREPARED BY "}
            {organization.name.toUpperCase()}
          </Text>
        </View>
      </Page>

      <Page size="A4" style={s.page} wrap>
        <View style={s.header} fixed>
          <Text style={s.headerOrg}>{organization.name}</Text>
          <Text style={s.headerTrip}>{trip.title} - {version.name}</Text>
        </View>

        {dayNumbers.map((dayNum) => {
          const daySegments = segments.filter(seg => seg.dayNumber === dayNum);
          const renderItems = buildPdfDayItems(daySegments);
          let dayLabel = `Day ${dayNum}`;
          if (trip.startDate) {
            const d = new Date(trip.startDate);
            d.setDate(d.getDate() + dayNum - 1);
            dayLabel += ` - ${formatDate(d)}`;
          }
          return (
            <View key={dayNum}>
              <Text style={s.dayHeader}>{dayLabel}</Text>
              {renderItems.map((item) => {
                if (item.kind === "journey") {
                  return <JourneyPdfView key={`j-${item.journeyId}`} legs={item.legs} showPricing={showPricing} />;
                }
                return <SegmentView key={item.segment.id} segment={item.segment} photos={photoMap.get(item.segment.id)} showPricing={showPricing} />;
              })}
            </View>
          );
        })}

        <Text style={s.footer} fixed>
          {organization.name} - Generated by Travel Lab
        </Text>
      </Page>
    </Document>
  );
}

export async function generateTripPdf(data: PdfData): Promise<NodeJS.ReadableStream> {
  if (!data.segments) data.segments = [];
  if (!data.version) throw new Error("No version provided for PDF generation");
  if (!data.trip) throw new Error("No trip provided for PDF generation");

  let photoMap = new Map<string, ResolvedPhoto[]>();
  try {
    photoMap = await resolveSegmentPhotos(data.segments);
  } catch (err) {
    console.warn("[PDF] Failed to resolve segment photos:", err);
  }

  return ReactPDF.renderToStream(<TripPdfDocument data={data} photoMap={photoMap} />);
}
