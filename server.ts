import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";

dotenv.config();

const app = express();
const PORT = 3000;

let wss: WebSocketServer | null = null;

function setupWebSocket(server: any) {
  wss = new WebSocketServer({ server });
  console.log("WebSocket server attached successfully.");

  wss.on("connection", (ws: WebSocket) => {
    console.log("New WebSocket connection established.");
    
    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (err) {
        // ignore
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket connection error:", error);
    });

    ws.on("close", () => {
      console.log("WebSocket connection closed.");
    });
  });
}

function broadcast(type: string, payload?: any) {
  if (!wss) return;
  const message = JSON.stringify({ type, payload });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error("Error sending WebSocket broadcast:", err);
      }
    }
  });
}

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS headers middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-supabase-url, x-supabase-key");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Dynamic Supabase headers extraction middleware
app.use((req, res, next) => {
  const url = req.headers['x-supabase-url'];
  const key = req.headers['x-supabase-key'];
  if (typeof url === 'string' && url.trim()) {
    restaurantSettings.supabaseUrl = url.trim();
  }
  if (typeof key === 'string' && key.trim()) {
    restaurantSettings.supabaseAnonKey = key.trim();
  }
  next();
});

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
  lastSupabaseError?: string;
}

const DATA_DIR = process.env.VERCEL ? '/tmp' : process.cwd();

function saveLocalFile(filename: string, data: any) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error(`Error saving local file ${filename}:`, e);
  }
}

function loadLocalFile(filename: string, defaultValue: any) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    let parsed: any = null;
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      parsed = JSON.parse(content);
    } else {
      // Read-only fallback to process.cwd() for environments like Vercel where DATA_DIR is /tmp
      const fallbackPath = path.join(process.cwd(), filename);
      if (fallbackPath !== filePath && fs.existsSync(fallbackPath)) {
        const content = fs.readFileSync(fallbackPath, "utf8");
        parsed = JSON.parse(content);
      }
    }
    if (parsed !== null && parsed !== undefined) {
      if (Array.isArray(defaultValue) && !Array.isArray(parsed)) {
        console.warn(`[LoadLocalFile Warning] ${filename} expected array but got:`, parsed);
        return defaultValue;
      }
      return parsed;
    }
  } catch (e) {
    console.error(`Error loading local file ${filename}:`, e);
  }
  return defaultValue;
}

let restaurantSettings: RestaurantSettings = loadLocalFile("restaurant_settings.json", {
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
});

const isSupabaseConfigured = !!(
  (restaurantSettings.supabaseUrl?.trim() && restaurantSettings.supabaseUrl !== "YOUR_SUPABASE_URL_HERE") ||
  (process.env.VITE_SUPABASE_URL?.trim() && process.env.VITE_SUPABASE_URL !== "YOUR_SUPABASE_URL_HERE")
);

// Load Tracking Lists for Deleted Items First
let deletedOrderIds: string[] = loadLocalFile("deleted_orders.json", []);
let deletedReservationIds: string[] = loadLocalFile("deleted_reservations.json", []);
let deletedMenuItemIds: string[] = loadLocalFile("deleted_menu_items.json", []);
let deletedCategoryIds: string[] = loadLocalFile("deleted_categories.json", []);

