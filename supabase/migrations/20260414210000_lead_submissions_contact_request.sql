-- Add fields to support bundling the contact-request signal with the
-- form-completed notification. The lead-magnet-api defers the
-- form-completed email by 60 seconds; if a contact request arrives in
-- that window, it populates these columns and the deferred task sends a
-- single bundled notification instead of two separate emails.

ALTER TABLE public.lead_submissions
  ADD COLUMN IF NOT EXISTS contact_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_additional_info text;

COMMENT ON COLUMN public.lead_submissions.contact_requested_at IS
  'Set when the lead clicks "Contact Agent" on the results page. Used by '
  'the deferred form-completed email to decide whether to bundle the '
  'callback request into a single notification (if within 60s of form '
  'completion) or send a separate callback-requested email.';

COMMENT ON COLUMN public.lead_submissions.contact_additional_info IS
  'Free-text note the lead added when requesting a callback.';
