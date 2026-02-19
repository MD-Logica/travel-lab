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
- **profiles**: id (= auth user id), org_id, role (owner/advisor/assistant/client), full_name, email, phone, avatar_url
- **clients**: id, org_id, full_name, email, phone, notes, tags, preferences (jsonb), preferences_updated_at
- **trips**: id, org_id, title, destination, description, cover_image_url, start_date, end_date, status, budget, currency, notes
- **trip_versions**: id, trip_id, org_id, version_number, name, is_primary
- **trip_segments**: id, version_id, trip_id, org_id, day_number, sort_order, type (flight/charter/hotel/transport/restaurant/activity/note), title, subtitle, start_time, end_time, confirmation_number, cost, currency, notes
- **trip_documents**: id, org_id, trip_id, client_id, uploaded_by, file_name, file_type, file_size, storage_path, label, is_visible_to_client, created_at
- **conversations**: id, org_id, client_id, last_message_at, created_at
- **messages**: id, conversation_id, org_id, sender_type (advisor/client), sender_id, sender_name, content, is_read, created_at
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
- client/src/components/ - AppSidebar, MarketingNav, AuthLayout, TrialBanner, UpgradePrompt, MobileTabBar, PwaInstallPrompt
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