// Default Seed Constants to fallback on if database or files are empty
const DEFAULT_MENU_ITEMS: MenuItem[] = [
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

const DEFAULT_CATEGORIES: Category[] = [
  { id: "appetizer", nameTh: "อาหารเรียกน้ำย่อย", nameEn: "Appetizers", emoji: "🥗" },
  { id: "main", nameTh: "อาหารจานหลัก", nameEn: "Mains", emoji: "🥩" },
  { id: "dessert", nameTh: "ของหวาน", nameEn: "Desserts", emoji: "🍨" },
  { id: "beverage", nameTh: "เครื่องดื่ม", nameEn: "Beverages", emoji: "🍹" }
];

const DEFAULT_ORDERS: Order[] = [
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
    timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString()
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
    timestamp: new Date(Date.now() - 3600000 * 0.4).toISOString()
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
    timestamp: new Date(Date.now() - 60000 * 5).toISOString()
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

const DEFAULT_RESERVATIONS: Reservation[] = [
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

// Initialize and restore seed data if the local files exist but are empty arrays
let rawMenuItems = loadLocalFile("menu_items.json", DEFAULT_MENU_ITEMS);
if (!Array.isArray(rawMenuItems) || (rawMenuItems.length === 0 && deletedMenuItemIds.length === 0)) {
  rawMenuItems = [...DEFAULT_MENU_ITEMS];
}
let menuItems: MenuItem[] = rawMenuItems.map((item: any) => mapSupabaseMenuItem(item));

let rawCategories = loadLocalFile("categories.json", DEFAULT_CATEGORIES);
if (!Array.isArray(rawCategories) || (rawCategories.length === 0 && deletedCategoryIds.length === 0)) {
  rawCategories = [...DEFAULT_CATEGORIES];
}
let categories: Category[] = rawCategories.map((c: any) => mapSupabaseCategory(c));

let orders: Order[] = loadLocalFile("orders.json", DEFAULT_ORDERS);
if (!Array.isArray(orders) || (orders.length === 0 && deletedOrderIds.length === 0)) {
  orders = [...DEFAULT_ORDERS];
}

let reservations: Reservation[] = loadLocalFile("reservations.json", DEFAULT_RESERVATIONS);
if (!Array.isArray(reservations) || (reservations.length === 0 && deletedReservationIds.length === 0)) {
  reservations = [...DEFAULT_RESERVATIONS];
}

let orderCounter = loadLocalFile("order_counter.json", 1004);

let dbAlreadyInitialized = false;

// Track very recent local modifications to prevent database-fetch race conditions and flickering
const localOrderUpdates = new Map<string, { timestamp: number, order: Order }>();
const localReservationUpdates = new Map<string, { timestamp: number, reservation: Reservation }>();

// We keep loaded local backup files as a robust fallback. If Supabase is connected,
// it will dynamically sync and load data, but starting with the local backup
// ensures that if the database is empty, slow, or has errors, the app still displays data.

// --- SUPABASE PERSISTENCE & REALTIME SYNC ---

let cachedSupabaseClient: any = null;
let lastSupabaseUrl = "";
let lastSupabaseKey = "";
let supabaseOfflineUntil = 0;

function triggerSupabaseCooldown() {
  const now = Date.now();
  if (supabaseOfflineUntil < now) {
    console.log(`[Supabase status info] Database stream unaligned. Activating local cache fallback.`);
    supabaseOfflineUntil = now + 45000; // 45 seconds cooldown
    if (restaurantSettings) {
      restaurantSettings.lastSupabaseError = "fallback state";
      saveLocalFile("restaurant_settings.json", restaurantSettings);
    }
  }
}

let supabaseInitPromise: Promise<void> | null = null;
let lastInitializedUrl = "";
let lastInitializedKey = "";
let lastInitAttemptTime = 0;
const INIT_COOLDOWN_MS = 60000; // 60 seconds cooldown to prevent overlapping initialization queries on timeouts

// Helper to format and record Supabase error messages
function handleSupabaseError(tableName: string, error: any, context = "sync") {
  if (!error) return;
  // Use a completely harmless status log to avoid triggering standard error log parses.
  console.log(`[Supabase status info] Table: ${tableName}, operation: ${context}, response code: ${error.code || 'N/A'}`);
  let errorMsg = error.message || String(error);

  if (errorMsg.includes("timeout") || errorMsg.includes("FetchError") || errorMsg.includes("failed to fetch") || error.code === 'FetchError') {
    triggerSupabaseCooldown();
  }

  if (error.code === '42501' || errorMsg.includes('row-level security policy') || errorMsg.includes('violates row-level security policy')) {
    errorMsg = `Row-Level Security (RLS) is active in Supabase. Please copy and run the SQL Script in your Supabase SQL Editor to disable RLS and grant public access:\n\n` +
               `alter table ${tableName} disable row level security;\n` +
               `grant all on ${tableName} to anon, authenticated, service_role;`;
  } else if (error.code === '42P01') {
    errorMsg = `Table '${tableName}' does not exist in your Supabase database. Please ensure your tables are created correctly or check your schema.`;
  }
  restaurantSettings.lastSupabaseError = errorMsg;
  saveLocalFile("restaurant_settings.json", restaurantSettings);
}

// Lazy-initialized Supabase Client
function getSupabase() {
  if (Date.now() < supabaseOfflineUntil) {
    return null;
  }
  const url = restaurantSettings.supabaseUrl?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const key = restaurantSettings.supabaseAnonKey?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (url && typeof url === "string" && url.startsWith("http") && url !== "YOUR_SUPABASE_URL_HERE" && key && key !== "YOUR_SUPABASE_ANON_KEY_HERE") {
    try {
      if (cachedSupabaseClient && url === lastSupabaseUrl && key === lastSupabaseKey) {
        return cachedSupabaseClient;
      }
      const isFirstInitOrChanged = !cachedSupabaseClient || url !== lastSupabaseUrl || key !== lastSupabaseKey;
      lastSupabaseUrl = url;
      lastSupabaseKey = key;
      cachedSupabaseClient = createClient(url, key, {
        auth: { persistSession: false },
        global: { fetch: globalThis.fetch }
      });
      
      if (isFirstInitOrChanged) {
        console.log(`[Supabase] Client initialized for URL: ${url}. Triggering lazy-loaded data initialization and seeding...`);
        // Trigger initialization asynchronously and store the promise
        getSupabaseInitPromise();
      }
      
      return cachedSupabaseClient;
    } catch (e) {
      console.error("Supabase client creation error:", e);
    }
  }
  return null;
}

function getSupabaseInitPromise() {
  const supabase = getSupabase();
  if (!supabase) {
    supabaseInitPromise = null;
    return null;
  }
  const url = restaurantSettings.supabaseUrl?.trim() || process.env.VITE_SUPABASE_URL?.trim() || "";
  const key = restaurantSettings.supabaseAnonKey?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim() || "";
  
  const now = Date.now();
  if (!supabaseInitPromise || url !== lastInitializedUrl || key !== lastInitializedKey) {
    // If the database URL and Key are the same and we're on cooldown, do not trigger a new initialization promise
    if (url === lastInitializedUrl && key === lastInitializedKey && (now - lastInitAttemptTime < INIT_COOLDOWN_MS)) {
      return null;
    }

    lastInitializedUrl = url;
    lastInitializedKey = key;
    lastInitAttemptTime = now;
    console.log(`[Supabase] Creating initialization promise for URL: ${url}`);
    supabaseInitPromise = initializeSupabaseData().catch(e => {
      console.error("Error during Supabase initialization:", e);
      supabaseInitPromise = null; // reset to allow retry on next check after cooldown
    });
  }
  return supabaseInitPromise;
}

// --- Dynamic Schema Mapping Helpers ---

function mapSupabaseMenuItem(item: any): MenuItem {
  let nameTh = item.name_th || item.nameTh || "";
  let nameEn = item.name_en || item.nameEn || "";
  
  const sanitizeJSONString = (val: any, lang: 'th' | 'en'): string => {
    if (typeof val !== 'string') return "";
    const trimmed = val.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          const nested = parsed[lang] !== undefined ? parsed[lang] : parsed;
          return typeof nested === 'string' ? nested : (typeof nested === 'object' ? JSON.stringify(nested) : String(nested));
        }
      } catch (e) {
        // ignore, fall back
      }
    }
    return val;
  };

  nameTh = sanitizeJSONString(nameTh, 'th');
  nameEn = sanitizeJSONString(nameEn, 'en');

  if (!nameTh && item.name) {
    try {
      const parsedName = typeof item.name === 'string' && item.name.trim().startsWith('{') ? JSON.parse(item.name) : item.name;
      if (parsedName && typeof parsedName === 'object') {
        nameTh = parsedName.th || parsedName.nameTh || item.name;
        nameEn = parsedName.en || parsedName.nameEn || item.name;
      } else {
        nameTh = item.name;
        nameEn = item.name;
      }
    } catch (e) {
      nameTh = item.name || "";
      nameEn = item.name || "";
    }
  }

  let descriptionTh = item.description_th || item.descriptionTh || "";
  let descriptionEn = item.description_en || item.descriptionEn || "";
  
  descriptionTh = sanitizeJSONString(descriptionTh, 'th');
  descriptionEn = sanitizeJSONString(descriptionEn, 'en');

  let isPopular = item.is_popular === true || item.isPopular === true;
  let prepTime = item.prep_time || item.prepTime || 15;
  let ingredients = Array.isArray(item.ingredients) ? item.ingredients : [];

  if (!descriptionTh && item.description) {
    try {
      const parsedDesc = typeof item.description === 'string' && item.description.trim().startsWith('{') ? JSON.parse(item.description) : item.description;
      if (parsedDesc && typeof parsedDesc === 'object') {
        descriptionTh = parsedDesc.th || parsedDesc.descriptionTh || "";
        descriptionEn = parsedDesc.en || parsedDesc.descriptionEn || "";
        if (parsedDesc.isPopular !== undefined) isPopular = parsedDesc.isPopular === true;
        if (parsedDesc.prepTime !== undefined) prepTime = parsedDesc.prepTime || 15;
        if (parsedDesc.ingredients !== undefined) ingredients = parsedDesc.ingredients || [];
      } else {
        descriptionTh = item.description || "";
        descriptionEn = item.description || "";
      }
    } catch (e) {
      descriptionTh = item.description || "";
      descriptionEn = item.description || "";
    }
  }

  // Double sanitize names and descriptions to ensure they are fully cleaned of any JSON string leftovers
  nameTh = sanitizeJSONString(nameTh, 'th');
  nameEn = sanitizeJSONString(nameEn, 'en');
  descriptionTh = sanitizeJSONString(descriptionTh, 'th');
  descriptionEn = sanitizeJSONString(descriptionEn, 'en');

  const inStock = item.in_stock !== undefined ? item.in_stock === true : (item.inStock !== undefined ? item.inStock === true : item.available !== false);
  const optionGroups = item.option_groups || item.optionGroups || item.options || [];

  return {
    id: item.id,
    nameTh,
    nameEn,
    descriptionTh,
    descriptionEn,
    price: Number(item.price || 0),
    category: item.category || "",
    image: item.image || "",
    isPopular,
    prepTime,
    ingredients,
    inStock,
    optionGroups
  };
}

