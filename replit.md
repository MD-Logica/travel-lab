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
- **trips**: id, org_id, title, destination, description, cover_image_url, start_date, end_date, status, budget, currency, notes

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
- client/src/pages/ - Landing, Pricing, Onboarding, Dashboard, Trips, TripDetail, Clients, Settings
- client/src/pages/auth/ - Login, Signup, ForgotPassword, SetPassword
- client/src/components/ - AppSidebar, MarketingNav, AuthLayout, TrialBanner, UpgradePrompt
- server/routes.ts - All API routes with auth + org middleware
- server/storage.ts - DatabaseStorage class with org-scoped queries
- shared/schema.ts - Drizzle schema + types
- shared/models/auth.ts - Auth tables (users, sessions)

## Routing
- Public pages (always accessible): /, /pricing
- Auth pages (redirect to /dashboard if logged in): /login, /signup, /forgot-password, /set-password
- Authenticated pages (redirect to /login if not logged in): /dashboard, /trips, /clients, /settings

## Recent Changes
- 2026-02-19: Built public marketing pages: redesigned landing page with full-bleed hero, social proof, 4 feature sections; new /pricing page with plan cards, comparison table, FAQ; marketing navbar; trial banner; upgrade prompt modal
- 2026-02-19: Custom email/password auth with bcrypt, 4 auth pages, two-panel layout
- 2026-02-19: Initial MVP build with multi-tenant architecture, Replit Auth, luxury design system
