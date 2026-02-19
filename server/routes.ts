import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { storage } from "./storage";
import { z } from "zod";

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

  app.get("/api/trips", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const trips = await storage.getTripsByOrg(req._orgId);
      res.json(trips);
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
      const clients = await storage.getClientsByOrg(req._orgId);
      res.json(clients);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clients" });
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
