import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// In-Memory Database State (resets on server restart, but fully synchronized during session)
export interface Category {
  id: string;
  nameTh: string;
  nameEn: string;
  emoji: string;
}

export interface OptionChoice {
  name: string;
  price: number;
  image?: string;
}

export interface OptionGroup {
  id: string;
  name: string;
  required: boolean;
  choices: OptionChoice[];
}

export interface MenuItem {
  id: string;
  nameTh: string;
  nameEn: string;
  descriptionTh: string;
  descriptionEn: string;
  price: number;
  category: string; // dynamic category ID
  image: string; // base64 or url
  isPopular: boolean;
  prepTime: number; // minutes
  ingredients: string[];
  inStock: boolean;
  optionGroups?: OptionGroup[];
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  dineInType: 'dine-in' | 'delivery';
  tableNumber?: string;
  deliveryAddress?: string;
  phone?: string;
  paymentMethod?: 'cash' | 'promptpay';
  paymentSlip?: string; // base64 or url
  items: {
    menuItemId: string;
    nameEn: string;
    nameTh: string;
    price: number;
    quantity: number;
    customizations?: {
      sweetness?: string;
      temperature?: string;
      spiciness?: string;
      noodleType?: string;
      riceType?: string;
      optionSelections?: { [groupName: string]: OptionChoice };
      notes?: string;
      serviceType?: 'dine-in' | 'takeaway';
    };
  }[];
  totalAmount: number;
  status: 'pending' | 'preparing' | 'cooking' | 'ready' | 'completed' | 'cancelled';
  timestamp: string; // ISO string
}

