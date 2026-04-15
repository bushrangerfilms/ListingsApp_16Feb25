#!/usr/bin/env node

/**
 * Automated Database Setup Script
 * 
 * This script creates the initial organization and admin user setup
 * for the Bridge Auctioneers CRM application.
 * 
 * Prerequisites:
 * 1. You must have signed up via the Supabase Auth UI first
 * 2. Environment variables must be set (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
 * 
 * Usage:
 * npm run setup-db YOUR_EMAIL@example.com
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables');
  console.error('   Required: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'crm' },
  auth: {
    persistSession: false
  }
});

async function setupDatabase(userEmail) {
  try {
    console.log('\n🚀 Starting automated database setup...\n');

    // Step 1: Find the user by email
    console.log(`📧 Looking up user: ${userEmail}`);
    const { data: users, error: userError } = await supabase.rpc('get_user_by_email', {
      email_address: userEmail
    });

    if (userError) {
      console.error('❌ Error finding user:', userError.message);
      console.log('\n💡 Make sure you have:');
      console.log('   1. Signed up through the Supabase Auth UI first');
      console.log('   2. Provided the correct email address');
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.error(`❌ No user found with email: ${userEmail}`);
      console.log('\n💡 Please sign up first via Supabase Auth:');
      console.log(`   1. Go to ${SUPABASE_URL}/auth/v1/signup`);
      console.log('   2. Create an account with this email');
      console.log('   3. Run this script again');
      process.exit(1);
    }

    const userId = users[0].id;
    console.log(`✅ Found user ID: ${userId}\n`);

    // Step 2: Check if organization exists
    console.log('🏢 Checking for Bridge Auctioneers organization...');
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', 'bridge-auctioneers')
      .maybeSingle();

    let orgId;

    if (existingOrg) {
      orgId = existingOrg.id;
      console.log(`✅ Organization already exists: ${orgId}\n`);
    } else {
      // Create organization
      console.log('📝 Creating Bridge Auctioneers organization...');
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          business_name: 'Bridge Auctioneers',
          slug: 'bridge-auctioneers',
          is_active: true,
          contact_email: userEmail,
          website: 'https://bridgeauctioneers.ie',
          phone: '+353 1 234 5678'
        })
        .select('id')
        .single();

      if (orgError) {
        console.error('❌ Error creating organization:', orgError.message);
        process.exit(1);
      }

      orgId = newOrg.id;
      console.log(`✅ Created organization: ${orgId}\n`);
    }

    // Step 3: Add admin role
    console.log('👤 Setting up admin role...');
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: 'admin'
      }, {
        onConflict: 'user_id,role',
        ignoreDuplicates: true
      });

    if (roleError) {
      console.error('❌ Error setting admin role:', roleError.message);
    } else {
      console.log('✅ Admin role assigned\n');
    }

    // Step 4: Link user to organization
    console.log('🔗 Linking user to organization...');
    const { error: linkError } = await supabase
      .from('user_organizations')
      .upsert({
        user_id: userId,
        organization_id: orgId,
        role: 'admin'
      }, {
        onConflict: 'user_id,organization_id',
        ignoreDuplicates: true
      });

    if (linkError) {
      console.error('❌ Error linking user to organization:', linkError.message);
    } else {
      console.log('✅ User linked to organization\n');
    }

    // Step 5: Verify setup
    console.log('🔍 Verifying setup...');
    const { data: verification, error: verifyError } = await supabase
      .from('user_organizations')
      .select(`
        user_id,
        organization_id,
        role,
        organizations (
          business_name,
          slug
        )
      `)
      .eq('user_id', userId)
      .single();

    if (verifyError || !verification) {
      console.error('❌ Verification failed:', verifyError?.message);
      process.exit(1);
    }

    console.log('✅ Setup verified successfully!\n');
    console.log('📋 Configuration:');
    console.log(`   User ID: ${userId}`);
    console.log(`   Email: ${userEmail}`);
    console.log(`   Organization: ${verification.organizations.business_name}`);
    console.log(`   Slug: ${verification.organizations.slug}`);
    console.log(`   Role: ${verification.role}`);
    console.log('\n🎉 Database setup complete!\n');
    console.log('Next steps:');
    console.log('1. Visit your Replit webview');
    console.log('2. Log in with your email and password');
    console.log('3. You should see the Bridge Auctioneers dashboard\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Get email from command line argument
const userEmail = process.argv[2];

if (!userEmail) {
  console.error('❌ Please provide your email address');
  console.log('\nUsage:');
  console.log('  npm run setup-db YOUR_EMAIL@example.com');
  console.log('\nExample:');
  console.log('  npm run setup-db john@bridgeauctioneers.ie\n');
  process.exit(1);
}

if (!userEmail.includes('@')) {
  console.error('❌ Invalid email format');
  process.exit(1);
}

setupDatabase(userEmail);
