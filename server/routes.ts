import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { ObjectStorageService, ObjectNotFoundError } from "./replit_integrations/object_storage";
import { storage } from "./storage";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generateTripPdf } from "./pdf-generator";
import { generateCalendar } from "./calendar-generator";
import { checkSingleFlight } from "./flight-tracker";
import { differenceInCalendarDays } from "date-fns";
import { sendTeamInviteEmail, sendClientPortalInviteEmail, sendSelectionSubmittedEmail } from "./email";
import { segmentVariants, tripSegments, trips, profiles, clients } from "@shared/schema";
import webpush from "web-push";

const objectStorageService = new ObjectStorageService();

function assignDayFromDate(
  departureDate: string,
  tripStartDate: Date | string,
  tripEndDate: Date | string | null
): number {
  const dep = new Date(departureDate + "T00:00:00");
  const startStr = typeof tripStartDate === "string"
    ? tripStartDate : tripStartDate.toISOString();
  const start = new Date(startStr.split("T")[0] + "T00:00:00");
  const diff = differenceInCalendarDays(dep, start);
  const day = Math.max(1, diff + 1);

  if (tripEndDate) {
    const endStr = typeof tripEndDate === "string"
      ? tripEndDate : tripEndDate.toISOString();
    const end = new Date(endStr.split("T")[0] + "T00:00:00");
    const maxDay = differenceInCalendarDays(end, start) + 1;
    return Math.min(day, maxDay);
  }
  return day;
}

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@travellab.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function sendPushToOrg(orgId: string, payload: { title: string; body: string; url?: string }, excludeProfileId?: string) {
  try {
    const subs = await storage.getPushSubscriptionsForOrg(orgId);
    const filtered = excludeProfileId ? subs.filter(s => s.profileId !== excludeProfileId) : subs;
    const payloadStr = JSON.stringify(payload);
    await Promise.allSettled(
      filtered.map(sub =>
        webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }, payloadStr).catch(() => {})
      )
    );
  } catch {}
}

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

