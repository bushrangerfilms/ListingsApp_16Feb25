import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
  // Get connection string from environment or command line
  const connectionString = process.env.SUPABASE_DB_URL || process.argv[2];
  
  if (!connectionString) {
    console.error('❌ Error: No database connection string provided');
    console.error('\nUsage:');
    console.error('  SUPABASE_DB_URL="your-connection-string" node run-migrations.js');
    console.error('  OR');
    console.error('  node run-migrations.js "your-connection-string"');
    console.error('\nGet your connection string from:');
    console.error('  https://supabase.com/dashboard/project/sjcfcxjpukgeaxxkffpq/settings/database');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to Supabase database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Get all migration files sorted by timestamp
    const migrationsDir = join(__dirname, 'supabase', 'migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${migrationFiles.length} migration files\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const file of migrationFiles) {
      const filePath = join(migrationsDir, file);
      const sql = readFileSync(filePath, 'utf8');
      
      process.stdout.write(`Applying ${file}... `);
      
      try {
        await client.query(sql);
        console.log('✅');
        successCount++;
      } catch (error) {
        console.log('❌');
        errorCount++;
        errors.push({
          file,
          error: error.message
        });
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📁 Total: ${migrationFiles.length}`);
    console.log('='.repeat(60));
    
    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:\n');
      errors.forEach(({ file, error }) => {
        console.log(`  ${file}:`);
        console.log(`    ${error}\n`);
      });
    } else {
      console.log('\n🎉 All migrations applied successfully!');
      console.log('\nYou can now run the user setup SQL:');
      console.log('  INSERT INTO public.user_roles (user_id, role)');
      console.log("  VALUES ('b3201c8e-a10c-4fe1-8fa7-6dd97f65dfd1', 'admin');");
      console.log('  \n  INSERT INTO public.user_organizations (user_id, organization_id, role)');
      console.log("  VALUES ('b3201c8e-a10c-4fe1-8fa7-6dd97f65dfd1', 'b3d49735-1a04-42e0-a73d-a06b5f54de62', 'admin');");
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

runMigrations().catch(console.error);
