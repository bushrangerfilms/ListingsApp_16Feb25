---
id: scheduling.overview
title: How scheduling works
apps: [socials]
route_hints: ["/scheduling", "/"]
plan_gates: []
---

# How scheduling works

Once a listing is created and you have at least one social account connected, AutoListing automatically schedules posts for it across the coming weeks. Scheduling is shown as a weekly planner in the **Socials** app under **Scheduling**.

## How posts get scheduled

Each listing gets a posting **template** based on its status (see "Adding and editing listings" for the per-status frequency). The template generates **slots** — time-of-day spots in the week when posts can go out. The system then **fills** those slots with actual posts containing a video or image and an AI-generated caption.

Time slots default to:

- **Tuesday 6pm**, **Thursday 6pm** for new listings (launch phase)
- **Wednesday 12pm** for ongoing weekly posts

You can change these times in **Settings → Posting Times**.

## The weekly planner

The planner shows the current week and several weeks ahead. Each post card shows:

- The listing title and a thumbnail of the video/image
- The scheduled time
- The platforms it'll post to (icons for Instagram, Facebook, etc.)
- The status (Scheduled, Pending Approval, Posted, Failed)

You can:

- **Drag a post** to a different time slot to reschedule it
- **Click a post** to see the caption, edit it, or change platforms
- **Click the orange rocket icon** to identify launch-phase posts (extra posts in the first 2 weeks)

## One post per slot

Each `(branch, time)` combination can have at most one active post. If you drag a post onto a slot that already has one, the planner asks if you want to swap.

## What happens when you drag a post away

When you drag a post to a different time, the original slot becomes empty. **AutoListing does NOT automatically refill the empty slot** — it stays vacant until you manually drop another post there or until a new listing's schedule generation creates one.

This is intentional: if you wanted that slot empty, the system shouldn't second-guess you.

## Regenerating a schedule

If you've made big changes to a listing and want a fresh schedule for it:

1. Open the listing detail (in either Listings or Socials)
2. Click **Regenerate Schedule**
3. Existing future posts are cleared and a new schedule is built from scratch

Already-posted content is not affected.

## Why isn't my post showing up?

A few common reasons:

- **No social accounts connected** — see the "Connecting your social accounts" doc
- **Social posting is paused** — check Settings → Posting Pause
- **Post is in approval queue** — check the Approval tab
- **Listing status is Withdrawn or Off Market** — these don't post
- **Listing reached its end-of-cycle** (Sold past 1 week, Sale Agreed past 2 weeks) — these stop posting on purpose

If none of these apply, ask AL — there may be a deeper issue.