export interface RestaurantSettings {
  storeName: string;
  promptPayNumber: string;
  promptPayName: string;
  lineChannelAccessToken?: string;
  lineUserId?: string;
  phone?: string;
  tagline?: string;
  openTime?: string;
  closeTime?: string;
  closedDays?: number[];
  isClosedTemporarily?: boolean;
  isReservationEnabled?: boolean;
  isLoyaltyEnabled?: boolean;
  lastLineError?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

let restaurantSettings: RestaurantSettings = {
  storeName: "AURA CULINARY",
  promptPayNumber: "081-234-5678",
  promptPayName: "คุณสมศรี ดีดี",
  lineChannelAccessToken: "",
  lineUserId: "",
  phone: "081-234-5678",
  tagline: "Gastronomy & AI Sommelier",
  openTime: "09:00",
  closeTime: "21:00",
  closedDays: [],
  isClosedTemporarily: false,
  isReservationEnabled: true,
  isLoyaltyEnabled: true,
  lastLineError: "",
  supabaseUrl: process.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || ""
};

// Initial Menu Seed Data
let menuItems: MenuItem[] = [
  {
    id: "A1",
    nameTh: "มันฝรั่งทอดคลุกทรัฟเฟิล",
    nameEn: "Truffle French Fries",
    descriptionTh: "มันฝรั่งทอดกรอบสีทอง คลุกน้ำมันทรัฟเฟิลขาว โรยด้วยชีสพาร์เมซานขูดและพาร์สลีย์สด เสิร์ฟพร้อมซอสกระเทียมมาโย",
    descriptionEn: "Golden crisp french fries tossed with premium white truffle oil, grated parmesan cheese, and fresh parsley. Served with house-made garlic aioli.",
    price: 180,
    category: "appetizer",
    image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80",
    isPopular: true,
    prepTime: 8,
    ingredients: ["Potato", "Truffle Oil", "Parmesan", "Garlic", "Parsley"],
    inStock: true
  },
  {
    id: "A2",
    nameTh: "เกี๊ยวซ่าเนื้อวากิวสะดุ้งไฟ",
    nameEn: "Seared Wagyu Gyoza",
    descriptionTh: "เกี๊ยวซ่าญี่ปุ่นสอดไส้เนื้อวากิวบดพรีเมียม ต้นหอม และขิง ย่างกระทะร้อนๆ จนกรอบก้น ราดด้วยซอสน้ำมันพริกสูตรพิเศษ",
    descriptionEn: "Pan-seared Japanese dumplings stuffed with premium minced Wagyu beef, chives, and ginger. Drizzled with signature spiced chili oil.",
    price: 240,
    category: "appetizer",
    image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=80",
    isPopular: true,
    prepTime: 10,
    ingredients: ["Wagyu Beef", "Flour Wrapper", "Chive", "Chili Oil", "Soy Sauce"],
    inStock: true
  },
  {
    id: "A3",
    nameTh: "สลัดบูร์ราตาคาเปรเซ่",
    nameEn: "Burrata Caprese Salad",
    descriptionTh: "ชีสบูร์ราตาอิตาเลียนสดเสิร์ฟพร้อมมะเขือเทศแอร์ลูมหวานฉ่ำ ใบโหระพาอิตาเลียน ซอสบัลซามิกเกรดพรีเมียม และน้ำมันมะกอกบริสุทธิ์ extra virgin",
    descriptionEn: "Fresh Italian burrata cheese served with organic heirloom tomatoes, sweet basil leaves, aged balsamic reduction glaze, and premium extra virgin olive oil.",
    price: 290,
    category: "appetizer",
    image: "https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=600&auto=format&fit=crop&q=80",
    isPopular: false,
    prepTime: 7,
    ingredients: ["Burrata Cheese", "Heirloom Tomatoes", "Balsamic Glaze", "Basil", "Olive Oil"],
    inStock: true
  },
  {
    id: "M1",
    nameTh: "สเต็กเนื้อวากิวออสเตรเลียริบอาย A4",
    nameEn: "Australian Wagyu Ribeye Steak A4",
    descriptionTh: "เนื้อวากิวออสเตรเลียริบอายเกรดพรีเมียม (Marble score 7+) ย่างเตาถ่าน เสิร์ฟคู่กับกระเทียมอบ มันฝรั่งทรัฟเฟิลบด และซอสไวน์แดงสูตรเข้มข้น",
    descriptionEn: "Premium Australian Wagyu ribeye (MS 7+) chargrilled to perfection. Served with roasted garlic heads, truffle mashed potato, and a rich red wine reduction.",
    price: 1390,
    category: "main",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
    isPopular: true,
    prepTime: 20,
    ingredients: ["Wagyu Ribeye", "Red Wine Sauce", "Garlic", "Potato", "Rosemary"],
    inStock: true
  },
  {
    id: "M2",
    nameTh: "ผัดไทยกุ้งแม่น้ำล็อบสเตอร์",
    nameEn: "Lobster Pad Thai Royale",
    descriptionTh: "ผัดไทยสูตรดั้งเดิมโบราณ ยกระดับความหรูหราด้วยหางกุ้งล็อบสเตอร์ย่างเนยกระเทียม ทานคู่กับเส้นจันท์เหนียวนุ่ม เต้าหู้ ถั่วงอก ใบกุยช่าย และถั่วลิสงคั่วบดใหม่",
    descriptionEn: "Traditional Thai stir-fried rice noodles served with a whole grilled lobster tail with garlic butter. Garnished with organic beansprouts, chives, and freshly roasted peanuts.",
    price: 750,
    category: "main",
    image: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=600&auto=format&fit=crop&q=80",
    isPopular: true,
    prepTime: 15,
    ingredients: ["Lobster Tail", "Rice Noodles", "Tamarind Sauce", "Tofu", "Peanuts", "Bean Sprouts"],
    inStock: true
  },
  {
    id: "M3",
    nameTh: "ริซอตโต้ครีมเห็ดป่าและทรัฟเฟิล",
    nameEn: "Truffle Wild Mushroom Risotto",
    descriptionTh: "ข้าวริซอตโต้จากแคว้นเวเนโต เคี่ยวอย่างพิถีพิถันในน้ำซุปผัก ครีมสด ชีสพาร์เมซานเข้มข้น และเห็ดป่าหลากชนิด ราดด้วยซอสน้ำมันเห็ดทรัฟเฟิลดำดำดิ่ง",
    descriptionEn: "Creamy Italian arborio rice simmered patiently in rich vegetable stock, heavy cream, parmesan, and roasted wild forest mushrooms, finished with fresh truffle paste.",
    price: 420,
    category: "main",
    image: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=600&auto=format&fit=crop&q=80",
    isPopular: false,
    prepTime: 18,
    ingredients: ["Arborio Rice", "Shitake Mushroom", "Porcini Mushroom", "Truffle Paste", "Parmesan"],
    inStock: true
  },
  {
    id: "M4",
    nameTh: "สเต็กแซลมอนนอร์เวย์ซอสยูซุเทอริยากิ",
    nameEn: "Norwegian Salmon with Yuzu Teriyaki",
    descriptionTh: "แซลมอนส่งตรงจากนอร์เวย์เซียร์จนหนังกรอบ เนื้อในนุ่มฉ่ำ ราดซอสเทอริยากิผสมส้มยูซุหอมสดชื่น เสิร์ฟพร้อมข้าวญี่ปุ่นอบเนย",
    descriptionEn: "Pan-seared Norwegian salmon with a perfectly crispy skin. Glazed with a refreshing citrus-infused yuzu teriyaki sauce, served with buttered Japanese rice.",
    price: 450,
    category: "main",
    image: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80",
    isPopular: false,
    prepTime: 12,
    ingredients: ["Salmon Fillet", "Yuzu Teriyaki Sauce", "Japanese Rice", "Asparagus", "Sesame"],
    inStock: true
  },
  {
    id: "M5",
    nameTh: "ก๋วยเตี๋ยวเรือน้ำตกเนื้อวากิวริบอาย",
    nameEn: "Wagyu Ribeye Boat Noodles",
    descriptionTh: "ก๋วยเตี๋ยวเรือรสเข้มข้นจัดจ้านแบบโบราณ ท็อปด้วยเนื้อวากิวริบอายออสเตรเลียสไลด์บางสะดุ้งน้ำซุป ลูกชิ้นเนื้อเกรดดี และผักบุ้งจีนกรอบ (สามารถเลือกเส้นได้ตามต้องการ)",
    descriptionEn: "Rich and spicy traditional Thai boat noodle broth, topped with premium thin-sliced Australian Wagyu ribeye, quality beef balls, and crispy water spinach. (Customisable noodle type)",
    price: 250,
    category: "main",
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80",
    isPopular: true,
    prepTime: 8,
    ingredients: ["Wagyu Beef", "Noodles", "Spiced Broth", "Beef Balls", "Morning Glory"],
    inStock: true,
    optionGroups: [
      {
        id: "opt_m5_1",
        name: "สั่งพิเศษ",
        required: true,
        choices: [
          { name: "ธรรมดา", price: 0 },
          { name: "พิเศษ", price: 10 }
        ]
      },
      {
        id: "opt_m5_2",
        name: "ผสมอะไรเพิ่ม",
        required: false,
        choices: [
          { name: "หมูแดง", price: 10 },
          { name: "หมูกรอบ", price: 10 }
        ]
      }
    ]
  },
  {
    id: "M6",
    nameTh: "ข้าวกะเพราเนื้อสับวากิวไข่ดาวกรอบ",
    nameEn: "Wagyu Holy Basil Beef with Crispy Egg",
    descriptionTh: "ผัดกะเพราเนื้อสับวากิวคัดสรรพิเศษ ผัดแห้งๆ รสชาติจัดจ้านหอมพริกแห้งและใบกะเพราป่า เสิร์ฟราดข้าวสวยร้อนๆ และไข่ดาวขอบกรอบไข่แดงเยิ้ม (สามารถเลือกข้าวได้ตามต้องการ)",
    descriptionEn: "Stir-fried minced Wagyu beef with fiery dry chilies and aromatic holy basil, served over warm rice and a crispy-edged fried egg with a runny yolk. (Customisable rice type)",
    price: 190,
    category: "main",
    image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80",
    isPopular: true,
    prepTime: 10,
    ingredients: ["Minced Wagyu", "Holy Basil", "Garlic", "Chili", "Egg", "Rice"],
    inStock: true,
    optionGroups: [
      {
        id: "opt_m6_1",
        name: "สั่งพิเศษ",
        required: true,
        choices: [
          { name: "ธรรมดา", price: 0 },
          { name: "พิเศษ", price: 10 }
        ]
      },
      {
        id: "opt_m6_2",
        name: "ผสมอะไรเพิ่ม",
        required: false,
        choices: [
          { name: "หมูแดง", price: 10 },
          { name: "หมูกรอบ", price: 10 }
        ]
      }
    ]
  },
  {
    id: "D1",
    nameTh: "ช็อกโกแลตลาวาอุ่นเสิร์ฟพร้อมไอศกรีมวานิลลา",
    nameEn: "Warm Dark Chocolate Lava Cake",
    descriptionTh: "เค้กช็อกโกแลตลาวาเข้มข้นสไตล์เบลเยียม 70% อบสดใหม่เมื่อสั่ง ไส้ช็อกโกแลตอุ่นเยิ้มๆ เสิร์ฟคู่กับเจลาโต้วานิลลาฝักมาดากัสการ์และผลเบอร์รี่สด",
    descriptionEn: "Decadent 70% Belgian dark chocolate cake baked to order with an oozing molten center. Served with high-end Madagascar vanilla bean gelato and fresh seasonal berries.",
    price: 240,
    category: "dessert",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80",
    isPopular: true,
    prepTime: 12,
    ingredients: ["70% Belgian Chocolate", "Butter", "Flour", "Egg", "Vanilla Gelato"],
    inStock: true
  },
  {
    id: "D2",
    nameTh: "ข้าวเหนียวมะม่วงน้ำดอกไม้ซิกเนเจอร์",
    nameEn: "Signature Nam Dok Mai Mango Sticky Rice",
    descriptionTh: "มะม่วงน้ำดอกไม้หวานหอมคัดพิเศษ เสิร์ฟพร้อมข้าวเหนียวมูนใบเตยอัญชันเม็ดนุ่ม เรียงตัวสวย ราดกะทิเข้มข้นอบควันเทียนและถั่วทองคั่วกรอบ",
    descriptionEn: "Perfectly sweet Nam Dok Mai mango served with warm blue-butterfly and green-pandan infused coconut sticky rice, topped with salted coconut sauce and crispy mung beans.",
    price: 190,
    category: "dessert",
    image: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=600&auto=format&fit=crop&q=80",
    isPopular: true,
    prepTime: 6,
    ingredients: ["Mango", "Glutinous Rice", "Coconut Milk", "Pandan Leaf", "Crispy Mung Beans"],
    inStock: true
  },
  {
    id: "B1",
    nameTh: "ยูซุโรสสปาร์คกลิ้ง",
    nameEn: "Yuzu Rose Sparkling",
    descriptionTh: "น้ำส้มยูซุนำเข้าจากญี่ปุ่น ผสมน้ำสกัดดอกกุหลาบออร์แกนิก ไซรัปโฮมเมด และน้ำโซดาซ่าเย็นชื่นใจ ตกแต่งด้วยใบสะระแหน่ฝรั่งและดอกไม้ทานได้",
    descriptionEn: "Authentic Japanese yuzu juice infused with organic rose-water extraction, artisan simple syrup, and sparkling soda water. Garnished with mint leaves and edible flowers.",
    price: 150,
    category: "beverage",
    image: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&auto=format&fit=crop&q=80",
    isPopular: true,
    prepTime: 4,
    ingredients: ["Yuzu Juice", "Rose Water", "Soda Water", "Mint", "Syrup"],
    inStock: true
  },
  {
    id: "B2",
    nameTh: "อุจิมัทฉะเย็นลาเต้เกรดพิธีการ",
    nameEn: "Ceremonial Uji Matcha Latte",
    descriptionTh: "ผงมัทฉะอุจิแท้เกรดดีที่สุด พิถีพิถันตีด้วยแปรงไม้ไผ่ ผสมเข้ากับนมสดแท้ 100% รสชาติเข้มข้น มีกลิ่นหอมของอูมามิและมิลค์กี้แบบธรรมชาติ",
    descriptionEn: "Stone-ground ceremonial grade Uji matcha whisked traditional style with premium cold milk, sweetened with organic sugarcane honey.",
    price: 160,
    category: "beverage",
    image: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80",
    isPopular: false,
    prepTime: 5,
    ingredients: ["Ceremonial Matcha", "Fresh Milk", "Bamboo Whisk", "Honey"],
    inStock: true
  },
  {
    id: "B3",
    nameTh: "ชากุหลาบอัญชันมะนาวน้ำผึ้ง",
    nameEn: "Honey Lemon Butterfly Pea Refresher",
    descriptionTh: "น้ำอัญชันสกัดสดสีน้ำเงินอินทรีย์ ผสมกับน้ำมะนาวแท้จนเปลี่ยนเป็นสีม่วงพาสเทลสวยงาม เสริมความหวานด้วยน้ำผึ้งป่าแท้และหญ้าหวาน",
    descriptionEn: "Vibrant organic blue butterfly pea tea shifting to a pastel violet hue upon addition of fresh squeezed lemon. Sweetened with wild forest honey.",
    price: 120,
    category: "beverage",
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80",
    isPopular: false,
    prepTime: 3,
    ingredients: ["Butterfly Pea Flower", "Honey", "Lemon", "Soda"],
    inStock: true
  }
];

// Active Categories State (with pre-seeded options)
let categories: Category[] = [
  { id: "appetizer", nameTh: "อาหารเรียกน้ำย่อย", nameEn: "Appetizers", emoji: "🥗" },
  { id: "main", nameTh: "อาหารจานหลัก", nameEn: "Mains", emoji: "🥩" },
  { id: "dessert", nameTh: "ของหวาน", nameEn: "Desserts", emoji: "🍨" },
  { id: "beverage", nameTh: "เครื่องดื่ม", nameEn: "Beverages", emoji: "🍹" }
];

// Initial Orders Seed Data (to make the admin dashboard look active and ready instantly)
let orders: Order[] = [
  {
    id: "ORD-1001",
    orderNumber: "1001",
    customerName: "คุณแพรวา",
    dineInType: "dine-in",
    tableNumber: "04",
    items: [
      { menuItemId: "A1", nameEn: "Truffle French Fries", nameTh: "มันฝรั่งทอดคลุกทรัฟเฟิล", price: 180, quantity: 1 },
      { menuItemId: "M1", nameEn: "Australian Wagyu Ribeye Steak A4", nameTh: "สเต็กเนื้อวากิวออสเตรเลียริบอาย A4", price: 1390, quantity: 1, customizations: { notes: "ขอมีเดียมแรร์ค่ะ" } },
      { menuItemId: "B1", nameEn: "Yuzu Rose Sparkling", nameTh: "ยูซุโรสสปาร์คกลิ้ง", price: 150, quantity: 2 }
    ],
    totalAmount: 1870,
    status: "completed",
    timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString() // 2.5 hours ago
  },
  {
    id: "ORD-1002",
    orderNumber: "1002",
    customerName: "คุณกรวิชญ์",
    dineInType: "delivery",
    deliveryAddress: "789 ถ.สุขุมวิท ซอย 24 แขวงคลองเตย กรุงเทพฯ 10110",
    phone: "081-234-5678",
    items: [
      { menuItemId: "M2", nameEn: "Lobster Pad Thai Royale", nameTh: "ผัดไทยกุ้งแม่น้ำล็อบสเตอร์", price: 750, quantity: 1 },
      { menuItemId: "D2", nameEn: "Signature Nam Dok Mai Mango Sticky Rice", nameTh: "ข้าวเหนียวมะม่วงน้ำดอกไม้ซิกเนเจอร์", price: 190, quantity: 1 }
    ],
    totalAmount: 940,
    status: "preparing",
    timestamp: new Date(Date.now() - 3600000 * 0.4).toISOString() // 24 mins ago
  },
  {
    id: "ORD-1003",
    orderNumber: "1003",
    customerName: "คุณสมศักดิ์",
    dineInType: "dine-in",
    tableNumber: "12",
    items: [
      { menuItemId: "A3", nameEn: "Burrata Caprese Salad", nameTh: "สลัดบูร์ราตาคาเปรเซ่", price: 290, quantity: 1 },
      { menuItemId: "M3", nameEn: "Truffle Wild Mushroom Risotto", nameTh: "ริซอตโต้ครีมเห็ดป่าและทรัฟเฟิล", price: 420, quantity: 1 },
      { menuItemId: "B2", nameEn: "Ceremonial Uji Matcha Latte", nameTh: "อุจิมัทฉะเย็นลาเต้เกรดพิธีการ", price: 160, quantity: 1 }
    ],
    totalAmount: 870,
    status: "pending",
    timestamp: new Date(Date.now() - 60000 * 5).toISOString() // 5 mins ago
  }
];

export interface Reservation {
  id: string;
  customerName: string;
  phone: string;
  date: string;
  time: string;
  partySize: number;
  tablePreference?: string;
  specialRequest?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  timestamp: string;
}

let reservations: Reservation[] = [
  {
    id: "RES-2001",
    customerName: "คุณวิภาวี",
    phone: "089-999-8888",
    date: "2026-07-06",
    time: "19:00",
    partySize: 4,
    tablePreference: "โซนริมหน้าต่าง (Window Seat)",
    specialRequest: "เลี้ยงฉลองวันเกิด มีเค้กมาเองค่ะ",
    status: "confirmed",
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: "RES-2002",
    customerName: "Mr. Jack Robinson",
    phone: "082-111-2222",
    date: "2026-07-07",
    time: "18:30",
    partySize: 2,
    tablePreference: "โซนเงียบสงบ (Quiet Zone)",
    specialRequest: "Anniversary dinner, quiet spot please",
    status: "pending",
    timestamp: new Date().toISOString()
  }
];

let orderCounter = 1004;

// --- SUPABASE PERSISTENCE & REALTIME SYNC ---

// Lazy-initialized Supabase Client
function getSupabase() {
  const url = restaurantSettings.supabaseUrl?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const key = restaurantSettings.supabaseAnonKey?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (url && key) {
    try {
      return createClient(url, key);
    } catch (e) {
      console.error("Supabase client creation error:", e);
    }
  }
  return null;
}

// Helper to sync restaurant settings to Supabase
async function syncSettingsToSupabase() {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('restaurant_settings').upsert({
      id: 'default',
      store_name: restaurantSettings.storeName,
      promptpay_number: restaurantSettings.promptPayNumber,
      promptpay_name: restaurantSettings.promptPayName,
      line_channel_access_token: restaurantSettings.lineChannelAccessToken || "",
      line_user_id: restaurantSettings.lineUserId || "",
      phone: restaurantSettings.phone || "",
      tagline: restaurantSettings.tagline || "",
      open_time: restaurantSettings.openTime || "09:00",
      close_time: restaurantSettings.closeTime || "21:00",
      closed_days: restaurantSettings.closedDays || [],
      is_closed_temporarily: restaurantSettings.isClosedTemporarily === true,
      is_reservation_enabled: restaurantSettings.isReservationEnabled !== false,
      is_loyalty_enabled: restaurantSettings.isLoyaltyEnabled !== false,
      last_line_error: restaurantSettings.lastLineError || ""
    });
    if (error) console.error("Supabase settings sync error:", error);
  } catch (e) {
    console.error("Supabase settings sync failed:", e);
  }
}

