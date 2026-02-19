import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, pgEnum, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const planEnum = pgEnum("plan", ["trial", "pro", "enterprise"]);
export const planStatusEnum = pgEnum("plan_status", ["active", "past_due", "cancelled"]);
export const roleEnum = pgEnum("role", ["owner", "advisor", "assistant", "client"]);
export const tripStatusEnum = pgEnum("trip_status", ["draft", "planning", "confirmed", "in_progress", "completed", "cancelled"]);

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
  preferences: jsonb("preferences"),
  preferencesUpdatedAt: timestamp("preferences_updated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  title: text("title").notNull(),
  destination: text("destination").notNull(),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const segmentTypeEnum = pgEnum("segment_type", ["flight", "charter", "hotel", "transport", "restaurant", "activity", "note"]);

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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type TripVersion = typeof tripVersions.$inferSelect;
export type InsertTripVersion = z.infer<typeof insertTripVersionSchema>;
export type TripSegment = typeof tripSegments.$inferSelect;
export type InsertTripSegment = z.infer<typeof insertTripSegmentSchema>;