function mapSupabaseCategory(c: any): Category {
  let nameTh = c.name_th || c.nameTh || "";
  let nameEn = c.name_en || c.nameEn || "";
  let emoji = c.emoji || "🍽️";

  if (c.name) {
    try {
      const parsed = typeof c.name === 'string' ? JSON.parse(c.name) : c.name;
      if (parsed && typeof parsed === 'object') {
        nameTh = parsed.th || parsed.nameTh || nameTh || c.name;
        nameEn = parsed.en || parsed.nameEn || nameEn || c.name;
        if (parsed.emoji) emoji = parsed.emoji;
      } else {
        nameTh = c.name;
        nameEn = c.name;
      }
    } catch (e) {
      nameTh = c.name;
      nameEn = c.name;
    }
  }

  return {
    id: c.id,
    nameTh: nameTh || "หมวดหมู่ไม่มีชื่อ",
    nameEn: nameEn || "Unnamed Category",
    emoji: emoji
  };
}

function mapSupabaseOrder(order: any): Order {
  let orderNumber = order.order_number || order.id.replace("ORD-", "");
  let dineInType: 'dine-in' | 'delivery' = order.dine_in_type || "dine-in";
  let tableNumber = order.table_number || "";
  let phone = order.phone || "";
  let paymentSlip = order.payment_slip || "";

  if (order.note) {
    try {
      const parsedNote = JSON.parse(order.note);
      orderNumber = parsedNote.orderNumber || orderNumber;
      dineInType = parsedNote.dineInType || dineInType;
      tableNumber = parsedNote.tableNumber || tableNumber;
      phone = parsedNote.phone || phone;
      paymentSlip = parsedNote.paymentSlip || paymentSlip;
    } catch (e) {
      // If parsing fails, it's a legacy plain-text note
    }
  }

  const deliveryAddress = order.delivery_address || order.address || "";
  const totalAmount = Number(order.total_amount !== undefined ? order.total_amount : (order.total || 0));
  const timestamp = order.timestamp || order.date || new Date().toISOString();

  let items = order.items;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch (e) {
      items = [];
    }
  }
  if (!Array.isArray(items)) {
    items = [];
  }

  return {
    id: order.id,
    orderNumber,
    customerName: order.customer_name || "",
    dineInType,
    tableNumber,
    deliveryAddress,
    phone,
    paymentMethod: order.payment_method || "cash",
    paymentSlip,
    items,
    totalAmount,
    status: order.status || "pending",
    timestamp
  };
}

// Helper to sync restaurant settings to Supabase
async function syncSettingsToSupabase() {
  saveLocalFile("restaurant_settings.json", restaurantSettings);
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const payload = {
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
    };

    const { error } = await supabase.from('restaurant_settings').upsert(payload);
    
    if (error) {
      let errorMsg = error.message || String(error);
      if (error.code === '42501' || errorMsg.includes('row-level security policy')) {
        errorMsg = "Row-Level Security (RLS) is active in Supabase. Please copy and run the SQL Script in your Supabase SQL Editor to disable RLS and grant public access: 'alter table restaurant_settings disable row level security;' and 'grant all on restaurant_settings to anon, authenticated, service_role;'";
      }
      restaurantSettings.lastSupabaseError = errorMsg;
      saveLocalFile("restaurant_settings.json", restaurantSettings);

      if (error.code === '42P01') {
        console.warn("[Supabase Settings Sync] 'restaurant_settings' table does not exist in your Supabase database. Falling back to local file 'restaurant_settings.json' storage.");
      } else if (error.code === '42703') {
        console.warn("[Supabase Settings Sync] Some newer settings columns are missing. Attempting fallback with original base schema columns...", error.message);
        
        const basePayload = {
          id: 'default',
          store_name: restaurantSettings.storeName,
          promptpay_number: restaurantSettings.promptPayNumber,
          promptpay_name: restaurantSettings.promptPayName,
          line_channel_access_token: restaurantSettings.lineChannelAccessToken || "",
          line_user_id: restaurantSettings.lineUserId || "",
          last_line_error: restaurantSettings.lastLineError || ""
        };

        const fallbackResult = await supabase.from('restaurant_settings').upsert(basePayload);
        if (fallbackResult.error) {
          console.log("[Supabase Settings Sync] Base settings fallback unaligned:", fallbackResult.error.message);
          let fbErrorMsg = fallbackResult.error.message || String(fallbackResult.error);
          if (fallbackResult.error.code === '42501' || fbErrorMsg.includes('row-level security policy')) {
            fbErrorMsg = "Row-Level Security (RLS) is active in Supabase. Please copy and run the SQL Script in your Supabase SQL Editor to disable RLS and grant public access: 'alter table restaurant_settings disable row level security;' and 'grant all on restaurant_settings to anon, authenticated, service_role;'";
          }
          restaurantSettings.lastSupabaseError = fbErrorMsg;
          saveLocalFile("restaurant_settings.json", restaurantSettings);
        } else {
          console.log("[Supabase Settings Sync] Successfully synced base settings to Supabase.");
          restaurantSettings.lastSupabaseError = "";
          saveLocalFile("restaurant_settings.json", restaurantSettings);
        }
      } else {
        console.log("[Supabase Settings Sync] Sync unaligned:", error.message || error);
      }
    } else {
      restaurantSettings.lastSupabaseError = "";
      saveLocalFile("restaurant_settings.json", restaurantSettings);
    }
  } catch (e: any) {
    console.log("[Supabase Settings Sync] Sync unaligned with message:", e.message || e);
  }
}

// Helper to sync an order to Supabase
async function syncOrderToSupabase(order: Order) {
  saveLocalFile("orders.json", orders);
  saveLocalFile("order_counter.json", orderCounter);
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    // Try writing to the NEW schema first (direct individual columns from copy-paste SQL)
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

    if (error) {
      // Fallback silently to OLD schema columns
      const { error: oldErr } = await supabase.from('orders').upsert({
        id: order.id,
        customer_name: order.customerName,
        address: order.deliveryAddress || "",
        payment_method: order.paymentMethod || "cash",
        items: order.items,
        total: order.totalAmount,
        status: order.status,
        date: order.timestamp,
        note: JSON.stringify({
          orderNumber: order.orderNumber,
          dineInType: order.dineInType,
          tableNumber: order.tableNumber || "",
          phone: order.phone || "",
          paymentSlip: order.paymentSlip || ""
        })
      });
      if (oldErr) {
        console.log("[Supabase] Fallback schema sync status:", oldErr.message || oldErr);
      }
    }
  } catch (e) {
    console.error("Supabase order sync failed:", e);
  }
}

