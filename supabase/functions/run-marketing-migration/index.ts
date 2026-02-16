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

    // Create the table
    await sql`
      CREATE TABLE IF NOT EXISTS public.marketing_content (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        section_key VARCHAR(50) NOT NULL,
        headline TEXT,
        subheadline TEXT,
        paragraph_1 TEXT,
        paragraph_2 TEXT,
        paragraph_3 TEXT,
        image_url TEXT,
        is_enabled BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(organization_id, section_key)
      )
    `;

    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_marketing_content_org_section 
      ON public.marketing_content(organization_id, section_key)
    `;

    // Enable RLS
    await sql`ALTER TABLE public.marketing_content ENABLE ROW LEVEL SECURITY`;

    // Drop existing policies if they exist
    await sql`DROP POLICY IF EXISTS "Admins can manage marketing content" ON public.marketing_content`;
    await sql`DROP POLICY IF EXISTS "Public can read enabled marketing content" ON public.marketing_content`;

    // Create admin policy
    await sql.unsafe(`
      CREATE POLICY "Admins can manage marketing content"
      ON public.marketing_content
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

    // Create public read policy
    await sql.unsafe(`
      CREATE POLICY "Public can read enabled marketing content"
      ON public.marketing_content
      FOR SELECT
      USING (is_enabled = true)
    `);

    // Grant permissions
    await sql`GRANT SELECT ON public.marketing_content TO anon`;
    await sql`GRANT ALL ON public.marketing_content TO authenticated`;

    await sql.end();

    return new Response(
      JSON.stringify({ success: true, message: 'marketing_content table created successfully' }),
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
