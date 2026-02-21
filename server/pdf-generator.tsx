import React from "react";
import ReactPDF, { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import type { Trip, TripVersion, TripSegment, SegmentVariant } from "@shared/schema";
import { formatDestinations, segmentVariants } from "@shared/schema";
import { differenceInMinutes, parseISO } from "date-fns";
import { eq } from "drizzle-orm";
import { db } from "./db";
import path from "path";

const FONTS_DIR = path.join(process.cwd(), "server", "fonts");

Font.register({
  family: "Serif",
  fonts: [
    { src: path.join(FONTS_DIR, "CormorantGaramond-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONTS_DIR, "CormorantGaramond-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
    { src: path.join(FONTS_DIR, "CormorantGaramond-Bold.ttf"), fontWeight: 700 },
  ],
});

Font.register({
  family: "Sans",
  fonts: [
    { src: path.join(FONTS_DIR, "Inter-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONTS_DIR, "Inter-SemiBold.ttf"), fontWeight: 600 },
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
  segmentCard: { marginBottom: 10, padding: 12, borderLeftWidth: 3, backgroundColor: "#fafaf9", borderRadius: 4 },
  segmentTitle: { fontSize: 12, fontFamily: "Serif", fontWeight: 700, marginBottom: 3 },
  segmentType: { fontSize: 7, letterSpacing: 1.5, textTransform: "uppercase", color: colors.muted, marginBottom: 5 },
  segmentDetail: { fontSize: 9, color: "#4b5563", marginBottom: 2, lineHeight: 1.4 },
  segmentConfirmation: { fontSize: 9, fontWeight: 600, color: colors.primary, marginTop: 3 },
  segmentNotes: { fontSize: 9, color: colors.muted, fontStyle: "italic", marginTop: 3 },
  variantBox: { marginTop: 6, padding: 6, backgroundColor: colors.white, borderRadius: 2, borderWidth: 0.5, borderColor: colors.border },
  choiceGroupWrapper: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderStyle: "dashed" as const,
    borderRadius: 4,
    padding: 6,
    backgroundColor: "#fffbeb",
  },
  choiceGroupLabel: {
    fontSize: 7,
    fontWeight: 600,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    color: "#d97706",
    marginBottom: 6,
  },
  orDivider: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginVertical: 6,
  },
  orDividerLine: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: "#fcd34d",
  },
  orDividerText: {
    fontSize: 7,
    fontWeight: 700,
    color: "#f59e0b",
    paddingHorizontal: 6,
    letterSpacing: 1.5,
  },
  variantLabel: { fontSize: 8, fontWeight: 600, flex: 1 },
  variantDetail: { fontSize: 8, color: colors.muted, textAlign: "right" as const, flexShrink: 0 },
  variantHeader: { fontSize: 8, fontWeight: 600, color: colors.primary, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: 1 },
  variantRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "flex-start" as const, paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  variantRowLast: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "flex-start" as const, paddingVertical: 3 },
  refundLine: { fontSize: 8, color: colors.muted, marginTop: 2 },
  propertyGroupHeader: { fontFamily: "Serif", fontSize: 13, fontWeight: 700, color: colors.hotel, marginBottom: 4, marginTop: 8 },
  propertyGroupTotal: { fontSize: 10, fontWeight: 600, color: colors.text, marginTop: 4, textAlign: "right" as const },
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

function formatRefundability(refundability: string | null | undefined, refundDeadline: string | Date | null | undefined): string | null {
  if (!refundability || refundability === "unknown") return null;
  if (refundability === "non_refundable" || refundability === "nonrefundable") return "Non-refundable";
  const deadlineStr = refundDeadline ? formatDate(refundDeadline) : "";
  if (refundability === "refundable") return deadlineStr ? `Refundable until ${deadlineStr}` : "Refundable";
  if (refundability === "partial" || refundability === "partially_refundable") return deadlineStr ? `Partial refund until ${deadlineStr}` : "Partial refund available";
  return null;
}

const bookingClassLabelsPdf: Record<string, string> = {
  first: "First",
  business: "Business",
  premium_economy: "Premium Economy",
  economy: "Economy",
};

function buildFlightPrimaryLabelPdf(
  segment: TripSegment,
  journeyLegs?: TripSegment[]
): string {
  const meta = (segment.metadata || {}) as Record<string, any>;
  const qty = meta.quantity || 1;
  const cabin = bookingClassLabelsPdf[meta.bookingClass] || "";

  if (journeyLegs && journeyLegs.length > 1) {
    const firstMeta = (journeyLegs[0].metadata || {}) as Record<string, any>;
    const lastMeta = (journeyLegs[journeyLegs.length - 1].metadata || {}) as Record<string, any>;
    const dep = firstMeta.departure?.iata || firstMeta.departureAirport || "";
    const arr = lastMeta.arrival?.iata || lastMeta.arrivalAirport || "";
    const stops = journeyLegs.length - 1;
    const routePart = dep && arr ? `${dep} → ${arr}` : (firstMeta.airline || "Flight");
    const stopsPart = stops === 1 ? "1 stop" : `${stops} stops`;
    const extras: string[] = [stopsPart];
    if (cabin) extras.push(cabin);
    if (qty > 1) extras.push(`${qty} passengers`);
    return `${routePart} (${extras.join(", ")})`;
  }

  const dep = meta.departure?.iata || meta.departureAirport || "";
  const arr = meta.arrival?.iata || meta.arrivalAirport || "";
  const fn = meta.flightNumber || "";
  const parts: string[] = [];
  if (fn) parts.push(fn);
  if (dep && arr) parts.push(`${dep} → ${arr}`);
  const extras: string[] = [];
  if (cabin) extras.push(cabin);
  if (qty > 1) extras.push(`${qty} passengers`);
  const base = parts.join(" / ");
  return base
    ? `${base}${extras.length > 0 ? ` (${extras.join(", ")})` : ""}`
    : (segment.title || "Primary flight");
}

function buildHotelPrimaryLabelPdf(segment: TripSegment): string {
  const meta = (segment.metadata || {}) as Record<string, any>;
  const hotelName = meta.hotelName || segment.title || "";
  const roomType = meta.roomType || segment.subtitle || "";
  const qty = meta.quantity || 1;
  const parts = [hotelName, roomType].filter(Boolean);
  if (qty > 1) parts.push(`${qty} rooms`);
  return parts.length > 0 ? parts.join(" — ") : "Primary room";
}

function buildPrimaryLabelForPdf(segment: TripSegment, journeyLegs?: TripSegment[]): string {
  if (segment.type === "flight" || segment.type === "charter_flight") {
    return buildFlightPrimaryLabelPdf(segment, journeyLegs);
  }
  if (segment.type === "hotel") {
    return buildHotelPrimaryLabelPdf(segment);
  }
  return segment.title || "Primary option";
}

function VariantDisplay({ variants, showPricing, primarySegment, journeyLegs, primaryCost, isApproved }: { variants: SegmentVariant[]; showPricing: boolean; primarySegment?: TripSegment; journeyLegs?: TripSegment[]; primaryCost?: number; isApproved?: boolean }) {
  if (!variants || variants.length === 0) return null;
  if (isApproved) return null;

  const selectedVariant = variants.find(v => v.isSelected);
  const submittedVariant = !selectedVariant ? variants.find(v => v.isSubmitted) : null;

  function buildVariantRowLabel(v: SegmentVariant): string {
    const isUpgrade = !v.variantType || v.variantType === "upgrade";
    if (isUpgrade && primarySegment) {
      if (primarySegment.type === "flight" || primarySegment.type === "charter_flight") {
        const segMeta = (primarySegment.metadata || {}) as Record<string, any>;
        const variantCabin = bookingClassLabelsPdf[(v as any).bookingClass] || bookingClassLabelsPdf[(v as any).cabin] || v.label || "";
        const vQty = v.quantity || segMeta.quantity || 1;
        if (journeyLegs && journeyLegs.length > 1) {
          const firstMeta = (journeyLegs[0].metadata || {}) as Record<string, any>;
          const lastMeta = (journeyLegs[journeyLegs.length - 1].metadata || {}) as Record<string, any>;
          const dep = firstMeta.departure?.iata || firstMeta.departureAirport || "";
          const arr = lastMeta.arrival?.iata || lastMeta.arrivalAirport || "";
          const stops = journeyLegs.length - 1;
          const routePart = dep && arr ? `${dep} → ${arr}` : buildPrimaryLabelForPdf(primarySegment, journeyLegs);
          const stopsPart = stops === 1 ? "1 stop" : `${stops} stops`;
          const extras: string[] = [stopsPart];
          if (variantCabin) extras.push(variantCabin);
          if (vQty > 1) extras.push(`${vQty} pax`);
          return `${routePart} (${extras.join(", ")})`;
        }
        const dep = segMeta.departure?.iata || segMeta.departureAirport || "";
        const arr = segMeta.arrival?.iata || segMeta.arrivalAirport || "";
        const routePart = dep && arr ? `${dep} → ${arr}` : buildPrimaryLabelForPdf(primarySegment);
        const extras: string[] = [];
        if (variantCabin) extras.push(variantCabin);
        if (vQty > 1) extras.push(`${vQty} pax`);
        return extras.length > 0 ? `${routePart} (${extras.join(", ")})` : routePart;
      }
      if (primarySegment.type === "hotel") {
        const hotelName = (primarySegment.metadata as any)?.hotelName || primarySegment.title || "";
        const vQty = v.quantity || (primarySegment.metadata as any)?.quantity || 1;
        const parts = [hotelName, v.label].filter(Boolean);
        if (vQty > 1) parts.push(`${vQty} rooms`);
        return parts.join(" — ");
      }
      const ctx = buildPrimaryLabelForPdf(primarySegment, journeyLegs);
      return ctx ? `${ctx} — ${v.label}` : v.label;
    }
    return v.label;
  }

  function buildPrimaryRowLabel(): string {
    return buildPrimaryLabelForPdf(primarySegment!, journeyLegs);
  }

  function renderVariantPrice(v: SegmentVariant) {
    if (!showPricing || v.cost == null || v.cost <= 0) return null;
    const currency = v.currency || primarySegment?.currency || "USD";
    const qty = v.quantity || (primarySegment?.metadata as any)?.quantity || 1;
    const ppu = v.pricePerUnit && v.pricePerUnit > 0
      ? v.pricePerUnit
      : (qty > 1 && v.cost > 0 ? v.cost / qty : null);
    const unitWord = primarySegment?.type === "hotel" ? "room" : "pax";
    return (
      <View style={{ alignItems: "flex-end" as const }}>
        <Text style={s.variantDetail}>{formatCurrency(v.cost, currency)}</Text>
        {qty > 1 && ppu && (
          <Text style={[s.variantDetail, { fontSize: 7 }]}>
            {formatCurrency(ppu, currency)}/{unitWord}
          </Text>
        )}
      </View>
    );
  }

  function renderRefund(refundText: string | null) {
    if (!refundText) return null;
    return (
      <Text style={[s.variantDetail, { fontSize: 7, color: refundText.includes("Non") ? "#dc2626" : colors.muted }]}>
        {refundText}
      </Text>
    );
  }

  if (selectedVariant) {
    const refundText = formatRefundability(selectedVariant.refundability, selectedVariant.refundDeadline);
    const label = buildVariantRowLabel(selectedVariant);
    return (
      <View style={[s.variantBox, { marginTop: 8 }]}>
        <Text style={s.variantHeader}>Selected Option</Text>
        <View style={s.variantRowLast}>
          <Text style={s.variantLabel}>{label}</Text>
          <View style={{ alignItems: "flex-end" as const, flexShrink: 0 }}>
            <Text style={{ fontSize: 8, fontWeight: 600, color: "#059669" }}>✓ Selected</Text>
            {renderRefund(refundText)}
          </View>
        </View>
      </View>
    );
  }

  const primaryMeta = (primarySegment?.metadata || {}) as Record<string, any>;
  const primaryCostVal = primaryCost ?? primarySegment?.cost;
  const primaryQty = primaryMeta.quantity || 1;
  const primaryPpu = primaryMeta.pricePerUnit && primaryMeta.pricePerUnit > 0
    ? primaryMeta.pricePerUnit
    : (primaryQty > 1 && (primaryCostVal || 0) > 0 ? primaryCostVal! / primaryQty : null);
  const primaryCurrency = primarySegment?.currency || "USD";
  const primaryUnitWord = primarySegment?.type === "hotel" ? "room" : "pax";
  const primaryRefund = formatRefundability(primaryMeta.refundability || primarySegment?.refundability, primaryMeta.refundDeadline);

  const headerLabel = submittedVariant ? "Options (preference indicated)" : "Options";

  return (
    <View style={[s.variantBox, { marginTop: 8 }]}>
      <Text style={s.variantHeader}>{headerLabel}</Text>

      {primarySegment && (
        <View style={s.variantRow}>
          <Text style={[s.variantLabel, { color: colors.primary }]}>
            {buildPrimaryRowLabel()}
          </Text>
          <View style={{ alignItems: "flex-end" as const, flexShrink: 0, maxWidth: "45%" }}>
            {showPricing && primaryCostVal != null && primaryCostVal > 0 && (
              <>
                <Text style={s.variantDetail}>{formatCurrency(primaryCostVal, primaryCurrency)}</Text>
                {primaryQty > 1 && primaryPpu && (
                  <Text style={[s.variantDetail, { fontSize: 7 }]}>
                    {formatCurrency(primaryPpu, primaryCurrency)}/{primaryUnitWord}
                  </Text>
                )}
              </>
            )}
            {renderRefund(primaryRefund)}
          </View>
        </View>
      )}

      {variants.map((v, vi) => {
        const isLast = vi === variants.length - 1;
        const rowStyle = isLast ? s.variantRowLast : s.variantRow;
        const refundText = formatRefundability(v.refundability, v.refundDeadline);
        const isThisSubmitted = v.isSubmitted;

        return (
          <View key={v.id} style={rowStyle}>
            <Text style={s.variantLabel}>{buildVariantRowLabel(v)}</Text>
            <View style={{ alignItems: "flex-end" as const, flexShrink: 0, maxWidth: "45%" }}>
              {isThisSubmitted ? (
                <Text style={{ fontSize: 8, fontWeight: 600, color: colors.primary }}>Requested</Text>
              ) : (
                renderVariantPrice(v)
              )}
              {renderRefund(refundText)}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SegmentView({ segment, photos, showPricing = true, timeFormat = "24h", variants, isApproved }: { segment: TripSegment; photos?: ResolvedPhoto[]; showPricing?: boolean; timeFormat?: string; variants?: SegmentVariant[]; isApproved?: boolean }) {
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
      if (depTime) details.push(`Departs: ${fmtTime(depTime, timeFormat)} local`);
      const arrTime = meta.arrival?.scheduledTime || meta.arrivalTime || "";
      if (arrTime) details.push(`Arrives: ${fmtTime(arrTime, timeFormat)} local`);
      const _selectedCabin = isApproved && variants
        ? (() => {
            const sel = variants.find(v => v.isSelected);
            return sel ? (bookingClassLabelsPdf[(sel as any).bookingClass] || bookingClassLabelsPdf[(sel as any).cabin] || null) : null;
          })()
        : null;
      const _cabinDisplay = _selectedCabin || (meta.bookingClass ? (bookingClassLabels[meta.bookingClass] || meta.bookingClass) : null);
      if (_cabinDisplay) details.push(`Class: ${_cabinDisplay}`);
      if (meta.status && meta.status !== "Scheduled") details.push(`Status: ${meta.status}`);
      if (meta.aircraft) details.push(`Aircraft: ${meta.aircraft}`);
      const fQty = meta.quantity || 1;
      const fPpu = meta.pricePerUnit;
      if (fQty > 1) details.push(`${fQty} passengers`);
      if (fPpu && fPpu > 0 && fQty > 1) details.push(`${formatCurrency(fPpu, segment.currency || "USD")} per passenger`);
    } else if (segment.type === "charter" || segment.type === "charter_flight") {
      title = meta.operator || "Private Charter";
      const dep = meta.departureLocation || "";
      const arr = meta.arrivalLocation || "";
      if (dep && arr) details.push(`${dep} > ${arr}`);
      if (meta.departureTime) details.push(`Departs: ${fmtTime(meta.departureTime, timeFormat)} local`);
      if (meta.arrivalTime) details.push(`Arrives: ${fmtTime(meta.arrivalTime, timeFormat)} local`);
      if (meta.aircraftType) details.push(`Aircraft: ${meta.aircraftType}`);
      if (meta.fboHandler) details.push(`FBO: ${meta.fboHandler}`);
      details.push("Charter");
    } else if (segment.type === "hotel") {
      title = meta.hotelName || segment.title || "Hotel";
      const _selectedRoomLabel = isApproved && variants
        ? (() => {
            const sel = variants.find(v => v.isSelected);
            return sel?.label || null;
          })()
        : null;
      if (meta.checkIn && meta.checkOut) details.push(`${meta.checkIn} > ${meta.checkOut}`);
      const roomDisplay = _selectedRoomLabel || meta.roomType || "";
      if (roomDisplay) details.push(`Room: ${roomDisplay}`);
      if (meta.address) details.push(meta.address);
      if (meta.starRating && Number(meta.starRating) > 0) {
        const starWords: Record<number, string> = { 1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five" };
        const rating = Number(meta.starRating);
        details.push(`${starWords[rating] || rating}-Star Hotel`);
      }
      const hQty = meta.quantity || 1;
      const hPpu = meta.pricePerUnit;
      if (hQty > 1) details.push(`${hQty} rooms`);
      if (hPpu && hPpu > 0 && hQty > 1) details.push(`${formatCurrency(hPpu, segment.currency || "USD")} per room / night`);
    } else if (segment.type === "restaurant") {
      title = meta.restaurantName || segment.title || "Restaurant";
      if (segment.startTime) details.push(`Time: ${fmtTime(segment.startTime, timeFormat)}`);
      if (meta.partySize) details.push(`Party: ${meta.partySize} guests`);
      if (meta.address) details.push(meta.address);
      if (meta.cuisine) details.push(`Cuisine: ${meta.cuisine}`);
    } else if (segment.type === "activity") {
      title = meta.activityName || segment.title || "Activity";
      if (segment.startTime) details.push(`Time: ${fmtTime(segment.startTime, timeFormat)}`);
      if (meta.location) details.push(meta.location);
      if (meta.duration) details.push(`Duration: ${meta.duration}`);
    } else if (segment.type === "transport") {
      title = meta.provider || meta.transportType || segment.title || "Transport";
      const pickup = meta.pickupLocation || "";
      const dropoff = meta.dropoffLocation || "";
      if (pickup && dropoff) details.push(`${pickup} > ${dropoff}`);
      if (segment.startTime) details.push(`Time: ${fmtTime(segment.startTime, timeFormat)}`);
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
      {(() => {
        let displayCost: number | null = segment.cost ?? null;
        let costLabel: string | null = null;

        if (segment.hasVariants && variants && variants.length > 0) {
          const selVariant = variants.find(v => v.isSelected);
          if (selVariant) {
            displayCost = selVariant.cost ?? null;
          } else {
            if (isApproved) {
              displayCost = segment.cost ?? null;
            } else {
              costLabel = "TBD";
              displayCost = null;
            }
          }
        }

        const showCostRow = confNum || (showPricing && (displayCost != null && displayCost > 0 || costLabel));
        if (!showCostRow) return null;

        return (
          <View style={{ flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, marginTop: 4 }}>
            {confNum ? (
              <Text style={s.segmentConfirmation}>Confirmation: {confNum}</Text>
            ) : <Text />}
            {showPricing && (
              costLabel === "TBD" ? (
                <Text style={{ fontSize: 9, color: colors.muted, fontStyle: "italic" as const }}>TBD</Text>
              ) : displayCost != null && displayCost > 0 ? (
                <Text style={{ fontSize: 9, fontWeight: 600, color: colors.text }}>
                  {formatCurrency(displayCost, segment.currency || "USD")}
                </Text>
              ) : null
            )}
          </View>
        );
      })()}
      {segment.notes ? <Text style={s.segmentNotes}>{segment.notes}</Text> : null}
      {(() => {
        const refundText = formatRefundability(
          meta.refundability || segment.refundability,
          meta.refundDeadline || segment.refundDeadline
        );
        return refundText ? <Text style={s.refundLine}>{refundText}</Text> : null;
      })()}
      {photos && photos.length > 0 ? (
        <View style={{ flexDirection: "row", gap: 4, marginTop: 6 }}>
          {photos.map((p, i) => (
            <Image key={i} src={p.dataUri} style={{ width: 60, height: 60, borderRadius: 3 }} />
          ))}
        </View>
      ) : null}
      {segment.hasVariants && variants && variants.length > 0 ? (
        <VariantDisplay variants={variants} showPricing={showPricing} primarySegment={segment} isApproved={isApproved} />
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

function JourneyPdfView({ legs, showPricing = true, timeFormat = "24h", variantMap, isApproved }: { legs: TripSegment[]; showPricing?: boolean; timeFormat?: string; variantMap?: Map<string, SegmentVariant[]>; isApproved?: boolean }) {
  const firstMeta = (legs[0].metadata || {}) as Record<string, any>;
  const lastMeta = (legs[legs.length - 1].metadata || {}) as Record<string, any>;
  const originIata = firstMeta.departure?.iata || firstMeta.departureAirport || "";
  const destIata = lastMeta.arrival?.iata || lastMeta.arrivalAirport || "";
  const stopsCount = legs.length - 1;
  const firstLegVariants = variantMap?.get(legs[0].id);

  let journeyDisplayCost: number | null = null;
  let journeyIsTbd = false;
  if (firstLegVariants && firstLegVariants.length > 0) {
    const selVariant = firstLegVariants.find(v => v.isSelected);
    if (selVariant) {
      journeyDisplayCost = selVariant.cost ?? null;
    } else if (isApproved) {
      journeyDisplayCost = legs.reduce((sum, leg) => sum + (leg.cost || 0), 0) || null;
    } else {
      journeyIsTbd = true;
    }
  } else {
    journeyDisplayCost = legs.reduce((sum, leg) => sum + (leg.cost || 0), 0) || null;
    if (journeyDisplayCost === 0) journeyDisplayCost = null;
  }

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
        let bClass = meta.bookingClass ? (bookingClassLabels[meta.bookingClass] || meta.bookingClass) : "";
        if (isApproved && i === 0 && firstLegVariants) {
          const selVariant = firstLegVariants.find(v => v.isSelected);
          if (selVariant) {
            const selCabin = bookingClassLabelsPdf[(selVariant as any).bookingClass] || bookingClassLabelsPdf[(selVariant as any).cabin];
            if (selCabin) bClass = selCabin;
          }
        }

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
                <Text style={s.segmentDetail}>{depIata} {">"} {arrIata}{depTime ? ` | ${fmtTime(depTime, timeFormat)}` : ""}{arrTime ? ` - ${fmtTime(arrTime, timeFormat)}` : ""}</Text>
              )}
              {confNum ? <Text style={s.segmentConfirmation}>Confirmation: {confNum}</Text> : null}
            </View>
          </View>
        );
      })}
      {showPricing && (journeyIsTbd || (journeyDisplayCost != null && journeyDisplayCost > 0)) && (
        <View style={{ flexDirection: "row" as const, justifyContent: "flex-end" as const, marginTop: 4 }}>
          {journeyIsTbd ? (
            <Text style={{ fontSize: 9, color: colors.muted, fontStyle: "italic" as const }}>TBD</Text>
          ) : (
            <Text style={{ fontSize: 9, fontWeight: 600, color: colors.text }}>
              {formatCurrency(journeyDisplayCost!, legs[0].currency || "USD")}
            </Text>
          )}
        </View>
      )}
      {legs[0].hasVariants && firstLegVariants && firstLegVariants.length > 0 && (() => {
        const journeyTotalCost = legs.reduce((sum, leg) => sum + (leg.cost || 0), 0);
        return (
          <VariantDisplay
            variants={firstLegVariants}
            showPricing={showPricing}
            primarySegment={legs[0]}
            journeyLegs={legs}
            primaryCost={journeyTotalCost > 0 ? journeyTotalCost : undefined}
            isApproved={isApproved}
          />
        );
      })()}
    </View>
  );
}

type PdfDayRenderItem =
  | { kind: "segment"; segment: TripSegment }
  | { kind: "journey"; journeyId: string; legs: TripSegment[] }
  | { kind: "choiceGroup"; choiceGroupId: string; options: TripSegment[] };

function buildPdfDayItems(daySegments: TripSegment[]): PdfDayRenderItem[] {
  const items: PdfDayRenderItem[] = [];
  const seenJourneyIds = new Set<string>();
  const seenChoiceGroupIds = new Set<string>();
  const journeyGroups = new Map<string, TripSegment[]>();
  const choiceGroups = new Map<string, TripSegment[]>();

  for (const seg of daySegments) {
    if (seg.journeyId) {
      if (!journeyGroups.has(seg.journeyId)) journeyGroups.set(seg.journeyId, []);
      journeyGroups.get(seg.journeyId)!.push(seg);
    }
    if (seg.choiceGroupId) {
      if (!choiceGroups.has(seg.choiceGroupId)) choiceGroups.set(seg.choiceGroupId, []);
      choiceGroups.get(seg.choiceGroupId)!.push(seg);
    }
  }

  for (const seg of daySegments) {
    if (seg.journeyId && (journeyGroups.get(seg.journeyId)?.length ?? 0) > 1) {
      if (!seenJourneyIds.has(seg.journeyId)) {
        seenJourneyIds.add(seg.journeyId);
        const legs = journeyGroups.get(seg.journeyId)!;
        legs.sort((a, b) => ((a.metadata as any)?.legNumber || 0) - ((b.metadata as any)?.legNumber || 0));
        items.push({ kind: "journey", journeyId: seg.journeyId, legs });
      }
    } else if (seg.choiceGroupId && (choiceGroups.get(seg.choiceGroupId)?.length ?? 0) > 1) {
      if (!seenChoiceGroupIds.has(seg.choiceGroupId)) {
        seenChoiceGroupIds.add(seg.choiceGroupId);
        const options = choiceGroups.get(seg.choiceGroupId)!;
        options.sort((a, b) => a.sortOrder - b.sortOrder);
        items.push({ kind: "choiceGroup", choiceGroupId: seg.choiceGroupId, options });
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
  advisor: { fullName: string; email?: string | null; phone?: string | null; website?: string | null; timeFormat?: string } | null;
  client: { fullName: string } | null;
  companions?: { id: string; fullName: string }[];
  version: TripVersion;
  segments: TripSegment[];
}

function fmtTime(t: string | null | undefined, tf: string): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr), m = parseInt(mStr);
  if (isNaN(h) || isNaN(m)) return t || "";
  if (tf !== "12h") return t;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function PropertyGroupView({ groupSegments, showPricing, timeFormat, photoMap, variantMap, isApproved }: { groupSegments: TripSegment[]; showPricing: boolean; timeFormat: string; photoMap: Map<string, ResolvedPhoto[]>; variantMap: Map<string, SegmentVariant[]>; isApproved?: boolean }) {
  const firstMeta = (groupSegments[0].metadata || {}) as Record<string, any>;
  const hotelName = firstMeta.hotelName || groupSegments[0].title || "Hotel";
  const combinedTotal = groupSegments.reduce((sum, seg) => sum + (seg.cost || 0), 0);
  const currency = groupSegments.find(seg => seg.currency)?.currency || "USD";

  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={s.propertyGroupHeader}>{hotelName}</Text>
      {groupSegments.map((seg) => (
        <SegmentView key={seg.id} segment={seg} photos={photoMap.get(seg.id)} showPricing={showPricing} timeFormat={timeFormat} variants={variantMap.get(seg.id)} isApproved={isApproved} />
      ))}
      {showPricing && combinedTotal > 0 && (
        <Text style={s.propertyGroupTotal}>Property Total: {formatCurrency(combinedTotal, currency)}</Text>
      )}
    </View>
  );
}

function TripPdfDocument({ data, photoMap, variantMap }: { data: PdfData; photoMap: Map<string, ResolvedPhoto[]>; variantMap: Map<string, SegmentVariant[]> }) {
  const { trip, organization, advisor, client, companions, version, segments } = data;
  const showPricing = version.showPricing ?? true;
  const timeFormat = advisor?.timeFormat || "24h";
  const isApproved = !!(trip.approvedVersionId && trip.approvedVersionId === version.id);

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
          {companions && companions.length > 0 && (
            <Text style={{ fontFamily: "Serif", fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
              Traveling with: {companions.map(c => c.fullName).join(", ")}
            </Text>
          )}
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
              {(() => {
                const seenPropertyGroups = new Set<string>();
                return renderItems.map((item) => {
                  if (item.kind === "journey") {
                    return <JourneyPdfView key={`j-${item.journeyId}`} legs={item.legs} showPricing={showPricing} timeFormat={timeFormat} variantMap={variantMap} isApproved={isApproved} />;
                  }

                  if (item.kind === "choiceGroup") {
                    if (isApproved) {
                      const chosen = item.options.find(o => o.isChoiceSelected) || item.options[0];
                      return (
                        <SegmentView
                          key={`choice-approved-${chosen.id}`}
                          segment={chosen}
                          photos={photoMap.get(chosen.id)}
                          showPricing={showPricing}
                          timeFormat={timeFormat}
                          variants={variantMap.get(chosen.id)}
                          isApproved={isApproved}
                        />
                      );
                    }
                    return (
                      <View key={`choice-${item.choiceGroupId}`} style={s.choiceGroupWrapper}>
                        <Text style={s.choiceGroupLabel}>Choose one option</Text>
                        {item.options.map((option, idx) => (
                          <View key={option.id}>
                            {idx > 0 && (
                              <View style={s.orDivider}>
                                <View style={s.orDividerLine} />
                                <Text style={s.orDividerText}>OR</Text>
                                <View style={s.orDividerLine} />
                              </View>
                            )}
                            <SegmentView
                              segment={option}
                              photos={photoMap.get(option.id)}
                              showPricing={showPricing}
                              timeFormat={timeFormat}
                              variants={variantMap.get(option.id)}
                              isApproved={false}
                            />
                          </View>
                        ))}
                      </View>
                    );
                  }

                  const seg = item.segment;
                  if (seg.propertyGroupId && seg.type === "hotel") {
                    if (seenPropertyGroups.has(seg.propertyGroupId)) return null;
                    seenPropertyGroups.add(seg.propertyGroupId);
                    const groupSegs = daySegments.filter(ds => ds.propertyGroupId === seg.propertyGroupId);
                    if (groupSegs.length > 1) {
                      return <PropertyGroupView key={`pg-${seg.propertyGroupId}`} groupSegments={groupSegs} showPricing={showPricing} timeFormat={timeFormat} photoMap={photoMap} variantMap={variantMap} isApproved={isApproved} />;
                    }
                  }
                  return <SegmentView key={seg.id} segment={seg} photos={photoMap.get(seg.id)} showPricing={showPricing} timeFormat={timeFormat} variants={variantMap.get(seg.id)} isApproved={isApproved} />;
                });
              })()}
            </View>
          );
        })}

        {showPricing && (() => {
          const subtotal = isApproved
            ? segments.reduce((sum, seg) => {
                if (seg.choiceGroupId && !seg.isChoiceSelected) return sum;
                if (seg.hasVariants) {
                  const segVariants = variantMap.get(seg.id);
                  const sel = segVariants?.find(v => v.isSelected);
                  if (sel && sel.cost != null) return sum + sel.cost;
                }
                return sum + (seg.cost || 0);
              }, 0)
            : segments.reduce((sum, seg) => {
                if (seg.choiceGroupId && !seg.isChoiceSelected) {
                  const groupHasSelection = segments.some(
                    s => s.choiceGroupId === seg.choiceGroupId && s.isChoiceSelected
                  );
                  if (groupHasSelection) return sum;
                }
                return sum + (seg.cost || 0);
              }, 0);
          if (subtotal <= 0) return null;
          const currency = segments.find(seg => seg.currency)?.currency || trip.currency || "USD";
          const vDiscount = (version as any).discount || 0;
          const vDiscountType = (version as any).discountType || "fixed";
          const vDiscountLabel = (version as any).discountLabel || "";
          const discountVal = vDiscount > 0
            ? (vDiscountType === "percent" ? Math.round(subtotal * (vDiscount / 100)) : vDiscount)
            : 0;
          const finalTotal = Math.max(0, subtotal - discountVal);
          const fmtCost = (amount: number) =>
            new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

          return (
            <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
              {discountVal > 0 ? (
                <>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontFamily: "Sans", fontSize: 9, color: colors.muted }}>Subtotal</Text>
                    <Text style={{ fontFamily: "Sans", fontSize: 9, color: colors.muted }}>{fmtCost(subtotal)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontFamily: "Sans", fontSize: 9, color: "#059669" }}>
                      {vDiscountLabel || "Discount"}{vDiscountType === "percent" ? ` (${vDiscount}%)` : ""}
                    </Text>
                    <Text style={{ fontFamily: "Sans", fontSize: 9, color: "#059669" }}>-{fmtCost(discountVal)}</Text>
                  </View>
                  <View style={{ borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontFamily: "Serif", fontSize: 12, fontWeight: 700 }}>Total</Text>
                    <Text style={{ fontFamily: "Serif", fontSize: 12, fontWeight: 700 }}>{fmtCost(finalTotal)}</Text>
                  </View>
                </>
              ) : (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: "Serif", fontSize: 12, fontWeight: 700 }}>Total</Text>
                  <Text style={{ fontFamily: "Serif", fontSize: 12, fontWeight: 700 }}>{fmtCost(subtotal)}</Text>
                </View>
              )}
            </View>
          );
        })()}

        {advisor && (
          <View style={{
            marginTop: 24,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.primary,
              justifyContent: "center",
              alignItems: "center",
            }}>
              <Text style={{ color: colors.white, fontSize: 13, fontFamily: "Serif", fontWeight: 700 }}>
                {advisor.fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Serif", fontSize: 11, fontWeight: 700, color: colors.text }}>
                {advisor.fullName}
              </Text>
              <Text style={{ fontSize: 8, color: colors.muted, marginTop: 1 }}>
                {organization.name}
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 3 }}>
                {advisor.email && (
                  <Text style={{ fontSize: 8, color: colors.muted }}>{advisor.email}</Text>
                )}
                {advisor.phone && (
                  <Text style={{ fontSize: 8, color: colors.muted }}>{advisor.phone}</Text>
                )}
                {advisor.website && (
                  <Text style={{ fontSize: 8, color: colors.primary }}>{advisor.website}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        <Text style={s.footer} fixed>
          {organization.name} - Generated by Travel Lab
        </Text>
      </Page>
    </Document>
  );
}

async function resolveVariants(segments: TripSegment[]): Promise<Map<string, SegmentVariant[]>> {
  const variantMap = new Map<string, SegmentVariant[]>();
  const variantSegments = segments.filter(seg => seg.hasVariants);
  if (variantSegments.length === 0) return variantMap;

  const tasks = variantSegments.map(async (seg) => {
    try {
      const variants = await db.select().from(segmentVariants).where(eq(segmentVariants.segmentId, seg.id));
      if (variants.length > 0) {
        variants.sort((a, b) => a.sortOrder - b.sortOrder);
        variantMap.set(seg.id, variants);
      }
    } catch (err) {
      console.warn(`[PDF] Failed to fetch variants for segment ${seg.id}:`, err);
    }
  });

  await Promise.all(tasks);
  return variantMap;
}

export async function generateTripPdf(data: PdfData): Promise<NodeJS.ReadableStream> {
  if (!data.segments) data.segments = [];
  if (!data.version) throw new Error("No version provided for PDF generation");
  if (!data.trip) throw new Error("No trip provided for PDF generation");

  let photoMap = new Map<string, ResolvedPhoto[]>();
  let variantMap = new Map<string, SegmentVariant[]>();
  try {
    [photoMap, variantMap] = await Promise.all([
      resolveSegmentPhotos(data.segments),
      resolveVariants(data.segments),
    ]);
  } catch (err) {
    console.warn("[PDF] Failed to resolve photos/variants:", err);
  }

  return ReactPDF.renderToStream(<TripPdfDocument data={data} photoMap={photoMap} variantMap={variantMap} />);
}
