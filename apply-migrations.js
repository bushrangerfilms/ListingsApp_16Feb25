import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase client with service role (bypasses RLS)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: 'public' } // Start with public schema
  }
);

async function applyMigrations() {
  console.log('🚀 Starting migration process...\n');
  
  const migrationsDir = join(__dirname, 'supabase', 'migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort by timestamp in filename

  console.log(`Found ${migrationFiles.length} migration files\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const file of migrationFiles) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf8');
    
    console.log(`Applying: ${file}`);
    
    try {
      // Execute the migration SQL using Supabase's RPC to raw SQL
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`  ✅ Success`);
        successCount++;
      }
    } catch (err) {
      console.error(`  ❌ Exception: ${err.message}`);
      errorCount++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📁 Total: ${migrationFiles.length}`);
  
  if (errorCount === 0) {
    console.log('\n🎉 All migrations applied successfully!');
  } else {
    console.log('\n⚠️  Some migrations failed. Check errors above.');
  }
}

applyMigrations().catch(console.error);
