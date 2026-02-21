# Travel Lab

## Overview
Travel Lab is a multi-tenant SaaS travel planning platform designed for luxury travel agencies. Its primary purpose is to empower travel advisors with tools to manage clients, design intricate itineraries, and streamline agency operations, all within a Condé Nast Traveller-inspired design aesthetic. The platform aims to enhance the efficiency and luxury experience provided by travel agencies.

## User Preferences
The user prefers a clean, modern UI/UX with a focus on luxury aesthetics. All data operations should be multi-tenancy aware, ensuring strict data isolation per organization. The user expects robust PWA features, including offline capabilities and push notifications, for a seamless mobile experience.

## System Architecture
- **Frontend**: Built with React + Vite, styled using TailwindCSS and shadcn/ui. Animations are handled by Framer Motion, and routing is managed by wouter.
- **Backend**: Utilizes Express.js, integrated with Replit Auth (OIDC) for authentication.
- **Database**: PostgreSQL is used as the primary data store, with Drizzle ORM for database interactions.
- **Authentication**: Implemented via Replit OpenID Connect.
- **Multi-tenancy**: All data tables are scoped by `org_id`. A dedicated middleware enforces this scoping for all database queries, ensuring data isolation between different agencies.
- **UI/UX Design**:
    - **Color Scheme**: Warm cream backgrounds (`#FAFBFC`) with terracotta/amber primary accents (`hsl 24 70% 45%`).
    - **Typography**: Playfair Display for headings (serif), DM Sans for body text, and Fira Code for monospace elements.
- **Key Features**:
    - **Client & Trip Management**: Comprehensive tools for managing client profiles, creating and editing multi-destination trip itineraries, and organizing trip segments (flights, hotels, activities).
    - **Team Collaboration**: Features for inviting team members, assigning roles (owner, advisor, assistant), and managing client access permissions (e.g., `canViewAllClients` toggle).
    - **Financials**: Budget tracking, discount/credit system for trip versions, and cost breakdowns.
    - **Document Management**: Secure document vault with file uploads (via Replit Object Storage), visibility toggles, and secure sharing.
    - **Communication**: Integrated messaging system for client-advisor communication and email notifications via Resend.
    - **Analytics**: Dashboard with key metrics, charts (trips over time, top destinations, trips by status), and activity tables.
    - **PWA Capabilities**: Service worker for caching and offline support, push notifications, and an install prompt for mobile users.
    - **Secure Sharing**: Token-based public access for trip itineraries, allowing clients to view their plans securely without authentication.
    - **Variant System**: Allows for batch-submission and approval flows for trip segments, including refundability options.
    - **Flight Tracking**: Integration with AeroDataBox API for real-time flight status monitoring and advisor notifications.
    - **Segment Templates**: Reusable templates for trip segments to improve advisor productivity.
    - **Unsplash Integration**: Photo picker for trip cover images, allowing search and selection from Unsplash.
    - **Journey System**: Supports multi-leg journeys (e.g., connecting flights) with detailed layover information and visual representations.

## External Dependencies
- **Replit Auth**: For user authentication and OpenID Connect integration.
- **PostgreSQL**: The primary database system.
- **Drizzle ORM**: Used for interacting with the PostgreSQL database.
- **TailwindCSS**: For rapid UI development and styling.
- **shadcn/ui**: UI component library.
- **Framer Motion**: For animations.
- **Resend**: Email sending service for notifications and invitations.
- **AeroDataBox API (via RapidAPI)**: For real-time flight status tracking.
- **Google Places API**: For destination input and autocomplete features.
- **Unsplash API**: For integrating photo search and selection for trip cover images.
- **Replit Object Storage**: Used for secure document storage.
- **Recharts**: For data visualization in the analytics dashboard.