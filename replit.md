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
- client/src/pages/ - Landing, Pricing, Onboarding, Dashboard, Trips, TripDetail, TripNew, TripEdit, Clients, ClientDetail, Settings
- client/src/pages/auth/ - Login, Signup, ForgotPassword, SetPassword
- client/src/components/ - AppSidebar, MarketingNav, AuthLayout, TrialBanner, UpgradePrompt
- server/routes.ts - All API routes with auth + org middleware
- server/storage.ts - DatabaseStorage class with org-scoped queries
- shared/schema.ts - Drizzle schema + types
- shared/models/auth.ts - Auth tables (users, sessions)

## Routing
- Public pages (always accessible): /, /pricing
- Auth pages (redirect to /dashboard if logged in): /login, /signup, /forgot-password, /set-password
- Authenticated pages (redirect to /login if not logged in): /dashboard, /trips, /trips/new, /trips/:id, /trips/:id/edit, /clients, /clients/:id, /settings

## Recent Changes
- 2026-02-19: Client preferences system — tab bar on client detail page (Overview/Preferences/Documents), structured preferences editor with travel style, flights, hotels, dining, interests, important dates, loyalty, general notes; view/edit modes; preferences reference panel in trip editor
- 2026-02-19: Trip editor (/trips/:id/edit) with version tabs, day timeline, segment CRUD (add/edit/delete dialog), version management (duplicate, set primary, delete)
- 2026-02-19: Added trip_segments and trip_versions tables; segment/version API routes; storage CRUD methods
- 2026-02-19: Built public marketing pages: redesigned landing page with full-bleed hero, social proof, 4 feature sections; new /pricing page with plan cards, comparison table, FAQ; marketing navbar; trial banner; upgrade prompt modal
- 2026-02-19: Custom email/password auth with bcrypt, 4 auth pages, two-panel layout
- 2026-02-19: Initial MVP build with multi-tenant architecture, Replit Auth, luxury design system
