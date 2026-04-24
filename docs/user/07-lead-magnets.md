---
id: lead-magnets
title: Lead magnets — quizzes, valuations, market updates
apps: [socials, listings]
route_hints: ["/lead-magnets", "/links/:orgSlug"]
plan_gates: []
---

# Lead magnets

Lead magnets are public-facing pages that capture visitor details in exchange for something useful. They're how you turn social media followers into seller leads.

AutoListing offers five lead magnet types:

| Type | What it does |
|---|---|
| **Free Valuation** | A request-a-valuation form. Visitor enters their address; you get a lead with all the details. |
| **Ready-to-Sell Quiz** | A short quiz that scores how ready someone is to sell. They get a personalised result; you get a qualified lead. |
| **Worth Estimate Quiz** | A quiz that estimates a property's value based on inputs. They get a number; you get the lead. |
| **Market Update** | An AI-generated monthly market report for a chosen area. They subscribe to receive it; you get the lead. |
| **Tips & Advice** | An AI-generated article with selling/buying tips. They read; you get the lead via the form. |

All lead magnets:

- Live at public URLs you can share or post to social media
- Are branded with your logo and colors
- Drop new leads into your CRM (the CRM)
- Can be enabled/disabled per type
- Auto-rotate posting on social media at the frequency you choose

## Setting them up

1. Open **Socials → Lead Magnets**
2. Each type has its own tab. Toggle the type **on** to activate it
3. Configure type-specific settings (which areas to use, color theme, etc.)
4. The Bio Hub link (`/links/your-org-slug`) appears in the Overview tab — share this once and it shows all your enabled lead magnets in one place

## How posting works

When you turn a lead magnet type on:

- AutoListing reserves slots in your weekly schedule for that type
- The frequency is set in the type's settings (e.g. "post once a week")
- Each post when it's about to go live picks fresh content (current image, current caption template, current service area weights) — so changing your settings affects future posts immediately

If you change the **frequency** for a type, the schedule is rebuilt. If you change anything else (image weights, caption templates, service areas), the change applies silently to future posts.

## Service areas

Lead magnets that include an area (Market Update, Tips & Advice) need to know which area(s) to use. Configure these under **Settings → Service Areas**:

- Add each area you cover (e.g. "Cork City", "Galway West")
- Mark one as **Primary** (it's used as the default)
- Each area gets a **weight** — areas with higher weight are picked more often when posting

If you only have one area, no weighting needed.

## The Bio Hub

Each organisation gets a public Bio Hub page at `/links/your-org-slug`. It shows all enabled lead magnets as buttons. This is the single link to put in your Instagram or TikTok bio.

For multi-area organisations, the Bio Hub asks visitors to pick their area first, then routes them to the area-specific lead magnet.

## Where leads land

All leads from any lead magnet land in **the CRM**:

- Sellers (from valuations, ready-to-sell, worth-estimate) → Sellers kanban
- Newsletter signups (Market Update, Tips & Advice) → Subscribers list

You'll also get an instant email notification (sent to your Notification Recipients in Email Settings).

## When the page isn't live

If you visit a lead magnet URL and see "Not available":

- The type might not be enabled — check the toggle in Socials → Lead Magnets
- Your service area might be missing — check Settings → Service Areas
- The org slug in the URL might be wrong — your slug is shown in Settings → General
