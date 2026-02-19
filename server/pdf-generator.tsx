import ReactPDF, { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { Trip, TripVersion, TripSegment } from "@shared/schema";

Font.register({
  family: "Serif",
  fonts: [
    { src: "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKd3vXDXbtU.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFu3DXbtU.ttf", fontWeight: 700 },
  ],
});

Font.register({
  family: "Sans",
  fonts: [
    { src: "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZOIHTWEBlw.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZ2NHjWEBlwu8Q.ttf", fontWeight: 600 },
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

function SegmentView({ segment }: { segment: TripSegment }) {
  const meta = segment.metadata as Record<string, any> || {};
  const typeColor = getSegmentColor(segment.type);
  const details: string[] = [];

  if (segment.type === "flight") {
    const dep = getMetaValue(meta, "departureAirport");
    const arr = getMetaValue(meta, "arrivalAirport");
    if (dep && arr) details.push(`${dep} → ${arr}`);
    const fn = getMetaValue(meta, "flightNumber");
    if (fn) details.push(`Flight ${fn}`);
    const airline = getMetaValue(meta, "airline");
    if (airline) details.push(airline);
  } else if (segment.type === "hotel") {
    const name = getMetaValue(meta, "hotelName");
    if (name) details.push(name);
    const room = getMetaValue(meta, "roomType");
    if (room) details.push(`Room: ${room}`);
    const stars = getMetaValue(meta, "starRating");
    if (stars) details.push(`${"★".repeat(Number(stars))} rating`);
  } else if (segment.type === "restaurant") {
    const name = getMetaValue(meta, "restaurantName");
    if (name) details.push(name);
    const cuisine = getMetaValue(meta, "cuisine");
    if (cuisine) details.push(`Cuisine: ${cuisine}`);
    const guest = getMetaValue(meta, "guestName");
    if (guest) details.push(`Guest: ${guest}`);
  } else if (segment.type === "activity") {
    const provider = getMetaValue(meta, "provider");
    if (provider) details.push(`Provider: ${provider}`);
    const category = getMetaValue(meta, "category");
    if (category) details.push(`Category: ${category}`);
    const meeting = getMetaValue(meta, "meetingPoint");
    if (meeting) details.push(`Meeting: ${meeting}`);
  } else if (segment.type === "note") {
    const noteType = getMetaValue(meta, "noteType");
    if (noteType) details.push(`[${noteType.toUpperCase()}]`);
    const content = getMetaValue(meta, "content");
    if (content) details.push(content.slice(0, 200));
  }

  if (segment.startTime) details.push(`Time: ${segment.startTime}${segment.endTime ? ` – ${segment.endTime}` : ""}`);

  return (
    <View style={[s.segmentCard, { borderLeftColor: typeColor }]}>
      <Text style={s.segmentType}>{segment.type}</Text>
      <Text style={s.segmentTitle}>{segment.title}</Text>
      {segment.subtitle && <Text style={s.segmentDetail}>{segment.subtitle}</Text>}
      {details.map((d, i) => (
        <Text key={i} style={s.segmentDetail}>{d}</Text>
      ))}
      {segment.confirmationNumber && (
        <Text style={s.segmentConfirmation}>Confirmation: {segment.confirmationNumber}</Text>
      )}
      {segment.cost != null && (
        <Text style={s.segmentDetail}>Cost: {segment.currency || "USD"} {segment.cost.toLocaleString()}</Text>
      )}
      {segment.notes && <Text style={s.segmentNotes}>{segment.notes}</Text>}
    </View>
  );
}

interface PdfData {
  trip: Trip;
  organization: { name: string; logoUrl: string | null };
  advisor: { fullName: string } | null;
  client: { fullName: string } | null;
  version: TripVersion;
  segments: TripSegment[];
}

function TripPdfDocument({ data }: { data: PdfData }) {
  const { trip, organization, advisor, client, version, segments } = data;

  const dayNumbers = Array.from(new Set(segments.map(s => s.dayNumber))).sort((a, b) => a - b);

  const dateRange = [trip.startDate, trip.endDate]
    .filter(Boolean)
    .map(d => formatDate(d))
    .join(" – ");

  return (
    <Document>
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverOverlay}>
          <Text style={s.coverTitle}>{trip.title}</Text>
          <Text style={s.coverSubtitle}>{trip.destination}</Text>
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
          <Text style={s.headerTrip}>{trip.title} — {version.name}</Text>
        </View>

        {dayNumbers.map((dayNum) => {
          const daySegments = segments.filter(seg => seg.dayNumber === dayNum);
          let dayLabel = `Day ${dayNum}`;
          if (trip.startDate) {
            const d = new Date(trip.startDate);
            d.setDate(d.getDate() + dayNum - 1);
            dayLabel += ` — ${formatDate(d)}`;
          }
          return (
            <View key={dayNum} wrap={false}>
              <Text style={s.dayHeader}>{dayLabel}</Text>
              {daySegments.map((seg) => (
                <SegmentView key={seg.id} segment={seg} />
              ))}
            </View>
          );
        })}

        <Text style={s.footer} fixed>
          {organization.name} — Generated by Travel Lab
        </Text>
      </Page>
    </Document>
  );
}

export async function generateTripPdf(data: PdfData): Promise<NodeJS.ReadableStream> {
  return ReactPDF.renderToStream(<TripPdfDocument data={data} />);
}