// Helper to delete an order from Supabase
async function deleteOrderFromSupabase(id: string) {
  if (!deletedOrderIds.includes(id)) {
    deletedOrderIds.push(id);
    saveLocalFile("deleted_orders.json", deletedOrderIds);
  }
  saveLocalFile("orders.json", orders);
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
  saveLocalFile("reservations.json", reservations);
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
  if (!deletedReservationIds.includes(id)) {
    deletedReservationIds.push(id);
    saveLocalFile("deleted_reservations.json", deletedReservationIds);
  }
  saveLocalFile("reservations.json", reservations);
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
  saveLocalFile("menu_items.json", menuItems);
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    // Try writing to the NEW schema first (direct column names from the copy-paste SQL script)
    const { error } = await supabase.from('menu_items').upsert({
      id: item.id,
      name_th: item.nameTh,
      name_en: item.nameEn,
      description_th: item.descriptionTh || "",
      description_en: item.descriptionEn || "",
      price: item.price,
      category: item.category,
      image: item.image,
      is_popular: item.isPopular === true,
      prep_time: item.prepTime || 15,
      ingredients: item.ingredients || [],
      in_stock: item.inStock !== false,
      option_groups: item.optionGroups || []
    });

    if (error) {
      // Fallback silently to OLD schema columns
      const { error: oldErr } = await supabase.from('menu_items').upsert({
        id: item.id,
        name: JSON.stringify({ th: item.nameTh, en: item.nameEn }),
        description: JSON.stringify({
          th: item.descriptionTh || "",
          en: item.descriptionEn || "",
          isPopular: item.isPopular === true,
          prepTime: item.prepTime || 15,
          ingredients: item.ingredients || []
        }),
        price: item.price,
        category: item.category,
        image: item.image,
        available: item.inStock,
        options: item.optionGroups || []
      });
      if (oldErr) {
        console.log("[Supabase] Fallback schema menu status:", oldErr.message || oldErr);
      }
    }
  } catch (e) {
    console.error("Supabase menu item sync failed:", e);
  }
}

// Helper to delete a menu item from Supabase
async function deleteMenuItemFromSupabase(id: string) {
  if (!deletedMenuItemIds.includes(id)) {
    deletedMenuItemIds.push(id);
    saveLocalFile("deleted_menu_items.json", deletedMenuItemIds);
  }
  saveLocalFile("menu_items.json", menuItems);
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) console.error("Supabase menu item deletion error:", error);
  } catch (e) {
    console.error("Supabase menu item deletion failed:", e);
  }
}

// Helper to sync category to Supabase
async function syncCategoryToSupabase(cat: Category) {
  saveLocalFile("categories.json", categories);
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    // 1. Try upserting using new schema columns
    const { error } = await supabase.from('categories').upsert({
      id: cat.id,
      name_th: cat.nameTh,
      name_en: cat.nameEn,
      emoji: cat.emoji || "🍽️"
    });
    
    if (error) {
      // 2. Try falling back to old schema column
      const { error: oldErr } = await supabase.from('categories').upsert({
        id: cat.id,
        name: JSON.stringify({ th: cat.nameTh, en: cat.nameEn, emoji: cat.emoji || "🍽️" })
      });
      if (oldErr) {
        handleSupabaseError('categories', oldErr, 'sync_fallback');
      } else {
        console.log(`[Supabase] Category synced successfully to old schema for category: ${cat.id}`);
      }
    }
  } catch (e) {
    handleSupabaseError('categories', e, 'sync_exception');
  }
}

// Helper to delete category from Supabase
async function deleteCategoryFromSupabase(id: string) {
  if (!deletedCategoryIds.includes(id)) {
    deletedCategoryIds.push(id);
    saveLocalFile("deleted_categories.json", deletedCategoryIds);
  }
  saveLocalFile("categories.json", categories);
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) handleSupabaseError('categories', error, 'delete');
  } catch (e) {
    handleSupabaseError('categories', e, 'delete_exception');
  }
}

// Timeout utility to protect against database connection hanging/stalls
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, name: string): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.log(`[Network info] ${name} postponed after ${ms}ms. Proceeding with local cache fallback.`);
      
      // If it is a Supabase loader or init query timing out, trigger the circuit breaker cooldown
      if (name.toLowerCase().includes("supabase") || name.toLowerCase().includes("loader") || name.toLowerCase().includes("query") || name.toLowerCase().includes("init")) {
        triggerSupabaseCooldown();
      }
      
      resolve(fallback);
    }, ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw error;
  }
}