// Helper to sync an order to Supabase
async function syncOrderToSupabase(order: Order) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('orders').upsert({
      id: order.id,
      order_number: order.orderNumber,
      customer_name: order.customerName,
      dine_in_type: order.dineInType,
      table_number: order.tableNumber || "",
      delivery_address: order.deliveryAddress || "",
      phone: order.phone || "",
      payment_method: order.paymentMethod || "cash",
      payment_slip: order.paymentSlip || "",
      items: order.items,
      total_amount: order.totalAmount,
      status: order.status,
      timestamp: order.timestamp
    });
    if (error) console.error("Supabase order sync error:", error);
  } catch (e) {
    console.error("Supabase order sync failed:", e);
  }
}

// Helper to delete an order from Supabase
async function deleteOrderFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) console.error("Supabase order deletion error:", error);
  } catch (e) {
    console.error("Supabase order deletion failed:", e);
  }
}

// Helper to sync a reservation to Supabase
async function syncReservationToSupabase(resv: Reservation) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('reservations').upsert({
      id: resv.id,
      customer_name: resv.customerName,
      phone: resv.phone,
      date: resv.date,
      time: resv.time,
      party_size: resv.partySize,
      table_preference: resv.tablePreference || "",
      special_request: resv.specialRequest || "",
      status: resv.status,
      timestamp: resv.timestamp
    });
    if (error) console.error("Supabase reservation sync error:", error);
  } catch (e) {
    console.error("Supabase reservation sync failed:", e);
  }
}

