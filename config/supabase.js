const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Usar anon key en lugar de service key

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables SUPABASE_URL o SUPABASE_ANON_KEY en .env');
  console.log('💡 Instrucciones:');
  console.log('1. Ve a https://supabase.com/dashboard');
  console.log('2. Selecciona tu proyecto');
  console.log('3. Ve a Settings > API');
  console.log('4. Copia la "anon" key (clave pública)');
  console.log('5. Agrégala como SUPABASE_ANON_KEY en el archivo .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

module.exports = supabase;