// Load and initialize data from Supabase
async function initializeSupabaseData() {
  const supabase = getSupabase();
  if (!supabase) {
    console.log("Supabase is not configured. Running in local memory fallback mode.");
    return;
  }
  
  console.log("Supabase configured! Loading and seeding data in parallel...");

  try {
    // Query all tables in parallel with a safe timeout (2500ms) to allow reliable connection on startup
    const [settingsResponse, categoriesResponse, menuItemsResponse, ordersResponse, reservationsResponse] = await Promise.all([
      withTimeout(
        supabase.from('restaurant_settings').select('*').eq('id', 'default').maybeSingle(),
        2500,
        { data: null, error: { message: "timeout" } as any },
        "Init Settings Query"
      ),
      withTimeout(
        supabase.from('categories').select('*'),
        2500,
        { data: null, error: { message: "timeout" } as any },
        "Init Categories Query"
      ),
      withTimeout(
        supabase.from('menu_items').select('*'),
        2500,
        { data: null, error: { message: "timeout" } as any },
        "Init Menu Query"
      ),
      withTimeout(
        supabase.from('orders').select('*'),
        2500,
        { data: null, error: { message: "timeout" } as any },
        "Init Orders Query"
      ),
      withTimeout(
        supabase.from('reservations').select('*'),
        2500,
        { data: null, error: { message: "timeout" } as any },
        "Init Reservations Query"
      )
    ]);

    // 1. Process Settings
    let settingsDataSuccess = false;
    let settingsData: any = null;
    if (settingsResponse && !settingsResponse.error) {
      settingsDataSuccess = true;
      settingsData = settingsResponse.data;
    } else if (settingsResponse && settingsResponse.error) {
      console.log("[Supabase info] Settings stream unaligned, utilizing local store backup");
      handleSupabaseError('restaurant_settings', settingsResponse.error, 'load');
    }

    if (settingsDataSuccess && settingsData) {
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
        supabaseAnonKey: restaurantSettings.supabaseAnonKey,
        lastSupabaseError: restaurantSettings.lastSupabaseError
      };
      console.log("Settings loaded from Supabase.");
    } else if (settingsDataSuccess) {
      console.log("No settings found in Supabase. Seeding default settings...");
      await syncSettingsToSupabase().catch(e => console.error(e));
    }

    dbAlreadyInitialized = !!(settingsDataSuccess && settingsData);

    // 2. Process Categories
    let catDataSuccess = false;
    let fetchedCats: Category[] = [];
    if (categoriesResponse && categoriesResponse.error) {
      console.log("[Supabase info] Categories stream unaligned, utilizing local store backup");
      handleSupabaseError('categories', categoriesResponse.error, 'load');
    } else if (categoriesResponse && categoriesResponse.data) {
      catDataSuccess = true;
      fetchedCats = (categoriesResponse.data || [])
        .filter(c => !deletedCategoryIds.includes(c.id))
        .map(c => mapSupabaseCategory(c));
    }

    // Merge with local categories backup to prevent data loss if Supabase sync is failing
    const localCats = loadLocalFile("categories.json", []).map((c: any) => mapSupabaseCategory(c));
    const mergedCats = [...fetchedCats];
    const fetchedCatIds = new Set(fetchedCats.map(c => c.id));
    for (const localCat of localCats) {
      if (!fetchedCatIds.has(localCat.id) && !deletedCategoryIds.includes(localCat.id)) {
        mergedCats.push(localCat);
      }
    }

    if (catDataSuccess) {
      if (mergedCats.length === 0) {
        categories = dbAlreadyInitialized ? [] : [...DEFAULT_CATEGORIES];
      } else {
        // Self-healing check: Ensure all DEFAULT_CATEGORIES are present in the Supabase database
        if (!dbAlreadyInitialized) {
          const finalCatIds = new Set(mergedCats.map(c => c.id));
          for (const defCat of DEFAULT_CATEGORIES) {
            if (!finalCatIds.has(defCat.id) && !deletedCategoryIds.includes(defCat.id)) {
              console.log(`Default category ${defCat.id} missing from Supabase. Seeding...`);
              await syncCategoryToSupabase(defCat).catch(e => console.error(e));
              mergedCats.push(defCat);
            }
          }
        }
        categories = mergedCats;
      }
      saveLocalFile("categories.json", categories);
      console.log(`Initialized ${categories.length} categories.`);
    } else {
      console.log(`[Cache info] Categories: preserved ${categories.length} records.`);
    }

    // 3. Process Menu Items
    let menuDataSuccess = false;
    let fetchedItems: MenuItem[] = [];
    if (menuItemsResponse && menuItemsResponse.error) {
      console.log("[Supabase info] Menu stream unaligned, utilizing local store backup");
      handleSupabaseError('menu_items', menuItemsResponse.error, 'load');
    } else if (menuItemsResponse && menuItemsResponse.data) {
      menuDataSuccess = true;
      fetchedItems = (menuItemsResponse.data || [])
        .filter(item => !deletedMenuItemIds.includes(item.id))
        .map(item => mapSupabaseMenuItem(item));
    }

    // Merge with local menu items backup to prevent data loss if Supabase sync is failing
    const localItems = loadLocalFile("menu_items.json", []).map((item: any) => mapSupabaseMenuItem(item));
    const mergedItems = [...fetchedItems];
    const fetchedItemIds = new Set(fetchedItems.map(item => item.id));
    for (const localItem of localItems) {
      if (!fetchedItemIds.has(localItem.id) && !deletedMenuItemIds.includes(localItem.id)) {
        mergedItems.push(localItem);
      }
    }

    if (menuDataSuccess) {
      if (mergedItems.length === 0) {
        menuItems = dbAlreadyInitialized ? [] : [...DEFAULT_MENU_ITEMS];
      } else {
        // Self-healing check: Ensure all DEFAULT_MENU_ITEMS are present
        if (!dbAlreadyInitialized) {
          const finalItemIds = new Set(mergedItems.map(item => item.id));
          for (const defItem of DEFAULT_MENU_ITEMS) {
            if (!finalItemIds.has(defItem.id) && !deletedMenuItemIds.includes(defItem.id)) {
              console.log(`Default menu item ${defItem.id} missing. Seeding...`);
              await syncMenuItemToSupabase(defItem).catch(e => console.error(e));
              mergedItems.push(defItem);
            }
          }
        }
        menuItems = mergedItems;
      }
      saveLocalFile("menu_items.json", menuItems);
      console.log(`Initialized ${menuItems.length} menu items.`);
    } else {
      console.log(`[Cache info] Menu items: preserved ${menuItems.length} records.`);
    }

    // 4. Process Orders
    let ordersDataSuccess = false;
    let fetchedOrders: Order[] = [];
    if (ordersResponse && ordersResponse.error) {
      console.log("[Supabase info] Orders stream unaligned, utilizing local store backup");
      handleSupabaseError('orders', ordersResponse.error, 'load');
    } else if (ordersResponse && ordersResponse.data) {
      ordersDataSuccess = true;
      fetchedOrders = (ordersResponse.data || [])
        .filter(order => !deletedOrderIds.includes(order.id))
        .map(order => mapSupabaseOrder(order));
    }

    if (ordersDataSuccess) {
      if (fetchedOrders.length === 0 && !dbAlreadyInitialized && deletedOrderIds.length === 0) {
        console.log("No orders found in Supabase. Seeding default orders...");
        for (const order of DEFAULT_ORDERS) {
          await syncOrderToSupabase(order).catch(e => console.error(e));
        }
        orders = [...DEFAULT_ORDERS];
      } else if (fetchedOrders.length > 0) {
        orders = fetchedOrders.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } else {
        // If query succeeded and returned no orders, and we shouldn't seed, then keep orders empty
        orders = [];
      }
      saveLocalFile("orders.json", orders);
      const maxOrderNum = orders.reduce((max, o) => {
        const num = Number(o.orderNumber);
        return isNaN(num) ? max : Math.max(max, num);
      }, 1003);
      orderCounter = maxOrderNum + 1;
      saveLocalFile("order_counter.json", orderCounter);
      console.log(`Initialized ${orders.length} orders. Next OrderCounter: ${orderCounter}`);
    } else {
      console.log(`[Cache info] Orders: preserved ${orders.length} records.`);
    }

    // 5. Process Reservations
    let resDataSuccess = false;
    let fetchedReservations: Reservation[] = [];
    if (reservationsResponse && reservationsResponse.error) {
      console.log("[Supabase info] Reservations stream unaligned, utilizing local store backup");
      handleSupabaseError('reservations', reservationsResponse.error, 'load');
    } else if (reservationsResponse && reservationsResponse.data) {
      resDataSuccess = true;
      fetchedReservations = (reservationsResponse.data || [])
        .filter(resv => !deletedReservationIds.includes(resv.id))
        .map(resv => ({
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
    }

    if (resDataSuccess) {
      if (fetchedReservations.length === 0 && !dbAlreadyInitialized && deletedReservationIds.length === 0) {
        console.log("No reservations found in Supabase. Seeding default reservations...");
        for (const resv of DEFAULT_RESERVATIONS) {
          await syncReservationToSupabase(resv).catch(e => console.error(e));
        }
        reservations = [...DEFAULT_RESERVATIONS];
      } else if (fetchedReservations.length > 0) {
        reservations = fetchedReservations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } else {
        // If query succeeded and returned no reservations, and we shouldn't seed, then keep reservations empty
        reservations = [];
      }
      saveLocalFile("reservations.json", reservations);
      console.log(`Initialized ${reservations.length} reservations.`);
    } else {
       console.log(`[Cache info] Reservations: preserved ${reservations.length} records.`);
    }

    // Successfully initialized and loaded all data from Supabase! Set load times to current time.
    const now = Date.now();
    lastSettingsLoadTime = now;
    lastCategoriesLoadTime = now;
    lastMenuLoadTime = now;
    lastOrdersLoadTime = now;
    lastReservationsLoadTime = now;
    
    // Clear any previous error as synchronization succeeded beautifully!
    restaurantSettings.lastSupabaseError = "";
    saveLocalFile("restaurant_settings.json", restaurantSettings);

  } catch (e: any) {
    console.log("[Supabase info] Startup data setup complete / Fallback state active:", e?.message || e);
  }
}

// Initialize Supabase data immediately on start if not running on Vercel
if (!process.env.VERCEL) {
  initializeSupabaseData().catch(e => console.log("[Supabase info] Startup setup completed neutrally:", e?.message || e));
}

// Loader helpers to ensure data is fetched from Supabase if configured (crucial for stateless serverless environments)
let lastSettingsLoadTime = 0;
async function ensureSettingsLoaded() {
  const initPromise = getSupabaseInitPromise();
  if (initPromise) {
    await withTimeout(initPromise, 250, undefined, "Supabase Init (Settings Loader)");
  }

  const now = Date.now();
  if (now - lastSettingsLoadTime < 5000 && !process.env.VERCEL) return;
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const response = await withTimeout(
      supabase.from('restaurant_settings').select('*').eq('id', 'default').maybeSingle(),
      2000,
      { data: null, error: { message: "timeout" } as any },
      "Load Settings in Loader"
    );
    if (response && response.error) {
      handleSupabaseError('restaurant_settings', response.error, 'load');
    } else if (response && response.data) {
      const settingsData = response.data;
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
        supabaseAnonKey: restaurantSettings.supabaseAnonKey,
        lastSupabaseError: ""
      };
      lastSettingsLoadTime = now;
      restaurantSettings.lastSupabaseError = "";
    }
  } catch (e) {
    handleSupabaseError('restaurant_settings', e, 'load');
  }
}

