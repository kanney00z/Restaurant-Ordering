import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const settings = JSON.parse(fs.readFileSync('restaurant_settings.json', 'utf8'));
const supabaseUrl = settings.supabaseUrl;
const supabaseAnonKey = settings.supabaseAnonKey;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseAnonKey ? 'Present' : 'Missing');

if (supabaseUrl && supabaseAnonKey) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  async function test() {
    console.log('\n--- Testing connection ---');
    try {
      const { data: settingsData, error: settingsErr } = await supabase
        .from('restaurant_settings')
        .select('*');
      console.log('Settings Fetch Result:', { data: settingsData, error: settingsErr });

      const { data: catData, error: catErr } = await supabase
        .from('categories')
        .select('*');
      console.log('Categories Fetch Result:', { count: catData?.length, error: catErr });
      if (catData) console.log('Categories:', catData);

      const { data: menuData, error: menuErr } = await supabase
        .from('menu_items')
        .select('*');
      console.log('Menu Items Fetch Result:', { count: menuData?.length, error: menuErr });
      if (menuData) console.log('Menu Items:', menuData);

    } catch (e) {
      console.error('Exception:', e);
    }
  }

  test();
} else {
  console.log('Supabase is not configured.');
}
