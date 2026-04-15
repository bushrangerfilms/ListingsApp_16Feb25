-- Create organization_site_copy table for customizable text content on public sites
CREATE TABLE IF NOT EXISTS public.organization_site_copy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  locale text NOT NULL DEFAULT 'en-IE',
  copy_key text NOT NULL,
  copy_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, locale, copy_key)
);

CREATE INDEX IF NOT EXISTS idx_org_site_copy_org_locale 
ON public.organization_site_copy(organization_id, locale);

ALTER TABLE public.organization_site_copy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site copy"
ON public.organization_site_copy
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage site copy"
ON public.organization_site_copy
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) AND 
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

CREATE TRIGGER update_organization_site_copy_updated_at
  BEFORE UPDATE ON public.organization_site_copy
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RPC function to get site copy for an organization
CREATE OR REPLACE FUNCTION public.get_organization_site_copy(org_id uuid, loc text DEFAULT 'en-IE')
RETURNS TABLE(copy_key text, copy_value text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT copy_key, copy_value
  FROM public.organization_site_copy
  WHERE organization_id = org_id AND locale = loc;
$$;

-- RPC function to upsert site copy for an organization (with authorization check)
CREATE OR REPLACE FUNCTION public.upsert_organization_site_copy(
  org_id uuid,
  loc text,
  key text,
  value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check that user has admin/super_admin role and belongs to this organization
  IF NOT (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) AND 
    org_id IN (SELECT get_user_organization_ids(auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions for organization';
  END IF;

  INSERT INTO public.organization_site_copy (organization_id, locale, copy_key, copy_value)
  VALUES (org_id, loc, key, value)
  ON CONFLICT (organization_id, locale, copy_key)
  DO UPDATE SET copy_value = EXCLUDED.copy_value, updated_at = now();
END;
$$;

-- RPC function to delete a site copy entry (with authorization check)
CREATE OR REPLACE FUNCTION public.delete_organization_site_copy(
  org_id uuid,
  loc text,
  key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check that user has admin/super_admin role and belongs to this organization
  IF NOT (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) AND 
    org_id IN (SELECT get_user_organization_ids(auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions for organization';
  END IF;

  DELETE FROM public.organization_site_copy
  WHERE organization_id = org_id AND locale = loc AND copy_key = key;
END;
$$;
