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
  image: string;
  isPopular: boolean;
  prepTime: number; // minutes
  ingredients: string[];
  inStock: boolean;
  optionGroups?: OptionGroup[];
}

export interface Customizations {
  sweetness?: string; // Standard, Less, None
  spiciness?: string; // Mild, Medium, Hot, None
  temperature?: string; // Hot, Iced
  noodleType?: string; // เส้นเล็ก, เส้นใหญ่, บะหมี่, เส้นหมี่, วุ้นเส้น, etc.
  riceType?: string; // ข้าวสวย, ข้าวกล้อง, ข้าวเหนียว, ข้าวออร์แกนิก, etc.
  optionSelections?: { [groupName: string]: OptionChoice }; // Selected option groups and choices
  notes?: string;
  serviceType?: 'dine-in' | 'takeaway';
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  customizations: Customizations;
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
  paymentSlip?: string; // base64 string or url
  items: {
    menuItemId: string;
    nameEn: string;
    nameTh: string;
    price: number;
    quantity: number;
    customizations?: Customizations;
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
  openTime?: string; // e.g. "09:00"
  closeTime?: string; // e.g. "21:00"
  closedDays?: number[]; // [0, 6] (0 = Sunday, 6 = Saturday)
  isClosedTemporarily?: boolean;
  isReservationEnabled?: boolean;
  isLoyaltyEnabled?: boolean;
  lastLineError?: string;
}

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

export interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  completedCount: number;
  pendingCount: number;
  preparingCount: number;
  cancelledCount: number;
  categorySales: {
    appetizer: number;
    main: number;
    dessert: number;
    beverage: number;
  };
  popularItems: {
    id: string;
    name: string;
    qty: number;
    revenue: number;
  }[];
}