async function syncFlightTracking(segment: any, tripId: string, orgId: string) {
  const meta = segment.metadata as Record<string, any> | null;
  if (segment.type !== "flight" || !meta?.flightNumber) {
    await storage.deleteFlightTrackingBySegment(segment.id);
    return;
  }

  const flightNumber = meta.flightNumber as string;
  let flightDate = "";
  if (meta.departureDate) {
    flightDate = meta.departureDate as string;
  } else if (meta.departureDateTime) {
    flightDate = (meta.departureDateTime as string).split("T")[0];
  }
  if (!flightDate) return;

  const composeDatetime = (date: string | undefined, time: string | undefined): string | null => {
    if (!date) return null;
    return time ? `${date}T${time}` : `${date}T00:00`;
  };

  const scheduledDeparture = composeDatetime(meta.departureDate, meta.departureTime) || meta.departureDateTime || null;
  const scheduledArrival = composeDatetime(meta.arrivalDate, meta.arrivalTime) || meta.arrivalDateTime || null;

  const existing = await storage.getFlightTrackingBySegment(segment.id);
  if (existing) {
    if (existing.flightNumber !== flightNumber || existing.flightDate !== flightDate) {
      await storage.updateFlightTracking(existing.id, {
        flightNumber,
        flightDate,
        scheduledDeparture,
        scheduledArrival,
        isActive: true,
        lastStatus: null,
        lastCheckedAt: null,
      });
    }
  } else {
    await storage.createFlightTracking({
      segmentId: segment.id,
      tripId,
      orgId,
      flightNumber,
      flightDate,
      scheduledDeparture,
      scheduledArrival,
      isActive: true,
    });
  }
}

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
        fullName: z.string().min(1, "Name is required").optional(),
        phone: z.string().optional().nullable(),
        website: z.string().optional().nullable(),
        timeFormat: z.enum(["12h", "24h"]).optional(),
      });
      const parsed = updateSchema.parse(req.body);
      const updateData: any = {};
      if (parsed.fullName !== undefined) updateData.fullName = parsed.fullName;
      if (parsed.phone !== undefined) updateData.phone = parsed.phone || null;
      if (parsed.website !== undefined) updateData.website = parsed.website || null;
      if (parsed.timeFormat !== undefined) updateData.timeFormat = parsed.timeFormat;
      const profile = await storage.updateProfile(userId, updateData);
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
      const profile = req._profile;
      const statusFilter = req.query.status as string | undefined;

      if (profile.role === "owner" || profile.canViewAllClients) {
        if (statusFilter === "archived") {
          const tripsWithClients = await storage.getTripsWithClientByStatus(req._orgId, "archived");
          return res.json(tripsWithClients);
        }
        const tripsWithClients = await storage.getTripsWithClientByOrg(req._orgId, "archived");
        return res.json(tripsWithClients);
      }
      const allTrips = await storage.getTripsByAdvisor(req._orgId, profile.id);
      if (statusFilter === "archived") {
        return res.json(allTrips.filter(t => t.status === "archived"));
      }
      res.json(allTrips.filter(t => t.status !== "archived"));
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

  app.get("/api/trip-view/:id", async (req: any, res) => {
    try {
      const token = req.query.token as string | undefined;
      const data = await storage.getTripFullView(req.params.id);
      if (!data) return res.status(404).json({ message: "Trip not found" });

      let isAuthenticatedUser = false;
      const userId = req.user?.claims?.sub;
      if (userId) {
        const profile = await storage.getProfile(userId);
        if (profile && profile.orgId === data.trip.orgId) {
          isAuthenticatedUser = true;
        }
        if (!isAuthenticatedUser && data.trip.clientId && data.client?.email) {
          const userEmail = req.user.claims.email;
          if (userEmail && userEmail.toLowerCase() === data.client.email.toLowerCase()) {
            isAuthenticatedUser = true;
          }
        }
      }

      const isValidToken = !!(token && data.trip.shareEnabled && data.trip.shareToken === token);

      if (!isAuthenticatedUser && !isValidToken) {
        return res.status(403).json({ message: "Access denied", requiresToken: true });
      }

      res.json(data);
    } catch (error) {
      console.error("Trip view error:", error);
      res.status(500).json({ message: "Failed to fetch trip view" });
    }
  });

  app.post("/api/trips/:id/share-token", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const trip = await storage.getTrip(req.params.id, req._orgId);
      if (!trip) return res.status(404).json({ message: "Trip not found" });
      const token = crypto.randomBytes(16).toString("hex");
      const updated = await storage.updateTrip(req.params.id, req._orgId, {
        shareToken: token,
        shareEnabled: true,
      } as any);
      res.json({ token, shareEnabled: true });
    } catch (error) {
      console.error("Generate share token error:", error);
      res.status(500).json({ message: "Failed to generate share token" });
    }
  });

  app.patch("/api/trips/:id/share", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const trip = await storage.getTrip(req.params.id, req._orgId);
      if (!trip) return res.status(404).json({ message: "Trip not found" });
      const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
      await storage.updateTrip(req.params.id, req._orgId, {
        shareEnabled: enabled,
      } as any);
      res.json({ shareEnabled: enabled });
    } catch (error) {
      console.error("Toggle share error:", error);
      res.status(500).json({ message: "Failed to update sharing" });
    }
  });

  // ─── VARIANT ROUTES ────────────────────────────────────────────────

  app.get("/api/segments/:segmentId/variants", async (req: any, res) => {
    try {
      const { segmentId } = req.params;
      const token = req.query.token as string | undefined;

      // Try authenticated access first
      if (req._orgId) {
        const variants = await storage.getVariantsBySegment(segmentId, req._orgId);
        return res.json(variants);
      }

      // Token-based public access
      if (token) {
        const { db } = await import("./db");
        const { eq, and } = await import("drizzle-orm");
        const [seg] = await db.select({ tripId: tripSegments.tripId, orgId: tripSegments.orgId })
          .from(tripSegments).where(eq(tripSegments.id, segmentId));
        if (!seg) return res.status(404).json({ message: "Segment not found" });

        const [trip] = await db.select({ shareToken: trips.shareToken, shareEnabled: trips.shareEnabled })
          .from(trips).where(eq(trips.id, seg.tripId));
        if (!trip || !trip.shareEnabled || trip.shareToken !== token) {
          return res.status(403).json({ message: "Access denied" });
        }

        const variants = await storage.getVariantsBySegment(segmentId, seg.orgId);
        return res.json(variants);
      }

      return res.status(401).json({ message: "Authentication required" });
    } catch (error) {
      console.error("Get variants error:", error);
      res.status(500).json({ message: "Failed to get variants" });
    }
  });

  app.post("/api/segments/:segmentId/variants", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const { segmentId } = req.params;
      const orgId = req._orgId;
      const variantData = { ...req.body, segmentId, orgId };
      const variant = await storage.createVariant(variantData);
      res.json(variant);
    } catch (error) {
      console.error("Create variant error:", error);
      res.status(500).json({ message: "Failed to create variant" });
    }
  });

  app.patch("/api/segments/:segmentId/variants/:variantId", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const { variantId } = req.params;
      const orgId = req._orgId;
      const variant = await storage.updateVariant(variantId, orgId, req.body);
      if (!variant) return res.status(404).json({ message: "Variant not found" });
      res.json(variant);
    } catch (error) {
      console.error("Update variant error:", error);
      res.status(500).json({ message: "Failed to update variant" });
    }
  });

  app.delete("/api/segments/:segmentId/variants/:variantId", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const { variantId } = req.params;
      const orgId = req._orgId;
      await storage.deleteVariant(variantId, orgId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete variant error:", error);
      res.status(500).json({ message: "Failed to delete variant" });
    }
  });

  app.post("/api/segments/:segmentId/variants/:variantId/select", async (req: any, res) => {
    try {
      const { segmentId, variantId } = req.params;
      const token = req.query.token as string;
      if (!token) return res.status(401).json({ message: "Token required" });

      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const [seg] = await db.select({ tripId: tripSegments.tripId, orgId: tripSegments.orgId })
        .from(tripSegments).where(eq(tripSegments.id, segmentId));
      if (!seg) return res.status(404).json({ message: "Segment not found" });

      const [trip] = await db.select({ shareToken: trips.shareToken, shareEnabled: trips.shareEnabled })
        .from(trips).where(eq(trips.id, seg.tripId));
      if (!trip || !trip.shareEnabled || trip.shareToken !== token) {
        return res.status(403).json({ message: "Access denied" });
      }

      const variants = await storage.selectVariant(segmentId, variantId);
      res.json(variants);
    } catch (error) {
      console.error("Select variant error:", error);
      res.status(500).json({ message: "Failed to select variant" });
    }
  });

  app.post("/api/trips/:tripId/submit-selections", async (req: any, res) => {
    try {
      const { tripId } = req.params;
      const token = req.query.token as string;
      if (!token) return res.status(401).json({ message: "Token required" });

      const { db } = await import("./db");
      const { eq, and, inArray } = await import("drizzle-orm");

      const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
      if (!trip || !trip.shareEnabled || trip.shareToken !== token) {
        return res.status(403).json({ message: "Access denied" });
      }

      const result = await storage.submitVariantsForTrip(tripId);

      // Send summary email to advisor
      try {
        if (trip.advisorId) {
          const [advisor] = await db.select({ email: profiles.email, fullName: profiles.fullName })
            .from(profiles).where(eq(profiles.id, trip.advisorId));

          let clientName = "Client";
          if (trip.clientId) {
            const [cl] = await db.select({ fullName: clients.fullName })
              .from(clients).where(eq(clients.id, trip.clientId));
            if (cl) clientName = cl.fullName;
          }

          if (advisor?.email) {
            // Get submitted variants for email
            const segs = await db.select({ id: tripSegments.id, title: tripSegments.title })
              .from(tripSegments)
              .where(and(eq(tripSegments.tripId, tripId), eq(tripSegments.hasVariants, true)));

            const segIds = segs.map(s => s.id);
            const submittedVariants = segIds.length > 0
              ? await db.select().from(segmentVariants)
                  .where(and(
                    inArray(segmentVariants.segmentId, segIds),
                    eq(segmentVariants.isSubmitted, true),
                    eq(segmentVariants.isSelected, true)
                  ))
              : [];

            const selections = submittedVariants.map(v => {
              const seg = segs.find(s => s.id === v.segmentId);
              return {
                segmentTitle: seg?.title || "Segment",
                variantLabel: v.label,
                price: v.cost ? new Intl.NumberFormat("en-US", { style: "currency", currency: v.currency || "USD", minimumFractionDigits: 0 }).format(v.cost) : undefined,
              };
            });

            await sendSelectionSubmittedEmail({
              toEmail: advisor.email,
              clientName,
              tripTitle: trip.title,
              selections,
              submitted: result.submitted,
              pending: result.pending,
            });
          }
        }
      } catch (emailErr) {
        console.error("Selection email failed:", emailErr);
      }

      res.json(result);
    } catch (error) {
      console.error("Submit selections error:", error);
      res.status(500).json({ message: "Failed to submit selections" });
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
      const profile = req._profile;
      if (profile.role === "owner" || profile.canViewAllClients) {
        const clientsList = await storage.getClientsByOrgWithTripCount(req._orgId);
        return res.json(clientsList);
      }
      const clientsList = await storage.getClientsByAdvisor(req._orgId, profile.id);
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
        assignedAdvisorId: z.string().optional().or(z.null()),
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
      const emailToSend = (req.body.email && req.body.email.trim()) || client.email;
      if (!emailToSend) return res.status(400).json({ message: "No email address provided" });
      if (emailToSend && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToSend)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      const updated = await storage.updateClient(req.params.id, req._orgId, {
        invited: "yes",
        invitedAt: new Date(),
      } as any);

      const profile = await storage.getProfile(req._userId);
      const org = await storage.getOrganization(req._orgId);
      const appUrl = `${req.protocol}://${req.get("host")}`;

      try {
        await sendClientPortalInviteEmail({
          toEmail: emailToSend,
          clientName: client.fullName,
          advisorName: profile?.fullName || "Your travel advisor",
          orgName: org?.name || "Travel Lab",
          appUrl,
        });
      } catch (emailErr) {
        console.error("[Email] Failed to send client portal invite:", emailErr);
      }

      res.json({ success: true, client: updated, sentTo: emailToSend });
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

  app.patch("/api/clients/:id/assign-advisor", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const profile = req._profile;
      if (profile.role !== "owner") {
        return res.status(403).json({ message: "Only owners can assign advisors" });
      }
      const { advisorId } = req.body;
      const client = await storage.updateClient(req.params.id, req._orgId, {
        assignedAdvisorId: advisorId || null,
      } as any);
      if (!client) return res.status(404).json({ message: "Client not found" });
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: "Failed to assign advisor" });
    }
  });

  app.get("/api/clients/:id/collaborators", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const collaborators = await storage.getClientCollaborators(req.params.id, req._orgId);
      res.json(collaborators);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collaborators" });
    }
  });

  app.post("/api/clients/:id/collaborators", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const profile = req._profile;
      if (profile.role !== "owner") {
        return res.status(403).json({ message: "Only owners can manage collaborators" });
      }
      const { advisorId } = req.body;
      if (!advisorId) return res.status(400).json({ message: "advisorId is required" });

      const collab = await storage.addClientCollaborator({
        clientId: req.params.id,
        advisorId,
        orgId: req._orgId,
      });
      res.json(collab);
    } catch (error) {
      res.status(500).json({ message: "Failed to add collaborator" });
    }
  });

  app.delete("/api/clients/:clientId/collaborators/:collabId", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const profile = req._profile;
      if (profile.role !== "owner") {
        return res.status(403).json({ message: "Only owners can manage collaborators" });
      }
      const removed = await storage.removeClientCollaborator(req.params.collabId, req._orgId);
      if (!removed) return res.status(404).json({ message: "Collaborator not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove collaborator" });
    }
  });

  app.get("/api/clients/:clientId/companions", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const companions = await storage.getClientCompanions(req.params.clientId, req._orgId);
      res.json(companions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch companions" });
    }
  });

  app.post("/api/client-relationships", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const { clientIdA, clientIdB, relationshipLabel } = req.body;
      if (!clientIdA || !clientIdB) return res.status(400).json({ message: "Both client IDs required" });
      if (clientIdA === clientIdB) return res.status(400).json({ message: "Cannot link a client to themselves" });
      const clientA = await storage.getClient(clientIdA, req._orgId);
      const clientB = await storage.getClient(clientIdB, req._orgId);
      if (!clientA || !clientB) return res.status(404).json({ message: "Client not found" });
      const result = await storage.createClientRelationship({
        orgId: req._orgId,
        clientIdA,
        clientIdB,
        relationshipLabel: relationshipLabel || null,
      });
      res.status(201).json(result);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ message: "Relationship already exists" });
      }
      res.status(500).json({ message: "Failed to create relationship" });
    }
  });

  app.delete("/api/client-relationships/:id", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const removed = await storage.deleteClientRelationship(req.params.id, req._orgId);
      if (!removed) return res.status(404).json({ message: "Relationship not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete relationship" });
    }
  });

  app.patch("/api/team/:memberId/permissions", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const profile = req._profile;
      if (profile.role !== "owner") {
        return res.status(403).json({ message: "Only owners can change permissions" });
      }
      const { canViewAllClients } = req.body;
      if (typeof canViewAllClients !== "boolean") {
        return res.status(400).json({ message: "canViewAllClients must be a boolean" });
      }
      const updated = await storage.updateProfile(req.params.memberId, { canViewAllClients } as any);
      if (!updated) return res.status(404).json({ message: "Member not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update permissions" });
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
        type: z.enum(["flight", "charter", "charter_flight", "hotel", "transport", "restaurant", "activity", "note"]),
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
        journeyId: z.string().optional().nullable(),
      });
      const parsed = segmentSchema.parse(req.body);

      const trip = await storage.getTrip(req.params.tripId, req._orgId);
      if (
        trip?.startDate &&
        (parsed.type === "flight" || parsed.type === "charter_flight") &&
        (parsed.metadata as any)?.departureDate
      ) {
        parsed.dayNumber = assignDayFromDate(
          (parsed.metadata as any).departureDate,
          trip.startDate,
          trip.endDate ?? null
        );
      }

      const segment = await storage.createTripSegment({
        ...parsed,
        versionId: req.params.versionId,
        tripId: req.params.tripId,
        orgId: req._orgId,
      });
      await syncFlightTracking(segment, req.params.tripId, req._orgId).catch(e => console.error("Flight tracking sync error:", e));
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
        type: z.enum(["flight", "charter", "charter_flight", "hotel", "transport", "restaurant", "activity", "note"]).optional(),
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
        journeyId: z.string().optional().nullable(),
      });
      const parsed = updateSchema.parse(req.body);

      const segType = parsed.type || req.body.type;
      if (
        (segType === "flight" || segType === "charter_flight") &&
        (parsed.metadata as any)?.departureDate
      ) {
        const trip = await storage.getTrip(req.params.tripId, req._orgId);
        if (trip?.startDate) {
          parsed.dayNumber = assignDayFromDate(
            (parsed.metadata as any).departureDate,
            trip.startDate,
            trip.endDate ?? null
          );
        }
      }

      const segment = await storage.updateTripSegment(req.params.segmentId, req._orgId, parsed);
      if (!segment) return res.status(404).json({ message: "Segment not found" });
      await syncFlightTracking(segment, req.params.tripId, req._orgId).catch(e => console.error("Flight tracking sync error:", e));
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
        sourceVersionId: z.string().optional(),
        name: z.string().min(1, "Version name is required"),
      }).parse(req.body);

      if (sourceVersionId) {
        const newVersion = await storage.duplicateTripVersion(sourceVersionId, req.params.tripId, req._orgId, name);
        res.status(201).json(newVersion);
      } else {
        const existingVersions = await storage.getTripVersions(req.params.tripId, req._orgId);
        const nextNumber = existingVersions.length > 0
          ? Math.max(...existingVersions.map(v => v.versionNumber)) + 1
          : 1;
        const newVersion = await storage.createTripVersion({
          tripId: req.params.tripId,
          orgId: req._orgId,
          versionNumber: nextNumber,
          name,
          isPrimary: false,
        });
        res.status(201).json(newVersion);
      }
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0].message });
      console.error("Create version error:", error);
      res.status(500).json({ message: "Failed to create version" });
    }
  });

  app.patch("/api/trips/:tripId/versions/:versionId", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        isPrimary: z.boolean().optional(),
        showPricing: z.boolean().optional(),
        discount: z.number().int().min(0).max(1000000).optional(),
        discountType: z.enum(["fixed", "percent"]).optional(),
        discountLabel: z.string().nullable().optional(),
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

      console.log("[PDF] showPricing:", selectedVersion.showPricing);

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

  // ──── TEAM MANAGEMENT ──────────────────────────────────────────────

  app.patch("/api/members/:memberId/role", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      if (req._profile.role !== "owner") {
        return res.status(403).json({ message: "Only the owner can change roles" });
      }
      const schema = z.object({ role: z.enum(["owner", "advisor", "assistant"]) });
      const { role } = schema.parse(req.body);
      const memberId = req.params.memberId;
      if (memberId === req._profile.id) {
        return res.status(400).json({ message: "You cannot change your own role" });
      }
      const member = await storage.getProfile(memberId);
      if (!member || member.orgId !== req._orgId) {
        return res.status(404).json({ message: "Member not found" });
      }
      const updated = await storage.updateProfile(memberId, { role });
      res.json(updated);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0].message });
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/members/:memberId", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      if (req._profile.role !== "owner") {
        return res.status(403).json({ message: "Only the owner can remove members" });
      }
      const memberId = req.params.memberId;
      if (memberId === req._profile.id) {
        return res.status(400).json({ message: "You cannot remove yourself" });
      }
      const member = await storage.getProfile(memberId);
      if (!member || member.orgId !== req._orgId) {
        return res.status(404).json({ message: "Member not found" });
      }
      await storage.deleteProfile(memberId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  app.get("/api/invitations", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const invites = await storage.getInvitationsByOrg(req._orgId);
      res.json(invites);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.post("/api/invitations", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      if (req._profile.role !== "owner") {
        return res.status(403).json({ message: "Only the owner can invite members" });
      }
      const schema = z.object({
        email: z.string().email("Valid email required"),
        role: z.enum(["advisor", "assistant"]),
      });
      const { email, role } = schema.parse(req.body);

      const org = await storage.getOrganization(req._orgId);
      if (!org) return res.status(404).json({ message: "Organization not found" });

      const advisorCount = await storage.countAdvisorsByOrg(req._orgId);
      if (advisorCount >= org.maxAdvisors) {
        return res.status(403).json({
          message: "plan_limit",
          detail: `You've reached the ${org.plan} plan limit of ${org.maxAdvisors} team members.`,
        });
      }

      const existing = await storage.getInvitationByEmail(email, req._orgId);
      if (existing) {
        return res.status(409).json({ message: "An invitation for this email is already pending" });
      }

      const existingMembers = await storage.getProfilesByOrg(req._orgId);
      if (existingMembers.some((m) => m.email === email)) {
        return res.status(409).json({ message: "This person is already a member" });
      }

      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await storage.createInvitation({
        orgId: req._orgId,
        email,
        role,
        token,
        status: "pending",
        invitedBy: req._profile.id,
        expiresAt,
      });

      const appUrl = `${req.protocol}://${req.get("host")}`;
      try {
        await sendTeamInviteEmail({
          toEmail: email,
          inviterName: req._profile.fullName || "Your colleague",
          orgName: org.name,
          role,
          token,
          appUrl,
        });
      } catch (emailErr) {
        console.error("[Email] Failed to send team invite:", emailErr);
      }

      res.status(201).json(invitation);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0].message });
      console.error("Create invitation error:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.post("/api/invitations/:id/resend", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      if (req._profile.role !== "owner") {
        return res.status(403).json({ message: "Only the owner can resend invitations" });
      }
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      const updated = await storage.updateInvitation(req.params.id, { expiresAt, status: "pending" });
      if (!updated) return res.status(404).json({ message: "Invitation not found" });

      const org = await storage.getOrganization(req._orgId);
      const appUrl = `${req.protocol}://${req.get("host")}`;
      try {
        await sendTeamInviteEmail({
          toEmail: updated.email,
          inviterName: req._profile.fullName || "Your colleague",
          orgName: org?.name || "Travel Lab",
          role: updated.role,
          token: updated.token,
          appUrl,
        });
      } catch (emailErr) {
        console.error("[Email] Failed to resend team invite:", emailErr);
      }

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to resend invitation" });
    }
  });

  app.delete("/api/invitations/:id", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      if (req._profile.role !== "owner") {
        return res.status(403).json({ message: "Only the owner can cancel invitations" });
      }
      const deleted = await storage.deleteInvitation(req.params.id, req._orgId);
      if (!deleted) return res.status(404).json({ message: "Invitation not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel invitation" });
    }
  });

  app.post("/api/invitations/accept", isAuthenticated, async (req: any, res) => {
    try {
      const schema = z.object({ token: z.string().min(1) });
      const { token } = schema.parse(req.body);
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation) return res.status(404).json({ message: "Invitation not found" });
      if (invitation.status !== "pending") return res.status(400).json({ message: "Invitation is no longer valid" });
      if (new Date(invitation.expiresAt) < new Date()) {
        await storage.updateInvitation(invitation.id, { status: "expired" });
        return res.status(400).json({ message: "Invitation has expired" });
      }

      const userId = req.user.claims.sub;
      const existingProfile = await storage.getProfile(userId);
      if (existingProfile) {
        return res.status(400).json({ message: "You already belong to an organization" });
      }

      const profile = await storage.createProfile({
        id: userId,
        orgId: invitation.orgId,
        role: invitation.role as any,
        fullName: req.user.claims.first_name
          ? `${req.user.claims.first_name} ${req.user.claims.last_name || ""}`.trim()
          : req.user.claims.email || "Team Member",
        email: req.user.claims.email || invitation.email,
        avatarUrl: req.user.claims.profile_image_url || null,
        invitedBy: invitation.invitedBy,
      });

      await storage.updateInvitation(invitation.id, { status: "accepted", acceptedAt: new Date() });

      const org = await storage.getOrganization(invitation.orgId);
      res.json({ organization: org, profile });
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0].message });
      console.error("Accept invitation error:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // ──── DOCUMENT VAULT ──────────────────────────────────────────────

  app.post("/api/documents/request-upload", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const schema = z.object({
        fileName: z.string().min(1),
        fileType: z.string().min(1),
        fileSize: z.number().int().positive().max(MAX_FILE_SIZE, "File size exceeds 20MB limit"),
        tripId: z.string().min(1),
        clientId: z.string().optional().nullable(),
        label: z.string().min(1, "Label is required"),
        isVisibleToClient: z.boolean().default(true),
      });
      const parsed = schema.parse(req.body);

      if (!ALLOWED_FILE_TYPES.includes(parsed.fileType)) {
        return res.status(400).json({
          message: "File type not allowed. Accepted: PDF, JPG, PNG, WebP",
        });
      }

      const trip = await storage.getTrip(parsed.tripId, req._orgId);
      if (!trip) return res.status(404).json({ message: "Trip not found" });

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      const doc = await storage.createTripDocument({
        orgId: req._orgId,
        tripId: parsed.tripId,
        clientId: parsed.clientId || trip.clientId || null,
        uploadedBy: req._profile.id,
        fileName: parsed.fileName,
        fileType: parsed.fileType,
        fileSize: parsed.fileSize,
        storagePath: objectPath,
        label: parsed.label,
        isVisibleToClient: parsed.isVisibleToClient,
      });

      res.json({ uploadURL, document: doc });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Document upload error:", error);
      res.status(500).json({ message: "Failed to initiate upload" });
    }
  });

  app.get("/api/trips/:tripId/documents", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const trip = await storage.getTrip(req.params.tripId, req._orgId);
      if (!trip) return res.status(404).json({ message: "Trip not found" });
      const docs = await storage.getTripDocuments(req.params.tripId, req._orgId);
      res.json(docs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/clients/:clientId/documents", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const client = await storage.getClient(req.params.clientId, req._orgId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      const docs = await storage.getClientDocuments(req.params.clientId, req._orgId);
      res.json(docs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/:id/download", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const doc = await storage.getTripDocument(req.params.id, req._orgId);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const objectFile = await objectStorageService.getObjectEntityFile(doc.storagePath);
      res.setHeader("Content-Disposition", `attachment; filename="${doc.fileName}"`);
      await objectStorageService.downloadObject(objectFile, res, 60);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: "File not found in storage" });
      }
      console.error("Download error:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.patch("/api/documents/:id", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const updateSchema = z.object({
        label: z.string().min(1).optional(),
        isVisibleToClient: z.boolean().optional(),
      });
      const parsed = updateSchema.parse(req.body);
      const doc = await storage.updateTripDocument(req.params.id, req._orgId, parsed);
      if (!doc) return res.status(404).json({ message: "Document not found" });
      res.json(doc);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0].message });
      res.status(500).json({ message: "Failed to update document" });
    }
  });

  app.delete("/api/documents/:id", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const doc = await storage.deleteTripDocument(req.params.id, req._orgId);
      if (!doc) return res.status(404).json({ message: "Document not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // ──── NOTIFICATIONS ──────────────────────────────────────────────

  app.get("/api/notifications", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const notifs = await storage.getNotifications(req._profile.id, 20);
      const unreadCount = await storage.getUnreadNotificationCount(req._profile.id);
      res.json({ notifications: notifs, unreadCount });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/mark-all-read", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      await storage.markAllNotificationsRead(req._profile.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      await storage.markNotificationRead(req.params.id, req._profile.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // ──── FLIGHT TRACKING ──────────────────────────────────────────

  app.get("/api/trips/:tripId/flight-tracking", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const trackings = await storage.getFlightTrackingForTrip(req.params.tripId, req._orgId);
      res.json(trackings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch flight tracking data" });
    }
  });

  app.post("/api/flight-tracking/:segmentId/refresh", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const tracking = await storage.getFlightTrackingBySegment(req.params.segmentId);
      if (!tracking) return res.status(404).json({ message: "No flight tracking found for this segment" });
      if (tracking.orgId !== req._orgId) return res.status(403).json({ message: "Forbidden" });

      const newStatus = await checkSingleFlight(tracking);
      if (!newStatus) return res.status(502).json({ message: "Could not fetch flight status. Please try again later." });

      const updated = await storage.getFlightTrackingBySegment(req.params.segmentId);
      res.json(updated);
    } catch (error) {
      console.error("Flight refresh error:", error);
      res.status(500).json({ message: "Failed to refresh flight status" });
    }
  });

  // ──── SEGMENT TEMPLATES ─────────────────────────────────────────

  app.get("/api/segment-templates", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const templates = await storage.getSegmentTemplatesByOrg(req._orgId);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.post("/api/segment-templates", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const schema = z.object({
        type: z.enum(["flight", "charter", "charter_flight", "hotel", "transport", "restaurant", "activity", "note"]),
        label: z.string().min(1),
        data: z.record(z.any()),
      });
      const parsed = schema.parse(req.body);
      const template = await storage.createSegmentTemplate({
        ...parsed,
        orgId: req._orgId,
        createdBy: req._profile.id,
        useCount: 0,
      });
      res.status(201).json(template);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0].message });
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.patch("/api/segment-templates/:id", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const schema = z.object({
        label: z.string().min(1).optional(),
      });
      const parsed = schema.parse(req.body);
      const template = await storage.updateSegmentTemplate(req.params.id, req._orgId, parsed);
      if (!template) return res.status(404).json({ message: "Template not found" });
      res.json(template);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0].message });
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  app.delete("/api/segment-templates/:id", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const template = await storage.getSegmentTemplate(req.params.id, req._orgId);
      if (!template) return res.status(404).json({ message: "Template not found" });
      if (template.createdBy !== req._profile.id && req._profile.role !== "owner") {
        return res.status(403).json({ message: "Only template creator or org owner can delete" });
      }
      await storage.deleteSegmentTemplate(req.params.id, req._orgId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  app.post("/api/segment-templates/:id/use", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      await storage.incrementTemplateUseCount(req.params.id, req._orgId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to increment use count" });
    }
  });

  // ──── TRIP DUPLICATION ─────────────────────────────────────────

  app.post("/api/trips/:tripId/duplicate", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const schema = z.object({
        title: z.string().min(1),
        clientId: z.string().min(1),
        startDate: z.string().optional().nullable(),
      });
      const parsed = schema.parse(req.body);
      const orgId = req._orgId;

      const sourceTrip = await storage.getTrip(req.params.tripId, orgId);
      if (!sourceTrip) return res.status(404).json({ message: "Source trip not found" });

      let endDate: Date | null = null;
      let startDate: Date | null = parsed.startDate ? new Date(parsed.startDate) : null;
      if (startDate && sourceTrip.startDate && sourceTrip.endDate) {
        const durationMs = new Date(sourceTrip.endDate).getTime() - new Date(sourceTrip.startDate).getTime();
        endDate = new Date(startDate.getTime() + durationMs);
      }

      const newTrip = await storage.createTrip({
        orgId,
        title: parsed.title,
        destination: sourceTrip.destination,
        description: sourceTrip.description,
        coverImageUrl: sourceTrip.coverImageUrl,
        startDate: startDate,
        endDate: endDate,
        status: "draft",
        budget: sourceTrip.budget,
        currency: sourceTrip.currency,
        clientId: parsed.clientId,
        advisorId: req._profile.id,
        notes: sourceTrip.notes,
      });

      const sourceVersions = await storage.getTripVersions(req.params.tripId, orgId);

      for (const sv of sourceVersions) {
        const newVersion = await storage.createTripVersion({
          tripId: newTrip.id,
          orgId,
          versionNumber: sv.versionNumber,
          name: sv.name,
          isPrimary: sv.isPrimary,
        });

        const sourceSegments = await storage.getTripSegments(sv.id, orgId);
        for (const seg of sourceSegments) {
          const metaCopy = seg.metadata ? { ...(seg.metadata as Record<string, any>) } : null;
          if (metaCopy) {
            delete metaCopy.confirmationNumber;
          }
          await storage.createTripSegment({
            versionId: newVersion.id,
            tripId: newTrip.id,
            orgId,
            dayNumber: seg.dayNumber,
            sortOrder: seg.sortOrder,
            type: seg.type,
            title: seg.title,
            subtitle: seg.subtitle,
            startTime: seg.startTime,
            endTime: seg.endTime,
            confirmationNumber: null,
            cost: seg.cost,
            currency: seg.currency,
            notes: seg.notes,
            photos: seg.photos,
            metadata: metaCopy,
          });
        }
      }

      res.status(201).json(newTrip);
    } catch (error: any) {
      if (error.name === "ZodError") return res.status(400).json({ message: error.errors[0].message });
      console.error("Trip duplication error:", error);
      res.status(500).json({ message: "Failed to duplicate trip" });
    }
  });

  // ──── ANALYTICS ─────────────────────────────────────────────────

  app.get("/api/analytics", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const range = (req.query.range as string) || "12m";
      const orgId = req._orgId;
      const profileRole = req._profile.role;

      const data = await storage.getAnalytics(orgId, range, profileRole);
      res.json(data);
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
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

  // ── Messaging routes ──
  app.get("/api/conversations", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const convos = await storage.getConversationsByOrg(req._orgId);
      res.json(convos);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const { clientId } = req.body;
      if (!clientId) return res.status(400).json({ message: "clientId required" });
      const client = await storage.getClient(clientId, req._orgId);
      if (!client) return res.status(404).json({ message: "Client not found" });
      const convo = await storage.getOrCreateConversation(req._orgId, clientId);
      res.json(convo);
    } catch (error) {
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const msgs = await storage.getMessages(req.params.id, req._orgId);
      res.json(msgs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const convo = await storage.getConversation(req.params.id, req._orgId);
      if (!convo) return res.status(404).json({ message: "Conversation not found" });

      const profile = await storage.getProfile(req._userId);
      const msg = await storage.createMessage({
        conversationId: req.params.id,
        orgId: req._orgId,
        senderType: "advisor",
        senderId: req._userId,
        senderName: profile?.fullName || "Advisor",
        content: req.body.content,
        isRead: false,
      });
      sendPushToOrg(req._orgId, {
        title: `New message from ${profile?.fullName || "Advisor"}`,
        body: req.body.content?.substring(0, 100) || "New message",
        url: `/dashboard/messages?id=${req.params.id}`,
      }, req._userId).catch(() => {});
      res.json(msg);
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.post("/api/conversations/:id/read", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      await storage.markMessagesRead(req.params.id, req._orgId);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  app.get("/api/messages/unread-count", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const unreadCount = await storage.getUnreadMessageCount(req._orgId);
      res.json({ unreadCount });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // ── Flight tracking for trip cards (mobile) ──
  app.get("/api/trips/flight-status", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const activeFlights = await storage.getActiveFlightTrackingForDate(today);
      const orgFlights = activeFlights.filter((f: any) => f.orgId === req._orgId);
      const result: Record<string, { count: number; hasActive: boolean }> = {};
      for (const f of orgFlights) {
        if (!result[(f as any).tripId]) {
          result[(f as any).tripId] = { count: 0, hasActive: false };
        }
        result[(f as any).tripId].count++;
        result[(f as any).tripId].hasActive = true;
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch flight status" });
    }
  });

  // ── Google Places API (New) proxy endpoints ──

  const placesTypeMap: Record<string, string[]> = {
    "lodging": ["lodging"],
    "restaurant": ["restaurant"],
    "establishment": ["establishment"],
    "(cities)": ["locality", "administrative_area_level_3", "postal_town"],
  };

  app.get("/api/places/autocomplete", isAuthenticated, async (req: any, res) => {
    try {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        console.warn("[Places] GOOGLE_PLACES_API_KEY not configured");
        return res.status(503).json({ message: "Places API not configured" });
      }
      const { input, types } = req.query;
      if (!input || typeof input !== "string" || input.length < 2) {
        return res.json({ predictions: [] });
      }

      const body: any = { input };
      if (types && typeof types === "string" && placesTypeMap[types]) {
        body.includedPrimaryTypes = placesTypeMap[types];
      }

      const apiRes = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify(body),
      });
      const data = await apiRes.json();

      if (data.error) {
        console.warn("[Places] Autocomplete API error:", data.error.message);
        return res.json({ predictions: [] });
      }

      const predictions = (data.suggestions || [])
        .filter((s: any) => s.placePrediction)
        .map((s: any) => {
          const p = s.placePrediction;
          return {
            place_id: p.placeId,
            description: p.text?.text || "",
            structured_formatting: {
              main_text: p.structuredFormat?.mainText?.text || "",
              secondary_text: p.structuredFormat?.secondaryText?.text || "",
            },
          };
        });

      res.json({ predictions });
    } catch (error) {
      console.error("[Places] Autocomplete error:", error);
      res.status(500).json({ message: "Places autocomplete failed" });
    }
  });

  app.get("/api/places/details", isAuthenticated, async (req: any, res) => {
    try {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ message: "Places API not configured" });
      }
      const { placeId } = req.query;
      if (!placeId || typeof placeId !== "string") {
        return res.status(400).json({ message: "placeId required" });
      }

      const fieldMask = "displayName,formattedAddress,internationalPhoneNumber,websiteUri,googleMapsUri,rating,priceLevel,types,editorialSummary,reviews,photos,location";
      const url = `https://places.googleapis.com/v1/places/${placeId}?languageCode=en`;
      const apiRes = await fetch(url, {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
      });
      const result = await apiRes.json();

      if (result.error) {
        console.warn("[Places] Details API error:", result.error.message);
        return res.status(404).json({ message: "Place not found" });
      }

      const photoRefs = (result.photos || []).slice(0, 4).map((p: any) => p.name);
      const priceLevelMap: Record<string, number> = {
        PRICE_LEVEL_FREE: 0,
        PRICE_LEVEL_INEXPENSIVE: 1,
        PRICE_LEVEL_MODERATE: 2,
        PRICE_LEVEL_EXPENSIVE: 3,
        PRICE_LEVEL_VERY_EXPENSIVE: 4,
      };

      res.json({
        name: result.displayName?.text || "",
        address: result.formattedAddress || "",
        phone: result.internationalPhoneNumber || "",
        website: result.websiteUri || "",
        mapsUrl: result.googleMapsUri || "",
        rating: result.rating || null,
        priceLevel: result.priceLevel ? (priceLevelMap[result.priceLevel] ?? null) : null,
        types: result.types || [],
        editorialSummary: result.editorialSummary?.text || "",
        firstReview: result.reviews?.[0]?.text?.text || "",
        photoRefs,
        lat: result.location?.latitude || null,
        lng: result.location?.longitude || null,
      });
    } catch (error) {
      console.error("[Places] Details error:", error);
      res.status(500).json({ message: "Places details failed" });
    }
  });

  app.get("/api/places/photo", async (req, res) => {
    try {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return res.status(503).send("Places API not configured");
      }
      const { ref, maxwidth } = req.query;
      if (!ref || typeof ref !== "string") {
        return res.status(400).send("photo reference required");
      }
      const width = maxwidth && typeof maxwidth === "string" ? maxwidth : "800";
      const url = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${width}&key=${apiKey}`;
      const apiRes = await fetch(url, { redirect: "follow" });
      if (!apiRes.ok) {
        return res.status(apiRes.status).send("Photo not available");
      }
      const contentType = apiRes.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const buffer = Buffer.from(await apiRes.arrayBuffer());
      res.send(buffer);
    } catch (error) {
      console.error("[Places] Photo proxy error:", error);
      res.status(500).send("Photo proxy failed");
    }
  });

  // ── AeroDataBox flight proxies ──

  function parseAeroTime(dt: string): string {
    if (!dt) return "";
    return dt.split(" ")[1]?.slice(0, 5) || "";
  }
  function parseAeroDate(dt: string): string {
    if (!dt) return "";
    return dt.split(" ")[0] || "";
  }

  // Flight search (segment editor)
  app.get("/api/flights/search", isAuthenticated, async (req: any, res) => {
    try {
      const apiKey = process.env.AERODATABOX_RAPIDAPI_KEY;
      if (!apiKey) return res.status(503).json({ error: "Flight search API not configured" });

      const flightNumber = (req.query.flightNumber as string || "").replace(/\s+/g, "").toUpperCase();
      const date = req.query.date as string || new Date().toISOString().split("T")[0];
      if (!flightNumber) return res.status(400).json({ error: "flightNumber required" });

      const url = `https://aerodatabox.p.rapidapi.com/flights/number/${flightNumber}/${date}?withAircraftImage=false&withLocation=false`;
      const apiRes = await fetch(url, {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
        },
      });

      if (apiRes.status === 204 || apiRes.status === 404) {
        return res.json({ error: "No flight found for this number and date." });
      }

      const text = await apiRes.text();
      if (!text || !text.trim()) {
        return res.json({ error: "No flight found for this number and date." });
      }

      let data: any;
      try { data = JSON.parse(text); } catch { return res.json({ error: "No flight found for this number and date." }); }

      console.log("[AeroDataBox] raw:", JSON.stringify(data).slice(0, 500));

      if (!Array.isArray(data) || data.length === 0) {
        return res.json({ error: "No flight found for this number and date." });
      }

      const raw = data[0];
      const depScheduled = raw.departure?.scheduledTime?.local || "";
      const depUtc       = raw.departure?.scheduledTime?.utc   || "";
      const arrScheduled = raw.arrival?.scheduledTime?.local || "";
      const arrUtc       = raw.arrival?.scheduledTime?.utc     || "";

      res.json({
        flight: {
          flightNumber: raw.number || flightNumber,
          airline: raw.airline?.name || "",
          aircraft: raw.aircraft?.model || "",
          status: raw.status || "",
          departure: {
            iata: raw.departure?.airport?.iata || "",
            airport: raw.departure?.airport?.name || "",
            scheduledTime: parseAeroTime(depScheduled),
            scheduledDate: parseAeroDate(depScheduled) || date,
            scheduledUtc: depUtc,
            scheduledLocal: depScheduled,
          },
          arrival: {
            iata: raw.arrival?.airport?.iata || "",
            airport: raw.arrival?.airport?.name || "",
            scheduledTime: parseAeroTime(arrScheduled),
            scheduledDate: parseAeroDate(arrScheduled) || date,
            scheduledUtc: arrUtc,
            scheduledLocal: arrScheduled,
          },
        },
      });
    } catch (error) {
      console.error("[AeroDataBox] search error:", error);
      res.json({ error: "No flight found." });
    }
  });

  // Flight status (background monitoring proxy)
  app.get("/api/flights/status", isAuthenticated, async (req: any, res) => {
    try {
      const apiKey = process.env.AERODATABOX_RAPIDAPI_KEY;
      if (!apiKey) return res.status(503).json({ error: "Flight status API not configured" });

      const flightIata = (req.query.flightIata as string || "").replace(/\s+/g, "").toUpperCase();
      if (!flightIata) return res.status(400).json({ error: "flightIata required" });

      const date = new Date().toISOString().split("T")[0];
      const url = `https://aerodatabox.p.rapidapi.com/flights/number/${flightIata}/${date}?withAircraftImage=false&withLocation=false`;
      const apiRes = await fetch(url, {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
        },
      });

      if (apiRes.status === 204 || apiRes.status === 404) {
        return res.json({ error: "No flight status found." });
      }

      const text = await apiRes.text();
      if (!text || !text.trim()) {
        return res.json({ error: "No flight status found." });
      }

      let data: any;
      try { data = JSON.parse(text); } catch { return res.json({ error: "No flight status found." }); }

      console.log("[AeroDataBox] status raw:", JSON.stringify(data).slice(0, 500));

      if (!Array.isArray(data) || data.length === 0) {
        return res.json({ error: "No flight status found." });
      }

      const raw = data[0];
      res.json({
        status: raw.status || "",
        depIata: raw.departure?.airport?.iata || "",
        arrIata: raw.arrival?.airport?.iata || "",
        updatedAt: null,
      });
    } catch (error) {
      console.error("[AeroDataBox] status error:", error);
      res.json({ error: "No flight status found." });
    }
  });

  app.get("/api/push/vapid-key", (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
  });

  app.post("/api/push/subscribe", isAuthenticated, orgMiddleware, async (req: any, res) => {
    try {
      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ message: "Invalid subscription" });
      }
      await storage.savePushSubscription(req.userId, req.orgId, endpoint, keys.p256dh, keys.auth);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to save push subscription" });
    }
  });

  app.post("/api/push/unsubscribe", isAuthenticated, async (req: any, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ message: "Missing endpoint" });
      await storage.removePushSubscription(req.userId, endpoint);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove push subscription" });
    }
  });

  app.get("/api/photos/search", isAuthenticated, async (req: any, res) => {
    try {
      const key = process.env.UNSPLASH_ACCESS_KEY;
      if (!key) return res.status(503).json({ error: "Photo search not configured" });

      const query = (req.query.q as string) || "luxury travel";
      const count = Math.min(parseInt(req.query.count as string || "6"), 12);

      const url = new URL("https://api.unsplash.com/search/photos");
      url.searchParams.set("query", query);
      url.searchParams.set("per_page", String(count));
      url.searchParams.set("orientation", "landscape");
      url.searchParams.set("content_filter", "high");

      const apiRes = await fetch(url.toString(), {
        headers: { Authorization: `Client-ID ${key}` },
      });

      if (!apiRes.ok) throw new Error(`Unsplash error: ${apiRes.status}`);

      const data = await apiRes.json();

      const photos = (data.results || []).map((p: any) => ({
        id: p.id,
        thumb: p.urls.small,
        regular: p.urls.regular,
        full: p.urls.full,
        credit: p.user.name,
        creditUrl: p.user.links.html + "?utm_source=travel_lab&utm_medium=referral",
        altDescription: p.alt_description,
      }));

      res.json({ photos });
    } catch (error) {
      console.error("[Unsplash] search error:", error);
      res.status(500).json({ error: "Photo search failed" });
    }
  });

  return httpServer;
}
