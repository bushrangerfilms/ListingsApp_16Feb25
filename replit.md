# AutoListing.io - Multi-Tenant Real Estate Property Management Platform

## Overview
AutoListing.io is a multi-tenant property management system designed to streamline operations for real estate professionals. It offers comprehensive features such as listings management, CRM, email automation, an AI assistant, and webhook integrations, aiming to be an all-in-one solution for enhanced client engagement and advanced property management.

## User Preferences
- **Cross-App Communication**: For coordinating with the Socials app (which shares the same Supabase project), messages can be written in this chat and user will copy/paste them to the other app's chat

## Production Launch Checklist
**IMPORTANT: Before going live, complete these steps:**

1. **Re-enable Email Confirmation** (Currently DISABLED for pilot phase)
   - Go to Supabase Dashboard → Authentication → Providers → Email
   - Turn ON "Confirm email"
   - This was disabled on Dec 16, 2025 to speed up pilot onboarding

## System Architecture
The platform employs a multi-tenant architecture with organization-based data isolation, custom domains, and role-based access control. The UI/UX is built with React 18, TypeScript, Vite, Radix UI, Shadcn, and Tailwind CSS. The backend leverages Supabase (PostgreSQL, Edge Functions, Auth, Storage) for data persistence and server-side logic. State management is handled by TanStack Query, routing by React Router DOM, and forms by React Hook Form with Zod validation.

**Key Features:**
-   **Property Management**: Supports various property types, photo management, flexible status workflows, and AI-powered detail extraction.
-   **CRM System**: Manages buyer/seller profiles, preferences, communication history, and includes automatic lead capture and smart matching.
-   **Email Automation**: Provides multi-step campaigns with customizable delays, reusable templates, tracking, and secure unsubscribes.
-   **AI Assistant**: Powered by Google Gemini 2.5 Flash API, offering custom knowledge base integration, context-aware understanding, lead generation, conversation history, and an embeddable public chatbot. An AI training system allows super admins to manage prompt customizations, including banned phrases, tone guidelines, and freeform instructions, with precedence applied at organization/locale levels.
-   **Webhooks**: Configurable webhooks for real-time notifications on listing events, featuring secure payload signing, automatic retry logic, and delivery logging.
-   **Credit-Based Billing System**: A Stripe-powered system for monetizing features across CRM and a companion Socials app, utilizing a shared credit ledger, defined pricing models, feature usage tracking, a 14-day free trial, and various account lifecycle states with automated dunning processes.
-   **Pilot Invite Code System**: Allows for dynamic invite codes to grant access and mark organizations as billing exempt during signup.
-   **Send Feedback Feature**: Enables users to submit ideas, bug reports, and feedback directly from the app, including file attachments.
-   **Company Logo Upload**: During signup, users can upload their company logo for cross-app branding.
-   **Organization Delete Feature**: Super admins can delete organizations and all related data, with cascade deletion handling various related tables.
-   **Demo Video Analytics**: Tracks engagement on the public AdminLogin page demo video. Captures play, progress milestones (25%, 50%, 75%), and completion events with session management, device type detection, and watch time calculation. Data displayed in Super Admin Analytics "Demo Video" tab with funnel visualization. Edge Function: `track-video-event` (no auth required). Table: `demo_video_analytics`.
-   **Lead Magnet Forms**: Two public lead capture quizzes accessible at `/lead-magnet/{orgSlug}/ready-to-sell` and `/lead-magnet/{orgSlug}/worth-estimate`. Features: deterministic scoring (Ready-to-Sell with weighted sections), conservative valuation envelopes (Worth Estimate with AI market research cache), UTM tracking (utm_source, utm_campaign, c, pid, v params), gated unlock flow (email/consent required for full report), and CRM lead creation/upsert. Edge Function: `lead-magnet-api`. Tables: `lead_magnets` (per-org config), `lead_submissions` (answers + results), `market_research_cache` (AI research artifacts). Auto-provisioned for all orgs via trigger.
-   **Topaz AI Image Upscaling**: Integrates with Kie.ai Topaz upscaler to enhance social media listing photos to 8K resolution (4x upscale) for higher-quality video generation in the Socials app. Uses `topaz/image-upscale` model via Kie.ai API. Only processes images under 10MB. Edge Functions: `upscale-photos` (single listing), `upscale-org-photos` (batch), `topaz-webhook` (callback handler). Jobs tracked in `photo_upscale_jobs` table. Rate limit: 20 requests per 10 seconds.

**Multi-Tenant Design:**
-   Organization-based data isolation.
-   Custom domains.
-   Role-based access control (`super_admin`, `developer`, `admin`, `user`).

**Database Structure:**
-   Split-schema approach: `public` for shared multi-tenant data, `crm` for CRM-specific data.
-   Dedicated tables for email sequences, templates, queues, analytics, AI assistant configs, conversation history, webhooks, and rate limits.
-   Credit ledger tables use `NUMERIC(12,2)` for fractional credit tracking.
-   Organizations table includes region settings: `locale`, `currency`, `timezone`, `vat_rate`, `country_code`.

**Security Features:**
-   Row Level Security (RLS) enforced by `organization_id`.
-   Service Role Bypass for privileged Edge Function operations.
-   HMAC Webhook Signing for payload authenticity.
-   Secure Tokens for email preferences.
-   IP-based rate limiting on public endpoints.

**Super Admin Portal:**
An internal operations console (`app.autolisting.io/internal/*`) for management and development teams, featuring an Edge Function backend (`internal-admin-api`) with server-side authorization. Key functionalities include:
-   Organization & User Directory (browse, search, impersonate with audit logging).
-   Plan Management, Billing & Revenue Dashboards, Discount Code Management.
-   Feature Flag System, Support Tools, Analytics Dashboard, GDPR Compliance, Audit Log, Alerting System.
-   Role-based data redaction (e.g., revenue/credit metrics hidden from developers).

**Internationalization (i18n):**
-   Infrastructure is in place (feature-flagged off by default), supporting `en-IE`, `en-GB`, `en-US` with region-specific configurations (BER/EPC ratings, Eircode/Postcode/ZIP, currency, VAT rates).
-   Components use translation keys with a `noopT` fallback when i18n is disabled.
-   Includes a feature flag system and a Super Admin preview mode for regional launches.

## External Dependencies

-   **Supabase**: Backend-as-a-Service (PostgreSQL, Edge Functions, Auth, Storage).
-   **Google Gemini API**: AI capabilities.
-   **Resend API**: Email sending and automation.
-   **Stripe**: Payment processing.
-   **Radix UI**: Accessible UI components.
-   **Shadcn**: Pre-built UI components.
-   **Tailwind CSS**: CSS framework.
-   **TanStack Query (React Query)**: Server state management.
-   **React Router DOM**: Client-side navigation.
-   **React Hook Form**: Form management.