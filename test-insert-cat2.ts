import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const settings = JSON.parse(fs.readFileSync('restaurant_settings.json', 'utf8'));
const supabaseUrl = settings.supabaseUrl;
const supabaseAnonKey = settings.supabaseAnonKey;

if (supabaseUrl && supabaseAnonKey) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  async function test() {
    console.log('Trying insert with id, name...');
    const res1 = await supabase.from('categories').upsert({
      id: 'test_id_old',
      name: 'อาหารจานหลัก'
    });
    console.log('Result 1 (name):', res1);

    console.log('\nTrying insert with id, name_th...');
    const res2 = await supabase.from('categories').upsert({
      id: 'test_id_th',
      name_th: 'อาหารจานหลัก'
    });
    console.log('Result 2 (name_th):', res2);
  }

  test();
}
