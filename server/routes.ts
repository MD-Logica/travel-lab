import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generateTripPdf } from "./pdf-generator";
import { generateCalendar } from "./calendar-generator";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

async function generateUniqueSlug(baseName: string): Promise<string> {
  let slug = slugify(baseName);
  if (!slug) slug = "agency";
  let existing = await storage.getOrganizationBySlug(slug);
  let counter = 1;
  while (existing) {
    slug = `${slugify(baseName)}-${counter}`;
    existing = await storage.getOrganizationBySlug(slug);
    counter++;
  }
  return slug;
}

function getOrgId(req: any): string | null {
  return req._orgId || null;
}

const PLAN_LIMITS: Record<string, { maxAdvisors: number; maxClients: number; maxTrips: number }> = {
  trial: { maxAdvisors: 3, maxClients: 50, maxTrips: 20 },
  pro: { maxAdvisors: 10, maxClients: 500, maxTrips: Infinity },
  enterprise: { maxAdvisors: Infinity, maxClients: Infinity, maxTrips: Infinity },
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  const { authStorage } = await import("./replit_integrations/auth/storage");

  const registerSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
  });

  const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  });

  app.post("/api/auth/register", async (req: any, res) => {
    try {
      const parsed = registerSchema.parse(req.body);
      const { firstName, lastName, password } = parsed;
      const email = parsed.email.toLowerCase().trim();

      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await authStorage.createUserWithPassword(email, firstName, lastName, passwordHash);

      req.login(
        { claims: { sub: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName }, expires_at: Math.floor(Date.now() / 1000) + 86400 * 7 },
        (err: any) => {
          if (err) return res.status(500).json({ message: "Registration succeeded but login failed" });
          res.status(201).json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
        }
      );
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Register error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const email = parsed.email.toLowerCase().trim();
      const password = parsed.password;

      const user = await authStorage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      req.login(
        { claims: { sub: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName }, expires_at: Math.floor(Date.now() / 1000) + 86400 * 7 },
        (err: any) => {
          if (err) return res.status(500).json({ message: "Login failed" });
          res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
        }
      );
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);

      const user = await authStorage.getUserByEmail(email);
      if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await authStorage.createResetToken(user.id, token, expiresAt);
        if (process.env.NODE_ENV === "development") {
          console.log(`[DEV] Password reset link: /set-password?token=${token}`);
        }
      }

      res.json({ message: "If an account exists with that email, we've sent a reset link." });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Please enter a valid email address" });
      }
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const schema = z.object({
        token: z.string().min(1),
        password: z.string().min(8, "Password must be at least 8 characters"),
      });
      const { token, password } = schema.parse(req.body);

      const resetToken = await authStorage.getValidResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await authStorage.updatePasswordHash(resetToken.userId, passwordHash);
      await authStorage.markResetTokenUsed(token);

      res.json({ message: "Password has been reset successfully" });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get("/api/auth/validate-reset-token/:token", async (req, res) => {
    try {
      const resetToken = await authStorage.getValidResetToken(req.params.token);
      if (!resetToken) {
        return res.status(400).json({ valid: false, message: "Invalid or expired reset link" });
      }
      res.json({ valid: true });
    } catch {
      res.status(500).json({ valid: false, message: "Failed to validate token" });
    }
  });

  const orgMiddleware = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      req._orgId = profile.orgId;
      req._profile = profile;
      next();
    } catch (err) {
      next(err);
    }
  };

  app.get("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getProfile(userId);
      if (!profile) return res.status(404).json(null);
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.patch("/api/profile", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updateSchema = z.object({
        fullName: z.string().min(1, "Name is required"),
      });
      const parsed = updateSchema.parse(req.body);
      const profile = await storage.updateProfile(userId, parsed);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      res.json(profile);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0].message });
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.get("/api/organization", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const org = await storage.getOrganization(req._orgId);
      if (!org) return res.status(404).json({ message: "Organization not found" });
      res.json(org);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch organization" });
    }
  });

  app.patch("/api/organization", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      if (req._profile.role !== "owner") {
        return res.status(403).json({ message: "Only the organization owner can update settings" });
      }
      const updateSchema = z.object({
        name: z.string().min(1, "Organization name is required").optional(),
        logoUrl: z.string().url().optional().nullable().or(z.literal("")),
      });
      const parsed = updateSchema.parse(req.body);
      const updateData: any = {};
      if (parsed.name !== undefined) updateData.name = parsed.name;
      if (parsed.logoUrl !== undefined) updateData.logoUrl = parsed.logoUrl || null;
      const org = await storage.updateOrganization(req._orgId, updateData);
      if (!org) return res.status(404).json({ message: "Organization not found" });
      res.json(org);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0].message });
      res.status(500).json({ message: "Failed to update organization" });
    }
  });

  app.post("/api/onboarding", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const existing = await storage.getProfile(userId);
      if (existing) return res.status(400).json({ message: "Already onboarded" });

      const schema = z.object({
        fullName: z.string().min(2),
        agencyName: z.string().min(2),
      });
      const { fullName, agencyName } = schema.parse(req.body);

      const slug = await generateUniqueSlug(agencyName);
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const org = await storage.createOrganization({
        name: agencyName,
        slug,
        plan: "trial",
        planStatus: "active",
        trialEndsAt,
        maxAdvisors: 3,
        maxClients: 50,
      });

      const profile = await storage.createProfile({
        id: userId,
        orgId: org.id,
        role: "owner",
        fullName,
        email: req.user.claims.email || null,
        avatarUrl: req.user.claims.profile_image_url || null,
      });

      res.json({ organization: org, profile });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Onboarding error:", error);
      res.status(500).json({ message: "Onboarding failed" });
    }
  });

  app.get("/api/stats", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const stats = await storage.getStats(req._orgId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/recent-trips", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);
      const recentTrips = await storage.getRecentTripsWithClient(req._orgId, limit);
      res.json(recentTrips);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent trips" });
    }
  });

  app.get("/api/trips", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const tripsWithClients = await storage.getTripsWithClientByOrg(req._orgId);
      res.json(tripsWithClients);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trips" });
    }
  });

  app.get("/api/trips/:id", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const trip = await storage.getTrip(req.params.id, req._orgId);
      if (!trip) return res.status(404).json({ message: "Trip not found" });
      res.json(trip);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trip" });
    }
  });

  app.get("/api/trip-view/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const data = await storage.getTripFullView(req.params.id);
      if (!data) return res.status(404).json({ message: "Trip not found" });

      const profile = await storage.getProfile(userId);
      const isOrgMember = profile && profile.orgId === data.trip.orgId;

      let isInvitedClient = false;
      if (data.trip.clientId && data.client?.email) {
        const userEmail = req.user.claims.email;
        if (userEmail && userEmail.toLowerCase() === data.client.email.toLowerCase()) {
          isInvitedClient = true;
        }
      }

      if (!isOrgMember && !isInvitedClient) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(data);
    } catch (error) {
      console.error("Trip view error:", error);
      res.status(500).json({ message: "Failed to fetch trip view" });
    }
  });

  app.post("/api/trips", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const orgId = req._orgId;
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ message: "Organization not found" });

      const limits = PLAN_LIMITS[org.plan] || PLAN_LIMITS.trial;
      const tripCount = await storage.countTripsByOrg(orgId);
      if (tripCount >= limits.maxTrips) {
        return res.status(403).json({
          message: "Trip limit reached",
          upgrade: true,
          limit: limits.maxTrips,
          current: tripCount,
        });
      }

      const tripData = {
        ...req.body,
        orgId,
        startDate: req.body.startDate ? new Date(req.body.startDate) : null,
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      };

      const trip = await storage.createTrip(tripData);

      await storage.createTripVersion({
        tripId: trip.id,
        orgId,
        versionNumber: 1,
        name: "Version 1",
        isPrimary: true,
      });

      res.status(201).json(trip);
    } catch (error: any) {
      console.error("Create trip error:", error);
      res.status(500).json({ message: "Failed to create trip" });
    }
  });

  app.patch("/api/trips/:id", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const updateData = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : null,
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      };
      const trip = await storage.updateTrip(req.params.id, req._orgId, updateData);
      if (!trip) return res.status(404).json({ message: "Trip not found" });
      res.json(trip);
    } catch (error) {
      res.status(500).json({ message: "Failed to update trip" });
    }
  });

  app.delete("/api/trips/:id", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const deleted = await storage.deleteTrip(req.params.id, req._orgId);
      if (!deleted) return res.status(404).json({ message: "Trip not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete trip" });
    }
  });

  app.get("/api/clients", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const clientsList = await storage.getClientsByOrgWithTripCount(req._orgId);
      res.json(clientsList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const client = await storage.getClient(req.params.id, req._orgId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const orgId = req._orgId;
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ message: "Organization not found" });

      const limits = PLAN_LIMITS[org.plan] || PLAN_LIMITS.trial;
      const clientCount = await storage.countClientsByOrgNew(orgId);
      if (clientCount >= limits.maxClients) {
        return res.status(403).json({
          message: "Client limit reached",
          upgrade: true,
          limit: limits.maxClients,
          current: clientCount,
        });
      }

      const schema = z.object({
        fullName: z.string().min(1, "Name is required"),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional().or(z.literal("")),
        notes: z.string().optional().or(z.literal("")),
        tags: z.array(z.string()).optional(),
      });

      const parsed = schema.parse(req.body);
      const client = await storage.createClient({
        orgId,
        fullName: parsed.fullName,
        email: parsed.email || null,
        phone: parsed.phone || null,
        notes: parsed.notes || null,
        tags: parsed.tags || null,
      });
      res.status(201).json(client);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Create client error:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  app.get("/api/clients/:id/trips", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const clientTrips = await storage.getTripsByClient(req.params.id, req._orgId);
      res.json(clientTrips);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client trips" });
    }
  });

  app.patch("/api/clients/:id", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const updateSchema = z.object({
        fullName: z.string().min(1).optional(),
        email: z.string().email().optional().or(z.literal("")).or(z.null()),
        phone: z.string().optional().or(z.literal("")).or(z.null()),
        notes: z.string().optional().or(z.literal("")).or(z.null()),
        tags: z.array(z.string()).optional().or(z.null()),
      });
      const parsed = updateSchema.parse(req.body);
      const client = await storage.updateClient(req.params.id, req._orgId, parsed);
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json(client);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.post("/api/clients/:id/invite", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const client = await storage.getClient(req.params.id, req._orgId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      if (!client.email) return res.status(400).json({ message: "Client has no email address" });

      const updated = await storage.updateClient(req.params.id, req._orgId, {
        invited: "yes",
        invitedAt: new Date(),
      } as any);

      res.json({ success: true, client: updated });
    } catch (error) {
      console.error("Invite client error:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  app.patch("/api/clients/:id/preferences", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const client = await storage.getClient(req.params.id, req._orgId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const updated = await storage.updateClient(req.params.id, req._orgId, {
        preferences: req.body,
        preferencesUpdatedAt: new Date(),
      } as any);

      res.json(updated);
    } catch (error) {
      console.error("Update preferences error:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  app.get("/api/trips/:id/full", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const trip = await storage.getTripWithClient(req.params.id, req._orgId);
      if (!trip) return res.status(404).json({ message: "Trip not found" });
      const versions = await storage.getTripVersions(req.params.id, req._orgId);
      res.json({ trip, versions });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trip" });
    }
  });

  app.get("/api/trips/:tripId/versions/:versionId/segments", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const segments = await storage.getTripSegments(req.params.versionId, req._orgId);
      res.json(segments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch segments" });
    }
  });

  app.post("/api/trips/:tripId/versions/:versionId/segments", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const segmentSchema = z.object({
        dayNumber: z.number().int().min(1),
        sortOrder: z.number().int().optional().default(0),
        type: z.enum(["flight", "charter", "hotel", "transport", "restaurant", "activity", "note"]),
        title: z.string().min(1, "Title is required"),
        subtitle: z.string().optional().nullable(),
        startTime: z.string().optional().nullable(),
        endTime: z.string().optional().nullable(),
        confirmationNumber: z.string().optional().nullable(),
        cost: z.number().optional().nullable(),
        currency: z.string().optional().default("USD"),
        notes: z.string().optional().nullable(),
        photos: z.array(z.string()).optional().nullable(),
        metadata: z.record(z.any()).optional().nullable(),
      });
      const parsed = segmentSchema.parse(req.body);
      const segment = await storage.createTripSegment({
        ...parsed,
        versionId: req.params.versionId,
        tripId: req.params.tripId,
        orgId: req._orgId,
      });
      res.status(201).json(segment);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Create segment error:", error);
      res.status(500).json({ message: "Failed to create segment" });
    }
  });

  app.patch("/api/trips/:tripId/segments/:segmentId", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const updateSchema = z.object({
        dayNumber: z.number().int().min(1).optional(),
        sortOrder: z.number().int().optional(),
        type: z.enum(["flight", "charter", "hotel", "transport", "restaurant", "activity", "note"]).optional(),
        title: z.string().min(1).optional(),
        subtitle: z.string().optional().nullable(),
        startTime: z.string().optional().nullable(),
        endTime: z.string().optional().nullable(),
        confirmationNumber: z.string().optional().nullable(),
        cost: z.number().optional().nullable(),
        currency: z.string().optional(),
        notes: z.string().optional().nullable(),
        photos: z.array(z.string()).optional().nullable(),
        metadata: z.record(z.any()).optional().nullable(),
      });
      const parsed = updateSchema.parse(req.body);
      const segment = await storage.updateTripSegment(req.params.segmentId, req._orgId, parsed);
      if (!segment) return res.status(404).json({ message: "Segment not found" });
      res.json(segment);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update segment" });
    }
  });

  app.delete("/api/trips/:tripId/segments/:segmentId", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const deleted = await storage.deleteTripSegment(req.params.segmentId, req._orgId);
      if (!deleted) return res.status(404).json({ message: "Segment not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete segment" });
    }
  });

  app.post("/api/trips/:tripId/versions/:versionId/segments/reorder", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const { segmentIds } = z.object({ segmentIds: z.array(z.string()) }).parse(req.body);
      await storage.reorderTripSegments(req.params.versionId, req._orgId, segmentIds);
      res.json({ success: true });
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: "Invalid segment IDs" });
      res.status(500).json({ message: "Failed to reorder segments" });
    }
  });

  app.post("/api/trips/:tripId/versions", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const { sourceVersionId, name } = z.object({
        sourceVersionId: z.string(),
        name: z.string().min(1, "Version name is required"),
      }).parse(req.body);
      const newVersion = await storage.duplicateTripVersion(sourceVersionId, req.params.tripId, req._orgId, name);
      res.status(201).json(newVersion);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0].message });
      console.error("Duplicate version error:", error);
      res.status(500).json({ message: "Failed to create version" });
    }
  });

  app.patch("/api/trips/:tripId/versions/:versionId", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        isPrimary: z.boolean().optional(),
      });
      const parsed = updateSchema.parse(req.body);

      if (parsed.isPrimary) {
        await storage.setTripVersionPrimary(req.params.versionId, req.params.tripId, req._orgId);
      }
      const version = await storage.updateTripVersion(req.params.versionId, req._orgId, parsed);
      if (!version) return res.status(404).json({ message: "Version not found" });
      res.json(version);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0].message });
      res.status(500).json({ message: "Failed to update version" });
    }
  });

  app.delete("/api/trips/:tripId/versions/:versionId", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const versions = await storage.getTripVersions(req.params.tripId, req._orgId);
      if (versions.length <= 1) {
        return res.status(400).json({ message: "Cannot delete the only version" });
      }
      const targetVersion = versions.find(v => v.id === req.params.versionId);
      if (targetVersion?.isPrimary) {
        return res.status(400).json({ message: "Cannot delete the primary version. Set another version as primary first." });
      }
      const deleted = await storage.deleteTripVersion(req.params.versionId, req._orgId);
      if (!deleted) return res.status(404).json({ message: "Version not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete version" });
    }
  });

  app.get("/api/export/pdf", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const { tripId, versionId } = req.query;
      if (!tripId) return res.status(400).json({ message: "tripId is required" });

      const fullData = await storage.getTripFullView(tripId as string);
      if (!fullData) return res.status(404).json({ message: "Trip not found" });
      if (fullData.trip.orgId !== req._orgId) return res.status(403).json({ message: "Access denied" });

      let selectedVersion = fullData.versions.find(v => v.isPrimary);
      if (versionId) {
        const v = fullData.versions.find(v => v.id === versionId);
        if (v) selectedVersion = v;
      }
      if (!selectedVersion) return res.status(404).json({ message: "No version found" });

      const segments = (selectedVersion as any).segments || [];

      const pdfStream = await generateTripPdf({
        trip: fullData.trip,
        organization: fullData.organization,
        advisor: fullData.advisor,
        client: fullData.client,
        version: selectedVersion,
        segments,
      });

      const filename = `${fullData.trip.title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_")}_Itinerary.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      (pdfStream as any).pipe(res);
    } catch (error) {
      console.error("PDF export error:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  app.get("/api/export/calendar", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const { tripId, versionId } = req.query;
      if (!tripId) return res.status(400).json({ message: "tripId is required" });

      const fullData = await storage.getTripFullView(tripId as string);
      if (!fullData) return res.status(404).json({ message: "Trip not found" });
      if (fullData.trip.orgId !== req._orgId) return res.status(403).json({ message: "Access denied" });

      let selectedVersion = fullData.versions.find(v => v.isPrimary);
      if (versionId) {
        const v = fullData.versions.find(v => v.id === versionId);
        if (v) selectedVersion = v;
      }
      if (!selectedVersion) return res.status(404).json({ message: "No version found" });

      const segments = (selectedVersion as any).segments || [];

      const ics = generateCalendar({
        trip: fullData.trip,
        organization: fullData.organization,
        version: selectedVersion,
        segments,
      });

      const filename = `${fullData.trip.title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_")}.ics`;
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(ics);
    } catch (error) {
      console.error("Calendar export error:", error);
      res.status(500).json({ message: "Failed to generate calendar" });
    }
  });

  app.get("/api/members", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const members = await storage.getProfilesByOrg(req._orgId);
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.get("/api/plan-limits", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const org = await storage.getOrganization(req._orgId);
      if (!org) return res.status(404).json({ message: "Organization not found" });

      const limits = PLAN_LIMITS[org.plan] || PLAN_LIMITS.trial;
      const [advisorCount, clientCount, tripCount] = await Promise.all([
        storage.countAdvisorsByOrg(req._orgId),
        storage.countClientsByOrg(req._orgId),
        storage.countTripsByOrg(req._orgId),
      ]);

      res.json({
        plan: org.plan,
        advisors: { current: advisorCount, max: limits.maxAdvisors },
        clients: { current: clientCount, max: limits.maxClients },
        trips: { current: tripCount, max: limits.maxTrips === Infinity ? -1 : limits.maxTrips },
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch plan limits" });
    }
  });

  return httpServer;
}