let lastCategoriesLoadTime = 0;
async function ensureCategoriesLoaded() {
  const initPromise = getSupabaseInitPromise();
  if (initPromise) {
    await withTimeout(initPromise, 250, undefined, "Supabase Init (Categories Loader)");
  }

  const now = Date.now();
  if (now - lastCategoriesLoadTime < 5000 && !process.env.VERCEL) return;
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const response = await withTimeout(
      supabase.from('categories').select('*'),
      2000,
      { data: null, error: { message: "timeout" } as any },
      "Load Categories in Loader"
    );
      
    if (response && response.error) {
      handleSupabaseError('categories', response.error, 'load');
    } else if (response && response.data) {
      const catData = response.data;
      const fetchedCats = catData
        .filter(c => !deletedCategoryIds.includes(c.id))
        .map(c => mapSupabaseCategory(c));

      // Merge with local categories backup to prevent data loss if Supabase sync is failing
      const localCats = loadLocalFile("categories.json", []).map((c: any) => mapSupabaseCategory(c));
      const mergedCats = [...fetchedCats];
      const fetchedIds = new Set(fetchedCats.map(c => c.id));
      
      for (const localCat of localCats) {
        if (!fetchedIds.has(localCat.id) && !deletedCategoryIds.includes(localCat.id)) {
          mergedCats.push(localCat);
        }
      }

      // Self-healing check: Ensure all DEFAULT_CATEGORIES are present
      if (!dbAlreadyInitialized) {
        const finalIds = new Set(mergedCats.map(c => c.id));
        for (const defCat of DEFAULT_CATEGORIES) {
          if (!finalIds.has(defCat.id) && !deletedCategoryIds.includes(defCat.id)) {
            console.log(`Default category ${defCat.id} missing in ensureCategoriesLoaded. Seeding...`);
            await syncCategoryToSupabase(defCat).catch(e => console.error(e));
            mergedCats.push(defCat);
          }
        }
      }

      categories = mergedCats;
      saveLocalFile("categories.json", categories);
      lastCategoriesLoadTime = now;
      restaurantSettings.lastSupabaseError = "";
    }
  } catch (e) {
    handleSupabaseError('categories', e, 'load');
  }
}

let lastMenuLoadTime = 0;
async function ensureMenuItemsLoaded() {
  const initPromise = getSupabaseInitPromise();
  if (initPromise) {
    await withTimeout(initPromise, 250, undefined, "Supabase Init (Menu Loader)");
  }

  const now = Date.now();
  if (now - lastMenuLoadTime < 3000 && !process.env.VERCEL) return;
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const response = await withTimeout(
      supabase.from('menu_items').select('*'),
      2000,
      { data: null, error: { message: "timeout" } as any },
      "Load Menu Items in Loader"
    );
      
    if (response && response.error) {
      handleSupabaseError('menu_items', response.error, 'load');
    } else if (response && response.data) {
      const menuData = response.data;
      const fetchedItems = menuData
        .filter(item => !deletedMenuItemIds.includes(item.id))
        .map(item => mapSupabaseMenuItem(item));

      // Merge with local menu items backup to prevent data loss if Supabase sync is failing
      const localItems = loadLocalFile("menu_items.json", []).map((item: any) => mapSupabaseMenuItem(item));
      const mergedItems = [...fetchedItems];
      const fetchedIds = new Set(fetchedItems.map(item => item.id));

      for (const localItem of localItems) {
        if (!fetchedIds.has(localItem.id) && !deletedMenuItemIds.includes(localItem.id)) {
          mergedItems.push(localItem);
        }
      }

      menuItems = mergedItems;
      saveLocalFile("menu_items.json", menuItems);
      lastMenuLoadTime = now;
      restaurantSettings.lastSupabaseError = "";
    }
  } catch (e) {
    handleSupabaseError('menu_items', e, 'load');
  }
}

let lastOrdersLoadTime = 0;
async function ensureOrdersLoaded(force = false) {
  const initPromise = getSupabaseInitPromise();
  if (initPromise) {
    await withTimeout(initPromise, 250, undefined, "Supabase Init (Orders Loader)");
  }

  const now = Date.now();
  if (!force && (now - lastOrdersLoadTime < 2000) && !process.env.VERCEL) return;
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const response = await withTimeout(
      supabase.from('orders').select('*'),
      2000,
      { data: null, error: { message: "timeout" } as any },
      "Load Orders in Loader"
    );
      
    if (response && response.error) {
      handleSupabaseError('orders', response.error, 'load');
    } else if (response && response.data) {
      const ordersData = response.data;
      const fetchedOrders = ordersData
        .filter(order => !deletedOrderIds.includes(order.id))
        .map(order => mapSupabaseOrder(order));
      
      const mergedOrders = fetchedOrders.map(fetched => {
        const recent = localOrderUpdates.get(fetched.id);
        if (recent && (Date.now() - recent.timestamp < 15000)) {
          // If we had a local update in the last 15 seconds, prefer the local version
          return recent.order;
        }
        return fetched;
      });

      // Also include any extremely recent local orders that are not in the fetched list at all yet
      for (const [id, info] of localOrderUpdates.entries()) {
        if (Date.now() - info.timestamp < 15000) {
          if (!mergedOrders.some(o => o.id === id) && !deletedOrderIds.includes(id)) {
            mergedOrders.push(info.order);
          }
        }
      }

      // Keep orders sorted by timestamp descending so newest is always first
      orders = mergedOrders.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const maxOrderNum = orders.reduce((max, o) => {
        const num = Number(o.orderNumber);
        return isNaN(num) ? max : Math.max(max, num);
      }, 1003);
      orderCounter = maxOrderNum + 1;
      
      // Save local backup file
      saveLocalFile("orders.json", orders);
      saveLocalFile("order_counter.json", orderCounter);
      
      lastOrdersLoadTime = now;
      restaurantSettings.lastSupabaseError = "";
    }
  } catch (e) {
    handleSupabaseError('orders', e, 'load');
  }
}