// Helper to delete a reservation from Supabase
async function deleteReservationFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('reservations').delete().eq('id', id);
    if (error) console.error("Supabase reservation deletion error:", error);
  } catch (e) {
    console.error("Supabase reservation deletion failed:", e);
  }
}

// Helper to sync a menu item to Supabase
async function syncMenuItemToSupabase(item: MenuItem) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('menu_items').upsert({
      id: item.id,
      name_th: item.nameTh,
      name_en: item.nameEn,
      description_th: item.descriptionTh,
      description_en: item.descriptionEn,
      price: item.price,
      category: item.category,
      image: item.image,
      is_popular: item.isPopular,
      prep_time: item.prepTime,
      ingredients: item.ingredients,
      in_stock: item.inStock,
      option_groups: item.optionGroups || []
    });
    if (error) console.error("Supabase menu item sync error:", error);
  } catch (e) {
    console.error("Supabase menu item sync failed:", e);
  }
}

// Helper to delete a menu item from Supabase
async function deleteMenuItemFromSupabase(id: string) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) console.error("Supabase menu item deletion error:", error);
  } catch (e) {
    console.error("Supabase menu item deletion failed:", e);
  }
}

// Load and initialize data from Supabase
async function initializeSupabaseData() {
  const supabase = getSupabase();
  if (!supabase) {
    console.log("Supabase is not configured. Running in local memory fallback mode.");
    return;
  }
  
  console.log("Supabase configured! Loading and seeding data...");
  try {
    // 1. Load Settings
    const { data: settingsData, error: settingsErr } = await supabase
      .from('restaurant_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();
      
    if (settingsErr) {
      console.error("Error reading settings from Supabase:", settingsErr);
    } else if (settingsData) {
      restaurantSettings = {
        storeName: settingsData.store_name,
        promptPayNumber: settingsData.promptpay_number,
        promptPayName: settingsData.promptpay_name,
        lineChannelAccessToken: settingsData.line_channel_access_token,
        lineUserId: settingsData.line_user_id,
        phone: settingsData.phone,
        tagline: settingsData.tagline,
        openTime: settingsData.open_time,
        closeTime: settingsData.close_time,
        closedDays: Array.isArray(settingsData.closed_days) ? settingsData.closed_days : [],
        isClosedTemporarily: settingsData.is_closed_temporarily,
        isReservationEnabled: settingsData.is_reservation_enabled,
        isLoyaltyEnabled: settingsData.is_loyalty_enabled,
        lastLineError: settingsData.last_line_error,
        supabaseUrl: restaurantSettings.supabaseUrl,
        supabaseAnonKey: restaurantSettings.supabaseAnonKey
      };
      console.log("Settings loaded from Supabase.");
    } else {
      console.log("No settings found in Supabase. Seeding default settings...");
      await syncSettingsToSupabase();
    }

    // 2. Load Menu Items
    const { data: menuData, error: menuErr } = await supabase
      .from('menu_items')
      .select('*');
      
    if (menuErr) {
      console.error("Error loading menu from Supabase:", menuErr);
    } else if (menuData && menuData.length > 0) {
      menuItems = menuData.map(item => ({
        id: item.id,
        nameTh: item.name_th,
        nameEn: item.name_en,
        descriptionTh: item.description_th || "",
        descriptionEn: item.description_en || "",
        price: Number(item.price),
        category: item.category,
        image: item.image,
        isPopular: item.is_popular,
        prepTime: item.prep_time,
        ingredients: item.ingredients || [],
        inStock: item.in_stock,
        optionGroups: item.option_groups || []
      }));
      console.log(`Loaded ${menuItems.length} menu items from Supabase.`);
    } else {
      console.log("No menu items found in Supabase. Seeding default menu items...");
      for (const item of menuItems) {
        await syncMenuItemToSupabase(item);
      }
    }

    // 3. Load Orders
    const { data: ordersData, error: ordersErr } = await supabase
      .from('orders')
      .select('*');
      
    if (ordersErr) {
      console.error("Error loading orders from Supabase:", ordersErr);
    } else if (ordersData && ordersData.length > 0) {
      orders = ordersData.map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        customerName: order.customer_name,
        dineInType: order.dine_in_type,
        tableNumber: order.table_number,
        deliveryAddress: order.delivery_address,
        phone: order.phone,
        paymentMethod: order.payment_method,
        paymentSlip: order.payment_slip,
        items: order.items,
        totalAmount: Number(order.total_amount),
        status: order.status,
        timestamp: order.timestamp
      }));
      
      const maxOrderNum = ordersData.reduce((max, o) => {
        const num = Number(o.order_number);
        return isNaN(num) ? max : Math.max(max, num);
      }, 1003);
      orderCounter = maxOrderNum + 1;
      console.log(`Loaded ${orders.length} orders from Supabase. Next OrderCounter: ${orderCounter}`);
    } else {
      console.log("No orders found in Supabase. Seeding default orders...");
      for (const order of orders) {
        await syncOrderToSupabase(order);
      }
    }

    // 4. Load Reservations
    const { data: resData, error: resErr } = await supabase
      .from('reservations')
      .select('*');
      
    if (resErr) {
      console.error("Error loading reservations from Supabase:", resErr);
    } else if (resData && resData.length > 0) {
      reservations = resData.map(resv => ({
        id: resv.id,
        customerName: resv.customer_name,
        phone: resv.phone,
        date: resv.date,
        time: resv.time,
        partySize: Number(resv.party_size),
        tablePreference: resv.table_preference,
        specialRequest: resv.special_request,
        status: resv.status,
        timestamp: resv.timestamp
      }));
      console.log(`Loaded ${reservations.length} reservations from Supabase.`);
    } else {
      console.log("No reservations found in Supabase. Seeding default reservations...");
      for (const resv of reservations) {
        await syncReservationToSupabase(resv);
      }
    }

  } catch (e) {
    console.error("Exception in Supabase loading:", e);
  }
}

// Initialize Supabase data immediately on start
initializeSupabaseData().catch(e => console.error("Error initializing Supabase data on start:", e));

