import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const databaseUrl = Deno.env.get('SUPABASE_DB_URL');
    
    if (!databaseUrl) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_DB_URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sql = postgres(databaseUrl, { prepare: false });

    await sql`
      CREATE TABLE IF NOT EXISTS public.organization_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        token TEXT NOT NULL UNIQUE,
        invited_by UUID NOT NULL REFERENCES auth.users(id),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
        accepted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(email, organization_id)
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_org_invitations_org 
      ON public.organization_invitations(organization_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_org_invitations_email 
      ON public.organization_invitations(email)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_org_invitations_token 
      ON public.organization_invitations(token)
    `;

    await sql`ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY`;

    await sql`DROP POLICY IF EXISTS "Admins can manage invitations" ON public.organization_invitations`;
    await sql`DROP POLICY IF EXISTS "Users can view their own invitations" ON public.organization_invitations`;

    await sql.unsafe(`
      CREATE POLICY "Admins can manage invitations"
      ON public.organization_invitations
      FOR ALL
      USING (
        has_role(auth.uid(), 'admin'::app_role) 
        AND organization_id IN (SELECT get_user_organization_ids(auth.uid()))
      )
      WITH CHECK (
        has_role(auth.uid(), 'admin'::app_role) 
        AND organization_id IN (SELECT get_user_organization_ids(auth.uid()))
      )
    `);

    await sql`DROP POLICY IF EXISTS "Public can verify invitation by token" ON public.organization_invitations`;
    
    await sql.unsafe(`
      CREATE POLICY "Public can verify invitation by token"
      ON public.organization_invitations
      FOR SELECT
      USING (true)
    `);

    await sql`GRANT SELECT ON public.organization_invitations TO anon`;
    await sql`GRANT ALL ON public.organization_invitations TO authenticated`;

    await sql.end();

    return new Response(
      JSON.stringify({ success: true, message: 'organization_invitations table created successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