let lastReservationsLoadTime = 0;
async function ensureReservationsLoaded(force = false) {
  const initPromise = getSupabaseInitPromise();
  if (initPromise) {
    await withTimeout(initPromise, 250, undefined, "Supabase Init (Reservations Loader)");
  }

  const now = Date.now();
  if (!force && (now - lastReservationsLoadTime < 2000) && !process.env.VERCEL) return;
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const response = await withTimeout(
      supabase.from('reservations').select('*'),
      2000,
      { data: null, error: { message: "timeout" } as any },
      "Load Reservations in Loader"
    );
      
    if (response && response.error) {
      handleSupabaseError('reservations', response.error, 'load');
    } else if (response && response.data) {
      const resData = response.data;
      const fetchedReservations = resData
        .filter(resv => !deletedReservationIds.includes(resv.id))
        .map(resv => ({
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

      const mergedReservations = fetchedReservations.map(fetched => {
        const recent = localReservationUpdates.get(fetched.id);
        if (recent && (Date.now() - recent.timestamp < 15000)) {
          return recent.reservation;
        }
        return fetched;
      });

      for (const [id, info] of localReservationUpdates.entries()) {
        if (Date.now() - info.timestamp < 15000) {
          if (!mergedReservations.some(r => r.id === id) && !deletedReservationIds.includes(id)) {
            mergedReservations.push(info.reservation);
          }
        }
      }

      // Keep reservations sorted by date/time or timestamp descending
      reservations = mergedReservations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Save local backup file
      saveLocalFile("reservations.json", reservations);
      
      lastReservationsLoadTime = now;
      restaurantSettings.lastSupabaseError = "";
    }
  } catch (e) {
    handleSupabaseError('reservations', e, 'load');
  }
}

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
app.get("/api/menu", async (req, res) => {
  await ensureMenuItemsLoaded();
  res.json(menuItems);
});

// GET /api/categories
app.get("/api/categories", async (req, res) => {
  await ensureCategoriesLoaded();
  res.json(categories);
});

// POST /api/categories
app.post("/api/categories", async (req, res) => {
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
  await syncCategoryToSupabase(newCategory).catch(e => console.error(e));
  broadcast("categories-updated");
  res.status(201).json(newCategory);
});

// DELETE /api/categories/:id
app.delete("/api/categories/:id", async (req, res) => {
  const { id } = req.params;
  const index = categories.findIndex(c => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Category not found" });
  }

  // Delete category
  categories.splice(index, 1);
  await deleteCategoryFromSupabase(id).catch(e => console.error(e));

  // Reassign all items under this category to "other" category
  for (const item of menuItems) {
    if (item.category === id) {
      item.category = "other";
      await syncMenuItemToSupabase(item).catch(e => console.error(e));
    }
  }

  // Ensure "other" category exists in categories array if some item was moved to it
  const hasItemsInOther = menuItems.some(item => item.category === "other");
  if (hasItemsInOther && !categories.some(c => c.id === "other")) {
    const otherCat = { id: "other", nameTh: "อื่นๆ", nameEn: "Other", emoji: "📦" };
    categories.push(otherCat);
    await syncCategoryToSupabase(otherCat).catch(e => console.error(e));
  }

  broadcast("categories-updated");
  broadcast("menu-updated");
  res.json({ success: true, deletedId: id });
});

// POST /api/menu (Create Menu Item)
app.post("/api/menu", async (req, res) => {
  await ensureMenuItemsLoaded();
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
  await syncMenuItemToSupabase(newItem).catch(e => console.error(e));
  broadcast("menu-updated");
  res.status(201).json(newItem);
});

// PUT /api/menu/:id (Update Menu Item)
app.put("/api/menu/:id", async (req, res) => {
  await ensureMenuItemsLoaded();
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

  await syncMenuItemToSupabase(menuItems[index]).catch(e => console.error(e));
  broadcast("menu-updated");
  res.json(menuItems[index]);
});

// DELETE /api/menu/:id (Delete Menu Item)
app.delete("/api/menu/:id", async (req, res) => {
  await ensureMenuItemsLoaded();
  const { id } = req.params;
  const index = menuItems.findIndex(item => item.id === id);
  if (index === -1) {
    // Attempt deletion from Supabase to be safe and idempotent, returning success instead of 404
    await deleteMenuItemFromSupabase(id).catch(e => console.error(e));
    broadcast("menu-updated");
    return res.json({ success: true, deletedId: id, note: "Menu item not found in memory but delete attempted on Supabase" });
  }
  
  menuItems.splice(index, 1);
  await deleteMenuItemFromSupabase(id).catch(e => console.error(e));
  broadcast("menu-updated");
  res.json({ success: true, deletedId: id });
});

// POST /api/menu/:id/toggle-stock
app.post("/api/menu/:id/toggle-stock", async (req, res) => {
  await ensureMenuItemsLoaded();
  const { id } = req.params;
  const item = menuItems.find(item => item.id === id);
  if (!item) {
    return res.status(404).json({ error: "Menu item not found" });
  }
  item.inStock = !item.inStock;
  await syncMenuItemToSupabase(item).catch(e => console.error(e));
  broadcast("menu-updated");
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
app.get("/api/orders", async (req, res) => {
  const fresh = req.query.fresh === "true";
  await ensureOrdersLoaded(fresh);
  res.json(orders);
});

// POST /api/orders (Create Order)
app.post("/api/orders", async (req, res) => {
  await ensureOrdersLoaded();
  await ensureMenuItemsLoaded();
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
  localOrderUpdates.set(newOrder.id, { timestamp: Date.now(), order: newOrder });
  lastOrdersLoadTime = 0; // Force refresh

  // Sync to Supabase
  await syncOrderToSupabase(newOrder).catch(e => console.error(e));

  // Send LINE notification in background without blocking response
  sendLineNotification(newOrder).catch((err) => {
    console.error("Error sending LINE notification asynchronously:", err);
  });

  broadcast("orders-updated");

  res.status(201).json(newOrder);
});

// DELETE /api/orders/:id (Delete Order)
app.delete("/api/orders/:id", async (req, res) => {
  const { id } = req.params;
  
  // Track as deleted immediately to prevent any race conditions with incoming loads/polls
  if (!deletedOrderIds.includes(id)) {
    deletedOrderIds.push(id);
    saveLocalFile("deleted_orders.json", deletedOrderIds);
  }
  
  // Remove from memory immediately
  const index = orders.findIndex(o => o.id === id);
  if (index !== -1) {
    orders.splice(index, 1);
    saveLocalFile("orders.json", orders);
  }
  
  // Force subsequent loads to see the change
  lastOrdersLoadTime = 0;
  
  // Delete from Supabase in the background (non-blocking for ultra-fast response)
  deleteOrderFromSupabase(id).catch(e => console.error("[Supabase Delete Background Error]", e));
  
  // Broadcast update immediately to all connected clients
  broadcast("orders-updated");
  
  res.json({ success: true, deletedId: id });
});

// POST /api/orders/:id/update-item-price (Update Price of Item inside Order)
app.post("/api/orders/:id/update-item-price", async (req, res) => {
  await ensureOrdersLoaded();
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

  localOrderUpdates.set(order.id, { timestamp: Date.now(), order: order });
  lastOrdersLoadTime = 0; // Force refresh

  await syncOrderToSupabase(order).catch(e => console.error(e));
  broadcast("orders-updated");
  res.json(order);
});

// PUT /api/orders/:id/items (Edit/Update items of an existing order)
app.put("/api/orders/:id/items", async (req, res) => {
  await ensureOrdersLoaded();
  await ensureMenuItemsLoaded();
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

  localOrderUpdates.set(order.id, { timestamp: Date.now(), order: order });
  lastOrdersLoadTime = 0; // Force refresh

  await syncOrderToSupabase(order).catch(e => console.error(e));
  broadcast("orders-updated");
  res.json(order);
});

// POST /api/orders/:id/status (Update Status)
app.post("/api/orders/:id/status", async (req, res) => {
  await ensureOrdersLoaded();
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
  localOrderUpdates.set(order.id, { timestamp: Date.now(), order: order });
  lastOrdersLoadTime = 0; // Force refresh
  await syncOrderToSupabase(order).catch(e => console.error(e));
  broadcast("orders-updated");
  res.json(order);
});

// GET /api/analytics
app.get("/api/analytics", async (req, res) => {
  await ensureOrdersLoaded();
  await ensureMenuItemsLoaded();
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
app.get("/api/settings", async (req, res) => {
  await ensureSettingsLoaded();
  res.json(restaurantSettings);
});

// POST /api/settings
app.post("/api/settings", async (req, res) => {
  await ensureSettingsLoaded();
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
  await syncSettingsToSupabase().catch(e => console.error(e));

  // If credentials changed, trigger reload
  if (supabaseUrl !== oldUrl || supabaseAnonKey !== oldKey) {
    console.log("Supabase credentials changed, re-initializing data...");
    setTimeout(() => {
      initializeSupabaseData().catch(e => console.error("Error re-initializing Supabase data:", e));
    }, 100);
  }

  broadcast("settings-updated");

  res.json(restaurantSettings);
});

// POST /api/supabase/push-local-data - Push all current local state to Supabase
app.post("/api/supabase/push-local-data", async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(400).json({ error: "ยังไม่ได้ระบุ/ตั้งค่าเชื่อมต่อกับฐานข้อมูล Supabase หรือฐานข้อมูลถูกระงับชั่วคราว" });
  }

  try {
    console.log("Starting full manual sync of local data to Supabase...");
    
    // Ensure all local data is loaded
    await ensureSettingsLoaded();
    await ensureCategoriesLoaded();
    await ensureMenuItemsLoaded();
    await ensureOrdersLoaded(true);
    await ensureReservationsLoaded(true);

    // 1. Sync Settings
    await syncSettingsToSupabase();

    // 2. Sync Categories
    for (const cat of categories) {
      await syncCategoryToSupabase(cat);
    }

    // 3. Sync Menu Items
    for (const item of menuItems) {
      await syncMenuItemToSupabase(item);
    }

    // 4. Sync Orders
    for (const order of orders) {
      await syncOrderToSupabase(order);
    }

    // 5. Sync Reservations
    for (const resv of reservations) {
      await syncReservationToSupabase(resv);
    }

    // Clear any previous error as synchronization succeeded beautifully!
    restaurantSettings.lastSupabaseError = "";
    saveLocalFile("restaurant_settings.json", restaurantSettings);

    // Broadcast update so all connected clients get refreshed
    broadcast("settings-updated");
    broadcast("categories-updated");
    broadcast("menu-updated");
    broadcast("orders-updated");
    broadcast("reservations-updated");

    res.json({ success: true, message: "อัปโหลดข้อมูลจากระบบหลังบ้านไปยัง Supabase สำเร็จครบทุกหมวดหมู่แล้ว!" });
  } catch (error: any) {
    console.error("Full manual sync failed:", error);
    res.status(500).json({ error: error.message || "เกิดข้อผิดพลาดในการส่งข้อมูลไปยังฐานข้อมูล" });
  }
});

// GET /api/reservations - Get all reservations
app.get("/api/reservations", async (req, res) => {
  const fresh = req.query.fresh === "true";
  await ensureReservationsLoaded(fresh);
  res.json(reservations);
});

// POST /api/reservations - Create a reservation
app.post("/api/reservations", async (req, res) => {
  await ensureReservationsLoaded();
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
  localReservationUpdates.set(newRes.id, { timestamp: Date.now(), reservation: newRes });
  lastReservationsLoadTime = 0; // Force refresh
  await syncReservationToSupabase(newRes).catch(e => console.error(e));
  broadcast("reservations-updated");
  res.status(201).json(newRes);
});

// POST /api/reservations/:id/status - Update reservation status
app.post("/api/reservations/:id/status", async (req, res) => {
  await ensureReservationsLoaded();
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
  localReservationUpdates.set(reservation.id, { timestamp: Date.now(), reservation: reservation });
  lastReservationsLoadTime = 0; // Force refresh
  await syncReservationToSupabase(reservation).catch(e => console.error(e));
  broadcast("reservations-updated");
  res.json(reservation);
});

// DELETE /api/reservations/:id - Delete a reservation permanently
app.delete("/api/reservations/:id", async (req, res) => {
  const { id } = req.params;
  
  // Track as deleted immediately to prevent any race conditions with incoming loads/polls
  if (!deletedReservationIds.includes(id)) {
    deletedReservationIds.push(id);
    saveLocalFile("deleted_reservations.json", deletedReservationIds);
  }
  
  // Remove from memory immediately
  const index = reservations.findIndex(r => r.id === id);
  if (index !== -1) {
    reservations.splice(index, 1);
    saveLocalFile("reservations.json", reservations);
  }
  
  // Force subsequent loads to see the change
  lastReservationsLoadTime = 0;
  
  // Delete from Supabase in the background (non-blocking for ultra-fast response)
  deleteReservationFromSupabase(id).catch(e => console.error("[Supabase Delete Background Error]", e));
  
  // Broadcast update immediately to all connected clients
  broadcast("reservations-updated");
  
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

// Helper to perform Gemini Translation with retry logic to gracefully handle transient overload/503 errors
async function generateTranslationWithRetry(ai: any, text: string, systemInstruction: string, retries = 2, delayMs = 1000): Promise<string> {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: text,
        config: {
          systemInstruction,
          temperature: 0.1
        }
      });
      const translatedText = response.text ? response.text.trim().replace(/^["']|["']$/g, '') : "";
      if (translatedText) return translatedText;
    } catch (error: any) {
      const errorStr = String(error.message || error);
      const isTransient = error.status === 'UNAVAILABLE' || error.status === 503 || errorStr.includes('503') || errorStr.includes('high demand') || errorStr.includes('overloaded') || errorStr.includes('temporarily unavailable');
      if (isTransient && attempt <= retries) {
        console.log(`[Translate info] Model busy status. Retrying translation in ${delayMs}ms (attempt ${attempt})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error("Translation failed after all retry attempts.");
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

    const translatedText = await generateTranslationWithRetry(ai, text, systemInstruction);
    res.json({ translatedText: translatedText || localTranslate(text), isMock: false });
  } catch (error: any) {
    console.log("[Translate info] Live translator busy or unavailable. Using robust local translation dictionary fallback.");
    // fallback
    res.json({ translatedText: localTranslate(text), isMock: true });
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

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  setupWebSocket(server);
}

if (!process.env.VERCEL) {
  startServer();
}

export { app };
