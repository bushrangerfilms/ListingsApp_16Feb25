---
id: post-approval
title: Post approval workflow
apps: [socials]
route_hints: ["/scheduling", "/scheduling?tab=approval"]
plan_gates: []
---

# Post approval workflow

By default, AutoListing posts go out automatically at their scheduled times. If you'd rather review posts before they go live, you can turn on the **Post Approval** workflow.

## Turning approval on or off

1. Open the **Socials** app → **Scheduling**
2. Click the **Settings** icon (top right)
3. Toggle **Require approval before posting**
4. Optionally set **Auto-approve after** (e.g. 24 hours) — posts not reviewed in that window will auto-approve and go out

You can also configure this during onboarding via the "Choose posting preferences" task on the Listings dashboard.

**Default for new signups:** approval is **on** by default for accounts created after April 2026. Existing accounts default to **off** unless you turn it on.

## How it works when approval is on

When AutoListing creates a new post:

- Status is set to **Pending Approval** instead of Scheduled
- The post does NOT go out at its scheduled time
- It appears in the **Approval** tab on the Scheduling page

When you approve a post:

- Status becomes **Scheduled**
- The post will go out at the next available time:
  - The originally scheduled time, if it's still in the future
  - The next round hour, if the original time has already passed

When you reject a post:

- Status becomes **Rejected**
- The post is permanently cancelled. The slot stays empty until you drop another post there.

## Where to see pending posts

The Scheduling page has three tabs:

- **Calendar** — the weekly planner view
- **Approval** — posts waiting for your review (only shows if approval is on)
- **History** — posts already gone out

A red dot on the Approval tab shows the current pending count.

## Email reminders

If you have pending posts:

- We send a daily digest email summarising what's waiting
- The email links directly to the Approval tab
- The digest stops when your queue is empty

## Editing before approving

You can edit a pending post (caption, platforms, time) before approving. Click the post to open it, make your changes, then click **Approve**.

## A note on existing future posts

Turning approval on doesn't change posts that are already scheduled. The next post AutoListing creates after you flip the toggle will respect the new setting. Each post checks the current setting at scheduling time, not at creation time.

This is why you might see future posts marked Scheduled even after enabling approval — those were created before you flipped it. They'll still go out automatically. New posts going forward will require approval.
