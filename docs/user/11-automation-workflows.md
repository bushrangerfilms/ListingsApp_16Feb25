---
id: automation-workflows
title: Automation — the Workflows monitor
apps: [socials]
route_hints: ["/workflows"]
plan_gates: [admin]
---

# Automation (the Workflows monitor)

The **Automation** menu item in the Socials sidebar (admin-only) opens the **Workflows monitor**. It's a real-time view of your automation pipeline — useful when you want to see exactly what's happening to a listing behind the scenes.

This page is an **admin tool**, not something everyday users need to look at. AutoListing's pipeline is designed to run silently. You'd visit Workflows when:

- A listing seems stuck (no video, no posts) and you want to see where it's hanging
- You want to confirm a video has actually been generated and is ready to post
- You're investigating why a Post Now didn't go out
- You're verifying that a status change picked up correctly

## What you see

For each active listing, the page shows the current **workflow state**:

- **Pending verification** — listing was just created/changed, system is checking it has all required fields
- **Verification passed** — checks done, ready to start
- **Template created** — posting schedule template is in place
- **Video rendering** — Shotstack/Creatomate is generating the video (separate states for 16:9 and 9:16 aspect ratios)
- **Videos complete** — all renders done
- **Slots created** — empty time slots reserved for posting
- **Posts created** — slots filled with actual posts ready to go out
- **Active** — fully running, posting on schedule
- **Failed (retrying)** — something failed; the system will retry
- **Failed (permanent)** — too many retries; needs human intervention
- **Cancelled / Archived** — terminal states

Plus VS2 (motion clips) and Post Now have their own dedicated states (VS2 clips generating, stitching, rendering; Post Now triggered, generating, posting, completed/failed).

## Common things to do here

- **Identify a stuck listing** — scan for listings sitting in a non-terminal state for too long. Anything stuck >30 min in video rendering is suspicious.
- **Manually retry a failed listing** — if a listing is in "Failed (permanent)", you can retry the workflow from this page
- **Drill into errors** — clicking a listing expands its full automation log: every step, every API call, every error message with timestamps

## Related: Activity feed

If you just want to see videos and posts (not the underlying pipeline state), use the **Activity** page instead. Activity is the user-facing view; Workflows is the admin/diagnostic view of the same underlying pipeline.

## Who can see this

Workflows is gated to **admin** role within an org (and super_admin). Regular users don't see the Automation menu item at all.

## A note on terminology

The menu item is labelled **Automation** but the route is `/workflows` and the page title is **Workflows Monitor**. Same thing — Automation is the user-friendly label; Workflows is the technical name.
