import {
  organizations, profiles, trips,
  type Organization, type InsertOrganization,
  type Profile, type InsertProfile,
  type Trip, type InsertTrip,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, count, sql, or, ilike } from "drizzle-orm";

export interface IStorage {
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;

  createProfile(profile: InsertProfile): Promise<Profile>;
  getProfile(userId: string): Promise<Profile | undefined>;
  getProfilesByOrg(orgId: string): Promise<Profile[]>;
  getClientsByOrg(orgId: string): Promise<Profile[]>;
  countAdvisorsByOrg(orgId: string): Promise<number>;
  countClientsByOrg(orgId: string): Promise<number>;

  createTrip(trip: InsertTrip): Promise<Trip>;
  getTrip(id: string, orgId: string): Promise<Trip | undefined>;
  getTripsByOrg(orgId: string): Promise<Trip[]>;
  updateTrip(id: string, orgId: string, data: Partial<InsertTrip>): Promise<Trip | undefined>;
  deleteTrip(id: string, orgId: string): Promise<boolean>;
  countTripsByOrg(orgId: string): Promise<number>;
  countActiveTripsByOrg(orgId: string): Promise<number>;

  countCompletedTripsByOrg(orgId: string): Promise<number>;
  getRecentTripsWithClient(orgId: string, limit?: number): Promise<(Trip & { clientName: string | null })[]>;
  getStats(orgId: string): Promise<{ totalTrips: number; activeTrips: number; completedTrips: number; totalClients: number }>;
}

export class DatabaseStorage implements IStorage {
  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [result] = await db.insert(organizations).values(org).returning();
    return result;
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [result] = await db.select().from(organizations).where(eq(organizations.id, id));
    return result;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [result] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    return result;
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const [result] = await db.insert(profiles).values(profile).returning();
    return result;
  }

  async getProfile(userId: string): Promise<Profile | undefined> {
    const [result] = await db.select().from(profiles).where(eq(profiles.id, userId));
    return result;
  }

  async getProfilesByOrg(orgId: string): Promise<Profile[]> {
    return db.select().from(profiles).where(eq(profiles.orgId, orgId));
  }

  async getClientsByOrg(orgId: string): Promise<Profile[]> {
    return db.select().from(profiles).where(
      and(eq(profiles.orgId, orgId), eq(profiles.role, "client"))
    );
  }

  async countAdvisorsByOrg(orgId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(profiles)
      .where(and(eq(profiles.orgId, orgId), eq(profiles.role, "advisor")));
    return result.count;
  }

  async countClientsByOrg(orgId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(profiles)
      .where(and(eq(profiles.orgId, orgId), eq(profiles.role, "client")));
    return result.count;
  }

  async createTrip(trip: InsertTrip): Promise<Trip> {
    const [result] = await db.insert(trips).values(trip).returning();
    return result;
  }

  async getTrip(id: string, orgId: string): Promise<Trip | undefined> {
    const [result] = await db.select().from(trips).where(
      and(eq(trips.id, id), eq(trips.orgId, orgId))
    );
    return result;
  }

  async getTripsByOrg(orgId: string): Promise<Trip[]> {
    return db.select().from(trips).where(eq(trips.orgId, orgId)).orderBy(sql`${trips.createdAt} DESC`);
  }

  async updateTrip(id: string, orgId: string, data: Partial<InsertTrip>): Promise<Trip | undefined> {
    const [result] = await db
      .update(trips)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(trips.id, id), eq(trips.orgId, orgId)))
      .returning();
    return result;
  }

  async deleteTrip(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(trips).where(
      and(eq(trips.id, id), eq(trips.orgId, orgId))
    ).returning();
    return result.length > 0;
  }

  async countTripsByOrg(orgId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(trips).where(eq(trips.orgId, orgId));
    return result.count;
  }

  async countActiveTripsByOrg(orgId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(trips)
      .where(
        and(
          eq(trips.orgId, orgId),
          or(eq(trips.status, "planning"), eq(trips.status, "confirmed"), eq(trips.status, "in_progress"))
        )
      );
    return result.count;
  }

  async countCompletedTripsByOrg(orgId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(trips)
      .where(and(eq(trips.orgId, orgId), eq(trips.status, "completed")));
    return result.count;
  }

  async getRecentTripsWithClient(orgId: string, limit = 5): Promise<(Trip & { clientName: string | null })[]> {
    const rows = await db
      .select({
        trip: trips,
        clientName: profiles.fullName,
      })
      .from(trips)
      .leftJoin(profiles, eq(trips.clientId, profiles.id))
      .where(eq(trips.orgId, orgId))
      .orderBy(sql`${trips.createdAt} DESC`)
      .limit(limit);
    return rows.map((r) => ({ ...r.trip, clientName: r.clientName }));
  }

  async getStats(orgId: string): Promise<{ totalTrips: number; activeTrips: number; completedTrips: number; totalClients: number }> {
    const [totalTrips, activeTrips, completedTrips, totalClients] = await Promise.all([
      this.countTripsByOrg(orgId),
      this.countActiveTripsByOrg(orgId),
      this.countCompletedTripsByOrg(orgId),
      this.countClientsByOrg(orgId),
    ]);
    return { totalTrips, activeTrips, completedTrips, totalClients };
  }
}

export const storage = new DatabaseStorage();