// --- END SUPABASE PERSISTENCE ---

// Lazy-loaded Gemini Client Helper
let aiClient: GoogleGenAI | null = null;
function getGeminiAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("GEMINI_API_KEY environment variable is not defined or is a placeholder. AI Sommelier will run in mock simulation mode.");
    return null;
  }
  
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// REST API Endpoints

// GET /api/menu
app.get("/api/menu", (req, res) => {
  res.json(menuItems);
});

// GET /api/categories
app.get("/api/categories", (req, res) => {
  res.json(categories);
});

// POST /api/categories
app.post("/api/categories", (req, res) => {
  const { nameTh, nameEn, emoji } = req.body;
  if (!nameTh || !nameEn) {
    return res.status(400).json({ error: "Required fields nameTh and nameEn are missing" });
  }
  
  const id = "cat_" + nameEn.toLowerCase().replace(/[^a-z0-9]/g, "_");
  
  // Prevent duplicate id
  if (categories.some(c => c.id === id)) {
    return res.status(400).json({ error: "Category already exists with this English name" });
  }

  const newCategory: Category = {
    id,
    nameTh,
    nameEn,
    emoji: emoji || "🍽️"
  };

  categories.push(newCategory);
  res.status(201).json(newCategory);
});

// DELETE /api/categories/:id
app.delete("/api/categories/:id", (req, res) => {
  const { id } = req.params;
  const index = categories.findIndex(c => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Category not found" });
  }

  // Delete category
  categories.splice(index, 1);

  // Reassign all items under this category to "other" category
  menuItems.forEach(item => {
    if (item.category === id) {
      item.category = "other";
    }
  });

  // Ensure "other" category exists in categories array if some item was moved to it
  const hasItemsInOther = menuItems.some(item => item.category === "other");
  if (hasItemsInOther && !categories.some(c => c.id === "other")) {
    categories.push({ id: "other", nameTh: "อื่นๆ", nameEn: "Other", emoji: "📦" });
  }

  res.json({ success: true, deletedId: id });
});

// POST /api/menu (Create Menu Item)
app.post("/api/menu", (req, res) => {
  const { nameTh, nameEn, descriptionTh, descriptionEn, price, category, image, prepTime, ingredients } = req.body;
  if (!nameTh || !nameEn || !price || !category) {
    return res.status(400).json({ error: "Required fields are missing" });
  }

  const newItem: MenuItem = {
    id: "M_CUSTOM_" + Math.random().toString(36).substr(2, 5).toUpperCase(),
    nameTh,
    nameEn,
    descriptionTh: descriptionTh || "",
    descriptionEn: descriptionEn || "",
    price: Number(price),
    category,
    image: image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
    isPopular: false,
    prepTime: Number(prepTime) || 10,
    ingredients: Array.isArray(ingredients) ? ingredients : [],
    inStock: true
  };

  menuItems.push(newItem);
  syncMenuItemToSupabase(newItem).catch(e => console.error(e));
  res.status(201).json(newItem);
});

// PUT /api/menu/:id (Update Menu Item)
app.put("/api/menu/:id", (req, res) => {
  const { id } = req.params;
  const index = menuItems.findIndex(item => item.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Menu item not found" });
  }

  menuItems[index] = {
    ...menuItems[index],
    ...req.body,
    id: menuItems[index].id // keep ID immutable
  };

  syncMenuItemToSupabase(menuItems[index]).catch(e => console.error(e));
  res.json(menuItems[index]);
});

// DELETE /api/menu/:id (Delete Menu Item)
app.delete("/api/menu/:id", (req, res) => {
  const { id } = req.params;
  const index = menuItems.findIndex(item => item.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Menu item not found" });
  }
  
  menuItems.splice(index, 1);
  deleteMenuItemFromSupabase(id).catch(e => console.error(e));
  res.json({ success: true, deletedId: id });
});

// POST /api/menu/:id/toggle-stock
app.post("/api/menu/:id/toggle-stock", (req, res) => {
  const { id } = req.params;
  const item = menuItems.find(item => item.id === id);
  if (!item) {
    return res.status(404).json({ error: "Menu item not found" });
  }
  item.inStock = !item.inStock;
  syncMenuItemToSupabase(item).catch(e => console.error(e));
  res.json({ id: item.id, inStock: item.inStock });
});

// LINE Notification Sender
async function sendLineNotification(order: Order) {
  const token = restaurantSettings.lineChannelAccessToken?.trim();
  if (!token) {
    console.log("LINE Notification: No Channel Access Token configured.");
    return;
  }

  const altText = `🔔 ออเดอร์ใหม่ #${order.id} จากคุณ ${order.customerName} ยอดรวม ${order.totalAmount} บาท`;
  
  const serviceType = order.dineInType === 'dine-in' 
    ? `ทานที่ร้าน (โต๊ะ #${order.tableNumber || '-'})` 
    : `สั่งกลับบ้าน/จัดส่ง (โทร: ${order.phone || '-'})`;

  // Construct a highly polished Flex Message layout
  const flexContents = {
    type: "bubble",
    styles: {
      header: {
        backgroundColor: "#1e1b4b"
      },
      body: {
        backgroundColor: "#0f172a"
      },
      footer: {
        backgroundColor: "#1e1b4b"
      }
    },
    header: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: restaurantSettings.storeName.toUpperCase(),
          weight: "bold",
          color: "#fb923c",
          size: "sm",
          letterSpacing: "0.15em"
        },
        {
          type: "text",
          text: "🔔 มีออเดอร์ใหม่เข้ามาแล้ว!",
          weight: "bold",
          color: "#ffffff",
          size: "xl"
        }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "หมายเลขออเดอร์",
                  color: "#94a3b8",
                  size: "xs",
                  flex: 2
                },
                {
                  type: "text",
                  text: order.id,
                  color: "#38bdf8",
                  size: "xs",
                  weight: "bold",
                  flex: 3
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "ลูกค้า",
                  color: "#94a3b8",
                  size: "xs",
                  flex: 2
                },
                {
                  type: "text",
                  text: order.customerName,
                  color: "#ffffff",
                  size: "xs",
                  weight: "bold",
                  flex: 3
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "รูปแบบบริการ",
                  color: "#94a3b8",
                  size: "xs",
                  flex: 2
                },
                {
                  type: "text",
                  text: serviceType,
                  color: "#ffffff",
                  size: "xs",
                  flex: 3,
                  wrap: true
                }
              ]
            },
            ...(order.deliveryAddress ? [{
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "ที่อยู่จัดส่ง",
                  color: "#94a3b8",
                  size: "xs",
                  flex: 2
                },
                {
                  type: "text",
                  text: order.deliveryAddress,
                  color: "#cbd5e1",
                  size: "xs",
                  flex: 3,
                  wrap: true
                }
              ]
            }] : []),
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "การชำระเงิน",
                  color: "#94a3b8",
                  size: "xs",
                  flex: 2
                },
                {
                  type: "text",
                  text: order.paymentMethod === 'promptpay' ? "โอนผ่านพร้อมเพย์" : "ชำระหน้าร้าน / เงินสด",
                  color: order.paymentMethod === 'promptpay' ? "#4ade80" : "#fb7185",
                  size: "xs",
                  weight: "bold",
                  flex: 3
                }
              ]
            }
          ]
        },
        {
          type: "separator",
          color: "#334155"
        },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "text",
              text: "รายการอาหาร:",
              weight: "bold",
              color: "#fb923c",
              size: "sm"
            },
            ...order.items.map(it => {
              const itemCustText = it.customizations && Object.keys(it.customizations).length > 0
                ? (() => {
                    const custParts: string[] = [];
                    if (it.customizations.serviceType) custParts.push(it.customizations.serviceType === 'dine-in' ? '🍽️ ทานที่ร้าน' : '🥡 กลับบ้าน');
                    if (it.customizations.sweetness) custParts.push(`หวาน ${it.customizations.sweetness}`);
                    if (it.customizations.spiciness) custParts.push(`เผ็ด ${it.customizations.spiciness}`);
                    if (it.customizations.temperature) custParts.push(it.customizations.temperature);
                    if (it.customizations.noodleType) custParts.push(`เส้น ${it.customizations.noodleType}`);
                    if (it.customizations.riceType) custParts.push(`ข้าว ${it.customizations.riceType}`);
                    if (it.customizations.notes) custParts.push(`โน้ต: ${it.customizations.notes}`);
                    return custParts.length > 0 ? ` (${custParts.join(', ')})` : "";
                  })()
                : "";

              return {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: `• ${it.nameTh}${itemCustText}`,
                    color: "#f8fafc",
                    size: "xs",
                    flex: 4,
                    wrap: true
                  },
                  {
                    type: "text",
                    text: `x${it.quantity}`,
                    color: "#cbd5e1",
                    size: "xs",
                    align: "right",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: `${it.price * it.quantity}฿`,
                    color: "#f8fafc",
                    size: "xs",
                    align: "right",
                    flex: 1.5
                  }
                ]
              };
            })
          ]
        },
        {
          type: "separator",
          color: "#334155"
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "ยอดรวมทั้งสิ้น",
              weight: "bold",
              color: "#ffffff",
              size: "sm",
              flex: 3
            },
            {
              type: "text",
              text: `${order.totalAmount.toLocaleString()} บาท`,
              weight: "bold",
              color: "#eab308",
              size: "sm",
              align: "right",
              flex: 3
            }
          ]
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#fb923c",
          height: "sm",
          action: {
            type: "uri",
            label: "เปิดระบบจัดการออเดอร์",
            uri: "https://ais-pre-dpbgtnjbao4uqwlj2qxcil-361727948318.asia-southeast1.run.app"
          }
        }
      ]
    }
  };

  const messagesPayload = [
    {
      type: "flex",
      altText: altText,
      contents: flexContents
    }
  ];

  const targetUserId = restaurantSettings.lineUserId?.trim();
  const endpoint = targetUserId 
    ? "https://api.line.me/v2/bot/message/push" 
    : "https://api.line.me/v2/bot/message/broadcast";

  const bodyPayload = targetUserId 
    ? { to: targetUserId, messages: messagesPayload }
    : { messages: messagesPayload };

  try {
    console.log(`Sending LINE Notification via ${endpoint}...`);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(bodyPayload)
    });

    const resData = await response.json();
    if (!response.ok) {
      console.error("LINE Notification Error:", resData);
      restaurantSettings.lastLineError = resData.message || JSON.stringify(resData);
    } else {
      console.log("LINE Notification sent successfully!");
      restaurantSettings.lastLineError = "";
    }
  } catch (error: any) {
    console.error("Failed to send LINE notification:", error);
    restaurantSettings.lastLineError = error?.message || String(error);
  }
}

