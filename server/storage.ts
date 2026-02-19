import {
  organizations, profiles, clients, trips, tripVersions, tripSegments,
  type Organization, type InsertOrganization,
  type Profile, type InsertProfile,
  type Client, type InsertClient,
  type Trip, type InsertTrip,
  type TripVersion, type InsertTripVersion,
  type TripSegment, type InsertTripSegment,
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

  createClient(client: InsertClient): Promise<Client>;
  getClient(id: string, orgId: string): Promise<Client | undefined>;
  getClientsByOrgWithTripCount(orgId: string): Promise<(Client & { tripCount: number })[]>;
  updateClient(id: string, orgId: string, data: Partial<InsertClient>): Promise<Client | undefined>;
  countClientsByOrgNew(orgId: string): Promise<number>;

  getTripsByClient(clientId: string, orgId: string): Promise<Trip[]>;

  createTrip(trip: InsertTrip): Promise<Trip>;
  getTrip(id: string, orgId: string): Promise<Trip | undefined>;
  getTripsByOrg(orgId: string): Promise<Trip[]>;
  updateTrip(id: string, orgId: string, data: Partial<InsertTrip>): Promise<Trip | undefined>;
  deleteTrip(id: string, orgId: string): Promise<boolean>;
  countTripsByOrg(orgId: string): Promise<number>;
  countActiveTripsByOrg(orgId: string): Promise<number>;

  countCompletedTripsByOrg(orgId: string): Promise<number>;
  getRecentTripsWithClient(orgId: string, limit?: number): Promise<(Trip & { clientName: string | null })[]>;
  getTripsWithClientByOrg(orgId: string): Promise<(Trip & { clientName: string | null })[]>;
  getStats(orgId: string): Promise<{ totalTrips: number; activeTrips: number; completedTrips: number; totalClients: number }>;

  createTripVersion(version: InsertTripVersion): Promise<TripVersion>;
  getTripVersions(tripId: string, orgId: string): Promise<TripVersion[]>;
  updateTripVersion(id: string, orgId: string, data: Partial<InsertTripVersion>): Promise<TripVersion | undefined>;
  deleteTripVersion(id: string, orgId: string): Promise<boolean>;
  duplicateTripVersion(sourceVersionId: string, tripId: string, orgId: string, newName: string): Promise<TripVersion>;
  setTripVersionPrimary(versionId: string, tripId: string, orgId: string): Promise<void>;

  createTripSegment(segment: InsertTripSegment): Promise<TripSegment>;
  getTripSegments(versionId: string, orgId: string): Promise<TripSegment[]>;
  updateTripSegment(id: string, orgId: string, data: Partial<InsertTripSegment>): Promise<TripSegment | undefined>;
  deleteTripSegment(id: string, orgId: string): Promise<boolean>;
  reorderTripSegments(versionId: string, orgId: string, segmentIds: string[]): Promise<void>;

  getTripWithClient(id: string, orgId: string): Promise<(Trip & { clientName: string | null }) | undefined>;
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

  async createClient(client: InsertClient): Promise<Client> {
    const [result] = await db.insert(clients).values(client).returning();
    return result;
  }

  async getClient(id: string, orgId: string): Promise<Client | undefined> {
    const [result] = await db.select().from(clients).where(
      and(eq(clients.id, id), eq(clients.orgId, orgId))
    );
    return result;
  }

  async getClientsByOrgWithTripCount(orgId: string): Promise<(Client & { tripCount: number })[]> {
    const rows = await db
      .select({
        client: clients,
        tripCount: sql<number>`cast(count(${trips.id}) as int)`,
      })
      .from(clients)
      .leftJoin(trips, eq(clients.id, trips.clientId))
      .where(eq(clients.orgId, orgId))
      .groupBy(clients.id)
      .orderBy(sql`${clients.fullName} ASC`);
    return rows.map((r) => ({ ...r.client, tripCount: r.tripCount }));
  }

  async updateClient(id: string, orgId: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const [result] = await db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(clients.id, id), eq(clients.orgId, orgId)))
      .returning();
    return result;
  }

  async countClientsByOrgNew(orgId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(clients).where(eq(clients.orgId, orgId));
    return result.count;
  }

  async getTripsByClient(clientId: string, orgId: string): Promise<Trip[]> {
    return db.select().from(trips).where(
      and(eq(trips.clientId, clientId), eq(trips.orgId, orgId))
    ).orderBy(sql`${trips.createdAt} DESC`);
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
        clientName: clients.fullName,
      })
      .from(trips)
      .leftJoin(clients, eq(trips.clientId, clients.id))
      .where(eq(trips.orgId, orgId))
      .orderBy(sql`${trips.createdAt} DESC`)
      .limit(limit);
    return rows.map((r) => ({ ...r.trip, clientName: r.clientName }));
  }

  async getTripsWithClientByOrg(orgId: string): Promise<(Trip & { clientName: string | null })[]> {
    const rows = await db
      .select({
        trip: trips,
        clientName: clients.fullName,
      })
      .from(trips)
      .leftJoin(clients, eq(trips.clientId, clients.id))
      .where(eq(trips.orgId, orgId))
      .orderBy(sql`${trips.createdAt} DESC`);
    return rows.map((r) => ({ ...r.trip, clientName: r.clientName }));
  }

  async createTripVersion(version: InsertTripVersion): Promise<TripVersion> {
    const [result] = await db.insert(tripVersions).values(version).returning();
    return result;
  }

  async getTripVersions(tripId: string, orgId: string): Promise<TripVersion[]> {
    return db.select().from(tripVersions).where(
      and(eq(tripVersions.tripId, tripId), eq(tripVersions.orgId, orgId))
    ).orderBy(sql`${tripVersions.versionNumber} ASC`);
  }

  async getStats(orgId: string): Promise<{ totalTrips: number; activeTrips: number; completedTrips: number; totalClients: number }> {
    const [totalTrips, activeTrips, completedTrips, totalClients] = await Promise.all([
      this.countTripsByOrg(orgId),
      this.countActiveTripsByOrg(orgId),
      this.countCompletedTripsByOrg(orgId),
      this.countClientsByOrgNew(orgId),
    ]);
    return { totalTrips, activeTrips, completedTrips, totalClients };
  }

  async updateTripVersion(id: string, orgId: string, data: Partial<InsertTripVersion>): Promise<TripVersion | undefined> {
    const [result] = await db
      .update(tripVersions)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(tripVersions.id, id), eq(tripVersions.orgId, orgId)))
      .returning();
    return result;
  }

  async deleteTripVersion(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(tripVersions).where(
      and(eq(tripVersions.id, id), eq(tripVersions.orgId, orgId))
    ).returning();
    return result.length > 0;
  }

  async duplicateTripVersion(sourceVersionId: string, tripId: string, orgId: string, newName: string): Promise<TripVersion> {
    const existingVersions = await this.getTripVersions(tripId, orgId);
    const nextNumber = existingVersions.length > 0
      ? Math.max(...existingVersions.map(v => v.versionNumber)) + 1
      : 1;

    const newVersion = await this.createTripVersion({
      tripId,
      orgId,
      versionNumber: nextNumber,
      name: newName,
      isPrimary: false,
    });

    const sourceSegments = await this.getTripSegments(sourceVersionId, orgId);
    for (const seg of sourceSegments) {
      await this.createTripSegment({
        versionId: newVersion.id,
        tripId,
        orgId,
        dayNumber: seg.dayNumber,
        sortOrder: seg.sortOrder,
        type: seg.type,
        title: seg.title,
        subtitle: seg.subtitle,
        startTime: seg.startTime,
        endTime: seg.endTime,
        confirmationNumber: seg.confirmationNumber,
        cost: seg.cost,
        currency: seg.currency,
        notes: seg.notes,
        photos: seg.photos,
        metadata: seg.metadata,
      });
    }

    return newVersion;
  }

  async setTripVersionPrimary(versionId: string, tripId: string, orgId: string): Promise<void> {
    await db
      .update(tripVersions)
      .set({ isPrimary: false })
      .where(and(eq(tripVersions.tripId, tripId), eq(tripVersions.orgId, orgId)));
    await db
      .update(tripVersions)
      .set({ isPrimary: true })
      .where(and(eq(tripVersions.id, versionId), eq(tripVersions.orgId, orgId)));
  }

  async createTripSegment(segment: InsertTripSegment): Promise<TripSegment> {
    const [result] = await db.insert(tripSegments).values(segment).returning();
    return result;
  }

  async getTripSegments(versionId: string, orgId: string): Promise<TripSegment[]> {
    return db.select().from(tripSegments).where(
      and(eq(tripSegments.versionId, versionId), eq(tripSegments.orgId, orgId))
    ).orderBy(sql`${tripSegments.dayNumber} ASC, ${tripSegments.sortOrder} ASC`);
  }

  async updateTripSegment(id: string, orgId: string, data: Partial<InsertTripSegment>): Promise<TripSegment | undefined> {
    const [result] = await db
      .update(tripSegments)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(tripSegments.id, id), eq(tripSegments.orgId, orgId)))
      .returning();
    return result;
  }

  async deleteTripSegment(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(tripSegments).where(
      and(eq(tripSegments.id, id), eq(tripSegments.orgId, orgId))
    ).returning();
    return result.length > 0;
  }

  async reorderTripSegments(versionId: string, orgId: string, segmentIds: string[]): Promise<void> {
    for (let i = 0; i < segmentIds.length; i++) {
      await db
        .update(tripSegments)
        .set({ sortOrder: i })
        .where(and(eq(tripSegments.id, segmentIds[i]), eq(tripSegments.orgId, orgId)));
    }
  }

  async getTripWithClient(id: string, orgId: string): Promise<(Trip & { clientName: string | null }) | undefined> {
    const rows = await db
      .select({
        trip: trips,
        clientName: clients.fullName,
      })
      .from(trips)
      .leftJoin(clients, eq(trips.clientId, clients.id))
      .where(and(eq(trips.id, id), eq(trips.orgId, orgId)));
    if (rows.length === 0) return undefined;
    return { ...rows[0].trip, clientName: rows[0].clientName };
  }
}

export const storage = new DatabaseStorage();
