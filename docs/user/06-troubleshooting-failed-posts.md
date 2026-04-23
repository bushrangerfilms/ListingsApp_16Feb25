---
id: troubleshooting.failed-posts
title: Troubleshooting failed posts
apps: [socials]
route_hints: ["/scheduling", "/videos", "/"]
plan_gates: []
---

# Troubleshooting failed posts

If a post shows as **Failed** on the Scheduling page or in your Activity feed, this guide covers the most common causes and fixes.

## How to find failed posts

- **Socials → Scheduling** → posts with a red status badge
- **Socials → Activity** → filter by "Failed"
- **Dashboard** → the "Failed Posts" card shows recent failures
- We also send a daily digest email if there are new failures (one email per organisation per 24h, sent to your contact email)

## Most common causes

### 1. Social account needs reconnecting

Most failures come from expired social platform tokens. Facebook, Instagram, and TikTok all expire connections every 60–90 days for security.

**Fix:**

- Go to **Social Accounts**
- Look for accounts marked **Reconnect needed**
- Click **Reconnect** and complete the platform's login

After reconnecting, future posts will go out normally. Failed posts that were already attempted are not automatically retried — you can manually re-post them by clicking the failed post → **Retry**.

### 2. Video generation failed

If the video for a post couldn't be generated (rare), the post fails before it even tries to post. This usually shows as a failure in the Activity feed.

**Fix:**

- Click the failed post → **Regenerate Video**
- If it fails again, the source photos may be the issue (corrupt files, very low resolution). Try replacing the listing's photos.

### 3. Post Now stuck

The "Post Now" feature has a 15-minute timeout. If a Post Now is still showing as "processing" after 15 minutes, the system auto-fails it. You can retry from the post detail.

### 4. Caption was rejected by the platform

Sometimes Instagram or TikTok rejects a caption (e.g. flagged hashtags, banned words). The platform usually returns a specific error message. Click the failed post to see the full error in the Activity log.

**Fix:** edit the caption, remove any flagged content, and retry.

### 5. Image format issues

Some platforms are picky about image formats and aspect ratios. AutoListing handles this automatically in most cases, but if you see persistent failures on a single platform, the image format may be the issue.

## Getting a stuck post moving

If a post has been "Processing" for hours:

1. Refresh the page first — sometimes it's already complete
2. Check the post's detail page for error messages
3. Try **Retry** if available
4. If still stuck, it'll be auto-failed by the system within 24 hours

## Still stuck?

If you've checked all of the above and still can't figure out why a post failed, ask Al — Al can read the post's detail and look up the specific error. If Al can't help, Al will offer to escalate it to support, sending the conversation context plus the failed post details to our team.

## What we monitor on our end

We're alerted automatically when:

- The system-wide failure rate goes above 5% in any 1-hour window
- A specific organisation has 3+ failures in 24 hours
- A scheduled-post cron skips its run

So in many cases we already know about the issue and are working on it. Failed posts caused by a platform-side outage usually resolve themselves within an hour.