// GET /api/orders
app.get("/api/orders", (req, res) => {
  res.json(orders);
});

// POST /api/orders (Create Order)
app.post("/api/orders", (req, res) => {
  const { customerName, dineInType, tableNumber, deliveryAddress, phone, items, paymentMethod, paymentSlip } = req.body;
  
  if (!customerName || !dineInType || !items || !items.length) {
    return res.status(400).json({ error: "Required order fields are missing" });
  }

  // Calculate real total
  let calculatedTotal = 0;
  const processedItems = items.map((cartItem: any) => {
    if (cartItem.menuItemId === "custom-written") {
      const price = typeof cartItem.price === "number" ? cartItem.price : 0;
      calculatedTotal += price * cartItem.quantity;
      return {
        menuItemId: "custom-written",
        nameEn: cartItem.nameEn || "Custom Requested Menu",
        nameTh: cartItem.nameTh || "เมนูสั่งทำพิเศษ",
        price: price,
        quantity: cartItem.quantity,
        customizations: cartItem.customizations
      };
    }
    const menuItem = menuItems.find(m => m.id === cartItem.menuItemId);
    let price = menuItem ? menuItem.price : 0;
    if (cartItem.customizations && cartItem.customizations.optionSelections) {
      Object.values(cartItem.customizations.optionSelections).forEach((choice: any) => {
        price += choice.price || 0;
      });
    }
    calculatedTotal += price * cartItem.quantity;
    return {
      menuItemId: cartItem.menuItemId,
      nameEn: menuItem ? menuItem.nameEn : "Unknown Item",
      nameTh: menuItem ? menuItem.nameTh : "เมนูไม่ระบุชื่อ",
      price: price,
      quantity: cartItem.quantity,
      customizations: cartItem.customizations
    };
  });

  const newOrder: Order = {
    id: "ORD-" + orderCounter,
    orderNumber: String(orderCounter),
    customerName,
    dineInType,
    tableNumber: dineInType === 'dine-in' ? tableNumber : undefined,
    deliveryAddress: dineInType === 'delivery' ? deliveryAddress : undefined,
    phone: dineInType === 'delivery' ? phone : undefined,
    paymentMethod: paymentMethod || 'cash',
    paymentSlip: paymentMethod === 'promptpay' ? paymentSlip : undefined,
    items: processedItems,
    totalAmount: calculatedTotal,
    status: "pending",
    timestamp: new Date().toISOString()
  };

  orders.unshift(newOrder); // Add to beginning of array so it appears at top
  orderCounter++;

  // Sync to Supabase
  syncOrderToSupabase(newOrder).catch(e => console.error(e));

  // Send LINE notification in background without blocking response
  sendLineNotification(newOrder).catch((err) => {
    console.error("Error sending LINE notification asynchronously:", err);
  });

  res.status(201).json(newOrder);
});

// DELETE /api/orders/:id (Delete Order)
app.delete("/api/orders/:id", (req, res) => {
  const { id } = req.params;
  const index = orders.findIndex(o => o.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Order not found" });
  }
  orders.splice(index, 1);
  deleteOrderFromSupabase(id).catch(e => console.error(e));
  res.json({ success: true, deletedId: id });
});

// POST /api/orders/:id/update-item-price (Update Price of Item inside Order)
app.post("/api/orders/:id/update-item-price", (req, res) => {
  const { id } = req.params;
  const { itemIndex, price } = req.body;

  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  if (itemIndex < 0 || itemIndex >= order.items.length) {
    return res.status(400).json({ error: "Invalid item index" });
  }

  order.items[itemIndex].price = Number(price);

  // Recalculate totalAmount
  order.totalAmount = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  syncOrderToSupabase(order).catch(e => console.error(e));
  res.json(order);
});

// PUT /api/orders/:id/items (Edit/Update items of an existing order)
app.put("/api/orders/:id/items", (req, res) => {
  const { id } = req.params;
  const { items } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: "Items are required" });
  }

  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  // Check if order is in editable status (pending or preparing)
  if (order.status !== 'pending' && order.status !== 'preparing') {
    return res.status(400).json({ error: "Cannot edit order as it is already being cooked, is ready, or completed." });
  }

  // Calculate real total
  let calculatedTotal = 0;
  const processedItems = items.map((cartItem: any) => {
    if (cartItem.menuItemId === "custom-written") {
      const price = typeof cartItem.price === "number" ? cartItem.price : 0;
      calculatedTotal += price * cartItem.quantity;
      return {
        menuItemId: "custom-written",
        nameEn: cartItem.nameEn || "Custom Requested Menu",
        nameTh: cartItem.nameTh || "เมนูสั่งทำพิเศษ",
        price: price,
        quantity: cartItem.quantity,
        customizations: cartItem.customizations
      };
    }
    const menuItem = menuItems.find(m => m.id === cartItem.menuItemId);
    let price = menuItem ? menuItem.price : 0;
    if (cartItem.customizations && cartItem.customizations.optionSelections) {
      Object.values(cartItem.customizations.optionSelections).forEach((choice: any) => {
        price += choice.price || 0;
      });
    }
    calculatedTotal += price * cartItem.quantity;
    return {
      menuItemId: cartItem.menuItemId,
      nameEn: menuItem ? menuItem.nameEn : "Unknown Item",
      nameTh: menuItem ? menuItem.nameTh : "เมนูไม่ระบุชื่อ",
      price: price,
      quantity: cartItem.quantity,
      customizations: cartItem.customizations
    };
  });

  order.items = processedItems;
  order.totalAmount = calculatedTotal;

  syncOrderToSupabase(order).catch(e => console.error(e));
  res.json(order);
});

