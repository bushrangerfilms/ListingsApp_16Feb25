---
id: custom-domain
title: Setting up a custom domain
apps: [listings]
route_hints: ["/admin/settings", "/admin/settings/domain"]
plan_gates: [paid]
---

# Setting up a custom domain

By default, your public listings live at `your-org-slug.autolisting.io`. With a custom domain, they live at `yourdomain.com` instead. This is included on all paid plans.

## Before you start

You need:

- A paid plan (Essentials or higher)
- A domain you own (bought through any registrar — GoDaddy, Namecheap, Cloudflare, etc.)
- Access to your registrar's DNS settings (sometimes called "Manage DNS")

## The setup steps

1. Open **Listings → Settings → Custom Domain**
2. Enter the domain you want to use (e.g. `listings.smithproperty.com` or `smithproperty.com`)
3. You'll see a list of **DNS records** to add — typically:
   - A `CNAME` record for the main domain
   - A `CNAME` record for `em.yourdomain.com` (used for sender email reputation)
4. Add those records in your registrar's DNS settings
5. Click **Verify** in AutoListing
6. Verification can take a few minutes to a few hours depending on your registrar's DNS speed
7. Once both records verify, your domain is live

## What happens after the domain verifies

- Your public property pages and lead-magnet pages serve from your domain
- Outbound emails (lead alerts, valuation confirmations) send from `noreply@em.yourdomain.com` — much better deliverability than a shared subdomain
- Your `your-org-slug.autolisting.io` URL keeps working as a fallback

## A subdomain or the apex domain?

You can use either:

- **Subdomain** (e.g. `listings.smithproperty.com`) — simpler. Doesn't conflict with anything else on your main site.
- **Apex domain** (e.g. `smithproperty.com`) — replaces your existing site entirely. Only do this if AutoListing is your whole web presence.

We recommend **subdomain** unless you specifically want AutoListing to be your only web presence.

## DNS guide for common registrars

The setup screen has step-by-step screenshots for the most common registrars. You can also paste your DNS records into our **AI DNS helper** which generates the exact text to enter.

## Troubleshooting

- **Verification failed** — DNS changes take time to propagate (up to 24h, usually under 1h). Wait and retry.
- **Wrong record type** — make sure you used `CNAME` not `A` or `TXT`
- **Trailing dot in the value** — some registrars need a trailing dot (`auto.listing.io.`), some don't. Try both.
- **Cloudflare proxy on?** — turn the orange cloud OFF for the AutoListing CNAMEs. Cloudflare proxying breaks the verification.

## Removing a custom domain

In **Settings → Custom Domain**, click **Remove Domain**. Your `your-org-slug.autolisting.io` URL keeps working. You can re-add a domain later if you change your mind.
