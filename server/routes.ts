import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";

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

  app.get("/api/organization", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const org = await storage.getOrganization(req._orgId);
      if (!org) return res.status(404).json({ message: "Organization not found" });
      res.json(org);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch organization" });
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
