import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const settings = JSON.parse(fs.readFileSync('restaurant_settings.json', 'utf8'));
const supabaseUrl = settings.supabaseUrl;
const supabaseAnonKey = settings.supabaseAnonKey;

if (supabaseUrl && supabaseAnonKey) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  async function test() {
    console.log('Trying full insert...');
    const res1 = await supabase.from('categories').upsert({
      id: 'test_id',
      name_th: 'ทดสอบ',
      name_en: 'Test',
      emoji: '🥗'
    });
    console.log('Result 1:', res1);

    console.log('\nTrying insert without emoji...');
    const res2 = await supabase.from('categories').upsert({
      id: 'test_id_no_emoji',
      name_th: 'ทดสอบไม่มีอิโมจิ',
      name_en: 'Test No Emoji'
    });
    console.log('Result 2:', res2);
  }

  test();
}
