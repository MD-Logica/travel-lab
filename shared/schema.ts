import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, pgEnum, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const planEnum = pgEnum("plan", ["trial", "pro", "enterprise"]);
export const planStatusEnum = pgEnum("plan_status", ["active", "past_due", "cancelled"]);
export const roleEnum = pgEnum("role", ["owner", "advisor", "assistant", "client"]);
export const tripStatusEnum = pgEnum("trip_status", ["draft", "planning", "confirmed", "in_progress", "completed", "cancelled", "archived"]);

export interface DestinationEntry {
  name: string;
  country?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  freeText?: boolean;
}

export function formatDestinations(destinations: DestinationEntry[] | null | undefined, fallback?: string): string {
  if (!destinations || destinations.length === 0) return fallback || "";
  return destinations.map(d => d.name).join(" · ");
}

export function formatDestinationsShort(destinations: DestinationEntry[] | null | undefined, fallback?: string, maxShow = 2): string {
  if (!destinations || destinations.length === 0) return fallback || "";
  if (destinations.length <= maxShow) return destinations.map(d => d.name).join(" · ");
  const shown = destinations.slice(0, maxShow).map(d => d.name).join(" · ");
  return `${shown} +${destinations.length - maxShow} more`;
}

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  plan: planEnum("plan").notNull().default("trial"),
  planStatus: planStatusEnum("plan_status").notNull().default("active"),
  trialEndsAt: timestamp("trial_ends_at"),
  maxAdvisors: integer("max_advisors").notNull().default(3),
  maxClients: integer("max_clients").notNull().default(50),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey(),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  role: roleEnum("role").notNull().default("owner"),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  invitedBy: varchar("invited_by"),
  website: text("website"),
  timeFormat: text("time_format").notNull().default("24h"),
  canViewAllClients: boolean("can_view_all_clients").notNull().default(false),
  preferences: jsonb("preferences").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  tags: text("tags").array(),
  avatarUrl: text("avatar_url"),
  invited: text("invited").default("no"),
  invitedAt: timestamp("invited_at"),
  assignedAdvisorId: varchar("assigned_advisor_id"),
  homeCities: jsonb("home_cities").default([]),
  preferences: jsonb("preferences"),
  preferencesUpdatedAt: timestamp("preferences_updated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clientCollaborators = pgTable("client_collaborators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  advisorId: varchar("advisor_id").notNull(),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  title: text("title").notNull(),
  destination: text("destination").notNull(),
  destinations: jsonb("destinations").$type<DestinationEntry[]>(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: tripStatusEnum("status").notNull().default("draft"),
  budget: integer("budget"),
  currency: text("currency").default("USD"),
  clientId: varchar("client_id"),
  advisorId: varchar("advisor_id"),
  notes: text("notes"),
  additionalClientIds: text("additional_client_ids").array().default(sql`'{}'`),
  shareToken: varchar("share_token").unique(),
  shareEnabled: boolean("share_enabled").notNull().default(false),
  selectionsSubmittedAt: timestamp("selections_submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tripVersions = pgTable("trip_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  versionNumber: integer("version_number").notNull().default(1),
  name: text("name").notNull().default("Version 1"),
  isPrimary: boolean("is_primary").notNull().default(true),
  showPricing: boolean("show_pricing").notNull().default(false),
  discount: integer("discount").default(0),
  discountType: varchar("discount_type").default("fixed"),
  discountLabel: text("discount_label"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const segmentTypeEnum = pgEnum("segment_type", ["flight", "charter", "charter_flight", "hotel", "transport", "restaurant", "activity", "note"]);

export const tripSegments = pgTable("trip_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  versionId: varchar("version_id").notNull().references(() => tripVersions.id, { onDelete: "cascade" }),
  tripId: varchar("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  dayNumber: integer("day_number").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  type: segmentTypeEnum("type").notNull().default("activity"),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  confirmationNumber: text("confirmation_number"),
  cost: integer("cost"),
  currency: text("currency").default("USD"),
  notes: text("notes"),
  photos: text("photos").array(),
  metadata: jsonb("metadata"),
  journeyId: varchar("journey_id"),
  hasVariants: boolean("has_variants").notNull().default(false),
  quantity: integer("quantity").default(1),
  pricePerUnit: integer("price_per_unit"),
  refundability: text("refundability").default("unknown"),
  refundDeadline: timestamp("refund_deadline"),
  propertyGroupId: varchar("property_group_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const segmentVariants = pgTable("segment_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  segmentId: varchar("segment_id").notNull().references(() => tripSegments.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  label: text("label").notNull(),
  description: text("description"),
  cost: integer("cost"),
  currency: text("currency").default("USD"),
  pricePerUnit: integer("price_per_unit"),
  quantity: integer("quantity").default(1),
  refundability: text("refundability").default("unknown"),
  refundDeadline: timestamp("refund_deadline"),
  metadata: jsonb("metadata"),
  isSelected: boolean("is_selected").notNull().default(false),
  isSubmitted: boolean("is_submitted").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSegmentVariantSchema = createInsertSchema(segmentVariants).omit({
  id: true,
  createdAt: true,
});

export type SegmentVariant = typeof segmentVariants.$inferSelect;
export type InsertSegmentVariant = z.infer<typeof insertSegmentVariantSchema>;

export const segmentVariantsRelations = relations(segmentVariants, ({ one }) => ({
  segment: one(tripSegments, {
    fields: [segmentVariants.segmentId],
    references: [tripSegments.id],
  }),
  organization: one(organizations, {
    fields: [segmentVariants.orgId],
    references: [organizations.id],
  }),
}));

export const tripDocuments = pgTable("trip_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  tripId: varchar("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").references(() => clients.id),
  uploadedBy: varchar("uploaded_by").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storagePath: text("storage_path").notNull(),
  label: text("label").notNull(),
  isVisibleToClient: boolean("is_visible_to_client").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const flightTracking = pgTable("flight_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  segmentId: varchar("segment_id").notNull().references(() => tripSegments.id, { onDelete: "cascade" }),
  tripId: varchar("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  flightNumber: text("flight_number").notNull(),
  flightDate: text("flight_date").notNull(),
  scheduledDeparture: text("scheduled_departure"),
  scheduledArrival: text("scheduled_arrival"),
  lastStatus: jsonb("last_status"),
  lastCheckedAt: timestamp("last_checked_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  profileId: varchar("profile_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const segmentTemplates = pgTable("segment_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull(),
  type: segmentTypeEnum("type").notNull(),
  label: text("label").notNull(),
  data: jsonb("data").notNull(),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  lastMessagePreview: text("last_message_preview"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  senderType: text("sender_type").notNull(),
  senderId: varchar("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  seenAt: timestamp("seen_at"),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"),
  attachmentName: text("attachment_name"),
  messageType: text("message_type").default("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export const messageReactions = pgTable("message_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  reactorType: text("reactor_type").notNull(),
  reactorId: varchar("reactor_id").notNull(),
  reactorName: text("reactor_name").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type MessageReaction = typeof messageReactions.$inferSelect;

export const clientChatTokens = pgTable("client_chat_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  tripId: varchar("trip_id").notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ClientChatToken = typeof clientChatTokens.$inferSelect;

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [conversations.orgId],
    references: [organizations.id],
  }),
  client: one(clients, {
    fields: [conversations.clientId],
    references: [clients.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  organization: one(organizations, {
    fields: [messages.orgId],
    references: [organizations.id],
  }),
}));

export const insertFlightTrackingSchema = createInsertSchema(flightTracking).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertSegmentTemplateSchema = createInsertSchema(segmentTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FlightTracking = typeof flightTracking.$inferSelect;
export type InsertFlightTracking = z.infer<typeof insertFlightTrackingSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type SegmentTemplate = typeof segmentTemplates.$inferSelect;
export type InsertSegmentTemplate = z.infer<typeof insertSegmentTemplateSchema>;

export const flightTrackingRelations = relations(flightTracking, ({ one }) => ({
  segment: one(tripSegments, {
    fields: [flightTracking.segmentId],
    references: [tripSegments.id],
  }),
  trip: one(trips, {
    fields: [flightTracking.tripId],
    references: [trips.id],
  }),
  organization: one(organizations, {
    fields: [flightTracking.orgId],
    references: [organizations.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organization: one(organizations, {
    fields: [notifications.orgId],
    references: [organizations.id],
  }),
}));

export const tripDocumentsRelations = relations(tripDocuments, ({ one }) => ({
  trip: one(trips, {
    fields: [tripDocuments.tripId],
    references: [trips.id],
  }),
  client: one(clients, {
    fields: [tripDocuments.clientId],
    references: [clients.id],
  }),
  organization: one(organizations, {
    fields: [tripDocuments.orgId],
    references: [organizations.id],
  }),
}));

export const insertTripDocumentSchema = createInsertSchema(tripDocuments).omit({
  id: true,
  createdAt: true,
});

export type TripDocument = typeof tripDocuments.$inferSelect;
export type InsertTripDocument = z.infer<typeof insertTripDocumentSchema>;

export const organizationsRelations = relations(organizations, ({ many }) => ({
  profiles: many(profiles),
  clients: many(clients),
  trips: many(trips),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  organization: one(organizations, {
    fields: [profiles.orgId],
    references: [organizations.id],
  }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clients.orgId],
    references: [organizations.id],
  }),
  trips: many(trips),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [trips.orgId],
    references: [organizations.id],
  }),
  client: one(clients, {
    fields: [trips.clientId],
    references: [clients.id],
  }),
  versions: many(tripVersions),
}));

export const tripVersionsRelations = relations(tripVersions, ({ one, many }) => ({
  trip: one(trips, {
    fields: [tripVersions.tripId],
    references: [trips.id],
  }),
  organization: one(organizations, {
    fields: [tripVersions.orgId],
    references: [organizations.id],
  }),
  segments: many(tripSegments),
}));

export const tripSegmentsRelations = relations(tripSegments, ({ one }) => ({
  version: one(tripVersions, {
    fields: [tripSegments.versionId],
    references: [tripVersions.id],
  }),
  trip: one(trips, {
    fields: [tripSegments.tripId],
    references: [trips.id],
  }),
  organization: one(organizations, {
    fields: [tripSegments.orgId],
    references: [organizations.id],
  }),
}));

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTripSchema = createInsertSchema(trips).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type ClientCollaborator = typeof clientCollaborators.$inferSelect;
export const insertClientCollaboratorSchema = createInsertSchema(clientCollaborators).omit({
  id: true,
  createdAt: true,
});
export type InsertClientCollaborator = z.infer<typeof insertClientCollaboratorSchema>;
export const insertTripVersionSchema = createInsertSchema(tripVersions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTripSegmentSchema = createInsertSchema(tripSegments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "expired", "cancelled"]);

export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  email: text("email").notNull(),
  role: roleEnum("role").notNull().default("advisor"),
  token: varchar("token").notNull().unique(),
  status: invitationStatusEnum("status").notNull().default("pending"),
  invitedBy: varchar("invited_by").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
});

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.orgId],
    references: [organizations.id],
  }),
}));

export const clientRelationships = pgTable("client_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  clientIdA: varchar("client_id_a").notNull().references(() => clients.id, { onDelete: "cascade" }),
  clientIdB: varchar("client_id_b").notNull().references(() => clients.id, { onDelete: "cascade" }),
  relationshipLabel: text("relationship_label"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientRelationshipSchema = createInsertSchema(clientRelationships).omit({
  id: true,
  createdAt: true,
});

export type ClientRelationship = typeof clientRelationships.$inferSelect;
export type InsertClientRelationship = z.infer<typeof insertClientRelationshipSchema>;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  orgId: varchar("org_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type TripVersion = typeof tripVersions.$inferSelect;
export type InsertTripVersion = z.infer<typeof insertTripVersionSchema>;
export type TripSegment = typeof tripSegments.$inferSelect;
export type InsertTripSegment = z.infer<typeof insertTripSegmentSchema>;
