# Travel Lab

## Overview
Travel Lab is a multi-tenant SaaS travel planning platform for luxury travel agencies. Built with a Condé Nast Traveller-inspired design aesthetic, it lets travel advisors manage clients, design itineraries, and organize their agency.

## Architecture
- **Frontend**: React + Vite, TailwindCSS, shadcn/ui, Framer Motion, wouter routing
- **Backend**: Express.js with Replit Auth (OIDC), PostgreSQL via Drizzle ORM
- **Auth**: Replit OpenID Connect (server/replit_integrations/auth/)
- **Multi-tenancy**: Every data table scoped by org_id, enforced via middleware

## Key Design Decisions
- **Fonts**: Playfair Display (serif headings), DM Sans (body), Fira Code (mono)
- **Colors**: Warm cream (#FAFBFC-ish) backgrounds, terracotta/amber primary (hsl 24 70% 45%)
- **Database**: PostgreSQL with Drizzle ORM, schema in shared/schema.ts
- **Multi-tenant isolation**: orgMiddleware extracts org_id from user profile, all queries scoped

## Data Model
- **organizations**: id, name, slug, plan (trial/pro/enterprise), plan_status, trial_ends_at, max_advisors, max_clients
- **profiles**: id (= auth user id), org_id, role (owner/advisor/assistant/client), full_name, email, phone, avatar_url, can_view_all_clients (boolean)
- **clients**: id, org_id, full_name, email, phone, notes, tags, assigned_advisor_id, preferences (jsonb), preferences_updated_at
- **client_collaborators**: id, client_id, advisor_id, org_id, created_at
- **trips**: id, org_id, title, destination (text, legacy), destinations (jsonb, DestinationEntry[]), description, cover_image_url, start_date, end_date, status, budget, currency, notes
- **trip_versions**: id, trip_id, org_id, version_number, name, is_primary
- **trip_segments**: id, version_id, trip_id, org_id, day_number, sort_order, type (flight/charter/hotel/transport/restaurant/activity/note), title, subtitle, start_time, end_time, confirmation_number, cost, currency, notes
- **trip_documents**: id, org_id, trip_id, client_id, uploaded_by, file_name, file_type, file_size, storage_path, label, is_visible_to_client, created_at
- **conversations**: id, org_id, client_id, last_message_at, created_at
- **messages**: id, conversation_id, org_id, sender_type (advisor/client), sender_id, sender_name, content, is_read, created_at
- **invitations**: id, org_id, email, role, token (unique), status (pending/accepted/expired/cancelled), invited_by, expires_at, accepted_at, created_at
- **push_subscriptions**: id, profile_id, org_id, endpoint, p256dh, auth, created_at

## Plan Limits
- Trial: 3 advisors, 50 clients, 20 trips
- Pro: 10 advisors, 500 clients, unlimited trips
- Enterprise: unlimited everything

## Self-Serve Signup Flow
1. User signs up via Replit Auth
2. GET /api/profile returns 404 → show onboarding
3. User enters name + agency name → POST /api/onboarding
4. Auto-creates organization (trial plan, 14-day trial) + profile (owner role)
5. Redirect to /dashboard

## Project Structure
- client/src/pages/ - Landing, Pricing, Onboarding, Dashboard, Trips, TripDetail, TripNew, TripEdit, Clients, ClientDetail, Settings, Messages
- client/src/pages/auth/ - Login, Signup, ForgotPassword, SetPassword
- client/src/components/ - AppSidebar, MarketingNav, AuthLayout, TrialBanner, UpgradePrompt, MobileTabBar, PwaInstallPrompt, DestinationInput, PlacesAutocomplete, PhoneInput, CurrencyInput
- client/src/hooks/ - use-auth, use-mobile, use-toast, use-push-notifications
- server/routes.ts - All API routes with auth + org middleware
- server/storage.ts - DatabaseStorage class with org-scoped queries
- shared/schema.ts - Drizzle schema + types
- shared/models/auth.ts - Auth tables (users, sessions)
- client/public/sw.js - Service worker (caching, push notifications)
- client/public/manifest.json - PWA manifest

## Routing
- Public pages (always accessible): /, /pricing
- Auth pages (redirect to /dashboard if logged in): /login, /signup, /forgot-password, /set-password
- Authenticated pages (redirect to /login if not logged in): /dashboard, /dashboard/analytics, /dashboard/messages, /trips, /trips/new, /trips/:id, /trips/:id/edit, /clients, /clients/:id, /settings

## PWA
- Service worker: cache-first for static assets, stale-while-revalidate for API
- Push notifications: web-push library, VAPID keys in env, push_subscriptions table
- Mobile breakpoint: 768px (useIsMobile hook)
- Bottom tab bar on mobile: Trips, Messages, Clients, More
- Install prompt: shows after 30s on first mobile visit

## Recent Changes
- 2026-02-21: Unsplash cover photo picker — GET /api/photos/search proxy route (server-side key, authenticated); trip-new.tsx two-tab photo picker: "Suggest photos" (auto-fetches by destination, 3-col grid, checkmark selection, search input, Unsplash attribution) + "Custom URL" (text input with preview); attribution derived from photo results + stored credit, only shows for unsplash.com URLs
- 2026-02-21: API key startup checks — server/index.ts warns if RESEND_API_KEY or UNSPLASH_ACCESS_KEY missing
- 2026-02-20: Secure trip sharing system — shareToken (varchar, unique) and shareEnabled (boolean) on trips table; POST /api/trips/:id/share-token generates 16-byte hex token + enables sharing; PATCH /api/trips/:id/share toggles enabled; GET /api/trip-view/:id supports token-based public access (no auth required) when shareEnabled + matching token; Share dialog in trip-edit.tsx with toggle, URL display, copy, reset link with confirmation; trip-view.tsx reads token from URL search params, shows "link no longer active" on 403; /trip/:id route accessible without authentication in App.tsx
- 2026-02-20: Email sending with Resend — server/email.ts with lazy Resend initialization; sendTeamInviteEmail (accept invitation link, 7-day expiry notice); sendClientPortalInviteEmail (itinerary link); POST /api/invitations sends email after creating invitation; POST /api/invitations/:id/resend extends expiry + re-sends email; POST /api/clients/:id/invite sends portal email; all email errors caught/logged without failing requests
- 2026-02-20: Portal status badge fix — replaced green "Portal active" badge with amber "Invitation sent [date]" badge + "Resend" link on client detail page
- 2026-02-20: Travel companions system — client_relationships table with bidirectional linking (normalized ID order), relationship labels (Spouse/Partner/Parent/Child/Sibling/Friend/Colleague/Other + custom), searchable Add Companion dialog, companion cards with avatar/name/badge/link/remove; PhoneInput in Add Client dialog; invite portal email field editable with validation and reset on close; API routes: GET /api/clients/:clientId/companions, POST /api/client-relationships, DELETE /api/client-relationships/:id
- 2026-02-20: Trip archive & permanent delete — Active/Archived view toggle on trips list, archive/unarchive via danger menus, permanent delete with confirmation dialog, archived trips excluded from analytics
- 2026-02-20: Discount/credit system — discount, discountType (fixed/percent), discountLabel columns on trip_versions; inline discount editor in trip-edit budget area; subtotal/discount/total breakdown in builder, client preview, and PDF; PATCH /api/trips/:tripId/versions/:versionId accepts discount fields
- 2026-02-20: Companion quick-add — additionalClientIds text[] column on trips; trip-new shows companion checkboxes when client with companions selected; trip-edit header shows "Traveling with: [names]"
- 2026-02-20: Recent trips cleanup — dashboard filters out archived trips, 404 handling on stale trip cards with toast + cache invalidation
- 2026-02-20: Multi-leg journey system — journeyId column on trip_segments (varchar, nullable) groups connecting flights; journey-utils.ts with calculateLayover (tight <60m/long >4h/normal), isRedEye, journeyTotalTime helpers; FlightSearchPanel in segment-editor allows adding multi-leg connections (each leg saved as separate segment with shared journeyId + legNumber metadata); trip-edit.tsx auto-generates day slots from trip date range, JourneyCard groups multi-leg flights with layover badges, red-eye indicators, airport-change warnings; trip-view.tsx JourneyViewCard shows connecting flights with visual stop indicators and leg details; PDF export JourneyPdfView renders grouped connecting flights with layover durations
- 2026-02-20: Multi-advisor collaboration system — canViewAllClients boolean on profiles, assignedAdvisorId on clients, client_collaborators table for shared access; advisor-scoped client/trip queries (advisors see only assigned + collaborating clients, owners see all); client detail page shows lead advisor selector (owner only) and collaborator badges with add/remove; clients list shows Advisor column; settings team table has "All Clients" toggle per member (Switch component, owner only); API routes: PATCH /api/clients/:id/assign-advisor, GET/POST/DELETE /api/clients/:id/collaborators, PATCH /api/team/:memberId/permissions
- 2026-02-19: Settings page refactor — three-tab layout (Profile/Organisation/Billing); Profile: editable name, read-only email with lock icon+tooltip, phone with PhoneInput country code selector, initials avatar, conditional save button; Organisation: org name/logo editing, team members table with avatar+name/email/role/joined/actions columns, inline role change dropdown (owner only, can't demote self), remove member with confirmation dialog, "Invite team member" modal with email+role selector+descriptions+plan limit enforcement, pending invitations shown in table with Pending badge+expiry+resend/cancel; Billing: plan badge, trial days countdown, disabled "Manage billing" stub; invitations table in DB, invitation CRUD API routes, accept invitation endpoint, team management routes (role change, member removal)
- 2026-02-19: Multi-city destination system — `destinations` jsonb column on trips for structured multi-destination support; DestinationInput component with Google Places cities autocomplete, free-text entry, tag-style chips, keyboard navigation, blur auto-commit, deduplication; formatDestinations/formatDestinationsShort display helpers; CurrencyInput integrated in trip-new/trip-detail budget fields; PDF export hardened with transport/charter segment support, currency formatting via Intl.NumberFormat, defensive null checks, try-catch error handling
- 2026-02-19: Analytics page (/dashboard/analytics) — premium editorial design with Recharts; date range selector (30d/3m/12m/all time); 4 summary stat cards (total trips, active trips, total clients, portfolio value); trips-over-time area chart; top destinations horizontal bar chart; trips-by-status donut chart; most active clients table (clickable to profile); advisor activity table (owner only); graceful empty states; sidebar navigation with BarChart2 icon
- 2026-02-19: Advisor productivity features — segment_templates table for reusable segment templates (Save as template checkbox in segment editor, template picker dropdown in Add menu, Templates section in Settings with rename/delete); trip duplication via Duplicate button in trip editor header (copies all versions/segments, lets you pick new client/dates, strips confirmation numbers)
- 2026-02-19: Flight status monitoring system — flight_tracking table, AeroDataBox API integration (via RapidAPI), 20-minute background polling for flights within monitoring window (3h before departure to 1h after arrival), notification bell in header with unread count + dropdown panel, flight status badges on segment cards (Scheduled/On Time/Delayed/Cancelled/Departed/Landed), manual refresh button, auto-creates tracking when flight segments saved, advisor notifications for delays 20+ min, gate changes, cancellations, departures, landings
- 2026-02-19: Secure document vault — trip_documents table, file upload via Replit Object Storage (presigned URL flow), drag-drop upload on client detail Documents tab and trip editor; label suggestions, visibility toggle, download/delete; org-scoped security on all document routes
- 2026-02-19: Client preferences system — tab bar on client detail page (Overview/Preferences/Documents), structured preferences editor with travel style, flights, hotels, dining, interests, important dates, loyalty, general notes; view/edit modes; preferences reference panel in trip editor
- 2026-02-19: Trip editor (/trips/:id/edit) with version tabs, day timeline, segment CRUD (add/edit/delete dialog), version management (duplicate, set primary, delete)
- 2026-02-19: Added trip_segments and trip_versions tables; segment/version API routes; storage CRUD methods
- 2026-02-19: Built public marketing pages: redesigned landing page with full-bleed hero, social proof, 4 feature sections; new /pricing page with plan cards, comparison table, FAQ; marketing navbar; trial banner; upgrade prompt modal
- 2026-02-19: Custom email/password auth with bcrypt, 4 auth pages, two-panel layout
- 2026-02-19: Initial MVP build with multi-tenant architecture, Replit Auth, luxury design system
