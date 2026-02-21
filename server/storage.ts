import {
  organizations, profiles, clients, trips, tripVersions, tripSegments, tripDocuments,
  flightTracking, notifications, segmentTemplates, conversations, messages, pushSubscriptions,
  invitations, clientCollaborators, clientRelationships, segmentVariants,
  messageReactions, clientChatTokens,
  type Organization, type InsertOrganization,
  type Profile, type InsertProfile,
  type Client, type InsertClient,
  type Trip, type InsertTrip,
  type TripVersion, type InsertTripVersion,
  type TripSegment, type InsertTripSegment,
  type TripDocument, type InsertTripDocument,
  type FlightTracking, type InsertFlightTracking,
  type Notification, type InsertNotification,
  type SegmentTemplate, type InsertSegmentTemplate,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage,
  type MessageReaction,
  type PushSubscription,
  type Invitation, type InsertInvitation,
  type ClientCollaborator, type InsertClientCollaborator,
  type SegmentVariant, type InsertSegmentVariant,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, count, sql, or, ilike, desc, inArray, isNull, gt } from "drizzle-orm";
import crypto from "crypto";

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
  getTripsWithClientByOrg(orgId: string, excludeStatus?: string): Promise<(Trip & { clientName: string | null })[]>;
  getTripsWithClientByStatus(orgId: string, status: string): Promise<(Trip & { clientName: string | null })[]>;
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

  createTripDocument(doc: InsertTripDocument): Promise<TripDocument>;
  getTripDocuments(tripId: string, orgId: string): Promise<(TripDocument & { uploaderName: string | null })[]>;
  getClientDocuments(clientId: string, orgId: string): Promise<(TripDocument & { uploaderName: string | null; tripTitle: string | null })[]>;
  getTripDocument(id: string, orgId: string): Promise<TripDocument | undefined>;
  updateTripDocument(id: string, orgId: string, data: Partial<InsertTripDocument>): Promise<TripDocument | undefined>;
  deleteTripDocument(id: string, orgId: string): Promise<TripDocument | undefined>;

  createFlightTracking(data: InsertFlightTracking): Promise<FlightTracking>;
  getFlightTrackingBySegment(segmentId: string): Promise<FlightTracking | undefined>;
  getActiveFlightTrackingForDate(date: string): Promise<FlightTracking[]>;
  updateFlightTracking(id: string, data: Partial<InsertFlightTracking>): Promise<FlightTracking | undefined>;
  deleteFlightTrackingBySegment(segmentId: string): Promise<void>;
  getFlightTrackingForTrip(tripId: string, orgId: string): Promise<FlightTracking[]>;

  createNotification(data: InsertNotification): Promise<Notification>;
  getNotifications(profileId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(profileId: string): Promise<number>;
  markNotificationRead(id: string, profileId: string): Promise<void>;
  markAllNotificationsRead(profileId: string): Promise<void>;

  getAdvisorProfilesForOrg(orgId: string): Promise<Profile[]>;

  createSegmentTemplate(data: InsertSegmentTemplate): Promise<SegmentTemplate>;
  getSegmentTemplatesByOrg(orgId: string): Promise<(SegmentTemplate & { creatorName: string | null })[]>;
  getSegmentTemplate(id: string, orgId: string): Promise<SegmentTemplate | undefined>;
  updateSegmentTemplate(id: string, orgId: string, data: Partial<InsertSegmentTemplate>): Promise<SegmentTemplate | undefined>;
  deleteSegmentTemplate(id: string, orgId: string): Promise<boolean>;
  incrementTemplateUseCount(id: string, orgId: string): Promise<void>;

  updateProfile(userId: string, data: Partial<InsertProfile>): Promise<Profile | undefined>;
  deleteProfile(userId: string): Promise<boolean>;
  updateOrganization(id: string, data: Partial<InsertOrganization>): Promise<Organization | undefined>;

  createInvitation(data: InsertInvitation): Promise<Invitation>;
  getInvitationsByOrg(orgId: string): Promise<(Invitation & { inviterName: string | null })[]>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  getInvitationByEmail(email: string, orgId: string): Promise<Invitation | undefined>;
  updateInvitation(id: string, data: Partial<InsertInvitation>): Promise<Invitation | undefined>;
  deleteInvitation(id: string, orgId: string): Promise<boolean>;

  getConversationsByOrg(orgId: string): Promise<(Conversation & { clientName: string; clientAvatarUrl: string | null; unreadCount: number })[]>;
  getConversationsForAdvisor(orgId: string, advisorId: string): Promise<(Conversation & { clientName: string; clientAvatarUrl: string | null; unreadCount: number })[]>;
  getOrCreateConversation(orgId: string, clientId: string): Promise<Conversation>;
  getConversation(id: string, orgId: string): Promise<Conversation | undefined>;
  getConversationById(id: string): Promise<Conversation | null>;
  getMessages(conversationId: string, orgId: string, limit?: number): Promise<(Message & { reactions: MessageReaction[] })[]>;
  createMessage(data: InsertMessage): Promise<Message>;
  markMessagesRead(conversationId: string, orgId: string): Promise<void>;
  markConversationSeenByClient(conversationId: string): Promise<void>;
  getUnreadMessageCount(orgId: string): Promise<number>;
  getUnreadMessageCountForAdvisor(orgId: string, advisorId: string): Promise<number>;
  createClientChatToken(clientId: string, orgId: string, tripId: string): Promise<string>;
  validateClientChatToken(token: string): Promise<{ clientId: string; orgId: string; tripId: string } | null>;
  addReaction(messageId: string, conversationId: string, orgId: string, reactorType: string, reactorId: string, reactorName: string, emoji: string): Promise<MessageReaction>;
  removeReaction(messageId: string, reactorId: string, reactorType: string): Promise<void>;
  getReactionsForMessage(messageId: string): Promise<MessageReaction[]>;
  getReactionsByConversation(conversationId: string): Promise<Record<string, MessageReaction[]>>;

  getTripFullView(tripId: string): Promise<{
    trip: Trip;
    organization: { id: string; name: string; logoUrl: string | null };
    advisor: { fullName: string; email: string | null; avatarUrl: string | null; phone: string | null; website: string | null; timeFormat: string } | null;
    client: { fullName: string; email: string | null } | null;
    companions: { id: string; fullName: string }[];
    versions: (TripVersion & { segments: TripSegment[] })[];
  } | undefined>;

  getClientsByAdvisor(orgId: string, advisorId: string): Promise<(Client & { tripCount: number })[]>;
  getClientCollaborators(clientId: string, orgId: string): Promise<(ClientCollaborator & { advisorName: string; advisorEmail: string | null })[]>;
  addClientCollaborator(data: InsertClientCollaborator): Promise<ClientCollaborator>;
  removeClientCollaborator(id: string, orgId: string): Promise<boolean>;
  canAdvisorAccessClient(advisorId: string, clientId: string, orgId: string): Promise<boolean>;
  getTripsByAdvisor(orgId: string, advisorId: string): Promise<(Trip & { clientName: string | null })[]>;

  getClientCompanions(clientId: string, orgId: string): Promise<{ id: string; companion: Client; relationshipLabel: string | null }[]>;
  createClientRelationship(data: { orgId: string; clientIdA: string; clientIdB: string; relationshipLabel: string | null }): Promise<any>;
  deleteClientRelationship(id: string, orgId: string): Promise<boolean>;

  getVariantsBySegment(segmentId: string, orgId: string): Promise<SegmentVariant[]>;
  createVariant(variant: InsertSegmentVariant): Promise<SegmentVariant>;
  updateVariant(id: string, orgId: string, data: Partial<InsertSegmentVariant>): Promise<SegmentVariant | undefined>;
  deleteVariant(id: string, orgId: string): Promise<void>;
  selectVariant(segmentId: string, variantId: string): Promise<SegmentVariant[]>;
  submitVariantsForTrip(tripId: string): Promise<{ submitted: number; pending: number }>;
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
      .where(
        and(
          eq(trips.orgId, orgId),
          sql`${trips.status} != 'archived'`
        )
      )
      .orderBy(sql`${trips.createdAt} DESC`)
      .limit(limit);
    return rows.map((r) => ({ ...r.trip, clientName: r.clientName }));
  }

  async getTripsWithClientByOrg(orgId: string, excludeStatus?: string): Promise<(Trip & { clientName: string | null })[]> {
    const conditions = [eq(trips.orgId, orgId)];
    if (excludeStatus) {
      conditions.push(sql`${trips.status} != ${excludeStatus}`);
    }
    const rows = await db
      .select({
        trip: trips,
        clientName: clients.fullName,
      })
      .from(trips)
      .leftJoin(clients, eq(trips.clientId, clients.id))
      .where(and(...conditions))
      .orderBy(sql`${trips.createdAt} DESC`);
    return rows.map((r) => ({ ...r.trip, clientName: r.clientName }));
  }

  async getTripsWithClientByStatus(orgId: string, status: string): Promise<(Trip & { clientName: string | null })[]> {
    const rows = await db
      .select({
        trip: trips,
        clientName: clients.fullName,
      })
      .from(trips)
      .leftJoin(clients, eq(trips.clientId, clients.id))
      .where(and(eq(trips.orgId, orgId), eq(trips.status, status as any)))
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
        metadata: seg.metadata as Record<string, unknown> | null,
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

  async updateProfile(userId: string, data: Partial<InsertProfile>): Promise<Profile | undefined> {
    const [result] = await db
      .update(profiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(profiles.id, userId))
      .returning();
    return result;
  }

  async updateOrganization(id: string, data: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [result] = await db
      .update(organizations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return result;
  }

  async deleteProfile(userId: string): Promise<boolean> {
    const deleted = await db.delete(profiles).where(eq(profiles.id, userId)).returning();
    return deleted.length > 0;
  }

  async createInvitation(data: InsertInvitation): Promise<Invitation> {
    const [result] = await db.insert(invitations).values(data).returning();
    return result;
  }

  async getInvitationsByOrg(orgId: string): Promise<(Invitation & { inviterName: string | null })[]> {
    const rows = await db
      .select({
        invitation: invitations,
        inviterName: profiles.fullName,
      })
      .from(invitations)
      .leftJoin(profiles, eq(invitations.invitedBy, profiles.id))
      .where(eq(invitations.orgId, orgId))
      .orderBy(desc(invitations.createdAt));
    return rows.map((r) => ({ ...r.invitation, inviterName: r.inviterName }));
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [result] = await db.select().from(invitations).where(eq(invitations.token, token));
    return result;
  }

  async getInvitationByEmail(email: string, orgId: string): Promise<Invitation | undefined> {
    const [result] = await db
      .select()
      .from(invitations)
      .where(and(eq(invitations.email, email), eq(invitations.orgId, orgId), eq(invitations.status, "pending")));
    return result;
  }

  async updateInvitation(id: string, data: Partial<InsertInvitation>): Promise<Invitation | undefined> {
    const [result] = await db.update(invitations).set(data).where(eq(invitations.id, id)).returning();
    return result;
  }

  async deleteInvitation(id: string, orgId: string): Promise<boolean> {
    const deleted = await db.delete(invitations).where(and(eq(invitations.id, id), eq(invitations.orgId, orgId))).returning();
    return deleted.length > 0;
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
  async getTripFullView(tripId: string): Promise<{
    trip: Trip;
    organization: { id: string; name: string; logoUrl: string | null };
    advisor: { fullName: string; email: string | null; avatarUrl: string | null; phone: string | null; website: string | null; timeFormat: string } | null;
    client: { fullName: string; email: string | null } | null;
    companions: { id: string; fullName: string }[];
    versions: (TripVersion & { segments: TripSegment[] })[];
  } | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
    if (!trip) return undefined;

    const [org] = await db.select({
      id: organizations.id,
      name: organizations.name,
      logoUrl: organizations.logoUrl,
    }).from(organizations).where(eq(organizations.id, trip.orgId));
    if (!org) return undefined;

    let advisor: { fullName: string; email: string | null; avatarUrl: string | null; phone: string | null; website: string | null; timeFormat: string } | null = null;
    if (trip.advisorId) {
      const [adv] = await db.select({
        fullName: profiles.fullName,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
        phone: profiles.phone,
        website: profiles.website,
        timeFormat: profiles.timeFormat,
      }).from(profiles).where(eq(profiles.id, trip.advisorId));
      if (adv) advisor = adv;
    }

    let client: { fullName: string; email: string | null } | null = null;
    if (trip.clientId) {
      const [cl] = await db.select({
        fullName: clients.fullName,
        email: clients.email,
      }).from(clients).where(eq(clients.id, trip.clientId));
      if (cl) client = cl;
    }

    let companions: { id: string; fullName: string }[] = [];
    const additionalIds = trip.additionalClientIds as string[] | null;
    if (additionalIds && additionalIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      companions = await db
        .select({ id: clients.id, fullName: clients.fullName })
        .from(clients)
        .where(inArray(clients.id, additionalIds));
    }

    const versionRows = await db.select().from(tripVersions)
      .where(eq(tripVersions.tripId, tripId))
      .orderBy(tripVersions.versionNumber);

    const versionsWithSegments = await Promise.all(
      versionRows.map(async (v) => {
        const segs = await db.select().from(tripSegments)
          .where(eq(tripSegments.versionId, v.id))
          .orderBy(tripSegments.dayNumber, tripSegments.sortOrder);
        return { ...v, segments: segs };
      })
    );

    return {
      trip,
      organization: org,
      advisor,
      client,
      companions,
      versions: versionsWithSegments,
    };
  }

  async createTripDocument(doc: InsertTripDocument): Promise<TripDocument> {
    const [result] = await db.insert(tripDocuments).values(doc).returning();
    return result;
  }

  async getTripDocuments(tripId: string, orgId: string): Promise<(TripDocument & { uploaderName: string | null })[]> {
    const rows = await db
      .select({
        doc: tripDocuments,
        uploaderName: profiles.fullName,
      })
      .from(tripDocuments)
      .leftJoin(profiles, eq(tripDocuments.uploadedBy, profiles.id))
      .where(and(eq(tripDocuments.tripId, tripId), eq(tripDocuments.orgId, orgId)))
      .orderBy(sql`${tripDocuments.createdAt} DESC`);
    return rows.map(r => ({ ...r.doc, uploaderName: r.uploaderName }));
  }

  async getClientDocuments(clientId: string, orgId: string): Promise<(TripDocument & { uploaderName: string | null; tripTitle: string | null })[]> {
    const rows = await db
      .select({
        doc: tripDocuments,
        uploaderName: profiles.fullName,
        tripTitle: trips.title,
      })
      .from(tripDocuments)
      .leftJoin(profiles, eq(tripDocuments.uploadedBy, profiles.id))
      .leftJoin(trips, eq(tripDocuments.tripId, trips.id))
      .where(and(eq(tripDocuments.clientId, clientId), eq(tripDocuments.orgId, orgId)))
      .orderBy(sql`${tripDocuments.createdAt} DESC`);
    return rows.map(r => ({ ...r.doc, uploaderName: r.uploaderName, tripTitle: r.tripTitle }));
  }

  async getTripDocument(id: string, orgId: string): Promise<TripDocument | undefined> {
    const [result] = await db.select().from(tripDocuments).where(
      and(eq(tripDocuments.id, id), eq(tripDocuments.orgId, orgId))
    );
    return result;
  }

  async updateTripDocument(id: string, orgId: string, data: Partial<InsertTripDocument>): Promise<TripDocument | undefined> {
    const [result] = await db
      .update(tripDocuments)
      .set(data)
      .where(and(eq(tripDocuments.id, id), eq(tripDocuments.orgId, orgId)))
      .returning();
    return result;
  }

  async deleteTripDocument(id: string, orgId: string): Promise<TripDocument | undefined> {
    const [result] = await db
      .delete(tripDocuments)
      .where(and(eq(tripDocuments.id, id), eq(tripDocuments.orgId, orgId)))
      .returning();
    return result;
  }

  async createFlightTracking(data: InsertFlightTracking): Promise<FlightTracking> {
    const [result] = await db.insert(flightTracking).values(data).returning();
    return result;
  }

  async getFlightTrackingBySegment(segmentId: string): Promise<FlightTracking | undefined> {
    const [result] = await db.select().from(flightTracking).where(eq(flightTracking.segmentId, segmentId));
    return result;
  }

  async getActiveFlightTrackingForDate(date: string): Promise<FlightTracking[]> {
    return db.select().from(flightTracking).where(
      and(eq(flightTracking.flightDate, date), eq(flightTracking.isActive, true))
    );
  }

  async updateFlightTracking(id: string, data: Partial<InsertFlightTracking>): Promise<FlightTracking | undefined> {
    const [result] = await db.update(flightTracking).set(data).where(eq(flightTracking.id, id)).returning();
    return result;
  }

  async deleteFlightTrackingBySegment(segmentId: string): Promise<void> {
    await db.delete(flightTracking).where(eq(flightTracking.segmentId, segmentId));
  }

  async getFlightTrackingForTrip(tripId: string, orgId: string): Promise<FlightTracking[]> {
    return db.select().from(flightTracking).where(
      and(eq(flightTracking.tripId, tripId), eq(flightTracking.orgId, orgId))
    );
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [result] = await db.insert(notifications).values(data).returning();
    return result;
  }

  async getNotifications(profileId: string, limit = 20): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.profileId, profileId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(profileId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(notifications)
      .where(and(eq(notifications.profileId, profileId), eq(notifications.isRead, false)));
    return result?.count || 0;
  }

  async markNotificationRead(id: string, profileId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.profileId, profileId)));
  }

  async markAllNotificationsRead(profileId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true })
      .where(and(eq(notifications.profileId, profileId), eq(notifications.isRead, false)));
  }

  async getAdvisorProfilesForOrg(orgId: string): Promise<Profile[]> {
    return db.select().from(profiles).where(
      and(
        eq(profiles.orgId, orgId),
        or(eq(profiles.role, "owner"), eq(profiles.role, "advisor"))
      )
    );
  }

  async createSegmentTemplate(data: InsertSegmentTemplate): Promise<SegmentTemplate> {
    const [result] = await db.insert(segmentTemplates).values(data).returning();
    return result;
  }

  async getSegmentTemplatesByOrg(orgId: string): Promise<(SegmentTemplate & { creatorName: string | null })[]> {
    const rows = await db
      .select({
        template: segmentTemplates,
        creatorName: profiles.fullName,
      })
      .from(segmentTemplates)
      .leftJoin(profiles, eq(segmentTemplates.createdBy, profiles.id))
      .where(eq(segmentTemplates.orgId, orgId))
      .orderBy(desc(segmentTemplates.useCount));
    return rows.map(r => ({ ...r.template, creatorName: r.creatorName }));
  }

  async getSegmentTemplate(id: string, orgId: string): Promise<SegmentTemplate | undefined> {
    const [result] = await db.select().from(segmentTemplates)
      .where(and(eq(segmentTemplates.id, id), eq(segmentTemplates.orgId, orgId)));
    return result;
  }

  async updateSegmentTemplate(id: string, orgId: string, data: Partial<InsertSegmentTemplate>): Promise<SegmentTemplate | undefined> {
    const [result] = await db.update(segmentTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(segmentTemplates.id, id), eq(segmentTemplates.orgId, orgId)))
      .returning();
    return result;
  }

  async deleteSegmentTemplate(id: string, orgId: string): Promise<boolean> {
    const [result] = await db.delete(segmentTemplates)
      .where(and(eq(segmentTemplates.id, id), eq(segmentTemplates.orgId, orgId)))
      .returning();
    return !!result;
  }

  async incrementTemplateUseCount(id: string, orgId: string): Promise<void> {
    await db.update(segmentTemplates)
      .set({ useCount: sql`${segmentTemplates.useCount} + 1` })
      .where(and(eq(segmentTemplates.id, id), eq(segmentTemplates.orgId, orgId)));
  }

  async getAnalytics(orgId: string, range: string, role: string): Promise<any> {
    const now = new Date();
    let sinceDate: Date | null = null;
    if (range === "30d") {
      sinceDate = new Date(now.getTime() - 30 * 86400000);
    } else if (range === "3m") {
      sinceDate = new Date(now);
      sinceDate.setMonth(sinceDate.getMonth() - 3);
    } else if (range === "12m") {
      sinceDate = new Date(now);
      sinceDate.setFullYear(sinceDate.getFullYear() - 1);
    }

    const dateCondition = sinceDate
      ? sql`AND t.created_at >= ${sinceDate}`
      : sql``;

    const dateConditionNoAlias = sinceDate
      ? sql`AND created_at >= ${sinceDate}`
      : sql``;

    const [
      summaryRows,
      activeTripsRows,
      totalClientsRows,
      tripsOverTimeRows,
      topDestRows,
      statusRows,
      topClientsRows,
      advisorRows,
    ] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)::int AS total_trips,
          COALESCE(SUM(CASE WHEN t.budget IS NOT NULL THEN t.budget ELSE 0 END), 0)::bigint AS portfolio_value,
          COALESCE(
            (SELECT currency FROM trips WHERE org_id = ${orgId} AND budget IS NOT NULL ORDER BY created_at DESC LIMIT 1),
            'USD'
          ) AS currency
        FROM trips t
        WHERE t.org_id = ${orgId} ${dateCondition}
      `),

      db.execute(sql`
        SELECT COUNT(*)::int AS active_trips
        FROM trips
        WHERE org_id = ${orgId} AND status IN ('planning', 'confirmed', 'in_progress')
      `),

      db.execute(sql`
        SELECT COUNT(*)::int AS total_clients
        FROM clients
        WHERE org_id = ${orgId}
      `),

      db.execute(sql`
        SELECT
          TO_CHAR(t.created_at, 'YYYY-MM') AS month,
          COUNT(*)::int AS trip_count
        FROM trips t
        WHERE t.org_id = ${orgId} ${dateCondition}
        GROUP BY TO_CHAR(t.created_at, 'YYYY-MM')
        ORDER BY month ASC
      `),

      db.execute(sql`
        SELECT destination, COUNT(*)::int AS trip_count
        FROM trips
        WHERE org_id = ${orgId} AND destination IS NOT NULL AND destination != '' ${dateConditionNoAlias}
        GROUP BY destination
        ORDER BY trip_count DESC
        LIMIT 8
      `),

      db.execute(sql`
        SELECT status, COUNT(*)::int AS status_count
        FROM trips
        WHERE org_id = ${orgId} ${dateConditionNoAlias}
        GROUP BY status
        ORDER BY status_count DESC
      `),

      db.execute(sql`
        SELECT
          c.id,
          c.full_name,
          COUNT(t.id)::int AS total_trips,
          MAX(t.created_at) AS most_recent_trip,
          COALESCE(SUM(CASE WHEN t.budget IS NOT NULL THEN t.budget ELSE 0 END), 0)::bigint AS total_value
        FROM clients c
        LEFT JOIN trips t ON t.client_id = c.id AND t.org_id = ${orgId} ${dateCondition}
        WHERE c.org_id = ${orgId}
        GROUP BY c.id, c.full_name
        ORDER BY total_trips DESC
        LIMIT 10
      `),

      role === "owner" ? db.execute(sql`
        SELECT
          p.id,
          p.full_name,
          COUNT(DISTINCT t.id)::int AS trips_created,
          COUNT(DISTINCT t.client_id)::int AS clients_managed
        FROM profiles p
        LEFT JOIN trips t ON t.advisor_id = p.id AND t.org_id = ${orgId} ${dateCondition}
        WHERE p.org_id = ${orgId} AND p.role IN ('owner', 'advisor')
        GROUP BY p.id, p.full_name
        ORDER BY trips_created DESC
      `) : Promise.resolve({ rows: [] }),
    ]);

    const summary = (summaryRows as any).rows?.[0] || summaryRows[0] || {};
    const activeTrips = (activeTripsRows as any).rows?.[0] || activeTripsRows[0] || {};
    const totalClients = (totalClientsRows as any).rows?.[0] || totalClientsRows[0] || {};

    return {
      summary: {
        totalTrips: summary.total_trips || 0,
        activeTrips: activeTrips.active_trips || 0,
        totalClients: totalClients.total_clients || 0,
        portfolioValue: Number(summary.portfolio_value || 0),
        currency: summary.currency || "USD",
      },
      tripsOverTime: ((tripsOverTimeRows as any).rows || tripsOverTimeRows || []).map((r: any) => ({
        month: r.month,
        count: r.trip_count,
      })),
      topDestinations: ((topDestRows as any).rows || topDestRows || []).map((r: any) => ({
        destination: r.destination,
        count: r.trip_count,
      })),
      tripsByStatus: ((statusRows as any).rows || statusRows || []).map((r: any) => ({
        status: r.status,
        count: r.status_count,
      })),
      topClients: ((topClientsRows as any).rows || topClientsRows || []).map((r: any) => ({
        id: r.id,
        name: r.full_name,
        totalTrips: r.total_trips,
        mostRecentTrip: r.most_recent_trip,
        totalValue: Number(r.total_value || 0),
      })),
      advisorActivity: ((advisorRows as any).rows || advisorRows || []).map((r: any) => ({
        id: r.id,
        name: r.full_name,
        tripsCreated: r.trips_created,
        clientsManaged: r.clients_managed,
      })),
    };
  }

  async getConversationsByOrg(orgId: string): Promise<(Conversation & { clientName: string; clientAvatarUrl: string | null; unreadCount: number })[]> {
    const rows = await db.execute(sql`
      SELECT c.*,
        cl.full_name AS client_name,
        cl.avatar_url AS client_avatar_url,
        COALESCE((SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id AND m.is_read = false AND m.sender_type = 'client'), 0) AS unread_count
      FROM conversations c
      JOIN clients cl ON cl.id = c.client_id
      WHERE c.org_id = ${orgId}
      ORDER BY c.last_message_at DESC NULLS LAST
    `);
    return ((rows as any).rows || rows || []).map((r: any) => ({
      id: r.id,
      orgId: r.org_id,
      clientId: r.client_id,
      lastMessageAt: r.last_message_at,
      lastMessagePreview: r.last_message_preview,
      createdAt: r.created_at,
      clientName: r.client_name,
      clientAvatarUrl: r.client_avatar_url,
      unreadCount: Number(r.unread_count),
    }));
  }

  async getConversationsForAdvisor(orgId: string, advisorId: string): Promise<(Conversation & { clientName: string; clientAvatarUrl: string | null; unreadCount: number })[]> {
    const rows = await db.execute(sql`
      SELECT c.*,
        cl.full_name AS client_name,
        cl.avatar_url AS client_avatar_url,
        COALESCE((SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id AND m.is_read = false AND m.sender_type = 'client'), 0) AS unread_count
      FROM conversations c
      JOIN clients cl ON cl.id = c.client_id
      WHERE c.org_id = ${orgId}
      AND (
        cl.assigned_advisor_id = ${advisorId}
        OR EXISTS (
          SELECT 1 FROM client_collaborators cc
          WHERE cc.client_id = cl.id
          AND cc.advisor_id = ${advisorId}
          AND cc.org_id = ${orgId}
        )
      )
      ORDER BY c.last_message_at DESC NULLS LAST
    `);
    return ((rows as any).rows || rows || []).map((r: any) => ({
      id: r.id,
      orgId: r.org_id,
      clientId: r.client_id,
      lastMessageAt: r.last_message_at,
      lastMessagePreview: r.last_message_preview,
      createdAt: r.created_at,
      clientName: r.client_name,
      clientAvatarUrl: r.client_avatar_url,
      unreadCount: Number(r.unread_count),
    }));
  }

  async getOrCreateConversation(orgId: string, clientId: string): Promise<Conversation> {
    const [existing] = await db.select().from(conversations)
      .where(and(eq(conversations.orgId, orgId), eq(conversations.clientId, clientId)));
    if (existing) return existing;
    const [created] = await db.insert(conversations)
      .values({ orgId, clientId })
      .returning();
    return created;
  }

  async getConversation(id: string, orgId: string): Promise<Conversation | undefined> {
    const [result] = await db.select().from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.orgId, orgId)));
    return result;
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    const [result] = await db.select().from(conversations)
      .where(eq(conversations.id, id));
    return result || null;
  }

  async getMessages(conversationId: string, orgId: string, limit = 100): Promise<(Message & { reactions: MessageReaction[] })[]> {
    const msgs = await db.select().from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.orgId, orgId)))
      .orderBy(messages.createdAt)
      .limit(limit);
    const reactionsMap = await this.getReactionsByConversation(conversationId);
    return msgs.map(m => ({ ...m, reactions: reactionsMap[m.id] || [] }));
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [msg] = await db.insert(messages).values(data).returning();
    await db.update(conversations)
      .set({
        lastMessageAt: new Date(),
        lastMessagePreview: data.content.slice(0, 100),
      })
      .where(eq(conversations.id, data.conversationId));
    return msg;
  }

  async markMessagesRead(conversationId: string, orgId: string): Promise<void> {
    await db.update(messages)
      .set({ isRead: true })
      .where(and(
        eq(messages.conversationId, conversationId),
        eq(messages.orgId, orgId),
        eq(messages.senderType, "client"),
        eq(messages.isRead, false),
      ));
  }

  async getUnreadMessageCount(orgId: string): Promise<number> {
    const result = await db.select({ count: count() }).from(messages)
      .where(and(
        eq(messages.orgId, orgId),
        eq(messages.senderType, "client"),
        eq(messages.isRead, false),
      ));
    return result[0]?.count || 0;
  }

  async getUnreadMessageCountForAdvisor(orgId: string, advisorId: string): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN clients cl ON cl.id = c.client_id
      WHERE m.org_id = ${orgId}
      AND m.sender_type = 'client'
      AND m.is_read = false
      AND (
        cl.assigned_advisor_id = ${advisorId}
        OR EXISTS (
          SELECT 1 FROM client_collaborators cc
          WHERE cc.client_id = cl.id
          AND cc.advisor_id = ${advisorId}
          AND cc.org_id = ${orgId}
        )
      )
    `);
    const rows = (result as any).rows || result || [];
    return Number(rows[0]?.cnt || 0);
  }

  async markConversationSeenByClient(conversationId: string): Promise<void> {
    await db.update(messages)
      .set({ seenAt: new Date() })
      .where(and(
        eq(messages.conversationId, conversationId),
        eq(messages.senderType, "advisor"),
        isNull(messages.seenAt),
      ));
  }

  async createClientChatToken(clientId: string, orgId: string, tripId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(clientChatTokens).values({ clientId, orgId, tripId, token, expiresAt });
    return token;
  }

  async validateClientChatToken(token: string): Promise<{ clientId: string; orgId: string; tripId: string } | null> {
    const [row] = await db.select().from(clientChatTokens)
      .where(and(eq(clientChatTokens.token, token), gt(clientChatTokens.expiresAt, new Date())));
    if (!row) return null;
    return { clientId: row.clientId, orgId: row.orgId, tripId: row.tripId };
  }

  async addReaction(messageId: string, conversationId: string, orgId: string, reactorType: string, reactorId: string, reactorName: string, emoji: string): Promise<MessageReaction> {
    await db.delete(messageReactions)
      .where(and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.reactorId, reactorId),
        eq(messageReactions.reactorType, reactorType),
      ));
    const [reaction] = await db.insert(messageReactions)
      .values({ messageId, conversationId, orgId, reactorType, reactorId, reactorName, emoji })
      .returning();
    return reaction;
  }

  async removeReaction(messageId: string, reactorId: string, reactorType: string): Promise<void> {
    await db.delete(messageReactions)
      .where(and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.reactorId, reactorId),
        eq(messageReactions.reactorType, reactorType),
      ));
  }

  async getReactionsForMessage(messageId: string): Promise<MessageReaction[]> {
    return db.select().from(messageReactions)
      .where(eq(messageReactions.messageId, messageId));
  }

  async getReactionsByConversation(conversationId: string): Promise<Record<string, MessageReaction[]>> {
    const rows = await db.select().from(messageReactions)
      .where(eq(messageReactions.conversationId, conversationId));
    const map: Record<string, MessageReaction[]> = {};
    for (const r of rows) {
      if (!map[r.messageId]) map[r.messageId] = [];
      map[r.messageId].push(r);
    }
    return map;
  }

  async savePushSubscription(profileId: string, orgId: string, endpoint: string, p256dh: string, auth: string): Promise<PushSubscription> {
    const existing = await db.select().from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.profileId, profileId), eq(pushSubscriptions.endpoint, endpoint)));
    if (existing.length > 0) {
      const [updated] = await db.update(pushSubscriptions)
        .set({ p256dh, auth })
        .where(eq(pushSubscriptions.id, existing[0].id))
        .returning();
      return updated;
    }
    const [sub] = await db.insert(pushSubscriptions).values({ profileId, orgId, endpoint, p256dh, auth }).returning();
    return sub;
  }

  async removePushSubscription(profileId: string, endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.profileId, profileId), eq(pushSubscriptions.endpoint, endpoint)));
  }

  async getPushSubscriptionsForOrg(orgId: string): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.orgId, orgId));
  }

  async getClientsByAdvisor(orgId: string, advisorId: string): Promise<(Client & { tripCount: number })[]> {
    const collabClientIds = await db
      .select({ clientId: clientCollaborators.clientId })
      .from(clientCollaborators)
      .where(and(eq(clientCollaborators.advisorId, advisorId), eq(clientCollaborators.orgId, orgId)));

    const collabIds = collabClientIds.map((r) => r.clientId);

    const rows = await db
      .select({
        client: clients,
        tripCount: sql<number>`cast(count(${trips.id}) as int)`,
      })
      .from(clients)
      .leftJoin(trips, eq(clients.id, trips.clientId))
      .where(
        and(
          eq(clients.orgId, orgId),
          collabIds.length > 0
            ? or(eq(clients.assignedAdvisorId, advisorId), inArray(clients.id, collabIds))
            : eq(clients.assignedAdvisorId, advisorId)
        )
      )
      .groupBy(clients.id)
      .orderBy(sql`${clients.fullName} ASC`);

    return rows.map((r) => ({ ...r.client, tripCount: r.tripCount }));
  }

  async getClientCollaborators(clientId: string, orgId: string): Promise<(ClientCollaborator & { advisorName: string; advisorEmail: string | null })[]> {
    const rows = await db
      .select({
        collab: clientCollaborators,
        advisorName: profiles.fullName,
        advisorEmail: profiles.email,
      })
      .from(clientCollaborators)
      .innerJoin(profiles, eq(clientCollaborators.advisorId, profiles.id))
      .where(and(eq(clientCollaborators.clientId, clientId), eq(clientCollaborators.orgId, orgId)));

    return rows.map((r) => ({ ...r.collab, advisorName: r.advisorName, advisorEmail: r.advisorEmail }));
  }

  async addClientCollaborator(data: InsertClientCollaborator): Promise<ClientCollaborator> {
    const existing = await db.select().from(clientCollaborators)
      .where(and(
        eq(clientCollaborators.clientId, data.clientId),
        eq(clientCollaborators.advisorId, data.advisorId),
        eq(clientCollaborators.orgId, data.orgId),
      ));
    if (existing.length > 0) return existing[0];
    const [result] = await db.insert(clientCollaborators).values(data).returning();
    return result;
  }

  async removeClientCollaborator(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(clientCollaborators)
      .where(and(eq(clientCollaborators.id, id), eq(clientCollaborators.orgId, orgId)))
      .returning();
    return result.length > 0;
  }

  async canAdvisorAccessClient(advisorId: string, clientId: string, orgId: string): Promise<boolean> {
    const profile = await this.getProfile(advisorId);
    if (!profile) return false;
    if (profile.role === "owner" || profile.canViewAllClients) return true;

    const client = await this.getClient(clientId, orgId);
    if (!client) return false;
    if (client.assignedAdvisorId === advisorId) return true;

    const collabs = await db.select().from(clientCollaborators)
      .where(and(
        eq(clientCollaborators.clientId, clientId),
        eq(clientCollaborators.advisorId, advisorId),
        eq(clientCollaborators.orgId, orgId),
      ));
    return collabs.length > 0;
  }

  async getTripsByAdvisor(orgId: string, advisorId: string): Promise<(Trip & { clientName: string | null })[]> {
    const collabClientIds = await db
      .select({ clientId: clientCollaborators.clientId })
      .from(clientCollaborators)
      .where(and(eq(clientCollaborators.advisorId, advisorId), eq(clientCollaborators.orgId, orgId)));

    const collabIds = collabClientIds.map((r) => r.clientId);

    const clientCondition = collabIds.length > 0
      ? or(eq(clients.assignedAdvisorId, advisorId), inArray(clients.id, collabIds))
      : eq(clients.assignedAdvisorId, advisorId);

    const rows = await db
      .select({
        trip: trips,
        clientName: clients.fullName,
      })
      .from(trips)
      .innerJoin(clients, eq(trips.clientId, clients.id))
      .where(and(eq(trips.orgId, orgId), clientCondition))
      .orderBy(sql`${trips.createdAt} DESC`);

    const tripsWithoutClient = await db
      .select({
        trip: trips,
      })
      .from(trips)
      .where(and(eq(trips.orgId, orgId), eq(trips.advisorId, advisorId), sql`${trips.clientId} IS NULL`))
      .orderBy(sql`${trips.createdAt} DESC`);

    const allTrips = [
      ...rows.map((r) => ({ ...r.trip, clientName: r.clientName })),
      ...tripsWithoutClient.map((r) => ({ ...r.trip, clientName: null })),
    ];
    allTrips.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    return allTrips;
  }
  async getClientCompanions(clientId: string, orgId: string): Promise<{ id: string; companion: Client; relationshipLabel: string | null }[]> {
    const asA = await db
      .select({ rel: clientRelationships, companion: clients })
      .from(clientRelationships)
      .innerJoin(clients, eq(clients.id, clientRelationships.clientIdB))
      .where(and(eq(clientRelationships.clientIdA, clientId), eq(clientRelationships.orgId, orgId)));

    const asB = await db
      .select({ rel: clientRelationships, companion: clients })
      .from(clientRelationships)
      .innerJoin(clients, eq(clients.id, clientRelationships.clientIdA))
      .where(and(eq(clientRelationships.clientIdB, clientId), eq(clientRelationships.orgId, orgId)));

    return [
      ...asA.map((r) => ({ id: r.rel.id, companion: r.companion, relationshipLabel: r.rel.relationshipLabel })),
      ...asB.map((r) => ({ id: r.rel.id, companion: r.companion, relationshipLabel: r.rel.relationshipLabel })),
    ];
  }

  async createClientRelationship(data: { orgId: string; clientIdA: string; clientIdB: string; relationshipLabel: string | null }): Promise<any> {
    const [a, b] = data.clientIdA < data.clientIdB
      ? [data.clientIdA, data.clientIdB]
      : [data.clientIdB, data.clientIdA];
    const [result] = await db.insert(clientRelationships).values({
      orgId: data.orgId,
      clientIdA: a,
      clientIdB: b,
      relationshipLabel: data.relationshipLabel,
    }).returning();
    return result;
  }

  async deleteClientRelationship(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(clientRelationships)
      .where(and(eq(clientRelationships.id, id), eq(clientRelationships.orgId, orgId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getVariantsBySegment(segmentId: string, orgId: string): Promise<SegmentVariant[]> {
    return db.select().from(segmentVariants)
      .where(and(eq(segmentVariants.segmentId, segmentId), eq(segmentVariants.orgId, orgId)))
      .orderBy(segmentVariants.sortOrder);
  }

  async createVariant(variant: InsertSegmentVariant): Promise<SegmentVariant> {
    const [result] = await db.insert(segmentVariants).values(variant).returning();
    await db.update(tripSegments).set({ hasVariants: true }).where(eq(tripSegments.id, variant.segmentId));
    return result;
  }

  async updateVariant(id: string, orgId: string, data: Partial<InsertSegmentVariant>): Promise<SegmentVariant | undefined> {
    const [result] = await db.update(segmentVariants).set(data)
      .where(and(eq(segmentVariants.id, id), eq(segmentVariants.orgId, orgId)))
      .returning();
    return result;
  }

  async deleteVariant(id: string, orgId: string): Promise<void> {
    const [variant] = await db.select({ segmentId: segmentVariants.segmentId })
      .from(segmentVariants)
      .where(and(eq(segmentVariants.id, id), eq(segmentVariants.orgId, orgId)));
    
    await db.delete(segmentVariants)
      .where(and(eq(segmentVariants.id, id), eq(segmentVariants.orgId, orgId)));
    
    if (variant) {
      const remaining = await db.select({ cnt: count() })
        .from(segmentVariants)
        .where(eq(segmentVariants.segmentId, variant.segmentId));
      if (!remaining[0]?.cnt || remaining[0].cnt === 0) {
        await db.update(tripSegments).set({ hasVariants: false })
          .where(eq(tripSegments.id, variant.segmentId));
      }
    }
  }

  async selectVariant(segmentId: string, variantId: string): Promise<SegmentVariant[]> {
    await db.update(segmentVariants).set({ isSelected: false })
      .where(eq(segmentVariants.segmentId, segmentId));
    await db.update(segmentVariants).set({ isSelected: true })
      .where(eq(segmentVariants.id, variantId));
    return db.select().from(segmentVariants)
      .where(eq(segmentVariants.segmentId, segmentId))
      .orderBy(segmentVariants.sortOrder);
  }

  async submitVariantsForTrip(tripId: string): Promise<{ submitted: number; pending: number }> {
    const segs = await db.select({ id: tripSegments.id })
      .from(tripSegments)
      .where(and(eq(tripSegments.tripId, tripId), eq(tripSegments.hasVariants, true)));
    
    if (segs.length === 0) return { submitted: 0, pending: 0 };
    
    const segIds = segs.map(s => s.id);
    
    await db.update(segmentVariants).set({ isSubmitted: true })
      .where(and(
        inArray(segmentVariants.segmentId, segIds),
        eq(segmentVariants.isSelected, true)
      ));
    
    const allVariants = await db.select({
      segmentId: segmentVariants.segmentId,
      isSelected: segmentVariants.isSelected,
      isSubmitted: segmentVariants.isSubmitted,
    }).from(segmentVariants).where(inArray(segmentVariants.segmentId, segIds));
    
    const submittedSegIds = new Set(allVariants.filter(v => v.isSubmitted).map(v => v.segmentId));
    const submitted = submittedSegIds.size;
    const pending = segs.length - submitted;
    
    await db.update(trips).set({ selectionsSubmittedAt: new Date() })
      .where(eq(trips.id, tripId));
    
    return { submitted, pending };
  }
}

export const storage = new DatabaseStorage();