// POST /api/orders/:id/status (Update Status)
app.post("/api/orders/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!status) {
    return res.status(400).json({ error: "Status field is required" });
  }

  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  order.status = status;
  syncOrderToSupabase(order).catch(e => console.error(e));
  res.json(order);
});

// GET /api/analytics
app.get("/api/analytics", (req, res) => {
  const totalRevenue = orders
    .filter(o => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const completedCount = orders.filter(o => o.status === "completed").length;
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const preparingCount = orders.filter(o => o.status === "preparing" || o.status === "cooking").length;
  const cancelledCount = orders.filter(o => o.status === "cancelled").length;

  // Category Breakdown
  const categorySales: Record<string, number> = {};
  categories.forEach(c => {
    categorySales[c.id] = 0;
  });
  orders.filter(o => o.status !== "cancelled").forEach(order => {
    order.items.forEach(item => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId);
      if (menuItem) {
        if (categorySales[menuItem.category] === undefined) {
          categorySales[menuItem.category] = 0;
        }
        categorySales[menuItem.category] += item.price * item.quantity;
      }
    });
  });

  // Hot Items
  const itemQuantities: Record<string, { name: string, qty: number, revenue: number }> = {};
  orders.filter(o => o.status !== "cancelled").forEach(order => {
    order.items.forEach(item => {
      if (!itemQuantities[item.menuItemId]) {
        itemQuantities[item.menuItemId] = {
          name: item.nameEn,
          qty: 0,
          revenue: 0
        };
      }
      itemQuantities[item.menuItemId].qty += item.quantity;
      itemQuantities[item.menuItemId].revenue += item.price * item.quantity;
    });
  });

  const popularItems = Object.entries(itemQuantities)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  res.json({
    totalRevenue,
    totalOrders: orders.length,
    completedCount,
    pendingCount,
    preparingCount,
    cancelledCount,
    categorySales,
    popularItems
  });
});

// GET /api/settings
app.get("/api/settings", (req, res) => {
  res.json(restaurantSettings);
});

// POST /api/settings
app.post("/api/settings", (req, res) => {
  const { 
    storeName, 
    promptPayNumber, 
    promptPayName, 
    lineChannelAccessToken, 
    lineUserId, 
    phone, 
    tagline,
    openTime,
    closeTime,
    closedDays,
    isClosedTemporarily,
    isReservationEnabled,
    isLoyaltyEnabled,
    supabaseUrl,
    supabaseAnonKey
  } = req.body;
  if (!storeName || !promptPayNumber || !promptPayName) {
    return res.status(400).json({ error: "Missing required settings fields" });
  }
  const tokenChanged = lineChannelAccessToken !== restaurantSettings.lineChannelAccessToken;
  const oldUrl = restaurantSettings.supabaseUrl;
  const oldKey = restaurantSettings.supabaseAnonKey;

  restaurantSettings = { 
    storeName, 
    promptPayNumber, 
    promptPayName,
    lineChannelAccessToken: lineChannelAccessToken || "",
    lineUserId: lineUserId || "",
    phone: phone || "",
    tagline: tagline || "",
    openTime: openTime || "09:00",
    closeTime: closeTime || "21:00",
    closedDays: Array.isArray(closedDays) ? closedDays : [],
    isClosedTemporarily: isClosedTemporarily === true,
    isReservationEnabled: isReservationEnabled !== false,
    isLoyaltyEnabled: isLoyaltyEnabled !== false,
    lastLineError: tokenChanged ? "" : (restaurantSettings.lastLineError || ""),
    supabaseUrl: supabaseUrl || "",
    supabaseAnonKey: supabaseAnonKey || ""
  };

  // Sync to Supabase
  syncSettingsToSupabase().catch(e => console.error(e));

  // If credentials changed, trigger reload
  if (supabaseUrl !== oldUrl || supabaseAnonKey !== oldKey) {
    console.log("Supabase credentials changed, re-initializing data...");
    setTimeout(() => {
      initializeSupabaseData().catch(e => console.error("Error re-initializing Supabase data:", e));
    }, 100);
  }

  res.json(restaurantSettings);
});

// GET /api/reservations - Get all reservations
app.get("/api/reservations", (req, res) => {
  res.json(reservations);
});

