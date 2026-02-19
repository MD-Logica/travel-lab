import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
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

export const tripsRelations = relations(trips, ({ one }) => ({
  organization: one(organizations, {
    fields: [trips.orgId],
    references: [organizations.id],
  }),
  client: one(clients, {
    fields: [trips.clientId],
    references: [clients.id],
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
export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;