// POST /api/reservations - Create a reservation
app.post("/api/reservations", (req, res) => {
  const { customerName, phone, date, time, partySize, tablePreference, specialRequest } = req.body;
  if (!customerName || !phone || !date || !time || !partySize) {
    return res.status(400).json({ error: "Missing required reservation fields" });
  }

  const newRes: Reservation = {
    id: `RES-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName,
    phone,
    date,
    time,
    partySize: Number(partySize),
    tablePreference: tablePreference || "",
    specialRequest: specialRequest || "",
    status: "pending",
    timestamp: new Date().toISOString()
  };

  reservations.unshift(newRes);
  syncReservationToSupabase(newRes).catch(e => console.error(e));
  res.status(201).json(newRes);
});

// POST /api/reservations/:id/status - Update reservation status
app.post("/api/reservations/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !['pending', 'confirmed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  const reservation = reservations.find(r => r.id === id);
  if (!reservation) {
    return res.status(404).json({ error: "Reservation not found" });
  }

  reservation.status = status;
  syncReservationToSupabase(reservation).catch(e => console.error(e));
  res.json(reservation);
});

// DELETE /api/reservations/:id - Delete a reservation permanently
app.delete("/api/reservations/:id", (req, res) => {
  const { id } = req.params;
  const index = reservations.findIndex(r => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Reservation not found" });
  }
  reservations.splice(index, 1);
  deleteReservationFromSupabase(id).catch(e => console.error(e));
  res.json({ success: true, id });
});

// POST /api/ai/recommend - Gemini Culinary Sommelier
app.post("/api/ai/recommend", async (req, res) => {
  const { prompt, currentCart } = req.body;
  
  if (!prompt && (!currentCart || !currentCart.length)) {
    return res.status(400).json({ error: "Provide a query or selected cart items for suggestions." });
  }

  const ai = getGeminiAI();

  // If Gemini is not set up, provide an elegant mock sommelier response matching user request.
  if (!ai) {
    const mockResponses = [
      `🍇 **Sommelier Suggestion (Simulation)**:
To pair beautifully with your **Australian Wagyu Ribeye Steak**, I highly recommend pairing it with a classic, full-bodied Red Wine reduction or our **Yuzu Rose Sparkling** to cut through the rich marbling of the meat. 

For side options, the **Truffle French Fries** provide a wonderfully earthy flavor match. For dessert, cap off your meal with the **Warm Dark Chocolate Lava Cake** to complement the roasted notes of your steak!`,
      `🌿 **Dietary Pairing (Simulation)**:
Looking for a balanced, vegetarian-friendly feast? Combine our **Burrata Caprese Salad** as a refreshing, creamy appetizer, followed by the **Truffle Wild Mushroom Risotto** as a decadent, earthy main course. 

To wash it down, the sparkling notes of our **Honey Lemon Butterfly Pea Refresher** will introduce a lovely honeyed citrus touch that balances the savory richness.`,
      `🍨 **Sweet Finish & Coffee Pairings (Simulation)**:
To complement the traditional, aromatic sweetness of the **Signature Mango Sticky Rice**, try enjoying it alongside our ceremonial **Ceremonial Uji Matcha Latte**. 

The natural, roasted umami notes and light bitterness of the Japanese matcha clean the palate beautifully after the sweet, rich coconut cream of the sticky rice!`
    ];
    
    // Choose based on keywords or random
    let chosenText = mockResponses[0];
    if (prompt && (prompt.toLowerCase().includes("vegan") || prompt.includes("ผัก") || prompt.includes("เจ") || prompt.toLowerCase().includes("salad") || prompt.toLowerCase().includes("risotto"))) {
      chosenText = mockResponses[1];
    } else if (prompt && (prompt.toLowerCase().includes("mango") || prompt.includes("หวาน") || prompt.toLowerCase().includes("matcha") || prompt.toLowerCase().includes("tea"))) {
      chosenText = mockResponses[2];
    }
    
    // Add brief artificial delay to simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    return res.json({ responseText: chosenText, isMock: true });
  }

  try {
    const formattedMenu = menuItems.map(m => `${m.nameEn} (${m.nameTh}) - ${m.price} THB: ${m.descriptionEn}`).join("\n");
    const cartText = currentCart && currentCart.length 
      ? `Customer's current cart includes: ${currentCart.map((c: any) => `${c.name} (x${c.quantity})`).join(", ")}` 
      : "Customer has no items in cart yet.";

    const systemInstruction = `You are a world-class culinary sommelier and professional chef at a luxurious dining restaurant. 
You are advising a customer on wine/beverage pairings, meal recommendations, or answers to culinary questions based solely on the restaurant's menu:
${formattedMenu}

Keep your responses structured, incredibly elegant, and professional. Recommend specific drink pairings, appetizers, or desserts from our menu that complement the customer's request. Express enthusiasm for fine dining. Give responses in Thai language (since the customer is in Thailand), but mention English menu names in bold as well.`;

    const userPrompt = `Customer Query: "${prompt || "Suggest me a great combinations of appetizers, mains, and drinks."}"\n${cartText}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7
      }
    });

    res.json({ responseText: response.text || "I apologize, but I could not formulate a pairing suggestion right now. Please try again.", isMock: false });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Failed to generate AI culinary recommendation.", details: error.message });
  }
});

// Dictionary and helper for local Thai to English translation when Gemini is running in Mock
const thaiToEnglishDict: Record<string, string> = {
  "แกงเขียวหวาน": "Green Curry",
  "แกงเขียวหวานไก่": "Chicken Green Curry",
  "แกงเขียวหวานเนื้อ": "Beef Green Curry",
  "กะเพรา": "Stir-fried Basil",
  "ผัดกะเพรา": "Stir-fried Holy Basil",
  "กะเพราหมูสับ": "Stir-fried Minced Pork with Holy Basil",
  "กะเพราเนื้อ": "Stir-fried Beef with Holy Basil",
  "ข้าวผัด": "Fried Rice",
  "ข้าวผัดปู": "Crab Fried Rice",
  "ข้าวผัดกุ้ง": "Shrimp Fried Rice",
  "ส้มตำ": "Papaya Salad (Som Tum)",
  "ต้มยำกุ้ง": "Tom Yum Goong (Spicy Shrimp Soup)",
  "ต้มยำ": "Tom Yum Soup",
  "ผัดไทย": "Pad Thai",
  "ชาเขียว": "Green Tea",
  "ชาไทย": "Thai Tea",
  "ชามะนาว": "Lemon Tea",
  "กาแฟ": "Coffee",
  "ข้าวเหนียวมะม่วง": "Mango Sticky Rice",
  "บัวลอย": "Bua Loy (Rice Balls in Coconut Milk)",
  "ต้มข่าไก่": "Tom Kha Gai (Chicken Coconut Soup)",
  "แกงเผ็ดเป็ดย่าง": "Red Curry with Roasted Duck",
  "มัสมั่น": "Massaman Curry",
  "แกงส้ม": "Sour Curry",
  "หมูกรอบ": "Crispy Pork Belly",
  "คอหมูย่าง": "Grilled Pork Neck",
  "น้ำตกเนื้อ": "Spicy Beef Salad",
  "ลาบหมู": "Spicy Minced Pork Salad",
  "ไข่ดาว": "Fried Egg",
  "ไข่เจียว": "Thai Omelette"
};

function localTranslate(text: string): string {
  const normalized = text.trim();
  if (thaiToEnglishDict[normalized]) {
    return thaiToEnglishDict[normalized];
  }
  
  const terms = [
    { th: "แกงเขียวหวาน", en: "Green Curry" },
    { th: "ผัดกะเพรา", en: "Stir-fried Holy Basil" },
    { th: "กะเพรา", en: "Holy Basil" },
    { th: "ข้าวผัด", en: "Fried Rice" },
    { th: "ต้มยำกุ้ง", en: "Tom Yum Goong" },
    { th: "ต้มยำ", en: "Tom Yum" },
    { th: "ผัดไทย", en: "Pad Thai" },
    { th: "ส้มตำ", en: "Papaya Salad" },
    { th: "ชาเขียว", en: "Green Tea" },
    { th: "ชาไทย", en: "Thai Tea" },
    { th: "ต้มข่า", en: "Tom Kha" },
    { th: "มัสมั่น", en: "Massaman" },
    { th: "หมูกรอบ", en: "Crispy Pork" },
    { th: "ไก่", en: "Chicken" },
    { th: "เนื้อ", en: "Beef" },
    { th: "หมู", en: "Pork" },
    { th: "กุ้ง", en: "Shrimp" },
    { th: "ทะเล", en: "Seafood" },
    { th: "ไข่ดาว", en: "Fried Egg" },
    { th: "ไข่เจียว", en: "Omelette" }
  ];

  let parts: string[] = [];
  let remaining = normalized;
  
  for (const term of terms) {
    if (remaining.includes(term.th)) {
      parts.push(term.en);
      remaining = remaining.replace(term.th, "").trim();
    }
  }
  
  if (parts.length > 0) {
    return parts.reverse().join(" ");
  }

  return `${text} (Translated)`;
}

// POST /api/ai/translate - Translate Thai Food names/descriptions to English
app.post("/api/ai/translate", async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "No text provided for translation." });
  }

  const ai = getGeminiAI();
  if (!ai) {
    // Return mock translation
    const translatedText = localTranslate(text);
    return res.json({ translatedText, isMock: true });
  }

  try {
    const systemInstruction = `You are an expert translator specializing in translating Thai food names, culinary terms, and restaurant menu descriptions into English.
Translate the provided Thai text accurately and naturally into English.
- If it is a food/dish name, translate it into standard English culinary terms (e.g. "แกงเขียวหวานเนื้อ" -> "Beef Green Curry").
- Provide ONLY the direct English translation as the output, with no explanation, intro, quote marks, or additional text.
- Maintain correct capitalization.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: text,
      config: {
        systemInstruction,
        temperature: 0.1
      }
    });

    const translatedText = response.text ? response.text.trim().replace(/^["']|["']$/g, '') : "";
    res.json({ translatedText: translatedText || localTranslate(text), isMock: false });
  } catch (error: any) {
    console.error("Gemini Translation API Error:", error);
    // fallback
    res.json({ translatedText: localTranslate(text), isMock: true, error: error.message });
  }
});

// Vite & Static file hosting setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export { app };
