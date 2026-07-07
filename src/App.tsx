import React, { useState, useEffect } from 'react';
import { 
  Utensils, 
  ShoppingBag, 
  Sparkles, 
  TrendingUp, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  ChefHat, 
  Smartphone, 
  User, 
  Table, 
  MapPin, 
  Check, 
  X, 
  Sliders, 
  Info, 
  Search, 
  ChevronRight, 
  Moon, 
  Sun, 
  BarChart3, 
  Settings, 
  AlertCircle,
  XCircle,
  Eye,
  RotateCcw,
  QrCode,
  ExternalLink,
  Wallet,
  Upload,
  Edit,
  Image,
  Phone,
  Calendar,
  Gift,
  Bot,
  Send,
  Volume2,
  Percent,
  Users
} from 'lucide-react';
import { Category, MenuItem, Order, CartItem, Customizations, AnalyticsData, RestaurantSettings, OptionChoice, OptionGroup, Reservation } from './types';
import { createClient } from '@supabase/supabase-js';
import DeliveryMap from './components/DeliveryMap';

const formatPrice = (val: any): string => {
  if (val === null || val === undefined) return '0';
  const num = Number(val);
  return isNaN(num) ? '0' : num.toLocaleString();
};

const isNoodleDish = (item: MenuItem) => {
  const name = (item.nameTh + " " + item.nameEn + " " + item.descriptionTh + " " + item.descriptionEn).toLowerCase();
  return name.includes('เส้น') || name.includes('ก๋วยเตี๋ยว') || name.includes('ผัดไทย') || name.includes('noodle') || name.includes('pasta') || name.includes('สปาเก็ตตี้') || name.includes('เกี๊ยว') || name.includes('ราเมน') || name.includes('ราเม็ง');
};

const isRiceDish = (item: MenuItem) => {
  const name = (item.nameTh + " " + item.nameEn + " " + item.descriptionTh + " " + item.descriptionEn).toLowerCase();
  if (item.category === 'dessert') return false;
  return name.includes('ข้าว') || name.includes('rice') || name.includes('ริซอตโต้') || name.includes('risotto');
};

export default function App() {
  // Navigation: 'customer' or 'admin'
  const [activeTab, setActiveTab] = useState<'customer' | 'admin'>('customer');
  
  // Menu and Orders State from Backend
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  
  // Client UI States
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Customization Modal
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [tempSweetness, setTempSweetness] = useState<string>('Standard');
  const [tempSpiciness, setTempSpiciness] = useState<string>('Medium');
  const [tempTemperature, setTempTemperature] = useState<string>('Iced');
  const [tempNotes, setTempNotes] = useState<string>('');
  const [tempNoodleType, setTempNoodleType] = useState<string>('เส้นเล็ก');
  const [tempRiceType, setTempRiceType] = useState<string>('ข้าวสวย');
  const [tempOptionSelections, setTempOptionSelections] = useState<{ [groupName: string]: OptionChoice }>({});
  const [tempServiceType, setTempServiceType] = useState<'dine-in' | 'takeaway'>('dine-in');

  // Custom Confirmation Dialog Modal State
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  } | null>(null);
  
  // Customer Checkout Details
  const [customerName, setCustomerName] = useState('');
  const [dineInType, setDineInType] = useState<'dine-in' | 'delivery'>('dine-in');
  const [tableNumber, setTableNumber] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('table') || '';
    }
    return '';
  });
  const [isScannedTable, setIsScannedTable] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.has('table');
    }
    return false;
  });
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<{ number: string; id: string } | null>(null);
  const [formErrors, setFormErrors] = useState<string>('');

  // AI Sommelier State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // Admin Panel states
  const [adminOrderFilter, setAdminOrderFilter] = useState<'all' | 'pending' | 'active' | 'completed' | 'cancelled'>('all');
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [newMenuTh, setNewMenuTh] = useState('');
  const [newMenuEn, setNewMenuEn] = useState('');
  const [newDescTh, setNewDescTh] = useState('');
  const [newDescEn, setNewDescEn] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState<string>('main');
  const [newImage, setNewImage] = useState('');
  const [newPrepTime, setNewPrepTime] = useState('15');
  const [newIngredients, setNewIngredients] = useState('');
  const [menuActionError, setMenuActionError] = useState('');
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [newOptionGroups, setNewOptionGroups] = useState<OptionGroup[]>([]);

  // Category states
  const [newCatTh, setNewCatTh] = useState('');
  const [newCatEn, setNewCatEn] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('🍽️');
  const [catActionError, setCatActionError] = useState('');
  const [scannedTableMsg, setScannedTableMsg] = useState<string>('');

  // Restaurant Settings states
  const [settings, setSettings] = useState<RestaurantSettings>({
    storeName: 'AURA CULINARY',
    promptPayNumber: '081-234-5678',
    promptPayName: 'คุณสมศรี ดีดี',
    lineChannelAccessToken: '',
    lineUserId: '',
    phone: '081-234-5678',
    tagline: 'Gastronomy & AI Sommelier',
    openTime: '09:00',
    closeTime: '21:00',
    closedDays: [],
    isClosedTemporarily: false,
    isReservationEnabled: true,
    isLoyaltyEnabled: true,
    lastLineError: ''
  });
  const [editStoreName, setEditStoreName] = useState('');
  const [editPromptPayNumber, setEditPromptPayNumber] = useState('');
  const [editPromptPayName, setEditPromptPayName] = useState('');
  const [editLineChannelAccessToken, setEditLineChannelAccessToken] = useState('');
  const [editLineUserId, setEditLineUserId] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editTagline, setEditTagline] = useState('');
  const [editOpenTime, setEditOpenTime] = useState('09:00');
  const [editCloseTime, setEditCloseTime] = useState('21:00');
  const [editClosedDays, setEditClosedDays] = useState<number[]>([]);
  const [editIsClosedTemporarily, setEditIsClosedTemporarily] = useState(false);
  const [editIsReservationEnabled, setEditIsReservationEnabled] = useState(true);
  const [editIsLoyaltyEnabled, setEditIsLoyaltyEnabled] = useState(true);
  const [editSupabaseUrl, setEditSupabaseUrl] = useState('');
  const [editSupabaseAnonKey, setEditSupabaseAnonKey] = useState('');
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState('');

  // Scoped fetch wrapper for API requests
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    return window.fetch(input, init);
  };

  // 5 Feature Upgrades states
  
  // 1. Smart Reservations
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [deletingResId, setDeletingResId] = useState<string | null>(null);
  const [resName, setResName] = useState('');
  const [resPhone, setResPhone] = useState('');
  const [resDate, setResDate] = useState('');
  const [resTime, setResTime] = useState('');
  const [resPartySize, setResPartySize] = useState(2);
  const [resTablePref, setResTablePref] = useState('window');
  const [resSpecialRequest, setResSpecialRequest] = useState('');
  const [resSuccess, setResSuccess] = useState(false);
  const [resLoading, setResLoading] = useState(false);
  const [adminSubTab, setAdminSubTab] = useState<'orders' | 'reservations'>('orders');

  // 2. Loyalty & Vouchers
  const [loyaltyPoints, setLoyaltyPoints] = useState(150); // Starting points
  const [appliedDiscount, setAppliedDiscount] = useState<{code: string; amount: number} | null>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [loyaltyMessage, setLoyaltyMessage] = useState('');

  // 3. AI Sommelier Chatbot
  const [isSommelierOpen, setIsSommelierOpen] = useState(false);
  const [sommelierMessages, setSommelierMessages] = useState<{sender: 'user' | 'sommelier'; text: string; items?: string[]}[]>([
    { sender: 'sommelier', text: 'สวัสดีครับ ผมคือ AI Sommelier ส่วนตัวของคุณ ยินดีแนะนำเมนูอาหารและไวน์หรือเครื่องดื่มชั้นเลิศที่จับคู่กันได้อย่างสมบูรณ์แบบครับ วันนี้อยากให้ผมแนะนำอาหารคู่กับเครื่องดื่มอะไรดีครับ? 🍷✨' }
  ]);
  const [sommelierInput, setSommelierInput] = useState('');
  const [isSommelierLoading, setIsSommelierLoading] = useState(false);

  // 4. KDS Kanban & Synthesizer state
  // Web Audio chime function
  const playChime = (frequency = 587.33, duration = 0.3, type: OscillatorType = 'sine') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      // Pitch slide for a sweet bell sound
      if (frequency === 587.33) {
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      }

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Web Audio API not supported or interaction first required:", e);
    }
  };

  // Track old orders count to play sound on new orders
  const [prevOrdersCount, setPrevOrdersCount] = useState<number>(0);

  // 5. Bill Splitter
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitType, setSplitType] = useState<'equal' | 'by-item'>('equal');
  const [splitPeopleCount, setSplitPeopleCount] = useState(2);
  const [splitPeopleNames, setSplitPeopleNames] = useState<string[]>(['คุณ (Me)', 'เพื่อน 1', 'เพื่อน 2', 'เพื่อน 3', 'เพื่อน 4']);
  const [itemAssignments, setItemAssignments] = useState<{ [cartItemIndex: number]: number[] }>({}); // cartItemIndex -> indices of people splitting it
  const [activeSplitPersonIdx, setActiveSplitPersonIdx] = useState<number>(0);

  // Payment Selection state for Checkout
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'promptpay'>('cash');
  const [paymentSlip, setPaymentSlip] = useState<string>('');
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const startEditingOrder = (order: Order) => {
    // Convert order items to CartItems
    const cartItems: CartItem[] = order.items.map(it => {
      const realItem = menuItems.find(m => m.id === it.menuItemId);
      if (it.menuItemId === 'custom-written') {
        return {
          menuItem: {
            id: 'custom-written',
            nameTh: it.nameTh,
            nameEn: it.nameEn,
            price: it.price,
            category: 'custom',
            image: "https://images.unsplash.com/photo-1495147400074-15f5e4c2974b?w=800&auto=format&fit=crop&q=40",
            descriptionTh: 'เมนูพิเศษสั่งทำ',
            descriptionEn: 'Custom requested menu item',
            isPopular: false,
            prepTime: 15,
            ingredients: [],
            inStock: true
          },
          quantity: it.quantity,
          customizations: it.customizations || {}
        };
      } else if (realItem) {
        return {
          menuItem: realItem,
          quantity: it.quantity,
          customizations: it.customizations || {}
        };
      } else {
        return {
          menuItem: {
            id: it.menuItemId,
            nameTh: it.nameTh,
            nameEn: it.nameEn,
            price: it.price,
            category: 'other',
            image: "https://images.unsplash.com/photo-1495147400074-15f5e4c2974b?w=800&auto=format&fit=crop&q=40",
            descriptionTh: 'เมนูในบิลเดิม',
            descriptionEn: 'Original ordered menu item',
            isPopular: false,
            prepTime: 10,
            ingredients: [],
            inStock: true
          },
          quantity: it.quantity,
          customizations: it.customizations || {}
        };
      }
    });

    setCart(cartItems);
    setEditingOrder(order);
    setCustomerName(order.customerName);
    setDineInType(order.dineInType);
    if (order.dineInType === 'dine-in') {
      setTableNumber(order.tableNumber || '');
    } else {
      setDeliveryAddress(order.deliveryAddress || '');
      setPhoneNumber(order.phone || '');
    }
    setLastPlacedOrder(null); // Switch off receipt view so they see cart edit screen
    setOrderSuccessMsg(null);
    
    // Scroll to cart section
    const cartSec = document.getElementById('cart_section');
    if (cartSec) {
      cartSec.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const cancelEditingOrder = () => {
    setCart([]);
    setEditingOrder(null);
    setCustomerName('');
    setDeliveryAddress('');
    setPhoneNumber('');
    setPaymentMethod('cash');
    setPaymentSlip('');
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors('');

    if (!editingOrder) return;

    if (cart.length === 0) {
      setFormErrors('ไม่มีรายการในตะกร้าอาหารของคุณ กรุณาเลือกอาหารก่อนทำการบันทึก');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const payload = {
        items: cart.map(c => ({
          menuItemId: c.menuItem.id,
          nameTh: c.menuItem.nameTh,
          nameEn: c.menuItem.nameEn,
          price: c.menuItem.price,
          quantity: c.quantity,
          customizations: c.customizations
        }))
      };

      const res = await fetch(`/api/orders/${editingOrder.id}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        setLastPlacedOrder(result); // Set it back to the updated order
        setEditingOrder(null); // Leave editing mode!
        setCart([]); // Clear cart
        setCustomerName('');
        setDeliveryAddress('');
        setPhoneNumber('');
        setPaymentMethod('cash');
        setPaymentSlip('');
        alert('บันทึกการแก้ไขออเดอร์ของท่านเรียบร้อยแล้วค่ะ!');
        fetchOrders();
      } else {
        const errData = await res.json();
        setFormErrors(errData.error || 'เกิดข้อผิดพลาดในการบันทึกการแก้ไขบิล');
      }
    } catch (err) {
      setFormErrors('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Order tracker states
  const [searchTrackerName, setSearchTrackerName] = useState('');
  const [trackedOrders, setTrackedOrders] = useState<Order[]>([]);
  const [hasTracked, setHasTracked] = useState(false);

  // Custom Requested Dish states
  const [customDishName, setCustomDishName] = useState('');
  const [customDishNotes, setCustomDishNotes] = useState('');
  const [customDishNameEn, setCustomDishNameEn] = useState('');

  // AI Translation States and Functions
  const [isTranslatingMenu, setIsTranslatingMenu] = useState(false);
  const [isTranslatingCat, setIsTranslatingCat] = useState(false);
  const [isTranslatingCustom, setIsTranslatingCustom] = useState(false);

  const translateText = async (text: string): Promise<string> => {
    if (!text.trim()) return '';
    try {
      const response = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      return data.translatedText || '';
    } catch (error) {
      console.error('Translation error:', error);
      return '';
    }
  };

  const handleMenuThBlur = async () => {
    if (!newMenuTh.trim()) return;
    setIsTranslatingMenu(true);
    const translated = await translateText(newMenuTh);
    if (translated) {
      setNewMenuEn(translated);
    }
    setIsTranslatingMenu(false);
  };

  const handleDescThBlur = async () => {
    if (!newDescTh.trim()) return;
    const translated = await translateText(newDescTh);
    if (translated) {
      setNewDescEn(translated);
    }
  };

  const handleCatThBlur = async () => {
    if (!newCatTh.trim()) return;
    setIsTranslatingCat(true);
    const translated = await translateText(newCatTh);
    if (translated) {
      setNewCatEn(translated);
    }
    setIsTranslatingCat(false);
  };

  const handleCustomThBlur = async () => {
    if (!customDishName.trim()) return;
    setIsTranslatingCustom(true);
    const translated = await translateText(customDishName);
    if (translated) {
      setCustomDishNameEn(translated);
    }
    setIsTranslatingCustom(false);
  };

  // Live-update tracked orders when orders array updates
  useEffect(() => {
    if (hasTracked && searchTrackerName.trim()) {
      const query = searchTrackerName.toLowerCase().trim();
      const results = orders.filter(o => {
        const matchName = o.customerName.toLowerCase().includes(query);
        const matchTable = o.tableNumber && `โต๊ะ #${o.tableNumber}`.toLowerCase().includes(query);
        const matchTablePlain = o.tableNumber && o.tableNumber.toLowerCase().includes(query);
        return matchName || matchTable || matchTablePlain || o.id.toLowerCase().includes(query);
      });
      setTrackedOrders(results);
    } else if (!searchTrackerName.trim()) {
      setTrackedOrders([]);
      setHasTracked(false);
    }
  }, [orders, hasTracked, searchTrackerName]);



  // Fetch initial state from Server
  useEffect(() => {
    fetchMenu();
    fetchCategories();
    fetchOrders();
    fetchAnalytics();
    fetchSettings();
    fetchReservations();

    // Check if table query param exists
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    if (tableParam) {
      setDineInType('dine-in');
      setTableNumber(tableParam);
      setIsScannedTable(true);
    } else {
      setTableNumber('');
      setIsScannedTable(false);
    }
    
    // Auto-refresh orders every 2 seconds in the background to emulate live updates
    const timer = setInterval(() => {
      fetchOrders();
      fetchAnalytics();
      fetchReservations();
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Supabase Real-Time Client Subscription
  useEffect(() => {
    const url = settings.supabaseUrl?.trim() || (import.meta as any).env.VITE_SUPABASE_URL?.trim();
    const key = settings.supabaseAnonKey?.trim() || (import.meta as any).env.VITE_SUPABASE_ANON_KEY?.trim();
    
    console.log('[Supabase Real-time] Checking config:', { url, key });

    if (!url || typeof url !== 'string' || !url.startsWith('http') || !key || url === 'YOUR_SUPABASE_URL_HERE' || key === 'YOUR_SUPABASE_ANON_KEY_HERE') {
      console.log('[Supabase Real-time] Skipping connection: Config is incomplete or invalid.');
      return;
    }

    try {
      console.log('Connecting to Supabase Real-time:', url);
      const supabase = createClient(url, key);
      
      // Subscribe to orders real-time channel
      const ordersChannel = supabase
        .channel('realtime_orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          console.log('Real-Time Order Update received:', payload);
          fetchOrders();
          fetchAnalytics();
        })
        .subscribe();

      // Subscribe to reservations real-time channel
      const reservationsChannel = supabase
        .channel('realtime_reservations')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, (payload) => {
          console.log('Real-Time Reservation Update received:', payload);
          fetchReservations();
        })
        .subscribe();

      // Subscribe to settings real-time channel
      const settingsChannel = supabase
        .channel('realtime_settings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_settings' }, (payload) => {
          console.log('Real-Time Settings Update received:', payload);
          fetchSettings();
        })
        .subscribe();

      // Subscribe to menu real-time channel
      const menuChannel = supabase
        .channel('realtime_menu')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, (payload) => {
          console.log('Real-Time Menu Update received:', payload);
          fetchMenu();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(ordersChannel);
        supabase.removeChannel(reservationsChannel);
        supabase.removeChannel(settingsChannel);
        supabase.removeChannel(menuChannel);
      };
    } catch (e) {
      console.error('Failed to configure client-side Supabase real-time:', e);
    }
  }, [settings.supabaseUrl, settings.supabaseAnonKey]);

  // Play chime when order count increases
  useEffect(() => {
    if (orders.length > 0) {
      if (prevOrdersCount > 0 && orders.length > prevOrdersCount) {
        // A new order has arrived! Play sweet double bell
        playChime(659.25, 0.2); // E5
        setTimeout(() => playChime(880.00, 0.4), 150); // A5
      }
      setPrevOrdersCount(orders.length);
    }
  }, [orders, prevOrdersCount]);

  const fetchMenu = async () => {
    try {
      const res = await fetch('/api/menu');
      if (res.ok) {
        const data = await res.json();
        setMenuItems(data);
      }
    } catch (err) {
      console.error("Error fetching menu:", err);
    }
  };

  const getStoreStatus = () => {
    if (settings.isClosedTemporarily) {
      return { isOpen: false, reason: 'ขณะนี้ร้านปิดให้บริการชั่วคราว (Temporarily Closed)' };
    }

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    if (settings.closedDays && settings.closedDays.includes(currentDay)) {
      const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
      return { isOpen: false, reason: `วันนี้ร้านปิดทำการประจำสัปดาห์ (${dayNames[currentDay]})` };
    }

    const openTime = settings.openTime || '09:00';
    const closeTime = settings.closeTime || '21:00';

    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeMinutes = currentHours * 60 + currentMinutes;

    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);

    const openTimeMinutes = openH * 60 + openM;
    const closeTimeMinutes = closeH * 60 + closeM;

    if (openTimeMinutes < closeTimeMinutes) {
      if (currentTimeMinutes < openTimeMinutes || currentTimeMinutes >= closeTimeMinutes) {
        return { isOpen: false, reason: `ร้านเปิดให้บริการเฉพาะเวลา ${openTime} - ${closeTime} น.` };
      }
    } else {
      // Overnight hours
      if (currentTimeMinutes >= closeTimeMinutes && currentTimeMinutes < openTimeMinutes) {
        return { isOpen: false, reason: `ร้านเปิดให้บริการเฉพาะเวลา ${openTime} - ${closeTime} น.` };
      }
    }

    return { isOpen: true, reason: '' };
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
        if (data.length > 0 && !newCategory) {
          setNewCategory(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setEditStoreName(data.storeName);
        setEditPromptPayNumber(data.promptPayNumber);
        setEditPromptPayName(data.promptPayName);
        setEditLineChannelAccessToken(data.lineChannelAccessToken || '');
        setEditLineUserId(data.lineUserId || '');
        setEditPhone(data.phone || '081-234-5678');
        setEditTagline(data.tagline || 'Gastronomy & AI Sommelier');
        setEditOpenTime(data.openTime || '09:00');
        setEditCloseTime(data.closeTime || '21:00');
        setEditClosedDays(data.closedDays || []);
        setEditIsClosedTemporarily(data.isClosedTemporarily || false);
        setEditIsReservationEnabled(data.isReservationEnabled !== false);
        setEditIsLoyaltyEnabled(data.isLoyaltyEnabled !== false);
        setEditSupabaseUrl(data.supabaseUrl || '');
        setEditSupabaseAnonKey(data.supabaseAnonKey || '');

        // Dynamic table greeting message
        const params = new URLSearchParams(window.location.search);
        const tableParam = params.get('table');
        if (tableParam) {
          setScannedTableMsg(`ยินดีต้อนรับสู่ ${data.storeName}! ระบบลงทะเบียน โต๊ะ #${tableParam} จาก QR Code เรียบร้อยแล้ว`);
        }
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSuccessMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: editStoreName.trim(),
          promptPayNumber: editPromptPayNumber.trim(),
          promptPayName: editPromptPayName.trim(),
          lineChannelAccessToken: editLineChannelAccessToken.trim(),
          lineUserId: editLineUserId.trim(),
          phone: editPhone.trim(),
          tagline: editTagline.trim(),
          openTime: editOpenTime,
          closeTime: editCloseTime,
          closedDays: editClosedDays,
          isClosedTemporarily: editIsClosedTemporarily,
          isReservationEnabled: editIsReservationEnabled,
          isLoyaltyEnabled: editIsLoyaltyEnabled,
          supabaseUrl: editSupabaseUrl.trim(),
          supabaseAnonKey: editSupabaseAnonKey.trim()
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setSettingsSuccessMsg('บันทึกการตั้งค่าร้านค้าเรียบร้อยแล้ว!');
        setTimeout(() => setSettingsSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error("Error updating settings:", err);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatActionError('');
    if (!newCatTh.trim() || !newCatEn.trim()) {
      setCatActionError('กรุณากรอกข้อมูลภาษาไทยและภาษาอังกฤษ');
      return;
    }
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameTh: newCatTh.trim(),
          nameEn: newCatEn.trim(),
          emoji: newCatEmoji || '🍽️'
        })
      });
      if (res.ok) {
        setNewCatTh('');
        setNewCatEn('');
        setNewCatEmoji('🍽️');
        fetchCategories();
      } else {
        const errData = await res.json();
        setCatActionError(errData.error || 'ไม่สามารถสร้างหมวดหมู่ใหม่ได้');
      }
    } catch (err) {
      setCatActionError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleDeleteCategory = (id: string) => {
    setConfirmDialog({
      title: 'ยืนยันการลบหมวดหมู่',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่นี้? เมนูอาหารที่อยู่ในหมวดหมู่นี้จะย้ายไปอยู่ที่หมวดหมู่ "อื่นๆ" อัตโนมัติ',
      confirmText: 'ลบหมวดหมู่',
      cancelText: 'ยกเลิก',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/categories/${id}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            fetchCategories();
            fetchMenu();
          } else {
            const errData = await res.json();
            alert(errData.error || 'ไม่สามารถลบหมวดหมู่ได้');
          }
        } catch (err) {
          console.error("Error deleting category:", err);
        }
      }
    });
  };

  const handleTrackOrders = () => {
    if (!searchTrackerName.trim()) {
      setTrackedOrders([]);
      setHasTracked(false);
      return;
    }
    const query = searchTrackerName.toLowerCase().trim();
    const results = orders.filter(o => {
      const matchName = o.customerName.toLowerCase().includes(query);
      const matchTable = o.tableNumber && `โต๊ะ #${o.tableNumber}`.toLowerCase().includes(query);
      const matchTablePlain = o.tableNumber && o.tableNumber.toLowerCase().includes(query);
      return matchName || matchTable || matchTablePlain || o.id.toLowerCase().includes(query);
    });
    setTrackedOrders(results);
    setHasTracked(true);
  };

  const handleCustomRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDishName.trim()) return;

    // Create a virtual MenuItem
    const virtualItem: MenuItem = {
      id: "custom-written",
      nameTh: `${customDishName.trim()} (${customDishNotes.trim() || 'เมนูสั่งทำพิเศษ'})`,
      nameEn: customDishNameEn ? `${customDishNameEn.trim()} (${customDishNotes.trim() || 'Custom Request'})` : "Custom Requested Menu Item",
      price: 0, // initially 0, admin sets price
      image: "https://images.unsplash.com/photo-1495147400074-15f5e4c2974b?w=800&auto=format&fit=crop&q=40", // beautiful neutral food image
      category: "custom",
      descriptionTh: `เมนูพิเศษระบุเอง: ${customDishNotes.trim() || 'ไม่มีหมายเหตุ'} (รอกำหนดราคาโดยร้านค้า)`,
      descriptionEn: customDishNameEn ? `Custom request: ${customDishNameEn.trim()} (waiting for admin to set price)` : `Custom requested item (wait for admin to assign price)`,
      ingredients: [],
      prepTime: 15,
      isPopular: false,
      inStock: true
    };

    const cartItem: CartItem = {
      menuItem: virtualItem,
      quantity: 1,
      customizations: {
        notes: customDishNotes.trim() || undefined
      }
    };

    setCart(prev => {
      // Find if we already have the exact same custom request
      const existing = prev.find(item => item.menuItem.id === "custom-written" && item.menuItem.nameTh === virtualItem.nameTh);
      if (existing) {
        return prev.map(item => 
          (item.menuItem.id === "custom-written" && item.menuItem.nameTh === virtualItem.nameTh) 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, cartItem];
    });

    setCustomDishName('');
    setCustomDishNotes('');
    setCustomDishNameEn('');
    alert('เพิ่มเมนูสั่งพิเศษของคุณลงในตะกร้าแล้วค่ะ! สามารถทำการกดสั่งอาหารเพื่อส่งไปที่ห้องครัวได้เลย');
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Error fetching analytics:", err);
    }
  };

  const fetchReservations = async () => {
    try {
      const res = await fetch('/api/reservations');
      if (res.ok) {
        const data = await res.json();
        setReservations(data);
      }
    } catch (err) {
      console.error("Error fetching reservations:", err);
    }
  };

  const submitReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setResLoading(true);
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: resName,
          phone: resPhone,
          date: resDate,
          time: resTime,
          partySize: Number(resPartySize),
          tablePreference: resTablePref,
          specialRequest: resSpecialRequest
        })
      });

      if (res.ok) {
        setResSuccess(true);
        fetchReservations();
        playChime(523.25, 0.4); // Success chime
        // Reset fields
        setResName('');
        setResPhone('');
        setResDate('');
        setResTime('');
        setResPartySize(2);
        setResTablePref('window');
        setResSpecialRequest('');
      } else {
        alert('ไม่สามารถจองโต๊ะอาหารได้ในขณะนี้ กรุณากรอกข้อมูลให้ครบถ้วนและลองอีกครั้งค่ะ');
      }
    } catch (err) {
      console.error("Error booking table:", err);
    } finally {
      setResLoading(false);
    }
  };

  const updateReservationStatus = async (id: string, status: 'pending' | 'confirmed' | 'cancelled') => {
    try {
      const res = await fetch(`/api/reservations/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchReservations();
        playChime(440, 0.15); // Simple click chime
      }
    } catch (err) {
      console.error("Error updating reservation status:", err);
    }
  };

  const deleteReservation = async (id: string) => {
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchReservations();
        playChime(330, 0.25); // simple chime for deletion
        setDeletingResId(null);
      }
    } catch (err) {
      console.error("Error deleting reservation:", err);
    }
  };

  const toggleItemAssignment = (itemIdx: number, personIdx: number) => {
    const current = itemAssignments[itemIdx] || [];
    const updated = current.includes(personIdx)
      ? current.filter(x => x !== personIdx)
      : [...current, personIdx];
    setItemAssignments({
      ...itemAssignments,
      [itemIdx]: updated
    });
  };

  const handleAddSommelierItem = (itemId: string) => {
    const item = menuItems.find(m => m.id === itemId);
    if (item) {
      handleOpenCustomize(item);
      setIsSommelierOpen(false); // Close AI sommelier drawer
    }
  };

  const sendSommelierMessage = async (textToSend?: string) => {
    const text = textToSend || sommelierInput;
    if (!text.trim()) return;

    const updatedMessages = [...sommelierMessages, { sender: 'user' as const, text }];
    setSommelierMessages(updatedMessages);
    setSommelierInput('');
    setIsSommelierLoading(true);

    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          currentCart: cart.map(item => ({
            name: item.menuItem.nameTh,
            qty: item.quantity,
            customizations: item.customizations
          }))
        })
      });

      if (res.ok) {
        const data = await res.json();
        const aiResponse = data.recommendation || data.text || "ขออภัยด้วยครับ ระบบประมวลผลแนะนำเมนูขัดข้องชั่วคราว ลองเลือกเมนูแสนอร่อยอื่นๆ ในหน้าร้านได้เลยครับ";
        
        // Scan response text for menu items
        const matchedItemIds: string[] = [];
        menuItems.forEach(item => {
          if (
            aiResponse.toLowerCase().includes(item.nameTh.toLowerCase()) || 
            aiResponse.toLowerCase().includes(item.nameEn.toLowerCase())
          ) {
            matchedItemIds.push(item.id);
          }
        });

        setSommelierMessages([
          ...updatedMessages,
          { sender: 'sommelier' as const, text: aiResponse, items: matchedItemIds }
        ]);
        playChime(783.99, 0.25); // G5 chime
      } else {
        setSommelierMessages([
          ...updatedMessages,
          { sender: 'sommelier' as const, text: "ขออภัยครับ ขณะนี้ระบบตอบรับกำลังออฟไลน์ สามารถสั่งสินค้าตรงจากเมนูได้ทันทีเลยครับ 🍷" }
        ]);
      }
    } catch (err) {
      console.error("Sommelier connection error:", err);
      setSommelierMessages([
        ...updatedMessages,
        { sender: 'sommelier' as const, text: "ขออภัยด้วยครับ มีข้อผิดพลาดในระบบการเชื่อมต่อ ลองใหม่อีกครั้งครับ" }
      ]);
    } finally {
      setIsSommelierLoading(false);
    }
  };

  // Cart operations
  const handleOpenCustomize = (item: MenuItem) => {
    if (!item.inStock) return;
    setCustomizingItem(item);
    // Reset defaults based on category name/id
    const catLower = item.category.toLowerCase();
    setTempSweetness('Standard');
    setTempSpiciness((catLower.includes('main') || catLower.includes('appetizer')) ? 'Medium' : 'None');
    setTempTemperature('Iced');
    setTempNotes('');
    setTempServiceType(dineInType === 'dine-in' ? 'dine-in' : 'takeaway');

    if (isNoodleDish(item)) {
      setTempNoodleType('เส้นเล็ก');
    } else {
      setTempNoodleType('');
    }

    if (isRiceDish(item)) {
      setTempRiceType('ข้าวสวย');
    } else {
      setTempRiceType('');
    }

    const initialSelections: { [groupName: string]: OptionChoice } = {};
    if (item.optionGroups) {
      item.optionGroups.forEach(group => {
        if (group.required && group.choices.length > 0) {
          initialSelections[group.name] = group.choices[0];
        }
      });
    }
    setTempOptionSelections(initialSelections);
  };

  const handleConfirmCustomize = () => {
    if (!customizingItem) return;

    const custom: Customizations = {};
    const catLower = customizingItem.category.toLowerCase();
    const isBeverage = catLower.includes('beverage') || catLower.includes('drink');
    const isSpicy = catLower.includes('main') || catLower.includes('appetizer') || catLower.includes('spicy') || catLower.includes('curry');

    if (isBeverage) {
      custom.sweetness = tempSweetness;
      custom.temperature = tempTemperature;
    }
    if (isSpicy) {
      custom.spiciness = tempSpiciness;
    }
    if (isNoodleDish(customizingItem)) {
      custom.noodleType = tempNoodleType;
    }
    if (isRiceDish(customizingItem)) {
      custom.riceType = tempRiceType;
    }
    if (tempNotes.trim()) {
      custom.notes = tempNotes;
    }
    if (tempServiceType) {
      custom.serviceType = tempServiceType;
    }

    if (Object.keys(tempOptionSelections).length > 0) {
      custom.optionSelections = tempOptionSelections;
    }

    // Check if matching item with identical customization is already in cart
    const existingIndex = cart.findIndex(c => 
      c.menuItem.id === customizingItem.id && 
      JSON.stringify(c.customizations) === JSON.stringify(custom)
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { menuItem: customizingItem, quantity: 1, customizations: custom }]);
    }

    setCustomizingItem(null);
  };

  const updateCartQty = (index: number, delta: number) => {
    const updated = [...cart];
    updated[index].quantity += delta;
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
    }
    setCart(updated);
  };

  const removeFromCart = (index: number) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  // Submit Order
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors('');
    
    if (!customerName.trim()) {
      setFormErrors('กรุณาระบุชื่อผู้สั่งอาหาร');
      return;
    }
    if (cart.length === 0) {
      setFormErrors('ไม่มีรายการในตะกร้าอาหารของคุณ');
      return;
    }
    if (dineInType === 'delivery') {
      if (!deliveryAddress.trim()) {
        setFormErrors('กรุณากรอกที่อยู่สำหรับจัดส่ง');
        return;
      }
      if (!phoneNumber.trim()) {
        setFormErrors('กรุณากรอกเบอร์โทรศัพท์สำหรับติดต่อ');
        return;
      }
    }
    if (paymentMethod === 'promptpay' && !paymentSlip) {
      setFormErrors('กรุณาอัปโหลดรูปภาพสลิปการโอนเงินเพื่อยืนยันการชำระเงินด้วยพร้อมเพย์');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const payload = {
        customerName,
        dineInType,
        tableNumber: dineInType === 'dine-in' ? tableNumber : undefined,
        deliveryAddress: dineInType === 'delivery' ? deliveryAddress : undefined,
        phone: dineInType === 'delivery' ? phoneNumber : undefined,
        paymentMethod,
        paymentSlip: paymentMethod === 'promptpay' ? paymentSlip : undefined,
        items: cart.map(c => ({
          menuItemId: c.menuItem.id,
          quantity: c.quantity,
          customizations: c.customizations
        }))
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        setOrderSuccessMsg({ number: result.orderNumber, id: result.id });
        setLastPlacedOrder(result); // Store full order object
        setSearchTrackerName(`โต๊ะ #${result.tableNumber || 'ปกติ'} / #{result.orderNumber}`);
        
        setCart([]); // Clear cart
        setCustomerName('');
        setDeliveryAddress('');
        setPhoneNumber('');
        setPaymentMethod('cash');
        setPaymentSlip('');
        // Refresh server lists
        fetchOrders();
        fetchAnalytics();
      } else {
        const errData = await res.json();
        setFormErrors(errData.error || 'เกิดข้อผิดพลาดในการสร้างออเดอร์');
      }
    } catch (err) {
      setFormErrors('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Gemini AI Sommelier Interaction
  const handleAiConsult = async (customPrompt?: string) => {
    const queryText = customPrompt || aiPrompt;
    if (!queryText.trim() && !cart.length) {
      setAiError('กรุณากรอกคำถามหรือเลือกเมนูในตะกร้าก่อนปรึกษา AI Sommelier');
      return;
    }

    setIsAiLoading(true);
    setAiError('');
    setAiResponse('');

    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: queryText,
          currentCart: cart.map(c => ({
            name: c.menuItem.nameEn,
            quantity: c.quantity
          }))
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAiResponse(data.responseText);
        if (!customPrompt) setAiPrompt(''); // clear only if custom input used
      } else {
        setAiError('Sommelier ไม่สามารถให้คำแนะนำได้ชั่วคราว กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err) {
      setAiError('การสื่อสารล้มเหลว กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Admin State modifications
  const handleUpdateStatus = async (orderId: string, status: Order['status']) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchOrders();
        fetchAnalytics();
      }
    } catch (err) {
      console.error("Error updating order status:", err);
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    setConfirmDialog({
      title: 'ยืนยันการลบบิลอาหาร',
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบบิล ${orderId} นี้ออกจากระบบอย่างถาวร? ออเดอร์นี้และข้อมูลทั้งหมดจะไม่สามารถกู้คืนได้`,
      confirmText: 'ลบออกทันที',
      cancelText: 'ยกเลิก',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/orders/${orderId}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            fetchOrders();
            fetchAnalytics();
          } else {
            const errData = await res.json();
            alert(errData.error || 'ไม่สามารถลบออเดอร์ได้');
          }
        } catch (err) {
          console.error("Error deleting order:", err);
        }
      }
    });
  };

  const handleUpdateItemPrice = async (orderId: string, itemIndex: number, newPrice: number) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/update-item-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIndex, price: newPrice })
      });
      if (res.ok) {
        fetchOrders();
        fetchAnalytics();
      } else {
        const errData = await res.json();
        alert(errData.error || 'ไม่สามารถแก้ไขราคาได้');
      }
    } catch (err) {
      console.error("Error updating item price:", err);
    }
  };

  const handleToggleStock = async (itemId: string) => {
    try {
      const res = await fetch(`/api/menu/${itemId}/toggle-stock`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchMenu();
      }
    } catch (err) {
      console.error("Error toggling item stock:", err);
    }
  };

  const handleDeleteMenuItem = (itemId: string) => {
    setConfirmDialog({
      title: 'ยืนยันการลบเมนูอาหาร',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการลบรายการอาหารนี้อย่างถาวร?',
      confirmText: 'ลบเมนูถาวร',
      cancelText: 'ยกเลิก',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/menu/${itemId}`, {
            method: 'DELETE'
          });
          if (res.ok) {
            fetchMenu();
            fetchAnalytics();
          } else {
            alert('ไม่สามารถลบรายการอาหารได้');
          }
        } catch (err) {
          console.error("Error deleting menu item:", err);
        }
      }
    });
  };

  const handleAddOptionGroup = () => {
    const newGroup: OptionGroup = {
      id: 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: '',
      required: false,
      choices: [{ name: '', price: 0 }]
    };
    setNewOptionGroups([...newOptionGroups, newGroup]);
  };

  const handleRemoveOptionGroup = (groupId: string) => {
    setNewOptionGroups(newOptionGroups.filter(g => g.id !== groupId));
  };

  const handleUpdateOptionGroup = (groupId: string, updated: Partial<OptionGroup>) => {
    setNewOptionGroups(newOptionGroups.map(g => {
      if (g.id === groupId) {
        return { ...g, ...updated };
      }
      return g;
    }));
  };

  const handleAddChoice = (groupId: string) => {
    setNewOptionGroups(newOptionGroups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          choices: [...g.choices, { name: '', price: 0 }]
        };
      }
      return g;
    }));
  };

  const handleRemoveChoice = (groupId: string, choiceIndex: number) => {
    setNewOptionGroups(newOptionGroups.map(g => {
      if (g.id === groupId) {
        const newChoices = [...g.choices];
        newChoices.splice(choiceIndex, 1);
        return { ...g, choices: newChoices };
      }
      return g;
    }));
  };

  const handleUpdateChoice = (groupId: string, choiceIndex: number, updated: Partial<OptionChoice>) => {
    setNewOptionGroups(newOptionGroups.map(g => {
      if (g.id === groupId) {
        const newChoices = g.choices.map((c, idx) => {
          if (idx === choiceIndex) {
            return { ...c, ...updated };
          }
          return c;
        });
        return { ...g, choices: newChoices };
      }
      return g;
    }));
  };

  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenuActionError('');

    if (!newMenuTh.trim() || !newMenuEn.trim() || !newPrice.trim()) {
      setMenuActionError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    try {
      const payload = {
        nameTh: newMenuTh,
        nameEn: newMenuEn,
        descriptionTh: newDescTh,
        descriptionEn: newDescEn,
        price: Number(newPrice),
        category: newCategory,
        image: newImage || undefined,
        prepTime: Number(newPrepTime) || 10,
        ingredients: newIngredients ? newIngredients.split(',').map(i => i.trim()) : [],
        optionGroups: newOptionGroups
      };

      const url = editingMenuItem ? `/api/menu/${editingMenuItem.id}` : '/api/menu';
      const method = editingMenuItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Reset and refresh
        setNewMenuTh('');
        setNewMenuEn('');
        setNewDescTh('');
        setNewDescEn('');
        setNewPrice('');
        setNewImage('');
        setNewPrepTime('15');
        setNewIngredients('');
        setNewOptionGroups([]);
        setEditingMenuItem(null);
        setIsAddingNewItem(false);
        fetchMenu();
      } else {
        setMenuActionError(editingMenuItem ? 'ไม่สามารถแก้ไขข้อมูลเมนูอาหารได้สำเร็จ' : 'ไม่สามารถเพิ่มเมนูใหม่ได้สำเร็จ');
      }
    } catch (err) {
      setMenuActionError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  // Helper selectors
  const filteredMenuItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = 
      item.nameTh.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.descriptionTh.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.descriptionEn.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const cartTotal = cart.reduce((sum, item) => {
    let extra = 0;
    if (item.customizations?.optionSelections) {
      (Object.values(item.customizations.optionSelections) as OptionChoice[]).forEach((choice) => {
        extra += choice.price || 0;
      });
    }
    return sum + ((item.menuItem.price + extra) * item.quantity);
  }, 0);
  const cartGrandTotal = Math.max(0, cartTotal - (appliedDiscount?.amount || 0));

  // Get active queue position among all active orders (pending, preparing, cooking, ready)
  const getOrderActiveQueueNumber = (orderId: string): number => {
    const activeStatuses = ['pending', 'preparing', 'cooking', 'ready'];
    const activeOrders = orders
      .filter(o => activeStatuses.includes(o.status))
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.orderNumber.localeCompare(b.orderNumber);
      });
    
    const index = activeOrders.findIndex(o => o.id === orderId);
    return index !== -1 ? index + 1 : -1;
  };

  const filteredOrders = orders.filter(order => {
    if (adminOrderFilter === 'all') return true;
    if (adminOrderFilter === 'pending') return order.status === 'pending';
    if (adminOrderFilter === 'active') return ['preparing', 'cooking', 'ready'].includes(order.status);
    if (adminOrderFilter === 'completed') return order.status === 'completed';
    if (adminOrderFilter === 'cancelled') return order.status === 'cancelled';
    return true;
  }).sort((a, b) => {
    if (adminOrderFilter === 'completed' || adminOrderFilter === 'cancelled') {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  return (
    <div id="app_root" className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      
      {/* Top Professional Navigation Bar */}
      <nav id="top_nav" className="h-20 shrink-0 bg-[#1E293B] border-b border-white/10 flex items-center justify-between px-6 md:px-10 shadow-md sticky top-0 z-40">
        <div id="brand_container" className="flex items-center gap-4">
          <div id="brand_icon" className="w-12 h-12 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Utensils id="utensils_svg" className="w-7 h-7 text-white" />
          </div>
          <div className="leading-tight">
            <span id="brand_text" className="text-xl md:text-2xl font-serif font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-amber-200 to-amber-400">
              {settings.storeName}
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="text-[10px] text-orange-400 font-mono tracking-widest uppercase">{settings.tagline || 'Gastronomy & AI Sommelier'}</p>
              {settings.phone && (
                <a 
                  href={`tel:${settings.phone}`} 
                  className="text-[9px] bg-slate-950 text-emerald-400 hover:text-emerald-300 px-1.5 py-0.2 rounded font-mono font-medium border border-emerald-500/10 flex items-center gap-1 transition-colors"
                  title="คลิกเพื่อโทรติดต่อร้านค้า"
                >
                  <span className="animate-pulse">●</span>
                  <span>📞 {settings.phone}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Tab Selector Mode togglers */}
        <div id="mode_selector" className="flex items-center gap-4">
          <div className="bg-slate-900/80 p-1.5 rounded-xl border border-white/5 flex gap-1">
            <button 
              id="tab_customer"
              onClick={() => setActiveTab('customer')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all ${
                activeTab === 'customer' 
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/10' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>สั่งอาหาร (Customer Order)</span>
            </button>
            <button 
              id="tab_admin"
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all ${
                activeTab === 'admin' 
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/10' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              <span>จัดการร้าน (Admin Dashboard)</span>
              {orders.filter(o => o.status === 'pending').length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono animate-bounce">
                  {orders.filter(o => o.status === 'pending').length}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'customer' && (
            <div className="flex gap-2">
              {(settings.isReservationEnabled !== false) && (
                <button
                  onClick={() => {
                    setResSuccess(false);
                    setShowReservationModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 border border-white/5 rounded-xl text-xs font-semibold text-slate-200 transition-all shadow-lg shadow-black/20 font-sans"
                >
                  <Calendar className="w-3.5 h-3.5 text-orange-400" />
                  <span className="hidden md:inline">📅 จองโต๊ะล่วงหน้า</span>
                  <span className="md:hidden">📅 จองโต๊ะ</span>
                </button>
              )}
              {(settings.isLoyaltyEnabled !== false) && (
                <button
                  onClick={() => setShowLoyaltyModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 border border-white/5 rounded-xl text-xs font-semibold text-slate-200 transition-all shadow-lg shadow-black/20 font-sans"
                >
                  <Gift className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline">⭐️ สมาชิกสะสมแต้ม</span>
                  <span className="md:hidden">⭐️ สะสมแต้ม</span>
                </button>
              )}
            </div>
          )}

          <div id="user_profile" className="hidden sm:flex items-center gap-3 border-l border-white/10 pl-5">
            <div className="text-right">
              <p className="text-xs text-slate-400">ยินดีต้อนรับ</p>
              <p className="text-sm font-semibold text-slate-200">Executive Guest</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center font-serif text-amber-400 font-bold">
              A
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container Layout */}
      <div id="main_content_wrapper" className="flex-1 overflow-auto">
        
        {/* ======================================================== */}
        {/* CUSTOMER PORTAL VIEW                                     */}
        {/* ======================================================== */}
        {activeTab === 'customer' && (
          <div id="customer_portal" className="grid grid-cols-1 xl:grid-cols-12 gap-8 p-6 md:p-8 max-w-7xl mx-auto items-start">
            
            {/* Left Portion: Catalog & Recommendations (7 cols) */}
            <div id="catalog_section" className="xl:col-span-8 space-y-8">
              
              {/* Store Closed Banner */}
              {(() => {
                const status = getStoreStatus();
                if (!status.isOpen) {
                  return (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-3xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-rose-200 text-xs animate-fadeIn shadow-xl relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl animate-pulse">🛑</span>
                        <div>
                          <p className="font-bold text-sm text-white mb-0.5">ขณะนี้ร้านปิดให้บริการสั่งอาหาร (Store is Closed)</p>
                          <p className="text-[11px] text-slate-400 font-sans">
                            {status.reason} ลูกค้ายังคงสามารถเลือกดูเมนูต่างๆ ได้ แต่ระบบจะไม่รับการกดสั่งซื้อในช่วงเวลานี้ค่ะ
                          </p>
                        </div>
                      </div>
                      {settings.phone && (
                        <a 
                          href={`tel:${settings.phone}`}
                          className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold py-1.5 px-4 rounded-xl transition-all shadow-md shadow-rose-500/20 whitespace-nowrap self-stretch md:self-auto text-center font-sans"
                        >
                          📞 โทรติดต่อร้าน
                        </a>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              {scannedTableMsg && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-3xl p-5 flex justify-between items-center text-orange-200 text-xs animate-fadeIn shadow-xl relative overflow-hidden">
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-orange-500"></div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">✨</span>
                    <div>
                      <p className="font-bold text-sm text-white mb-0.5">{scannedTableMsg}</p>
                      <p className="text-[11px] text-slate-400">ระบบเปลี่ยนโหมดเป็น "ทานที่ร้าน" และเลือก <strong className="text-orange-400 font-mono text-xs">โต๊ะ #{tableNumber}</strong> ให้คุณโดยอัตโนมัติเรียบร้อยแล้วค่ะ</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setScannedTableMsg('')}
                    className="text-slate-500 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Header Showcase with Interactive Search */}
              <div id="welcome_banner" className="bg-gradient-to-r from-slate-800 to-slate-900 border border-white/5 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xl">
                <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-[url('https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&auto=format&fit=crop&q=40')] bg-cover bg-center opacity-10 rounded-r-3xl pointer-events-none"></div>
                <div className="relative z-10 max-w-lg space-y-3">
                  <span className="px-3 py-1 bg-orange-500/20 text-orange-400 text-xs font-semibold uppercase tracking-widest rounded-full">
                    Aura Premium Experience
                  </span>
                  <h1 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-tight leading-tight">
                    ค้นพบรสชาติที่รังสรรค์อย่างวิจิตรบรรจง
                  </h1>
                  <p className="text-slate-400 text-sm md:text-base">
                    เมนูคัดพิเศษเกรดพรีเมียมจากเชฟผู้มีประสบการณ์ พร้อมระบบจับคู่เครื่องดื่มและอาหารโดยปัญญาประดิษฐ์ (AI Sommelier)
                  </p>
                  
                  {/* Search box */}
                  <div className="pt-2">
                    <div className="relative">
                      <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="ค้นหาเมนูยอดฮิต, สเต็กวากิว, ผัดไทยล็อบสเตอร์, ของหวาน..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-950/80 hover:bg-slate-950 border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 text-sm transition-all shadow-inner"
                      />
                    </div>
                  </div>
                </div>
            </div>

              {/* Custom Menu Request Input Card */}
              <div className="bg-[#1E293B]/60 rounded-3xl border border-dashed border-orange-500/30 p-5 shadow-lg space-y-4 relative overflow-hidden mb-6">
                <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-bl from-orange-500/10 to-transparent pointer-events-none rounded-bl-full"></div>
                <div className="flex items-start gap-3">
                  <div className="bg-orange-500/10 p-2.5 rounded-xl text-orange-400 shrink-0">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-serif text-sm font-bold text-white">💡 พิมพ์สั่งอาหารตามใจคุณ (Custom Order Request)</h3>
                    <p className="text-[11px] text-slate-400">หากคุณมีเมนูพิเศษที่อยากให้เชฟรังสรรค์ให้ หรือต้องการสั่งอาหารนอกเหนือจากรายการปกติ สามารถระบุได้ที่นี่ แล้วเชฟ/ผู้ดูแลร้านค้าจะเป็นผู้พิจารณาตั้งราคาให้ตามความเหมาะสมภายหลังค่ะ</p>
                  </div>
                </div>

                <form onSubmit={handleCustomRequestSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-6">
                    <label className="block text-[10px] text-slate-400 mb-1">ระบุชื่ออาหารหรือเมนูที่อยากทาน *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="เช่น ข้าวผัดกะเพราเนื้อโคขุนสับไข่ดาวกรอบๆ หรือ แซลมอนซาชิมิจานใหญ่"
                      value={customDishName}
                      onChange={(e) => setCustomDishName(e.target.value)}
                      onBlur={handleCustomThBlur}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-xl text-xs text-slate-200 focus:outline-none"
                    />
                    {isTranslatingCustom && (
                      <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1 animate-pulse">
                        <span className="inline-block w-2 h-2 border border-amber-400 border-t-transparent rounded-full animate-spin"></span>
                        กำลังแปลเป็นอังกฤษด้วย AI...
                      </p>
                    )}
                    {!isTranslatingCustom && customDishNameEn && (
                      <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                        ✨ แปลเป็นอังกฤษ: <span className="font-semibold italic">{customDishNameEn}</span>
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-[10px] text-slate-400 mb-1">หมายเหตุเพิ่มเติม (ความเผ็ด, แพ้อาหาร, อื่นๆ)</label>
                    <input 
                      type="text" 
                      placeholder="เช่น ขอเผ็ดน้อย ไม่ใส่ผงชูรส"
                      value={customDishNotes}
                      onChange={(e) => setCustomDishNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-xl text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-lg shadow-orange-500/15 flex items-center justify-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>สั่งพิเศษ</span>
                    </button>
                  </div>
                </form>
              </div>



              {/* Categorization Swiper bar */}
              <div id="category_bar" className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide flex items-center gap-2 transition-all border ${
                      selectedCategory === 'all' 
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-lg shadow-orange-500/15' 
                        : 'bg-slate-800/60 text-slate-300 border-white/5 hover:border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <span>🍽️</span>
                    <span>ทั้งหมด (All)</span>
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide flex items-center gap-2 transition-all border ${
                        selectedCategory === cat.id 
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-lg shadow-orange-500/15' 
                          : 'bg-slate-800/60 text-slate-300 border-white/5 hover:border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.nameTh} ({cat.nameEn})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu Grid Catalog */}
              <div id="menu_catalog_grid" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {filteredMenuItems.length === 0 ? (
                  <div className="col-span-full py-16 text-center space-y-3 bg-slate-800/20 border border-dashed border-white/5 rounded-2xl">
                    <Info className="w-12 h-12 text-slate-500 mx-auto" />
                    <p className="text-slate-400 font-medium">ไม่พบเมนูอาหารที่คุณต้องการค้นหา</p>
                    <button 
                      onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }} 
                      className="text-orange-400 hover:text-orange-300 text-xs font-bold underline"
                    >
                      ล้างคำค้นหา
                    </button>
                  </div>
                ) : (
                  filteredMenuItems.map((item) => (
                    <div 
                      key={item.id} 
                      className="group bg-[#1E293B]/70 rounded-2xl border border-white/5 overflow-hidden hover:border-orange-500/30 transition-all duration-300 flex flex-col justify-between shadow-lg hover:shadow-orange-500/5 hover:-translate-y-1"
                    >
                      <div>
                        {/* Food Image Banner */}
                        <div className="h-48 relative overflow-hidden bg-slate-900">
                          <img 
                            src={item.image} 
                            alt={item.nameEn} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#1E293B] via-transparent to-transparent opacity-60"></div>
                          
                          {/* Absolute over-layers */}
                          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                            {item.isPopular && (
                              <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider shadow-md">
                                POPULAR 🔥
                              </span>
                            )}
                            <span className="bg-slate-900/90 text-slate-200 text-[10px] px-2.5 py-1 rounded-md font-medium tracking-wide">
                              ⏱️ {item.prepTime} นาที
                            </span>
                          </div>

                          {!item.inStock && (
                            <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center backdrop-blur-xs">
                              <span className="bg-red-500/20 border border-red-500 text-red-400 font-bold text-sm px-4 py-2 rounded-xl">
                                หมดชั่วคราว (Out of Stock)
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Description content */}
                        <div className="p-5 space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="font-serif text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
                              {item.nameTh}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-400 italic font-mono font-medium">{item.nameEn}</p>
                          <p className="text-slate-300 text-xs line-clamp-3 leading-relaxed mt-1">
                            {item.descriptionTh}
                          </p>
                          
                          {/* Ingredients tags */}
                          {item.ingredients && item.ingredients.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-2">
                              {item.ingredients.map((ing, i) => (
                                <span key={i} className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                                  {ing}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Buy action */}
                      <div className="px-5 pb-5 pt-3 border-t border-white/5 flex items-center justify-between">
                        <div className="leading-tight">
                          <span className="text-[10px] text-slate-400 block uppercase tracking-wider">ราคา (THB)</span>
                          <span className="text-xl font-bold font-mono text-amber-400">
                            ฿{formatPrice(item.price)}
                          </span>
                        </div>
                        
                        <button
                          onClick={() => handleOpenCustomize(item)}
                          disabled={!item.inStock}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all ${
                            item.inStock 
                              ? 'bg-orange-500 hover:bg-orange-600 text-white hover:shadow-md hover:shadow-orange-500/20 active:scale-95' 
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                          <span>เลือกสั่ง</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Premium AI Culinary Sommelier Sidebar/Section */}
              <div id="ai_sommelier_section" className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-indigo-950/20 rounded-3xl border border-indigo-500/20 p-6 md:p-8 space-y-5 shadow-2xl relative overflow-hidden">
                <div className="absolute -right-16 -top-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -left-16 -bottom-16 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl"></div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-500/10">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-serif font-semibold text-white flex items-center gap-2">
                        ผู้เชี่ยวชาญด้านอาหารและไวน์ (AI Culinary Sommelier)
                        <span className="bg-indigo-500/20 text-indigo-400 text-[10px] px-2 py-0.5 rounded-md font-mono">Gemini 3.5</span>
                      </h3>
                      <p className="text-slate-400 text-xs">ปรึกษาเมนูที่เข้ากัน เลือกเครื่องดื่มที่เหมาะสม หรือปรับสูตรอาหารให้ตรงใจคุณ</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Sample suggestions pills */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { text: "สเต็กวากิวริบอาย ทานคู่กับเครื่องดื่มตัวไหนดีที่สุด?", label: "🥩 สเต็กริบอาย + ดริ้งค์" },
                      { text: "แนะนำเซ็ตอาหารค่ำโรแมนติกสําหรับสองคนพร้อมของหวานแสนอร่อย", label: "🕯️ ดินเนอร์สองคน" },
                      { text: "ขอรายการเมนูมังสวิรัติ (Vegetarian) และเห็ดทรัฟเฟิลในร้าน", label: "🥗 เมนูมังสวิรัติ" }
                    ].map((pill, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setAiPrompt(pill.text);
                          handleAiConsult(pill.text);
                        }}
                        className="text-[11px] bg-white/5 hover:bg-indigo-500/15 text-indigo-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/5 hover:border-indigo-500/30 transition-all text-left"
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>

                  {/* Sommelier Response Box */}
                  {(aiResponse || isAiLoading || aiError) && (
                    <div className="bg-slate-950/80 rounded-2xl p-5 border border-white/5 text-sm space-y-2 relative shadow-inner">
                      {isAiLoading ? (
                        <div className="flex items-center gap-3 py-4 text-slate-400">
                          <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                          <span className="font-medium animate-pulse">เชฟ Sommelier กำลังพิจารณาและคัดเลือกคำแนะนำอันสมบูรณ์แบบ...</span>
                        </div>
                      ) : aiError ? (
                        <div className="flex items-center gap-2 text-red-400">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{aiError}</span>
                        </div>
                      ) : (
                        <div className="prose prose-invert prose-xs text-slate-200 leading-relaxed space-y-2">
                          <p className="font-serif italic text-indigo-400 text-xs border-b border-white/5 pb-1 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            คำแนะนำระดับมิชลินซอมเมอลิเยร์:
                          </p>
                          <div className="whitespace-pre-line text-xs font-sans">
                            {aiResponse}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Input form */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="เช่น: เมนูช็อกโกแลตลาวาควรจับคู่กับเครื่องดื่มหวานหรือสปาร์คกลิ้ง?"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="flex-1 px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAiConsult();
                      }}
                    />
                    <button
                      onClick={() => handleAiConsult()}
                      disabled={isAiLoading}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-3 rounded-xl text-xs transition-colors shadow-md shadow-indigo-600/10 active:scale-95 flex items-center gap-1"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>ถามซอมเมอลิเยร์</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Portion: Interactive Cart & Order Formulation (4 cols) */}
            <div id="cart_section" className="xl:col-span-4 space-y-6 lg:sticky lg:top-24">
              
              {(() => {
                const livePlacedOrder = lastPlacedOrder ? orders.find(o => o.id === lastPlacedOrder.id) || lastPlacedOrder : null;
                if (livePlacedOrder) {
                  return (
                    /* Gorgeous Detailed Bill Receipt */
                    <div className="bg-[#1E293B] rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex flex-col animate-fadeIn">
                      <div className="p-5 border-b border-white/5 bg-slate-900 flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <h3 className="font-serif font-bold text-white text-lg">บิลของคุณ (Your Bill)</h3>
                        </div>
                        <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-mono font-semibold">
                          #{livePlacedOrder.orderNumber}
                        </span>
                      </div>

                      <div className="p-5 space-y-4">
                        {/* Status Tracker Banner */}
                        <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">สถานะการปรุงอาหาร</span>
                            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">อัปเดตสด</span>
                          </div>

                          {/* Status display */}
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">
                              {livePlacedOrder.status === 'pending' ? '⏳' :
                               livePlacedOrder.status === 'preparing' ? '👨‍🍳' :
                               livePlacedOrder.status === 'cooking' ? '🍳' :
                               livePlacedOrder.status === 'ready' ? '🛎️' :
                               livePlacedOrder.status === 'completed' ? '✅' : '❌'}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">
                                {livePlacedOrder.status === 'pending' ? 'รอร้านรับเรื่อง' :
                                 livePlacedOrder.status === 'preparing' ? 'รับออเดอร์แล้ว กำลังเตรียมปรุง' :
                                 livePlacedOrder.status === 'cooking' ? 'เชฟกำลังปรุงอาหารร้อนๆ' :
                                 livePlacedOrder.status === 'ready' ? 'ปรุงเสร็จแล้ว พร้อมเสิร์ฟ!' :
                                 livePlacedOrder.status === 'completed' ? 'เสิร์ฟเรียบร้อยแล้วค่ะ' : 'ยกเลิกออเดอร์แล้ว'}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {livePlacedOrder.status === 'pending' ? 'ส่งรายละเอียดไปที่กุ๊กในครัวเรียบร้อยแล้วค่ะ' :
                                 livePlacedOrder.status === 'preparing' ? 'กุ๊กรับเรื่องและกำลังล้างหั่นจัดเตรียมวัตถุดิบค่ะ' :
                                 livePlacedOrder.status === 'cooking' ? 'เชฟกำลังลงกระทะผัดทอดอย่างละเมียดละไม' :
                                 livePlacedOrder.status === 'ready' ? 'อาหารพร้อมยกออกจากครัวมาเสิร์ฟที่โต๊ะคุณแล้วค่ะ' :
                                 livePlacedOrder.status === 'completed' ? 'ขอให้อร่อยกับมื้ออาหารพิเศษนี้นะคะ ขอบคุณค่ะ' : 'ออเดอร์ถูกยกเลิก กรุณาสอบถามพนักงาน'}
                              </p>
                            </div>
                          </div>

                          {/* Simple progress bar */}
                          <div className="relative pt-1">
                            <div className="overflow-hidden h-1.5 text-xs flex rounded bg-slate-800">
                              <div 
                                style={{ 
                                  width: livePlacedOrder.status === 'pending' ? '20%' :
                                         livePlacedOrder.status === 'preparing' ? '40%' :
                                         livePlacedOrder.status === 'cooking' ? '70%' :
                                         livePlacedOrder.status === 'ready' ? '90%' :
                                         livePlacedOrder.status === 'completed' ? '100%' : '0%'
                                }}
                                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-1000 ${
                                  livePlacedOrder.status === 'cancelled' ? 'bg-red-500' : 'bg-gradient-to-r from-orange-500 to-emerald-500'
                                }`}
                              ></div>
                            </div>
                          </div>

                          {/* Queue Position */}
                          {getOrderActiveQueueNumber(livePlacedOrder.id) !== -1 && (
                            <div className="pt-2 flex justify-between items-center text-xs border-t border-white/5">
                              <span className="text-slate-400">ลำดับคิวปรุงอาหารของคุณ:</span>
                              <span className="bg-amber-500/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                                คิวที่ {getOrderActiveQueueNumber(livePlacedOrder.id)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Receipt Body */}
                        <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-3.5">
                          <div className="text-center border-b border-white/5 pb-3">
                            <h4 className="font-serif font-bold text-slate-200 text-sm tracking-wide">{settings.storeName}</h4>
                            <p className="text-[10px] text-slate-400">บิลสรุปรายการสั่งซื้ออาหาร</p>
                            {settings.phone && (
                              <p className="text-[9px] text-emerald-400 font-mono">📞 ติดต่อร้าน: {settings.phone}</p>
                            )}
                            <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                              {new Date(livePlacedOrder.timestamp).toLocaleDateString('th-TH')} {new Date(livePlacedOrder.timestamp).toLocaleTimeString('th-TH')}
                            </p>
                          </div>

                          {/* Customer info */}
                          <div className="grid grid-cols-2 text-[11px] text-slate-400 gap-y-1">
                            <span>ผู้สั่ง: <strong className="text-slate-200">{livePlacedOrder.customerName}</strong></span>
                            <span className="text-right">
                              {livePlacedOrder.dineInType === 'dine-in' 
                                ? (livePlacedOrder.tableNumber ? `📍 โต๊ะ #${livePlacedOrder.tableNumber}` : '🍽️ ทานที่ร้าน (สั่งปกติ)')
                                : '🚚 จัดส่ง/สั่งกลับบ้าน'}
                            </span>
                            <span>รหัสบิล: <span className="font-mono text-slate-300">{livePlacedOrder.id}</span></span>
                            <span className="text-right">ชำระ: <strong className="text-orange-400">{livePlacedOrder.paymentMethod === 'promptpay' ? '📱 พร้อมเพย์' : '💵 เงินสด'}</strong></span>
                          </div>

                          {/* Items table */}
                          <div className="border-t border-b border-white/5 py-3 space-y-2.5">
                            {livePlacedOrder.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between text-xs items-start">
                                <div className="min-w-0 flex-1 pr-2">
                                  <div className="flex gap-1 items-baseline">
                                    <span className="font-mono text-slate-400">{it.quantity}x</span>
                                    <span className="font-semibold text-slate-200 truncate">{it.nameTh}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 italic truncate">{it.nameEn}</p>
                                  {it.customizations && Object.keys(it.customizations).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {it.customizations.serviceType && (
                                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                                          it.customizations.serviceType === 'dine-in' 
                                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        }`}>
                                          {it.customizations.serviceType === 'dine-in' ? '🍽️ ทานที่ร้าน' : '🥡 กลับบ้าน'}
                                        </span>
                                      )}
                                      {it.customizations.sweetness && <span className="text-[9px] bg-slate-950 text-blue-300 px-1.5 py-0.2 rounded">หวาน: {it.customizations.sweetness}</span>}
                                      {it.customizations.spiciness && <span className="text-[9px] bg-slate-950 text-red-300 px-1.5 py-0.2 rounded">เผ็ด: {it.customizations.spiciness}</span>}
                                      {it.customizations.noodleType && <span className="text-[9px] bg-slate-950 text-amber-300 px-1.5 py-0.2 rounded">เส้น: {it.customizations.noodleType}</span>}
                                      {it.customizations.riceType && <span className="text-[9px] bg-slate-950 text-emerald-300 px-1.5 py-0.2 rounded">ข้าว: {it.customizations.riceType}</span>}
                                      {it.customizations.optionSelections && (Object.entries(it.customizations.optionSelections) as [string, OptionChoice][]).map(([grpName, choice]) => (
                                        <span key={grpName} className="text-[9px] bg-slate-950 text-orange-300 px-1.5 py-0.2 rounded font-medium">
                                          {grpName}: {choice.name}{choice.price > 0 ? ` (+฿${choice.price})` : ''}
                                        </span>
                                      ))}
                                      {it.customizations.notes && <span className="text-[9px] bg-slate-950 text-yellow-400 px-1.5 py-0.5 rounded max-w-[200px] truncate">📝 {it.customizations.notes}</span>}
                                    </div>
                                  )}
                                </div>
                                <span className="font-mono text-slate-300 text-right shrink-0">
                                  {it.price > 0 ? `฿${formatPrice(it.price * it.quantity)}` : 'รอกำหนดราคา ⏳'}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Totals */}
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between pt-2 border-t border-white/5 text-sm font-bold">
                              <span className="text-white">ยอดสุทธิ (Total Amount)</span>
                              <span className="font-mono text-orange-400 text-base">฿{formatPrice(livePlacedOrder.totalAmount)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-2 pt-1">
                          {(livePlacedOrder.status === 'pending' || livePlacedOrder.status === 'preparing') && (
                            <button
                              type="button"
                              onClick={() => startEditingOrder(livePlacedOrder)}
                              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/20 active:scale-[0.98]"
                            >
                              <span>✍️ แก้ไขบิล / เพิ่มรายการอาหารในบิลนี้</span>
                            </button>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => window.print()}
                              className="bg-slate-800 hover:bg-slate-750 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-white/5"
                            >
                              <span>🖨️ พิมพ์ใบเสร็จ / บิล</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setLastPlacedOrder(null);
                                setOrderSuccessMsg(null);
                              }}
                              className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-white/5"
                            >
                              <span>✨ สั่งอาหารเพิ่ม (เปิดบิลใหม่)</span>
                            </button>
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-500 text-center italic mt-2">
                          * คุณสามารถสั่งอาหารจานอื่นๆ เพิ่มเติมได้ตลอดเวลาโดยกด "สั่งอาหารเพิ่ม" ระบบจะเชื่อมโยงชื่อและโต๊ะเข้าครัวเดียวกันค่ะ
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  /* Regular Cart & Checkout form */
                  <div className="bg-[#1E293B] rounded-3xl border border-white/10 overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-5 border-b border-white/5 bg-slate-900 flex justify-between items-center">
                      <div className="flex items-center gap-2.5">
                        <ShoppingBag className="w-5 h-5 text-orange-400" />
                        <h3 className="font-serif font-bold text-white text-lg">ตะกร้าของคุณ (Your Cart)</h3>
                      </div>
                      <span className="bg-orange-500/10 text-orange-400 text-xs px-2.5 py-1 rounded-full font-mono font-semibold">
                        {cart.reduce((s, c) => s + c.quantity, 0)} รายการ
                      </span>
                    </div>

                    {/* List items */}
                    <div className="p-5 space-y-4 max-h-[360px] overflow-y-auto divide-y divide-white/5">
                      {cart.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 space-y-3">
                          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto">
                            <ShoppingBag className="w-6 h-6 text-slate-500" />
                          </div>
                          <p className="text-sm font-medium">ยังไม่มีรายการอาหารในตะกร้า</p>
                          <p className="text-xs text-slate-500">เลือกเมนูด้านซ้ายเพื่อเริ่มต้นความอร่อย</p>
                        </div>
                      ) : (
                        cart.map((cartItem, idx) => {
                          const extraPrice = cartItem.customizations?.optionSelections
                            ? (Object.values(cartItem.customizations.optionSelections) as OptionChoice[]).reduce((acc, c) => acc + (c.price || 0), 0)
                            : 0;
                          const itemTotal = (cartItem.menuItem.price + extraPrice) * cartItem.quantity;
                          return (
                            <div key={idx} className="flex gap-3 pt-3 first:pt-0 justify-between items-start">
                              <div className="flex gap-3 items-start flex-1 min-w-0">
                                <div className="w-12 h-12 rounded-lg bg-slate-900 shrink-0 overflow-hidden">
                                  <img src={cartItem.menuItem.image} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-sm font-semibold text-white truncate">{cartItem.menuItem.nameTh}</h4>
                                  <p className="text-[10px] text-slate-400 truncate italic">{cartItem.menuItem.nameEn}</p>
                                  
                                  {/* Display Customizations */}
                                  {cartItem.customizations && Object.keys(cartItem.customizations).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {cartItem.customizations.serviceType && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                          cartItem.customizations.serviceType === 'dine-in' 
                                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        }`}>
                                          {cartItem.customizations.serviceType === 'dine-in' ? '🍽️ ทานที่ร้าน' : '🥡 กลับบ้าน'}
                                        </span>
                                      )}
                                      {cartItem.customizations.sweetness && (
                                        <span className="text-[9px] bg-slate-800 text-blue-300 px-1.5 py-0.5 rounded">
                                          หวาน: {cartItem.customizations.sweetness}
                                        </span>
                                      )}
                                      {cartItem.customizations.spiciness && (
                                        <span className="text-[9px] bg-slate-800 text-red-300 px-1.5 py-0.5 rounded">
                                          เผ็ด: {cartItem.customizations.spiciness}
                                        </span>
                                      )}
                                      {cartItem.customizations.temperature && (
                                        <span className="text-[9px] bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded">
                                          {cartItem.customizations.temperature}
                                        </span>
                                      )}
                                      {cartItem.customizations.noodleType && (
                                        <span className="text-[9px] bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded">
                                          เส้น: {cartItem.customizations.noodleType}
                                        </span>
                                      )}
                                      {cartItem.customizations.riceType && (
                                        <span className="text-[9px] bg-slate-800 text-emerald-300 px-1.5 py-0.5 rounded">
                                          ข้าว: {cartItem.customizations.riceType}
                                        </span>
                                      )}
                                      {cartItem.customizations.optionSelections && (Object.entries(cartItem.customizations.optionSelections) as [string, OptionChoice][]).map(([grpName, choice]) => (
                                        <span key={grpName} className="text-[9px] bg-slate-800 text-orange-300 px-1.5 py-0.5 rounded">
                                          {grpName}: {choice.name}{choice.price > 0 ? ` (+฿${choice.price})` : ''}
                                        </span>
                                      ))}
                                      {cartItem.customizations.notes && (
                                        <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded truncate max-w-full block">
                                          📝 {cartItem.customizations.notes}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0 flex flex-col items-end gap-1.5 pl-2">
                                <span className="text-sm font-semibold font-mono text-white">฿{formatPrice(itemTotal)}</span>
                                
                                {/* Quantity buttons */}
                                <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-white/5">
                                  <button 
                                    onClick={() => updateCartQty(idx, -1)}
                                    className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="w-6 text-center text-xs font-bold font-mono text-white">{cartItem.quantity}</span>
                                  <button 
                                    onClick={() => updateCartQty(idx, 1)}
                                    className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Customer Checkout Details Form */}
                    <form onSubmit={editingOrder ? handleSaveChanges : handleCheckout} className="p-5 bg-slate-900 border-t border-white/5 space-y-4">
                      {editingOrder && (
                        <div className="bg-orange-500/10 border border-orange-500/25 p-3 rounded-xl flex flex-col gap-1.5 animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-orange-400 flex items-center gap-1">
                              📝 กำลังแก้ไขบิลออเดอร์ #{editingOrder.orderNumber}
                            </span>
                            <button
                              type="button"
                              onClick={cancelEditingOrder}
                              className="text-[9px] bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold px-2 py-0.5 rounded border border-red-500/20 transition-all"
                            >
                              ยกเลิกการแก้ไข
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-300 leading-relaxed">
                            ท่านสามารถเลือกอาหารจากเมนูด้านซ้ายเพื่อเพิ่มเข้าไปในบิลนี้ ปรับเปลี่ยนจำนวน หรือลดเมนูออก จากนั้นกดปุ่มสีส้มด้านล่างเพื่อบันทึกค่ะ
                          </p>
                        </div>
                      )}

                      <div className="space-y-3">
                        {/* ข้อมูลจัดส่ง (Delivery Details) and Dine-in/Delivery switch removed to simplify table ordering flow */}

                        {/* Customer Name */}
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">ชื่อผู้สั่งอาหาร (Customer Name) *</label>
                          <div className="relative">
                            <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                            <input
                              type="text"
                              required
                              disabled={!!editingOrder}
                              placeholder="กรุณากรอกชื่อของคุณ"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none placeholder-slate-600 disabled:opacity-50"
                            />
                          </div>
                        </div>

                        {/* เลือกรูปแบบการบริการ (Dine-in vs. Delivery Selection) */}
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1.5 font-bold">เลือกรูปแบบการบริการ (Service Option) *</label>
                          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-white/5">
                            <button
                              type="button"
                              disabled={!!editingOrder}
                              onClick={() => setDineInType('dine-in')}
                              className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                                dineInType === 'dine-in'
                                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/10'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                              }`}
                            >
                              <Utensils className="w-3.5 h-3.5" />
                              <span>ทานที่ร้าน (Dine-In)</span>
                            </button>
                            <button
                              type="button"
                              disabled={!!editingOrder}
                              onClick={() => setDineInType('delivery')}
                              className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                                dineInType === 'delivery'
                                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/10'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                              }`}
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>สั่งกลับบ้าน / จัดส่ง (Takeaway)</span>
                            </button>
                          </div>
                        </div>

                        {dineInType === 'dine-in' ? (
                          isScannedTable ? (
                            /* Table Number Display - shown only if scanned via QR Code */
                            <div className="bg-slate-950 p-3.5 rounded-xl border border-orange-500/20 space-y-1 animate-fadeIn">
                              <span className="block text-[10px] text-orange-400 font-bold uppercase tracking-wider">📍 โต๊ะที่ลงทะเบียนผ่าน QR Code</span>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-white font-mono">โต๊ะ #${tableNumber}</span>
                                <span className="text-[10px] bg-orange-500/15 text-orange-400 font-bold px-2 py-0.5 rounded-full border border-orange-500/20">สแกนอัตโนมัติ</span>
                              </div>
                            </div>
                          ) : null
                        ) : (
                          /* Delivery fields */
                          <div className="space-y-3 animate-fadeIn">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">เบอร์โทรศัพท์ (Phone Number) *</label>
                              <input
                                type="tel"
                                required
                                disabled={!!editingOrder}
                                placeholder="เช่น 081-234-5678"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none disabled:opacity-50"
                              />
                            </div>

                            {/* Interactive Delivery Map Pinning */}
                            {!editingOrder && (
                              <DeliveryMap 
                                onLocationSelected={(lat, lng, desc) => {
                                  const cleanedAddress = deliveryAddress
                                    .split('\n')
                                    .filter(line => !line.startsWith('📍 พิกัดแผนที่:'))
                                    .join('\n')
                                    .trim();
                                  setDeliveryAddress(`${desc}\n${cleanedAddress}`.trim());
                                }}
                              />
                            )}

                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">ที่อยู่จัดส่ง / ข้อมูลเพิ่มเติม (Delivery Address) *</label>
                              <textarea
                                required
                                disabled={!!editingOrder}
                                rows={2}
                                placeholder="กรุณากรอกบ้านเลขที่ ซอย ถนน และจุดสังเกตเพิ่มเติม"
                                value={deliveryAddress}
                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none resize-none disabled:opacity-50"
                              />
                            </div>
                          </div>
                        )}

                        {/* วิธีการชำระเงิน (Payment Method Selector) */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <label className="block text-[11px] text-slate-400">เลือกวิธีการชำระเงิน (Payment Method) * {editingOrder && '(ล็อคตามบิลเดิม)'}</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={!!editingOrder}
                              onClick={() => {
                                setPaymentMethod('cash');
                                setPaymentSlip('');
                              }}
                              className={`py-2 px-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border disabled:opacity-50 ${
                                paymentMethod === 'cash'
                                  ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20'
                                  : 'bg-slate-950 border-white/5 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              <span>ชำระเงินที่ร้าน</span>
                            </button>
                            <button
                              type="button"
                              disabled={!!editingOrder}
                              onClick={() => setPaymentMethod('promptpay')}
                              className={`py-2 px-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border disabled:opacity-50 ${
                                paymentMethod === 'promptpay'
                                  ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20'
                                  : 'bg-slate-950 border-white/5 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>โอนเงินด้วยพร้อมเพย์</span>
                            </button>
                          </div>
                        </div>

                        {/* PromptPay QR Section if selected */}
                        {paymentMethod === 'promptpay' && !editingOrder && (
                          <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-3 animate-fadeIn">
                            <div className="text-center space-y-1">
                              <p className="text-xs font-bold text-orange-400">สแกน QR Code เพื่อชำระเงิน</p>
                              <p className="text-[10px] text-slate-400">ชื่อบัญชี: <span className="text-white font-semibold">{settings.promptPayName}</span></p>
                              <p className="text-[10px] text-slate-400">เบอร์พร้อมเพย์: <span className="text-white font-mono font-bold">{settings.promptPayNumber}</span></p>
                              <p className="text-[10px] text-slate-400">ยอดเงินโอน: <span className="text-orange-400 font-mono font-bold text-xs">฿{formatPrice(cartGrandTotal)}</span></p>
                            </div>

                            {/* Real PromptPay QR Code using promptpay.io API */}
                            <div className="flex justify-center">
                              <div className="bg-white p-2.5 rounded-2xl w-40 h-40 flex items-center justify-center shadow-lg">
                                <img
                                  src={`https://promptpay.io/${settings.promptPayNumber.replace(/[^0-9]/g, '')}/${cartGrandTotal}.png`}
                                  alt="PromptPay QR Code"
                                  className="w-full h-full object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            </div>

                            {/* Transfer Slip Attachment Upload */}
                            <div className="space-y-1.5 pt-1">
                              <label className="block text-[10px] text-slate-400 text-center">อัปโหลดสลิปการโอนเงิน (Attach Transfer Slip) *</label>
                              {paymentSlip ? (
                                <div className="relative border border-orange-500/30 rounded-xl p-2 bg-slate-900 flex flex-col items-center gap-2">
                                  <img
                                    src={paymentSlip}
                                    alt="Payment Slip"
                                    className="h-32 object-contain rounded-lg border border-white/10"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setPaymentSlip('')}
                                    className="text-red-400 hover:text-red-300 text-[10px] font-bold"
                                  >
                                    ✕ ลบรูปสลิปนี้
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center border border-dashed border-white/10 rounded-xl p-3 bg-slate-900 hover:bg-slate-900/80 transition-colors relative cursor-pointer group">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    required
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          if (typeof reader.result === 'string') {
                                            setPaymentSlip(reader.result);
                                          }
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  />
                                  <div className="text-center space-y-1">
                                    <p className="text-[10px] text-orange-400 font-bold group-hover:underline flex items-center justify-center gap-1">
                                      <Upload className="w-3 h-3" />
                                      <span>คลิกเพื่อแนบรูปสลิป</span>
                                    </p>
                                    <p className="text-[8px] text-slate-500">รองรับไฟล์ภาพสลิปทุกประเภท</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Summary Pricing */}
                      <div className="pt-3 border-t border-white/5 space-y-2 text-xs">
                        {appliedDiscount && (
                          <div className="flex justify-between text-xs text-emerald-400 font-medium font-sans">
                            <span>ส่วนลดจากคูปอง ({appliedDiscount.code})</span>
                            <span>-฿{formatPrice(appliedDiscount.amount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm pt-2 font-semibold border-t border-white/5">
                          <span className="text-slate-200">ราคารวมทั้งสิ้น (Total Amount)</span>
                          <span className="font-mono text-xl text-amber-400">฿{formatPrice(cartGrandTotal)}</span>
                        </div>

                        {cart.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowSplitModal(true)}
                            className="w-full mt-2 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-all shadow-md font-sans"
                          >
                            <Percent className="w-3.5 h-3.5 text-amber-400" />
                            <span>📊 คำนวณแยกจ่ายบิล (Split Bill)</span>
                          </button>
                        )}
                      </div>

                      {/* Error / Success handlers */}
                      {formErrors && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{formErrors}</span>
                        </div>
                      )}

                      {orderSuccessMsg && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs p-3 rounded-lg space-y-1">
                          <div className="flex items-center gap-2 font-bold">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                            <span>สั่งอาหารสำเร็จแล้ว!</span>
                          </div>
                          <p>หมายเลขออเดอร์ของคุณคือ <strong className="font-mono text-emerald-300">#{orderSuccessMsg.number}</strong></p>
                          <p className="text-[10px] text-slate-400">กำลังส่งเรื่องไปที่ครัว แอดมินสามารถดูได้ที่หน้าหลังบ้านทันที</p>
                        </div>
                      )}

                      {(() => {
                        const status = getStoreStatus();
                        const isClosed = !status.isOpen;
                        return (
                          <>
                            {isClosed && (
                              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] p-3 rounded-lg space-y-1">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                                  <span>ขออภัย ขณะนี้ร้านอาหารปิดรับออเดอร์</span>
                                </div>
                                <p>{status.reason}</p>
                              </div>
                            )}

                            <button
                              type="submit"
                              disabled={cart.length === 0 || isSubmittingOrder || isClosed}
                              className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-xl transition-all duration-300 ${
                                cart.length > 0 && !isSubmittingOrder && !isClosed
                                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/15 cursor-pointer hover:scale-[1.02] active:scale-95'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {isSubmittingOrder 
                                ? 'กำลังบันทึกข้อมูล...' 
                                : isClosed
                                  ? 'ร้านปิดให้บริการ (Cannot Order)'
                                  : editingOrder 
                                    ? '💾 บันทึกการแก้ไขบิล (Save Order Edits)' 
                                    : 'ยืนยันการสั่งซื้ออาหาร (Send to Kitchen)'}
                            </button>
                          </>
                        );
                      })()}
                      
                      {settings.phone && (
                        <p className="text-[10px] text-slate-500 text-center font-sans mt-2">
                          หากพบปัญหาการสั่งซื้อ ติดต่อสอบถามทางร้านได้ที่: <a href={`tel:${settings.phone}`} className="text-emerald-400 font-mono font-bold hover:underline">{settings.phone}</a>
                        </p>
                      )}
                    </form>
                  </div>
                );
              })()}

              {/* Track My Orders Card */}
              <div className="bg-[#1E293B] rounded-3xl border border-white/10 p-5 shadow-xl space-y-4 animate-fadeIn">
                <div className="flex items-start gap-3">
                  <div className="bg-orange-500/10 p-2 rounded-xl text-orange-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-white text-sm flex items-center gap-1.5">
                      <span>เช็คสถานะและบิลของคุณ (Track My Orders)</span>
                    </h4>
                    <p className="text-[10px] text-slate-400">ระบุชื่อหรือโต๊ะเพื่อดูบิล รายการอาหาร และสถานะปรุงแบบเรียลไทม์</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ระบุชื่อคนสั่ง หรือ หมายเลขโต๊ะ เช่น โต๊ะ #1"
                      value={searchTrackerName}
                      onChange={(e) => setSearchTrackerName(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleTrackOrders}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>ค้นหา</span>
                    </button>
                  </div>

                  {/* Quick toggle if table is defined */}
                  {tableNumber && (
                    <div className="flex justify-start">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTrackerName(`โต๊ะ #${tableNumber}`);
                          setHasTracked(true);
                        }}
                        className="text-[10px] text-orange-400 hover:text-orange-300 font-bold hover:underline flex items-center gap-1"
                      >
                        <span>📍 ค้นหา "โต๊ะ #${tableNumber}" ของฉันทันที</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Searched tracked orders output */}
                {hasTracked && (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {trackedOrders.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">ไม่พบบิลอาหารภายใต้ชื่อหรือโต๊ะนี้</p>
                    ) : (
                      trackedOrders.map((order) => {
                        // Status label Th
                        const getStatusBadge = (status: string) => {
                          switch (status) {
                            case 'pending':
                              return { label: '⏳ รอร้านค้ายืนยัน', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
                            case 'preparing':
                              return { label: '👨‍🍳 กำลังเตรียมวัตถุดิบ', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' };
                            case 'cooking':
                              return { label: '🍳 กำลังปรุงอาหาร', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
                            case 'ready':
                              return { label: '🛎️ พร้อมเสิร์ฟแล้ว!', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
                            case 'completed':
                              return { label: '✅ เสิร์ฟสำเร็จแล้ว', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
                            case 'cancelled':
                              return { label: '❌ ยกเลิกออเดอร์', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
                            default:
                              return { label: status, color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
                          }
                        };
                        const badge = getStatusBadge(order.status);

                        return (
                          <div key={order.id} className="bg-slate-900 p-3 rounded-xl border border-white/5 space-y-2 text-xs">
                            <div className="flex justify-between items-start gap-1">
                              <div>
                                <p className="text-xs font-bold text-white">บิล {order.id}</p>
                                <p className="text-[10px] text-slate-500 font-mono">
                                  {new Date(order.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                                {badge.label}
                              </span>
                            </div>

                            {/* Items ordered */}
                            <div className="space-y-2 pl-2 border-l border-white/10">
                              {order.items.map((it, idx) => (
                                <div key={idx} className="space-y-0.5">
                                  <div className="flex justify-between text-[11px] text-slate-300">
                                    <span>{it.nameTh} x{it.quantity}</span>
                                    <span className="font-mono text-slate-400">
                                      {it.price > 0 ? `฿${formatPrice(it.price * it.quantity)}` : 'รอกำหนดราคา ⏳'}
                                    </span>
                                  </div>
                                  {it.customizations && Object.keys(it.customizations).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-0.5 pb-1">
                                      {it.customizations.serviceType && (
                                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                                          it.customizations.serviceType === 'dine-in' 
                                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        }`}>
                                          {it.customizations.serviceType === 'dine-in' ? '🍽️ ทานที่ร้าน' : '🥡 กลับบ้าน'}
                                        </span>
                                      )}
                                      {it.customizations.sweetness && <span className="text-[9px] bg-slate-950 text-blue-300 px-1.5 py-0.2 rounded font-medium">หวาน: {it.customizations.sweetness}</span>}
                                      {it.customizations.spiciness && <span className="text-[9px] bg-slate-950 text-red-300 px-1.5 py-0.2 rounded font-medium">เผ็ด: {it.customizations.spiciness}</span>}
                                      {it.customizations.temperature && <span className="text-[9px] bg-slate-950 text-amber-300 px-1.5 py-0.2 rounded font-medium">{it.customizations.temperature}</span>}
                                      {it.customizations.noodleType && <span className="text-[9px] bg-slate-950 text-amber-300 px-1.5 py-0.2 rounded font-medium">เส้น: {it.customizations.noodleType}</span>}
                                      {it.customizations.riceType && <span className="text-[9px] bg-slate-950 text-emerald-300 px-1.5 py-0.2 rounded font-medium">ข้าว: {it.customizations.riceType}</span>}
                                      {it.customizations.optionSelections && (Object.entries(it.customizations.optionSelections) as [string, OptionChoice][]).map(([grpName, choice]) => (
                                        <span key={grpName} className="text-[9px] bg-slate-950 text-orange-300 px-1.5 py-0.2 rounded font-medium">
                                          {grpName}: {choice.name}{choice.price > 0 ? ` (+฿${choice.price})` : ''}
                                        </span>
                                      ))}
                                      {it.customizations.notes && <span className="text-[9px] bg-slate-950 text-yellow-400 px-1.5 py-0.2 rounded font-medium max-w-[150px] truncate">📝 {it.customizations.notes}</span>}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {getOrderActiveQueueNumber(order.id) !== -1 && (
                              <div className="bg-[#FFA726]/10 border border-[#FFA726]/20 p-2 rounded-lg flex justify-between items-center text-[10px] my-1.5 animate-pulse">
                                <span className="text-[#FFE082]">คิวปรุงอาหารของคุณ:</span>
                                <span className="font-bold text-[#FFA726]">คิวที่ {getOrderActiveQueueNumber(order.id)}</span>
                              </div>
                            )}

                            <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[11px]">
                              <span className="text-slate-400">
                                จ่าย: {order.paymentMethod === 'promptpay' ? '📱 พร้อมเพย์' : '💵 เงินสด'}
                              </span>
                              <span className="font-bold text-orange-400 font-mono text-xs">
                                รวม: ฿{formatPrice(order.totalAmount)}
                              </span>
                            </div>

                            {(order.status === 'pending' || order.status === 'preparing') && (
                              <button
                                type="button"
                                onClick={() => startEditingOrder(order)}
                                className="w-full mt-2 bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 font-bold py-1.5 rounded-lg text-[10px] border border-orange-500/20 transition-all flex items-center justify-center gap-1 active:scale-95"
                              >
                                ✍️ แก้ไขบิลนี้ / เพิ่มรายการอาหาร
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* ADMIN MANAGEMENT PORTAL VIEW                             */}
        {/* ======================================================== */}
        {activeTab === 'admin' && (
          <div id="admin_portal" className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
            
            {/* Live Analytics Banner Widgets */}
            <div id="admin_analytics_widgets" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div className="bg-slate-800/80 p-5 rounded-2xl border border-white/10 shadow-lg space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">ยอดขายสะสมวันนี้</p>
                <div className="flex justify-between items-baseline">
                  <p className="text-3xl font-bold font-mono text-amber-400">
                    ฿{formatPrice(analytics?.totalRevenue)}
                  </p>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md font-mono">LIVE</span>
                </div>
                <p className="text-[10px] text-slate-400">ไม่นับออเดอร์ที่ถูกยกเลิกแล้ว</p>
              </div>

              <div className="bg-slate-800/80 p-5 rounded-2xl border border-white/10 shadow-lg space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">ออเดอร์ทั้งหมด</p>
                <div className="flex justify-between items-baseline">
                  <p className="text-3xl font-bold font-mono text-white">
                    {analytics?.totalOrders || '0'}
                  </p>
                  <span className="text-xs text-slate-400">รายการคิว</span>
                </div>
                <div className="flex gap-2 text-[10px]">
                  <span className="text-yellow-400">รอดำเนินการ: {analytics?.pendingCount || 0}</span>
                  <span className="text-blue-400">กำลังปรุง: {analytics?.preparingCount || 0}</span>
                </div>
              </div>

              <div className="bg-slate-800/80 p-5 rounded-2xl border border-white/10 shadow-lg space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">ความพึงพอใจการผลิต</p>
                <div className="flex justify-between items-baseline">
                  <p className="text-3xl font-bold font-mono text-emerald-400">
                    {analytics?.totalOrders ? Math.round(((analytics.completedCount) / analytics.totalOrders) * 100) : 100}%
                  </p>
                  <span className="text-xs text-slate-400">สำเร็จ {analytics?.completedCount || 0} รายการ</span>
                </div>
                <p className="text-[10px] text-slate-400">อัตราการทำอาหารสำเร็จเสร็จสิ้น</p>
              </div>

              <div className="bg-slate-800/80 p-5 rounded-2xl border border-white/10 shadow-lg space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">สถิติออเดอร์ยกเลิก</p>
                <div className="flex justify-between items-baseline">
                  <p className="text-3xl font-bold font-mono text-red-400">
                    {analytics?.cancelledCount || '0'}
                  </p>
                  <span className="text-xs text-slate-400">ยกเลิกแล้ว</span>
                </div>
                <p className="text-[10px] text-slate-400">ออเดอร์ที่ลูกค้าหรือแอดมินยกเลิก</p>
              </div>

            </div>

            {/* Admin sub-tabs toggle */}
            <div className="flex bg-slate-900/60 p-1 rounded-2xl border border-white/5 max-w-lg shadow-inner">
              <button
                onClick={() => setAdminSubTab('orders')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  adminSubTab === 'orders'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>คิวอาหาร & จัดการครัว ({orders.length})</span>
              </button>
              <button
                onClick={() => setAdminSubTab('reservations')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  adminSubTab === 'reservations'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>คิวจองโต๊ะล่วงหน้า ({reservations.length})</span>
              </button>
            </div>

            {/* Render Reservations Dashboard */}
            {adminSubTab === 'reservations' && (
              <div className="bg-[#1E293B] rounded-3xl border border-white/10 p-6 shadow-2xl space-y-6">
                <div>
                  <h3 className="font-serif font-bold text-xl text-white">รายชื่อจองโต๊ะอาหารล่วงหน้า (Table Reservations Board)</h3>
                  <p className="text-xs text-slate-400">อนุมัติ ยืนยัน หรือยกเลิกคิวจองโต๊ะของลูกค้าและเตรียมความพร้อมของโต๊ะอาหาร</p>
                </div>
                {reservations.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-sm">ไม่มีคิวจองโต๊ะล่วงหน้าในขณะนี้</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {reservations.map(res => (
                      <div key={res.id} className="bg-slate-900/60 rounded-2xl border border-white/5 p-5 space-y-4 relative overflow-hidden flex flex-col justify-between">
                        <div className={`absolute top-0 right-0 w-2 h-full ${
                          res.status === 'confirmed' ? 'bg-emerald-500' :
                          res.status === 'cancelled' ? 'bg-rose-500' : 'bg-amber-500'
                        }`} />
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-start pr-4">
                            <div>
                              <h4 className="font-bold text-white text-sm">{res.customerName}</h4>
                              <p className="text-xs text-slate-400">📞 {res.phone}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                res.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400' :
                                res.status === 'cancelled' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                              }`}>
                                {res.status === 'confirmed' ? 'ยืนยันแล้ว' :
                                 res.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'รอการติดต่อ'}
                              </span>

                              {/* Delete confirmation button */}
                              {deletingResId === res.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => deleteReservation(res.id)}
                                    className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold py-0.5 px-1.5 rounded transition-all"
                                    title="ยืนยันลบ"
                                  >
                                    ยืนยันลบ
                                  </button>
                                  <button
                                    onClick={() => setDeletingResId(null)}
                                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 py-0.5 px-1 rounded transition-all"
                                    title="ยกเลิก"
                                  >
                                    ยกเลิก
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingResId(res.id)}
                                  className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-white/5 transition-all"
                                  title="ลบรายการจอง"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/40 p-3 rounded-xl border border-white/5 font-sans">
                            <div>
                              <span className="text-[10px] text-slate-500 block">วันที่จอง</span>
                              <span className="font-bold text-slate-200">{res.date}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">เวลาที่จอง</span>
                              <span className="font-bold text-slate-200">{res.time} น.</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">จำนวนท่าน</span>
                              <span className="font-bold text-amber-400">{res.partySize} ท่าน</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">ความต้องการโต๊ะ</span>
                              <span className="font-bold text-slate-200 truncate block">{res.tablePreference || 'ไม่ได้ระบุ'}</span>
                            </div>
                          </div>

                          {res.specialRequest && (
                            <div className="text-[11px] bg-slate-950/20 p-2.5 rounded-lg border border-white/5 text-slate-300 italic font-sans">
                              📌 "{res.specialRequest}"
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 pt-3 border-t border-white/5 text-xs">
                          {res.status === 'pending' && (
                            <>
                              <button
                                onClick={() => updateReservationStatus(res.id, 'confirmed')}
                                className="flex-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white py-1.5 px-3 rounded-lg font-bold transition-all border border-emerald-500/10 text-center"
                              >
                                ยืนยันการจอง
                              </button>
                              <button
                                onClick={() => updateReservationStatus(res.id, 'cancelled')}
                                className="flex-1 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white py-1.5 px-3 rounded-lg font-bold transition-all border border-rose-500/10 text-center"
                              >
                                ยกเลิกการจอง
                              </button>
                            </>
                          )}
                          {res.status === 'confirmed' && (
                            <button
                              onClick={() => updateReservationStatus(res.id, 'cancelled')}
                              className="w-full bg-slate-950 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 py-1.5 px-3 rounded-lg transition-all border border-white/5 text-center"
                            >
                              ยกเลิกการจอง
                            </button>
                          )}
                          {res.status === 'cancelled' && (
                            <button
                              onClick={() => updateReservationStatus(res.id, 'confirmed')}
                              className="w-full bg-slate-950 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 py-1.5 px-3 rounded-lg transition-all border border-white/5 text-center"
                            >
                              กู้คืนสิทธิ์จองโต๊ะ
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Split layout: Order Management & Menu Inventory catalog */}
            {adminSubTab === 'orders' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Order management console queue (7 columns) */}
              <div className="lg:col-span-7 space-y-6">
                
                <div className="bg-[#1E293B] rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                  
                  {/* Queue Header with Filters */}
                  <div className="p-5 bg-slate-900 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-serif font-bold text-lg text-white">คิวออเดอร์อาหารสด (Kitchen Live Monitor)</h3>
                      <p className="text-xs text-slate-400">อัปเดตและควบคุมสถานะความคืบหน้าของออเดอร์จากครัวแบบเรียลไทม์</p>
                    </div>

                    {/* Filter buttons */}
                    <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-xl">
                      {[
                        { key: 'all', title: 'ทั้งหมด' },
                        { key: 'pending', title: 'รอรับเรื่อง' },
                        { key: 'active', title: 'กำลังทำ' },
                        { key: 'completed', title: 'เสร็จแล้ว' },
                        { key: 'cancelled', title: 'ยกเลิก' }
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => setAdminOrderFilter(f.key as any)}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                            adminOrderFilter === f.key 
                              ? 'bg-slate-800 text-white shadow' 
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {f.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Orders Queue Body */}
                  <div className="divide-y divide-white/5 max-h-[640px] overflow-y-auto">
                    {filteredOrders.length === 0 ? (
                      <div className="py-20 text-center text-slate-400 space-y-2">
                        <Clock className="w-10 h-10 mx-auto text-slate-600 animate-pulse" />
                        <p className="font-medium">ไม่มีรายการออเดอร์ตามเงื่อนไขนี้</p>
                        <p className="text-xs text-slate-500">ออเดอร์ที่ถูกสั่งซื้อจะมาปรากฏที่นี่ทันที</p>
                      </div>
                    ) : (
                      filteredOrders.map((order) => (
                        <div key={order.id} className="p-6 space-y-4 hover:bg-slate-800/20 transition-colors">
                          
                          {/* Order sub-header info */}
                          <div className="flex flex-wrap justify-between items-center gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-orange-400 font-bold text-base">
                                #{order.orderNumber}
                              </span>
                              {getOrderActiveQueueNumber(order.id) !== -1 ? (
                                <span className="bg-amber-500/15 text-amber-400 text-xs px-2 py-0.5 rounded-md font-bold border border-amber-500/20">
                                  คิวที่ {getOrderActiveQueueNumber(order.id)}
                                </span>
                              ) : (
                                <span className="bg-slate-500/10 text-slate-400 text-[10px] px-2 py-0.5 rounded-md font-medium">
                                  เสร็จสิ้น/ยกเลิก
                                </span>
                              )}
                              <span className="text-slate-400 text-xs">|</span>
                              <span className="text-slate-200 font-bold text-sm">
                                {order.customerName}
                              </span>
                              <span className={`text-[10px] px-2.5 py-1 rounded-md font-semibold ${
                                order.dineInType === 'dine-in' 
                                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' 
                                  : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              }`}>
                                {order.dineInType === 'dine-in' ? (order.tableNumber ? `โต๊ะ #${order.tableNumber}` : '🍽️ ทานที่ร้าน (ปกติ)') : '🚚 จัดส่งด่วน'}
                              </span>
                            </div>

                            {/* Status Pill Badge */}
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 text-xs font-mono">
                                {new Date(order.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                              </span>
                              
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-sans ${
                                order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 animate-pulse' :
                                order.status === 'preparing' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                order.status === 'cooking' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                                order.status === 'ready' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>
                                {order.status === 'pending' ? 'รอยืนยันออเดอร์' :
                                 order.status === 'preparing' ? 'รับเรื่องแล้ว' :
                                 order.status === 'cooking' ? 'กำลังปรุงอาหาร' :
                                 order.status === 'ready' ? 'รอเสิร์ฟ / รอจัดส่ง' :
                                 order.status === 'completed' ? 'เสร็จสิ้นสำเร็จ' :
                                 'ยกเลิกออเดอร์แล้ว'}
                              </span>
                            </div>
                          </div>

                          {/* Delivery Address if exists */}
                          {order.dineInType === 'delivery' && (order.deliveryAddress || order.phone) && (
                            <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5 text-xs space-y-1">
                              <p className="text-slate-400">📞 <span className="text-slate-200 font-mono font-bold">{order.phone}</span></p>
                              <p className="text-slate-400">📍 <span className="text-slate-200">{order.deliveryAddress}</span></p>
                            </div>
                          )}

                          {/* วิธีการชำระเงิน (Payment Status Badge for Admin) */}
                          <div className="flex flex-wrap items-center justify-between text-xs bg-slate-900/40 p-3 rounded-xl border border-white/5 gap-2">
                            <div className="flex items-center gap-2">
                              <Wallet className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-slate-400">ช่องทางชำระเงิน:</span>
                              <span className={`font-bold font-sans ${order.paymentMethod === 'promptpay' ? 'text-teal-400' : 'text-amber-400'}`}>
                                {order.paymentMethod === 'promptpay' ? '📱 โอนเงินผ่านพร้อมเพย์' : '💵 ชำระที่ร้าน / เงินสด'}
                              </span>
                            </div>
                            {order.paymentMethod === 'promptpay' && order.paymentSlip && (
                              <div className="flex items-center gap-2">
                                <a 
                                  href={order.paymentSlip} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="bg-slate-950 hover:bg-slate-900 border border-teal-500/30 hover:border-teal-400 text-teal-400 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shrink-0"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>เปิดดูสลิปโอนเงิน (คลิกเพื่อดูรูปเต็ม)</span>
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Food ordered lists */}
                          <div className="bg-slate-950 p-4 rounded-xl divide-y divide-white/5 space-y-2.5">
                            {order.items.map((it, idx) => (
                              <div key={idx} className="flex flex-col md:flex-row justify-between items-start md:items-center text-xs pt-2.5 first:pt-0 gap-2">
                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 text-slate-200">
                                    <span className="font-mono bg-slate-800 text-slate-300 font-bold px-1.5 py-0.5 rounded">
                                      {it.quantity}x
                                    </span>
                                    <span className="font-semibold truncate">{it.nameTh}</span>
                                    {it.price === 0 && (
                                      <span className="animate-pulse bg-yellow-500/20 text-yellow-400 text-[9px] px-1.5 py-0.5 rounded font-bold border border-yellow-500/30">
                                        ⚠️ รอกำหนดราคา
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-500 block italic truncate">{it.nameEn}</span>
                                  
                                  {/* Customizations display */}
                                  {it.customizations && Object.keys(it.customizations).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1 pl-6">
                                      {it.customizations.serviceType && (
                                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                                          it.customizations.serviceType === 'dine-in' 
                                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        }`}>
                                          {it.customizations.serviceType === 'dine-in' ? '🍽️ ทานที่ร้าน' : '🥡 กลับบ้าน'}
                                        </span>
                                      )}
                                      {it.customizations.sweetness && <span className="text-[9px] bg-slate-900 text-blue-300 px-1 py-0.2 rounded">หวาน: {it.customizations.sweetness}</span>}
                                      {it.customizations.spiciness && <span className="text-[9px] bg-slate-900 text-red-300 px-1 py-0.2 rounded">เผ็ด: {it.customizations.spiciness}</span>}
                                      {it.customizations.temperature && <span className="text-[9px] bg-slate-900 text-amber-300 px-1 py-0.2 rounded">{it.customizations.temperature}</span>}
                                      {it.customizations.noodleType && <span className="text-[9px] bg-slate-900 text-amber-300 px-1 py-0.2 rounded">เส้น: {it.customizations.noodleType}</span>}
                                      {it.customizations.riceType && <span className="text-[9px] bg-slate-900 text-emerald-300 px-1 py-0.2 rounded">ข้าว: {it.customizations.riceType}</span>}
                                      {it.customizations.optionSelections && (Object.entries(it.customizations.optionSelections) as [string, OptionChoice][]).map(([grpName, choice]) => (
                                        <span key={grpName} className="text-[9px] bg-slate-900 text-orange-300 px-1 py-0.2 rounded">
                                          {grpName}: {choice.name}{choice.price > 0 ? ` (+฿${choice.price})` : ''}
                                        </span>
                                      ))}
                                      {it.customizations.notes && <span className="text-[9px] bg-slate-900 text-yellow-400 px-1.5 py-0.5 rounded">📝 {it.customizations.notes}</span>}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Interactive Price Setter */}
                                <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                                  <span className="text-[10px] text-slate-500">ตั้งราคาต่อหน่วย:</span>
                                  <div className="relative">
                                    <span className="absolute left-2 top-0.5 text-[10px] text-slate-400">฿</span>
                                    <input
                                      type="number"
                                      min="0"
                                      defaultValue={it.price}
                                      key={it.price}
                                      onBlur={(e) => {
                                        const val = Number(e.target.value);
                                        if (val !== it.price) {
                                          handleUpdateItemPrice(order.id, idx, val);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const val = Number((e.target as HTMLInputElement).value);
                                          handleUpdateItemPrice(order.id, idx, val);
                                          (e.target as HTMLInputElement).blur();
                                        }
                                      }}
                                      className="w-20 pl-4 pr-1 py-0.5 bg-slate-900 border border-white/10 rounded font-mono text-xs text-orange-400 font-bold focus:outline-none focus:border-orange-500"
                                      placeholder="0"
                                    />
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-bold ml-1">รวม:</span>
                                  <span className="font-mono text-slate-300 font-bold w-16 text-right">
                                    ฿{formatPrice(it.price * it.quantity)}
                                  </span>
                                </div>
                              </div>
                            ))}

                            <div className="pt-2.5 flex justify-between items-baseline text-xs">
                              <span className="text-slate-400 font-medium">รวมยอดทั้งสิ้น (สุทธิ):</span>
                              <span className="text-sm font-bold font-mono text-amber-400">฿{formatPrice(order.totalAmount)}</span>
                            </div>
                          </div>

                          {/* Quick Workflow Action State triggers */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                            <span className="text-[11px] text-slate-400">ย้ายขั้นตอนการจัดการอาหาร:</span>
                            
                            <div className="flex gap-2">
                              {order.status === 'pending' && (
                                <button
                                  onClick={() => handleUpdateStatus(order.id, 'preparing')}
                                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>รับออเดอร์</span>
                                </button>
                              )}

                              {order.status === 'preparing' && (
                                <button
                                  onClick={() => handleUpdateStatus(order.id, 'cooking')}
                                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1"
                                >
                                  <ChefHat className="w-3.5 h-3.5" />
                                  <span>เริ่มทำอาหาร</span>
                                </button>
                              )}

                              {order.status === 'cooking' && (
                                <button
                                  onClick={() => handleUpdateStatus(order.id, 'ready')}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>ปรุงอาหารเสร็จแล้ว</span>
                                </button>
                              )}

                              {order.status === 'ready' && (
                                <button
                                  onClick={() => handleUpdateStatus(order.id, 'completed')}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>เสิร์ฟ / ส่งมอบงานสำเร็จ</span>
                                </button>
                              )}

                              {order.status !== 'completed' && order.status !== 'cancelled' && (
                                <button
                                  onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                                  className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>ยกเลิกออเดอร์</span>
                                </button>
                              )}

                              {(order.status === 'completed' || order.status === 'cancelled') && (
                                <button
                                  onClick={() => handleUpdateStatus(order.id, 'pending')}
                                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 border border-white/5"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>ทำซ้ำ / ย้อนคิว</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteOrder(order.id)}
                                className="bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 border border-rose-500/20"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>ลบบิลนี้</span>
                              </button>
                            </div>
                          </div>

                        </div>
                      ))
                    )}
                  </div>

                </div>

              </div>

              {/* Menu inventory catalog list & Create menu (5 columns) */}
              <div className="lg:col-span-5 space-y-6">

                {/* Store & Payment Settings Card */}
                <div className="bg-[#1E293B] rounded-3xl border border-white/10 p-5 shadow-xl space-y-4 animate-fadeIn">
                  <div>
                    <h4 className="font-serif font-bold text-white text-sm flex items-center gap-1.5">
                      <Settings className="w-4 h-4 text-orange-400" />
                      <span>ข้อมูลร้านค้าและบัญชีพร้อมเพย์ (Store Settings)</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 font-sans">ปรับเปลี่ยนชื่อร้านค้าและช่องทางบัญชีรับโอนเงินของทางร้านแบบเรียลไทม์</p>
                  </div>

                  <form onSubmit={handleUpdateSettings} className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">ชื่อร้านค้า (Store Name) *</label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น AURA CULINARY"
                        value={editStoreName}
                        onChange={(e) => setEditStoreName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">สโลแกน/คำโปรยร้านค้า (Store Tagline / Slogan)</label>
                      <input
                        type="text"
                        placeholder="เช่น Gastronomy & AI Sommelier"
                        value={editTagline}
                        onChange={(e) => setEditTagline(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">เบอร์โทรศัพท์ติดต่อของร้านค้า (Store Contact Phone) *</label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น 02-123-4567, 081-234-5678"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">เบอร์พร้อมเพย์ (PromptPay) *</label>
                        <input
                          type="text"
                          required
                          placeholder="เบอร์มือถือ หรือ เลขบัตรประชาชน"
                          value={editPromptPayNumber}
                          onChange={(e) => setEditPromptPayNumber(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">ชื่อบัญชีรับเงิน *</label>
                        <input
                          type="text"
                          required
                          placeholder="เช่น นายออร่า ดียอดเยี่ยม"
                          value={editPromptPayName}
                          onChange={(e) => setEditPromptPayName(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Store Schedule Settings */}
                    <div className="border-t border-white/5 pt-3 mt-3 space-y-3">
                      <div>
                        <h5 className="text-[11px] font-bold text-orange-400 uppercase tracking-wide">ตั้งเวลาเปิด-ปิด และวันหยุดร้าน (Operating Hours)</h5>
                        <p className="text-[9px] text-slate-400 font-sans">ควบคุมช่วงเวลาการสั่งอาหารของลูกค้า หากร้านปิดระบบจะระงับการสั่งชั่วคราว</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">เวลาเปิดร้าน *</label>
                          <input
                            type="time"
                            required
                            value={editOpenTime}
                            onChange={(e) => setEditOpenTime(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">เวลาปิดร้าน *</label>
                          <input
                            type="time"
                            required
                            value={editCloseTime}
                            onChange={(e) => setEditCloseTime(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-2">วันหยุดประจำสัปดาห์ (เลือกวันเพื่อตั้งปิดร้านประจำสัปดาห์)</label>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { value: 0, label: 'อา.' },
                            { value: 1, label: 'จ.' },
                            { value: 2, label: 'อ.' },
                            { value: 3, label: 'พ.' },
                            { value: 4, label: 'พฤ.' },
                            { value: 5, label: 'ศ.' },
                            { value: 6, label: 'ส.' }
                          ].map((day) => {
                            const isSelected = editClosedDays.includes(day.value);
                            return (
                              <button
                                key={day.value}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setEditClosedDays(editClosedDays.filter(d => d !== day.value));
                                  } else {
                                    setEditClosedDays([...editClosedDays, day.value]);
                                  }
                                }}
                                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                                  isSelected
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold'
                                    : 'bg-slate-950 text-slate-400 border border-white/5 hover:border-white/10'
                                }`}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-lg border border-white/5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-200">ปิดร้านชั่วคราว (Manual Override)</label>
                          <p className="text-[9px] text-slate-400">ปิดระบบการสั่งซื้อทันที (เช่น สำหรับวันหยุดเทศกาลหรือร้านปิดด่วน)</p>
                        </div>
                        <button
                          key="closed_temp_toggle"
                          type="button"
                          onClick={() => setEditIsClosedTemporarily(!editIsClosedTemporarily)}
                          className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative flex items-center ${
                            editIsClosedTemporarily ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                        >
                          <span className={`block w-5 h-5 bg-white rounded-full shadow-md transform duration-200 ${
                            editIsClosedTemporarily ? 'translate-x-6' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-lg border border-white/5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-200">เปิดใช้งานเมนูจองโต๊ะล่วงหน้า (Table Reservations)</label>
                          <p className="text-[9px] text-slate-400">แสดงปุ่มจองโต๊ะล่วงหน้าและระบบบริหารคิว/โต๊ะอาหาร</p>
                        </div>
                        <button
                          key="reservation_enabled_toggle"
                          type="button"
                          onClick={() => setEditIsReservationEnabled(!editIsReservationEnabled)}
                          className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative flex items-center ${
                            editIsReservationEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                          }`}
                        >
                          <span className={`block w-5 h-5 bg-white rounded-full shadow-md transform duration-200 ${
                            editIsReservationEnabled ? 'translate-x-6' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-lg border border-white/5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-200">เปิดใช้งานระบบสมาชิกสะสมแต้ม (Loyalty Points)</label>
                          <p className="text-[9px] text-slate-400">แสดงปุ่มสมาชิกสะสมแต้มและหน้าต่างคะแนนสำหรับลูกค้า</p>
                        </div>
                        <button
                          key="loyalty_enabled_toggle"
                          type="button"
                          onClick={() => setEditIsLoyaltyEnabled(!editIsLoyaltyEnabled)}
                          className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative flex items-center ${
                            editIsLoyaltyEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                          }`}
                        >
                          <span className={`block w-5 h-5 bg-white rounded-full shadow-md transform duration-200 ${
                            editIsLoyaltyEnabled ? 'translate-x-6' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    </div>

                    {/* LINE Notification Settings */}
                    <div className="border-t border-white/5 pt-3 mt-3 space-y-3">
                      <div>
                        <h5 className="text-[11px] font-bold text-orange-400 uppercase tracking-wide">ตั้งค่าแจ้งเตือน LINE (LINE Messaging API)</h5>
                        <p className="text-[9px] text-slate-400 font-sans">ระบบจะทำการแจ้งเตือนเมื่อมีออเดอร์ใหม่เข้ามา ด้วยการ์ดรูปแบบพรีเมียม (Flex Message)</p>
                      </div>

                      {settings.lastLineError && (
                        <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg text-[9px] text-rose-400 font-sans flex flex-col gap-1.5">
                          <span className="font-bold flex items-center gap-1">⚠️ การแจ้งเตือนล่าสุดล้มเหลว (LINE API Error):</span>
                          <span className="font-mono break-all bg-black/30 p-1.5 rounded text-rose-300">{settings.lastLineError}</span>
                          <span className="text-slate-400">กรุณาตรวจสอบว่า LINE Channel Access Token ด้านล่างถูกต้องและยังไม่หมดอายุ</span>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1 font-sans">LINE Channel Access Token *</label>
                        <textarea
                          rows={2}
                          placeholder="ใส่ Long-lived Channel Access Token"
                          value={editLineChannelAccessToken}
                          onChange={(e) => setEditLineChannelAccessToken(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-[10px] text-slate-200 focus:outline-none font-mono break-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1 font-sans">LINE Target ID (ไม่ใส่ = Broadcast ไปยังทุกคนที่เป็นเพื่อนกับบอท)</label>
                        <input
                          type="text"
                          placeholder="ใส่ User ID หรือ Group ID (เช่น U123456789...)"
                          value={editLineUserId}
                          onChange={(e) => setEditLineUserId(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none font-mono"
                        />
                        <p className="text-[9px] text-slate-500 mt-0.5 font-sans">เว้นว่างไว้หากต้องการส่งแบบ Broadcast ไปยังผู้ติดตามบอททุกคน</p>
                      </div>
                    </div>

                    {/* Supabase Database Settings */}
                    <div className="border-t border-white/5 pt-3 mt-3 space-y-3">
                      <div>
                        <h5 className="text-[11px] font-bold text-[#3ECF8E] uppercase tracking-wide flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse"></span>
                          <span>ตั้งค่า Supabase (Real-Time Cloud Database)</span>
                        </h5>
                        <p className="text-[9px] text-slate-400 font-sans">ซิงก์ข้อมูลออเดอร์ เมนู และการจองโต๊ะผ่าน Cloud Database ของ Supabase แบบเรียลไทม์ทันทีเมื่อมีการเปลี่ยนแปลงในระบบ</p>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1 font-sans">Supabase Project URL</label>
                        <input
                          type="text"
                          placeholder="https://your-project.supabase.co"
                          value={editSupabaseUrl}
                          onChange={(e) => setEditSupabaseUrl(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-white/5 focus:border-[#3ECF8E] rounded-lg text-xs text-slate-200 focus:outline-none font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1 font-sans">Supabase Anon Public API Key</label>
                        <textarea
                          rows={2}
                          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                          value={editSupabaseAnonKey}
                          onChange={(e) => setEditSupabaseAnonKey(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-white/5 focus:border-[#3ECF8E] rounded-lg text-[10px] text-slate-200 focus:outline-none font-mono break-all"
                        />
                      </div>

                      <div className="bg-slate-950 p-2.5 rounded-lg border border-[#3ECF8E]/20 space-y-2">
                        <span className="block text-[9px] font-bold text-[#3ECF8E] font-sans">⚡ คู่มือสร้างตาราง (SQL Script):</span>
                        <p className="text-[8px] text-slate-400 font-sans leading-relaxed">
                          กรุณาคัดลอกโค้ด SQL ด้านล่างนี้ ไปรันในเมนู <strong>SQL Editor</strong> บนคอนโซล Supabase ของท่านเพื่อตั้งตารางที่จำเป็น:
                        </p>
                        <textarea
                          readOnly
                          rows={6}
                          className="w-full p-2 bg-slate-900 border border-white/5 rounded text-[8px] font-mono text-slate-300 focus:outline-none"
                          value={`-- 1. Create restaurant_settings table
create table if not exists restaurant_settings (
  id text primary key,
  store_name text,
  promptpay_number text,
  promptpay_name text,
  line_channel_access_token text,
  line_user_id text,
  phone text,
  tagline text,
  open_time text,
  close_time text,
  closed_days jsonb,
  is_closed_temporarily boolean,
  is_reservation_enabled boolean,
  is_loyalty_enabled boolean,
  last_line_error text,
  updated_at timestamp with time zone default now()
);

-- 2. Create menu_items table
create table if not exists menu_items (
  id text primary key,
  name_th text,
  name_en text,
  description_th text,
  description_en text,
  price numeric,
  category text,
  image text,
  is_popular boolean,
  prep_time integer,
  ingredients text[],
  in_stock boolean,
  option_groups jsonb,
  updated_at timestamp with time zone default now()
);

-- 3. Create orders table
create table if not exists orders (
  id text primary key,
  order_number text,
  customer_name text,
  dine_in_type text,
  table_number text,
  delivery_address text,
  phone text,
  payment_method text,
  payment_slip text,
  items jsonb,
  total_amount numeric,
  status text,
  timestamp text,
  updated_at timestamp with time zone default now()
);

-- 4. Create reservations table
create table if not exists reservations (
  id text primary key,
  customer_name text,
  phone text,
  date text,
  time text,
  party_size integer,
  table_preference text,
  special_request text,
  status text,
  timestamp text,
  updated_at timestamp with time zone default now()
);

-- Enable Realtime for these tables
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table reservations;
alter publication supabase_realtime add table restaurant_settings;
alter publication supabase_realtime add table menu_items;

-- Disable Row Level Security (RLS) to allow public read/write/delete access via client Anon Key
alter table restaurant_settings disable row level security;
alter table menu_items disable row level security;
alter table orders disable row level security;
alter table reservations disable row level security;`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`-- 1. Create restaurant_settings table
create table if not exists restaurant_settings (
  id text primary key,
  store_name text,
  promptpay_number text,
  promptpay_name text,
  line_channel_access_token text,
  line_user_id text,
  phone text,
  tagline text,
  open_time text,
  close_time text,
  closed_days jsonb,
  is_closed_temporarily boolean,
  is_reservation_enabled boolean,
  is_loyalty_enabled boolean,
  last_line_error text,
  updated_at timestamp with time zone default now()
);

-- 2. Create menu_items table
create table if not exists menu_items (
  id text primary key,
  name_th text,
  name_en text,
  description_th text,
  description_en text,
  price numeric,
  category text,
  image text,
  is_popular boolean,
  prep_time integer,
  ingredients text[],
  in_stock boolean,
  option_groups jsonb,
  updated_at timestamp with time zone default now()
);

-- 3. Create orders table
create table if not exists orders (
  id text primary key,
  order_number text,
  customer_name text,
  dine_in_type text,
  table_number text,
  delivery_address text,
  phone text,
  payment_method text,
  payment_slip text,
  items jsonb,
  total_amount numeric,
  status text,
  timestamp text,
  updated_at timestamp with time zone default now()
);

-- 4. Create reservations table
create table if not exists reservations (
  id text primary key,
  customer_name text,
  phone text,
  date text,
  time text,
  party_size integer,
  table_preference text,
  special_request text,
  status text,
  timestamp text,
  updated_at timestamp with time zone default now()
);

-- Enable Realtime for these tables
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table reservations;
alter publication supabase_realtime add table restaurant_settings;
alter publication supabase_realtime add table menu_items;

-- Disable Row Level Security (RLS) to allow public read/write/delete access via client Anon Key
alter table restaurant_settings disable row level security;
alter table menu_items disable row level security;
alter table orders disable row level security;
alter table reservations disable row level security;`);
                            alert('คัดลอก SQL Script เรียบร้อยแล้ว!');
                          }}
                          className="w-full bg-slate-900 hover:bg-slate-850 text-[#3ECF8E] hover:text-white border border-[#3ECF8E]/20 text-[9px] font-bold py-1 rounded transition-colors"
                        >
                          📋 คัดลอกโค้ด SQL ทั้งหมด
                        </button>
                      </div>
                    </div>

                    {settingsSuccessMsg && (
                      <p className="text-[10px] text-emerald-400 font-bold text-center animate-fadeIn">✓ {settingsSuccessMsg}</p>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/15"
                    >
                      <span>บันทึกข้อมูลร้านค้า</span>
                    </button>
                  </form>
                </div>

                {/* Table QR Codes Card */}
                <div className="bg-[#1E293B] rounded-3xl border border-white/10 p-5 shadow-xl space-y-4 animate-fadeIn">
                  <div>
                    <h4 className="font-serif font-bold text-white text-sm flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-orange-400" />
                      <span>รหัสคิวอาร์สำหรับสั่งอาหาร (Menu & Table QR Codes)</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 font-sans">แสดง QR Code ของร้านค้าเพื่อให้ลูกค้าสแกนเข้าสั่งอาหารและลงทะเบียนโต๊ะอัตโนมัติ</p>
                  </div>

                  {/* General QR Code */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-[11px] text-orange-400 font-bold uppercase tracking-wider">🌟 คิวอาร์สั่งอาหารทั่วไป (General QR Code)</span>
                        <span className="text-[10px] text-slate-400">สำหรับลูกค้านั่งทานทั่วไป สั่งกลับบ้าน หรือสั่งเดลิเวอรี่ (ไม่ระบุโต๊ะ)</span>
                      </div>
                      <span className="text-[9px] bg-orange-500/15 text-orange-400 font-bold px-2 py-0.5 rounded-full border border-orange-500/20">หลัก</span>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-900 p-3 rounded-xl border border-white/5">
                      {(() => {
                        const storeUrl = window.location.origin;
                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=255-255-255&bgcolor=30-41-59&data=${encodeURIComponent(storeUrl)}`;
                        return (
                          <>
                            <div className="relative w-20 h-20 bg-slate-800 p-2 rounded-xl border border-white/5 flex items-center justify-center overflow-hidden shrink-0 mx-auto sm:mx-0">
                              <img 
                                src={qrUrl} 
                                alt="General QR Code"
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="flex-1 space-y-2 w-full text-center sm:text-left">
                              <p className="text-[10px] text-slate-300 font-mono break-all">{storeUrl}</p>
                              <div className="flex gap-2 justify-center sm:justify-start">
                                <a
                                  href={storeUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 border border-white/5"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  <span>ทดสอบเปิด</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(storeUrl);
                                    alert('คัดลอกลิงก์ร้านค้าทั่วไปเรียบร้อยแล้ว!');
                                  }}
                                  className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold transition-colors"
                                >
                                  คัดลอกลิงก์
                                </button>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-2">
                    <span className="block text-[11px] text-slate-400 font-bold mb-2">📍 คิวอาร์ระบุหมายเลขโต๊ะ (Specific Table QR Codes)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-1">
                    {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((num) => {
                      const tableUrl = `${window.location.origin}/?table=${num}`;
                      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=255-255-255&bgcolor=30-41-59&data=${encodeURIComponent(tableUrl)}`;
                      return (
                        <div key={num} className="bg-slate-900/60 p-3 rounded-2xl border border-white/5 flex flex-col items-center space-y-2 text-center group hover:border-orange-500/30 transition-colors">
                          <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-2.5 py-0.5 rounded-full font-mono">
                            โต๊ะ {num}
                          </span>
                          <div className="relative w-24 h-24 bg-slate-800 p-2 rounded-xl border border-white/5 flex items-center justify-center overflow-hidden">
                            <img 
                              src={qrUrl} 
                              alt={`QR Table ${num}`}
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex gap-1 w-full">
                            <a
                              href={tableUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white py-1 rounded-lg text-[9px] font-bold transition-colors flex items-center justify-center gap-0.5 border border-white/5"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              <span>ทดสอบ</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(tableUrl);
                                alert(`คัดลอกลิงก์สำหรับ โต๊ะ ${num} เรียบร้อยแล้ว!`);
                              }}
                              className="bg-orange-500 hover:bg-orange-600 text-white p-1 rounded-lg text-[9px] font-bold transition-colors shrink-0 px-2"
                              title="คัดลอกลิงก์"
                            >
                              คัดลอก
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Category Management Card */}
                <div className="bg-[#1E293B] rounded-3xl border border-white/10 p-5 shadow-xl space-y-4 animate-fadeIn">
                  <div>
                    <h4 className="font-serif font-bold text-white text-sm flex items-center gap-1.5">
                      <span>🏷️</span>
                      <span>จัดการหมวดหมู่สินค้า (Categories)</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 font-sans">เพิ่มหรือลบหมวดหมู่ของทางร้านแบบเรียลไทม์</p>
                  </div>

                  {/* Add Category Form */}
                  <form onSubmit={handleCreateCategory} className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-2">
                    <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider block">เพิ่มหมวดหมู่ใหม่</span>
                    <div className="grid grid-cols-12 gap-1.5">
                      <div className="col-span-3">
                        <label className="block text-[8px] text-slate-400 mb-0.5">อิโมจิ</label>
                        <input
                          type="text"
                          required
                          placeholder="เช่น 🍜"
                          value={newCatEmoji}
                          onChange={(e) => setNewCatEmoji(e.target.value)}
                          className="w-full px-1.5 py-1 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-center text-slate-200 focus:outline-none"
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="block text-[8px] text-slate-400 mb-0.5">ชื่อไทย *</label>
                        <input
                          type="text"
                          required
                          placeholder="เช่น บะหมี่"
                          value={newCatTh}
                          onChange={(e) => setNewCatTh(e.target.value)}
                          onBlur={handleCatThBlur}
                          className="w-full px-1.5 py-1 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-[11px] text-slate-200 focus:outline-none"
                        />
                      </div>
                      <div className="col-span-5">
                        <label className="block text-[8px] text-slate-400 mb-0.5 flex justify-between">
                          <span>ชื่ออังกฤษ *</span>
                          {isTranslatingCat && <span className="text-[7px] text-amber-400 animate-pulse">กำลังแปลด้วย AI...</span>}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder={isTranslatingCat ? "กำลังแปล..." : "เช่น Noodles"}
                          value={isTranslatingCat ? "" : newCatEn}
                          onChange={(e) => setNewCatEn(e.target.value)}
                          disabled={isTranslatingCat}
                          className="w-full px-1.5 py-1 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-[11px] text-slate-200 focus:outline-none disabled:opacity-50"
                        />
                      </div>
                    </div>
                    {catActionError && (
                      <p className="text-[9px] text-red-400 font-semibold">{catActionError}</p>
                    )}
                    <button
                      type="submit"
                      className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-1.5 rounded-lg text-[11px] transition-colors"
                    >
                      + เพิ่มหมวดหมู่
                    </button>
                  </form>

                  {/* List of categories with delete */}
                  <div className="divide-y divide-white/5 space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {categories.map(cat => (
                      <div key={cat.id} className="pt-1.5 first:pt-0 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm shrink-0">{cat.emoji}</span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-200 truncate text-[11px]">{cat.nameTh}</p>
                            <p className="text-[9px] text-slate-500 italic font-mono truncate">{cat.nameEn} ({cat.id})</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="text-slate-400 hover:text-red-400 p-1 rounded hover:bg-white/5 transition-colors shrink-0"
                          title="ลบหมวดหมู่นี้"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Menu Inventory Card */}
                <div className="bg-[#1E293B] rounded-3xl border border-white/10 p-5 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h4 className="font-serif font-bold text-white text-sm">จัดการรายการเมนูอาหาร</h4>
                      <p className="text-[10px] text-slate-400">ควบคุมวัตถุดิบและเปิดปิดรายการสินค้า</p>
                    </div>
                    <button
                      onClick={() => {
                        if (isAddingNewItem) {
                          setNewMenuTh('');
                          setNewMenuEn('');
                          setNewDescTh('');
                          setNewDescEn('');
                          setNewPrice('');
                          setNewImage('');
                          setNewPrepTime('15');
                          setNewIngredients('');
                          setNewOptionGroups([]);
                          setEditingMenuItem(null);
                        }
                        setIsAddingNewItem(!isAddingNewItem);
                      }}
                      className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold p-2 py-1.5 rounded-xl text-xs transition-colors shadow-md flex items-center gap-1"
                    >
                      {isAddingNewItem ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>{isAddingNewItem ? 'ปิดฟอร์ม' : 'เพิ่มเมนู'}</span>
                    </button>
                  </div>

                  {/* Add New Menu Item Form */}
                  {isAddingNewItem && (
                    <form onSubmit={handleCreateMenuItem} className="bg-slate-900/80 p-4 rounded-2xl border border-white/5 space-y-3 mb-4 animate-fadeIn">
                      <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        {editingMenuItem ? 'ฟอร์มแก้ไขข้อมูลเมนูอาหาร' : 'ฟอร์มเพิ่มรายการอาหารใหม่'}
                      </h5>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">ชื่อเมนู (ภาษาไทย) *</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="เช่น แกงเขียวหวานเนื้อวากิว"
                            value={newMenuTh}
                            onChange={(e) => setNewMenuTh(e.target.value)}
                            onBlur={handleMenuThBlur}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5 flex justify-between">
                            <span>ชื่อเมนู (อังกฤษ) *</span>
                            {isTranslatingMenu && <span className="text-[9px] text-amber-400 animate-pulse">กำลังแปลด้วย AI...</span>}
                          </label>
                          <input 
                            type="text" 
                            required 
                            placeholder={isTranslatingMenu ? "กำลังแปล..." : "เช่น Wagyu Green Curry"}
                            value={isTranslatingMenu ? "" : newMenuEn}
                            onChange={(e) => setNewMenuEn(e.target.value)}
                            disabled={isTranslatingMenu}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">ราคา (THB) *</label>
                          <input 
                            type="number" 
                            required 
                            placeholder="เช่น 390"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">หมวดหมู่ *</label>
                          <select
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none"
                          >
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.emoji} {cat.nameTh} ({cat.nameEn})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">คำอธิบายความอร่อย (ไทย)</label>
                        <textarea 
                          rows={2}
                          placeholder="สูตรโบราณ มะนาวแท้พรีเมียมหอมกลมกล่อม..."
                          value={newDescTh}
                          onChange={(e) => setNewDescTh(e.target.value)}
                          onBlur={handleDescThBlur}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">เวลาเตรียมอาหาร (นาที)</label>
                          <input 
                            type="number" 
                            placeholder="12"
                            value={newPrepTime}
                            onChange={(e) => setNewPrepTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">วัตถุดิบ (คอมมาคั่น)</label>
                          <input 
                            type="text" 
                            placeholder="Wagyu, Lime, Basil"
                            value={newIngredients}
                            onChange={(e) => setNewIngredients(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* ตัวเลือกเสริม (Options) Section */}
                      <div className="border border-white/10 rounded-2xl p-4 bg-slate-950/40 space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-white/5">
                          <h6 id="customize_form_header" className="text-[12px] font-bold text-white flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5 text-orange-400" />
                            ตัวเลือกเสริม (Options)
                          </h6>
                          <button
                            type="button"
                            onClick={handleAddOptionGroup}
                            className="text-[10px] bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-lg px-2.5 py-1 font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            เพิ่มกลุ่มตัวเลือก
                          </button>
                        </div>

                        {newOptionGroups.length === 0 ? (
                          <p className="text-[10px] text-slate-500 text-center py-2 italic">ไม่มีตัวเลือกเสริมสำหรับเมนูนี้ คลิกปุ่มด้านบนเพื่อเริ่มเพิ่ม</p>
                        ) : (
                          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                            {newOptionGroups.map((group, groupIdx) => (
                              <div key={group.id} className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-3 relative">
                                
                                {/* Group Header Row */}
                                <div className="flex items-center gap-2 justify-between">
                                  <div className="flex-1 min-w-0">
                                    <input
                                      type="text"
                                      required
                                      placeholder="เช่น สั่งพิเศษ, เลือกท็อปปิ้ง"
                                      value={group.name}
                                      onChange={(e) => handleUpdateOptionGroup(group.id, { name: e.target.value })}
                                      className="w-full px-2 py-1 bg-slate-900 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-white focus:outline-none font-bold"
                                    />
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <label className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={group.required}
                                        onChange={(e) => handleUpdateOptionGroup(group.id, { required: e.target.checked })}
                                        className="rounded bg-slate-900 border-white/15 text-orange-500 focus:ring-0 focus:ring-offset-0 w-3 h-3"
                                      />
                                      <span>บังคับเลือก</span>
                                    </label>
                                    
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOptionGroup(group.id)}
                                      className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                                      title="ลบกลุ่มตัวเลือกนี้"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Choice Sub-options */}
                                <div className="space-y-1.5 pl-2 border-l border-white/10">
                                  {group.choices.map((choice, choiceIdx) => (
                                    <div key={choiceIdx} className="flex items-center gap-1.5">
                                      {/* Image Box */}
                                      <div className="relative w-7 h-7 bg-slate-900/80 border border-white/10 hover:border-orange-500/50 rounded-lg flex items-center justify-center shrink-0 overflow-hidden group/thumb transition-all">
                                        {choice.image ? (
                                          <>
                                            <img src={choice.image} alt="" className="w-full h-full object-cover" />
                                            <button
                                              type="button"
                                              onClick={() => handleUpdateChoice(group.id, choiceIdx, { image: '' })}
                                              className="absolute inset-0 bg-red-600/80 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                                              title="ลบรูปภาพ"
                                            >
                                              <X className="w-3 h-3 text-white" />
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <Image className="w-3.5 h-3.5 text-slate-500 group-hover/thumb:text-orange-400 transition-colors" />
                                            <input
                                              type="file"
                                              accept="image/*"
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  const reader = new FileReader();
                                                  reader.onloadend = () => {
                                                    if (typeof reader.result === 'string') {
                                                      handleUpdateChoice(group.id, choiceIdx, { image: reader.result });
                                                    }
                                                  };
                                                  reader.readAsDataURL(file);
                                                }
                                              }}
                                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                              title="คลิกเพื่ออัปโหลดรูปภาพ"
                                            />
                                          </>
                                        )}
                                      </div>

                                      <input
                                        type="text"
                                        required
                                        placeholder="ตัวเลือก เช่น ธรรมดา, หมูแดง"
                                        value={choice.name}
                                        onChange={(e) => handleUpdateChoice(group.id, choiceIdx, { name: e.target.value })}
                                        className="flex-1 px-2 py-1 bg-slate-900/60 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-300 focus:outline-none"
                                      />
                                      <div className="flex items-center gap-1 shrink-0">
                                        <span className="text-[10px] text-slate-500">฿</span>
                                        <input
                                          type="number"
                                          min="0"
                                          placeholder="ราคา"
                                          value={choice.price || ''}
                                          onChange={(e) => handleUpdateChoice(group.id, choiceIdx, { price: Number(e.target.value) || 0 })}
                                          className="w-14 px-1.5 py-1 bg-slate-900/60 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-amber-400 font-mono text-center focus:outline-none"
                                        />
                                      </div>

                                      {/* External URL Button */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newUrl = prompt('ใส่ URL รูปภาพสำหรับตัวเลือกนี้:', choice.image || '');
                                          if (newUrl !== null) {
                                            handleUpdateChoice(group.id, choiceIdx, { image: newUrl });
                                          }
                                        }}
                                        className={`p-1 rounded border transition-colors ${choice.image && !choice.image.startsWith('data:') ? 'text-orange-400 border-orange-500/30' : 'text-slate-500 hover:text-slate-300 border-transparent'}`}
                                        title="ใส่ URL รูปภาพภายนอก"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        disabled={group.choices.length <= 1}
                                        onClick={() => handleRemoveChoice(group.id, choiceIdx)}
                                        className="text-slate-500 hover:text-red-400 p-1 rounded disabled:opacity-30 transition-colors"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}

                                  <button
                                    type="button"
                                    onClick={() => handleAddChoice(group.id)}
                                    className="text-[9px] text-orange-400 hover:underline flex items-center gap-0.5 mt-1 font-medium"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                    เพิ่มตัวเลือกย่อย
                                  </button>
                                </div>

                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">เลือกรูปภาพอาหาร (Upload Image / Use URL)</label>
                        <div className="space-y-2">
                          {/* File input */}
                          <div className="flex items-center justify-center border border-dashed border-white/10 rounded-xl p-3 bg-slate-950 hover:bg-slate-950/80 transition-colors relative cursor-pointer group">
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    if (typeof reader.result === 'string') {
                                      setNewImage(reader.result);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                            <div className="text-center space-y-1">
                              <p className="text-[11px] text-orange-400 font-bold group-hover:underline">📁 คลิกเพื่ออัปโหลดรูปภาพจากเครื่อง</p>
                              <p className="text-[9px] text-slate-500">รองรับไฟล์ PNG, JPG, WEBP (แปลงเป็น Base64 อัตโนมัติ)</p>
                            </div>
                          </div>

                          {/* Text input fallback */}
                          <div>
                            <p className="text-[9px] text-slate-500 text-center mb-1">หรือ วางลิงก์รูปภาพออนไลน์</p>
                            <input 
                              type="text" 
                              placeholder="วาง URL รูปภาพที่ต้องการ..."
                              value={newImage.startsWith('data:') ? '' : newImage}
                              onChange={(e) => setNewImage(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-lg text-xs text-slate-200 focus:outline-none"
                            />
                          </div>

                          {/* Preview selected image */}
                          {newImage && (
                            <div className="flex items-center gap-2 bg-slate-950/50 p-2 rounded-xl border border-white/5">
                              <img src={newImage} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-white/10" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-slate-300 truncate">เลือกรูปภาพสำเร็จแล้ว</p>
                                <p className="text-[8px] text-slate-500">{newImage.startsWith('data:') ? 'Base64 Encoded Image' : 'External Image URL'}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setNewImage('')}
                                className="text-[10px] text-red-400 hover:underline px-2"
                              >
                                ลบออก
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {menuActionError && (
                        <p className="text-[10px] text-red-400 font-bold">{menuActionError}</p>
                      )}

                      <button
                        type="submit"
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-xl text-xs transition-colors"
                      >
                        {editingMenuItem ? 'บันทึกการแก้ไขเมนูอาหาร' : 'บันทึกและขึ้นทะเบียนอาหารใหม่'}
                      </button>
                    </form>
                  )}

                  {/* Menu items stock quick catalog */}
                  <div className="divide-y divide-white/5 space-y-3 max-h-[460px] overflow-y-auto">
                    {menuItems.map(item => (
                      <div key={item.id} className="pt-3 first:pt-0 flex justify-between items-center gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={item.image} className="w-10 h-10 object-cover rounded-lg shrink-0" alt="" />
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-white truncate">{item.nameTh}</h5>
                            <p className="text-[10px] text-slate-400 truncate italic">{item.nameEn}</p>
                            <span className="text-xs font-bold font-mono text-amber-400 block mt-0.5">฿{item.price}</span>
                          </div>
                        </div>

                        {/* Inventory stock state switcher */}
                        <div className="shrink-0 flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                            item.inStock 
                              ? 'bg-emerald-500/10 text-emerald-400' 
                              : 'bg-red-500/10 text-red-400'
                          }`}>
                            {item.inStock ? 'พร้อมเสิร์ฟ' : 'หมดสต็อก'}
                          </span>
                          <button
                            onClick={() => handleToggleStock(item.id)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                              item.inStock 
                                ? 'bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white' 
                                : 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white'
                            }`}
                          >
                            {item.inStock ? 'ปิดเมนู' : 'เปิดเมนู'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingMenuItem(item);
                              setNewMenuTh(item.nameTh);
                              setNewMenuEn(item.nameEn);
                              setNewDescTh(item.descriptionTh || '');
                              setNewDescEn(item.descriptionEn || '');
                              setNewPrice(item.price.toString());
                              setNewCategory(item.category);
                              setNewImage(item.image || '');
                              setNewPrepTime(item.prepTime?.toString() || '15');
                              setNewIngredients(item.ingredients?.join(', ') || '');
                              setNewOptionGroups(item.optionGroups || []);
                              setIsAddingNewItem(true);
                              // Smooth scroll to the form header
                              setTimeout(() => {
                                const el = document.getElementById('customize_form_header');
                                if (el) {
                                  el.scrollIntoView({ behavior: 'smooth' });
                                }
                              }, 100);
                            }}
                            className="bg-slate-950 hover:bg-amber-500 text-slate-400 hover:text-white p-2 rounded-lg transition-all border border-white/5 hover:border-amber-500"
                            title="แก้ไขเมนูนี้"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMenuItem(item.id)}
                            className="bg-slate-950 hover:bg-red-500 text-slate-400 hover:text-white p-2 rounded-lg transition-all border border-white/5 hover:border-red-500"
                            title="ลบเมนูนี้ถาวร"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>

              </div>

            </div>
          )}

          </div>
        )}

      </div>

      {/* Item Customizer Modal overlay */}
      {customizingItem && (
        <div id="customize_modal" className="fixed inset-0 bg-slate-950/85 flex items-center justify-center p-4 z-50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#1E293B] rounded-3xl border border-white/10 max-w-md w-full overflow-hidden shadow-2xl animate-scaleUp">
            
            {/* Header info */}
            <div className="relative h-40 bg-slate-900">
              <img src={customizingItem.image} alt="" className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1E293B] to-transparent"></div>
              <button 
                onClick={() => setCustomizingItem(null)}
                className="absolute top-4 right-4 bg-slate-950/80 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-950 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="absolute bottom-4 left-5 pr-4">
                <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-bold rounded-md uppercase">
                  {customizingItem.category}
                </span>
                <h4 className="text-xl font-serif font-bold text-white mt-1">{customizingItem.nameTh}</h4>
                <p className="text-xs text-slate-400 italic">{customizingItem.nameEn}</p>
              </div>
            </div>

            {/* Config selectors */}
            <div className="p-6 space-y-5">
              
              {/* Serving Option (Dine-In / Takeaway) */}
              <div>
                <label className="block text-xs text-orange-400 font-bold uppercase mb-2 tracking-wider">รูปแบบการรับประทาน (Serving Option)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTempServiceType('dine-in')}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                      tempServiceType === 'dine-in' 
                        ? 'bg-orange-500 border-orange-500 text-white font-bold' 
                        : 'bg-slate-900 border-white/5 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>🍽️ ทานที่ร้าน (Dine In)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempServiceType('takeaway')}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                      tempServiceType === 'takeaway' 
                        ? 'bg-orange-500 border-orange-500 text-white font-bold' 
                        : 'bg-slate-900 border-white/5 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>🥡 สั่งกลับบ้าน (Takeaway)</span>
                  </button>
                </div>
              </div>

              {/* Beverage Options: Sweetness & Temperature */}
              {customizingItem.category === 'beverage' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 font-bold uppercase mb-2">ระดับความหวาน (Sweetness Level)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Standard (100%)', 'Less Sweet (50%)', 'No Sweet (0%)'].map((opt) => (
                        <button
                          type="button"
                          key={opt}
                          onClick={() => setTempSweetness(opt)}
                          className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${
                            tempSweetness === opt 
                              ? 'bg-orange-500 border-orange-500 text-white font-bold' 
                              : 'bg-slate-900 border-white/5 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 font-bold uppercase mb-2">อุณหภูมิ (Temperature)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Iced (เย็น)', 'Hot (ร้อน)'].map((opt) => (
                        <button
                          type="button"
                          key={opt}
                          onClick={() => setTempTemperature(opt)}
                          className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                            tempTemperature === opt 
                              ? 'bg-orange-500 border-orange-500 text-white font-bold' 
                              : 'bg-slate-900 border-white/5 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}



              {/* Dynamic Custom Option Groups */}
              {customizingItem.optionGroups && customizingItem.optionGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs text-slate-400 font-bold uppercase">
                      {group.name}
                    </label>
                    {group.required ? (
                      <span className="text-[10px] bg-red-500/10 text-red-400 font-bold px-1.5 py-0.5 rounded">จำเป็น</span>
                    ) : (
                      <span className="text-[10px] text-slate-500">เลือกเพิ่มหรือไม่ก็ได้</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.choices.map((choice) => {
                      const isSelected = tempOptionSelections[group.name]?.name === choice.name;
                      return (
                        <button
                          type="button"
                          key={choice.name}
                          onClick={() => {
                            if (isSelected) {
                              if (!group.required) {
                                const copy = { ...tempOptionSelections };
                                delete copy[group.name];
                                setTempOptionSelections(copy);
                              }
                            } else {
                              setTempOptionSelections({
                                ...tempOptionSelections,
                                [group.name]: choice
                              });
                            }
                          }}
                          className={`py-1.5 px-2 rounded-xl text-xs font-semibold border flex justify-between items-center transition-all gap-2 ${
                            isSelected 
                              ? 'bg-orange-500 border-orange-500 text-white font-bold shadow-md' 
                              : 'bg-slate-900 border-white/5 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {choice.image && (
                              <img 
                                src={choice.image} 
                                alt="" 
                                className="w-8 h-8 object-cover rounded-lg shrink-0 border border-white/10" 
                              />
                            )}
                            <span className="truncate text-left">{choice.name}</span>
                          </div>
                          <span className={`shrink-0 font-mono text-[10px] ${isSelected ? 'text-white/85' : 'text-amber-400/80'}`}>
                            {choice.price > 0 ? `+฿${choice.price}` : 'ฟรี'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}



              {/* Total checkout price action */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">ราคาหน่วย</span>
                  <span className="text-2xl font-bold font-mono text-amber-400">
                    ฿{(() => {
                      let extra = 0;
                      (Object.values(tempOptionSelections) as OptionChoice[]).forEach((choice) => {
                        extra += choice.price || 0;
                      });
                      return formatPrice(customizingItem.price + extra);
                    })()}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setCustomizingItem(null)}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleConfirmCustomize}
                    className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl text-xs transition-transform active:scale-95 shadow-lg shadow-orange-500/10"
                  >
                    เพิ่มลงตะกร้าสินค้า
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog Modal */}
      {confirmDialog && (
        <div id="confirm_modal" className="fixed inset-0 bg-slate-950/85 flex items-center justify-center p-4 z-[100] backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#1E293B] rounded-3xl border border-white/10 max-w-sm w-full p-6 shadow-2xl animate-scaleUp space-y-5">
            <div className="space-y-2 text-center">
              <div className="mx-auto bg-rose-500/10 text-rose-400 w-12 h-12 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="font-serif text-lg font-bold text-white">{confirmDialog.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{confirmDialog.message}</p>
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-xs transition-colors border border-white/5"
              >
                {confirmDialog.cancelText || 'ยกเลิก'}
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className={`flex-1 font-bold py-2 rounded-xl text-xs transition-colors ${
                  confirmDialog.isDanger 
                    ? 'bg-rose-600 hover:bg-rose-500 text-white' 
                    : 'bg-orange-500 hover:bg-orange-600 text-white'
                }`}
              >
                {confirmDialog.confirmText || 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 1. SMART TABLE RESERVATION MODAL ==================== */}
      {showReservationModal && (
        <div id="reservation_modal" className="fixed inset-0 bg-slate-950/85 flex items-center justify-center p-4 z-50 backdrop-blur-xs animate-fadeIn font-sans">
          <div className="bg-[#1E293B] rounded-3xl border border-white/10 max-w-lg w-full overflow-hidden shadow-2xl animate-scaleUp">
            <div className="relative p-6 border-b border-white/5 bg-slate-900/40 flex justify-between items-center">
              <div>
                <h3 className="font-serif font-bold text-lg text-white">จองโต๊ะอาหารล่วงหน้า (Smart Table Booking)</h3>
                <p className="text-xs text-slate-400">จองและเลือกโซนที่ต้องการล่วงหน้าเพื่อประสบการณ์ที่ดีที่สุดของคุณ</p>
              </div>
              <button 
                onClick={() => setShowReservationModal(false)}
                className="bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white p-2 rounded-xl border border-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
              {resSuccess ? (
                <div className="text-center py-6 space-y-4 animate-scaleUp">
                  <div className="mx-auto w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-serif text-lg font-bold text-white">ส่งคำขอจองโต๊ะสำเร็จแล้วค่ะ!</h4>
                    <p className="text-xs text-slate-400">ระบบได้รับการจองโต๊ะอาหารของคุณเรียบร้อยแล้ว</p>
                  </div>
                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 text-left text-xs text-slate-300 leading-relaxed space-y-2">
                    <p>✨ **ชื่อผู้จอง:** {resName || 'ลูกค้ากิตติมศักดิ์'}</p>
                    <p>📅 **วันที่และเวลา:** {resDate} เวลา {resTime} น.</p>
                    <p>👥 **จำนวนท่าน:** {resPartySize} ท่าน</p>
                    <p>📍 **โซนที่เลือก:** {resTablePref === 'window' ? 'ริมหน้าต่าง (Window View)' : resTablePref === 'quiet' ? 'โซนเงียบสงบ (Quiet Zone)' : resTablePref === 'bar' ? 'เคาน์เตอร์บาร์ (Bar Counter)' : 'ห้องแอร์ส่วนตัว (Cozy Indoor)'}</p>
                    <p className="text-[10px] text-orange-400 font-bold border-t border-white/5 pt-2 mt-2">📌 เจ้าหน้าที่ของร้านกำลังจัดเตรียมและจัดสรรโต๊ะที่ดีที่สุดและจะติดต่อกลับในกรณีพิเศษค่ะ!</p>
                  </div>
                  <button
                    onClick={() => {
                      setResSuccess(false);
                      setShowReservationModal(false);
                    }}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold py-2.5 rounded-xl text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                  >
                    ปิดหน้าต่างนี้
                  </button>
                </div>
              ) : (
                <form onSubmit={submitReservation} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">ชื่อผู้จอง *</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="คุณรักกระเพรา" 
                        value={resName}
                        onChange={(e) => setResName(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-xl text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">เบอร์โทรศัพท์ติดต่อ *</label>
                      <input 
                        type="tel" 
                        required 
                        placeholder="081-XXXXXXX" 
                        value={resPhone}
                        onChange={(e) => setResPhone(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-xl text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">เลือกวันที่ *</label>
                      <input 
                        type="date" 
                        required 
                        value={resDate}
                        onChange={(e) => setResDate(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-xl text-xs text-slate-200 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">เลือกเวลาที่ต้องการ *</label>
                      <input 
                        type="time" 
                        required 
                        value={resTime}
                        onChange={(e) => setResTime(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-xl text-xs text-slate-200 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">จำนวนท่าน *</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setResPartySize(Math.max(1, resPartySize - 1))}
                          className="w-8 h-8 rounded-lg bg-slate-950 hover:bg-slate-900 text-slate-400 flex items-center justify-center border border-white/5 text-xs font-bold font-mono"
                        >
                          -
                        </button>
                        <span className="flex-1 text-center font-bold text-slate-200 text-xs bg-slate-950 py-1.5 rounded-lg border border-white/5 font-mono">
                          {resPartySize} ท่าน
                        </span>
                        <button
                          type="button"
                          onClick={() => setResPartySize(resPartySize + 1)}
                          className="w-8 h-8 rounded-lg bg-slate-950 hover:bg-slate-900 text-slate-400 flex items-center justify-center border border-white/5 text-xs font-bold font-mono"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">เลือกบริเวณ / โซนที่นั่ง *</label>
                      <select
                        value={resTablePref}
                        onChange={(e) => setResTablePref(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-xl text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="window">ริมหน้าต่าง (Window View)</option>
                        <option value="quiet">โซนเงียบสงบส่วนตัว (Quiet Zone)</option>
                        <option value="bar">เคาน์เตอร์บาร์ (Bar Counter)</option>
                        <option value="indoor">ห้องแอร์ส่วนตัว (Cozy Indoor)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">ความต้องการเพิ่มเติมย่อย (ถ้ามี)</label>
                    <textarea
                      placeholder="เช่น ต้องการเค้กวันเกิด หรือมีเด็กเล็กต้องการเก้าอี้พิเศษ..."
                      value={resSpecialRequest}
                      onChange={(e) => setResSpecialRequest(e.target.value)}
                      rows={2}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-xl text-xs text-slate-200 focus:outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resLoading}
                    className="w-full mt-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-lg hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                  >
                    {resLoading ? 'กำลังส่งคำขอจอง...' : 'ยืนยันและส่งคำขอจองโต๊ะ'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== 2. LOYALTY & VOUCHERS MODAL ==================== */}
      {showLoyaltyModal && (
        <div id="loyalty_modal" className="fixed inset-0 bg-slate-950/85 flex items-center justify-center p-4 z-50 backdrop-blur-xs animate-fadeIn font-sans">
          <div className="bg-[#1E293B] rounded-3xl border border-white/10 max-w-md w-full overflow-hidden shadow-2xl animate-scaleUp">
            <div className="relative p-5 border-b border-white/5 bg-slate-900/40 flex justify-between items-center">
              <div>
                <h3 className="font-serif font-bold text-lg text-white">สมาชิก Aura Culinary Club</h3>
                <p className="text-xs text-slate-400">สะสมแต้ม แลกสิทธิประโยชน์สุดพรีเมียมส่วนตัว</p>
              </div>
              <button 
                onClick={() => {
                  setLoyaltyMessage('');
                  setShowLoyaltyModal(false);
                }}
                className="bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white p-2 rounded-xl border border-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Sleek Golden Membership Card */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 border border-amber-500/20 p-5 rounded-2xl shadow-xl flex flex-col justify-between h-44 animate-scaleUp">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl" />
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-500/10 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 animate-pulse" />
                      <span>Aura Elite Member</span>
                    </span>
                    <p className="text-sm font-semibold text-white/95 mt-2">คุณรักของอร่อย (Executive Guest)</p>
                  </div>
                  <div className="font-serif text-amber-500 font-bold text-lg">AURA</div>
                </div>

                <div className="flex justify-between items-end border-t border-white/5 pt-4">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase tracking-wider">คะแนนคงเหลือสะสม</span>
                    <span className="text-2xl font-bold font-mono text-amber-400">{loyaltyPoints}</span>
                    <span className="text-slate-400 text-xs ml-1 font-medium">คะแนน (Points)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-slate-500 block">MEMBER ID</span>
                    <span className="text-[10px] text-slate-400 font-mono">AUR-992-1150</span>
                  </div>
                </div>
              </div>

              {/* Redeem vouchers section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">คูปองส่วนลดที่เปิดให้แลกสิทธิ์</h4>
                
                {loyaltyMessage && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-xl text-center font-bold">
                    🎉 {loyaltyMessage}
                  </div>
                )}

                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {/* Coupon 1 */}
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 flex justify-between items-center gap-3">
                    <div className="flex gap-2 min-w-0">
                      <div className="bg-orange-500/10 text-orange-400 p-2 rounded-lg flex items-center justify-center shrink-0">
                        <Gift className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-white truncate">ส่วนลดพิเศษ 50 บาท</h5>
                        <p className="text-[10px] text-slate-400 truncate">ใช้ได้ทันทีในการสั่งอาหารรอบถัดไป</p>
                        <span className="text-[10px] text-amber-400 font-bold block mt-0.5 font-mono">ใช้ 50 คะแนน</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (loyaltyPoints >= 50) {
                          setLoyaltyPoints(loyaltyPoints - 50);
                          setAppliedDiscount({ code: 'AURA50', amount: 50 });
                          setLoyaltyMessage('แลกสิทธิ์คูปองส่วนลด 50 บาทเรียบร้อยแล้วค่ะ! จะนำไปหักลบในยอดสุทธิตะกร้าของคุณค่ะ');
                          playChime(659.25, 0.4);
                        } else {
                          alert('คะแนนสะสมของคุณไม่เพียงพอสำหรับการแลกคูปองนี้ค่ะ');
                        }
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-[10px] shrink-0 transition-colors"
                    >
                      แลกสิทธิ์
                    </button>
                  </div>

                  {/* Coupon 2 */}
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 flex justify-between items-center gap-3">
                    <div className="flex gap-2 min-w-0">
                      <div className="bg-orange-500/10 text-orange-400 p-2 rounded-lg flex items-center justify-center shrink-0">
                        <Gift className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-white truncate">ส่วนลดพิเศษ 100 บาท</h5>
                        <p className="text-[10px] text-slate-400 truncate">ใช้แลกหักราคาบิลทั้งหมด</p>
                        <span className="text-[10px] text-amber-400 font-bold block mt-0.5 font-mono">ใช้ 100 คะแนน</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (loyaltyPoints >= 100) {
                          setLoyaltyPoints(loyaltyPoints - 100);
                          setAppliedDiscount({ code: 'AURA100', amount: 100 });
                          setLoyaltyMessage('แลกสิทธิ์คูปองส่วนลด 100 บาทเรียบร้อยแล้วค่ะ! ระบบหักลบส่วนลดทันที');
                          playChime(659.25, 0.4);
                        } else {
                          alert('คะแนนสะสมของคุณไม่เพียงพอสำหรับการแลกคูปองนี้ค่ะ');
                        }
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-[10px] shrink-0 transition-colors"
                    >
                      แลกสิทธิ์
                    </button>
                  </div>

                  {/* Coupon 3 */}
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 flex justify-between items-center gap-3">
                    <div className="flex gap-2 min-w-0">
                      <div className="bg-orange-500/10 text-orange-400 p-2 rounded-lg flex items-center justify-center shrink-0">
                        <Gift className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-white truncate">ฟรี ยูซุโรสสปาร์คกลิ้ง 🍷</h5>
                        <p className="text-[10px] text-slate-400 truncate">มูลค่า 150 บาท สำหรับมื้อพิเศษ</p>
                        <span className="text-[10px] text-amber-400 font-bold block mt-0.5 font-mono">ใช้ 120 คะแนน</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (loyaltyPoints >= 120) {
                          setLoyaltyPoints(loyaltyPoints - 120);
                          setAppliedDiscount({ code: 'AURAFREE', amount: 150 });
                          setLoyaltyMessage('แลกสิทธิ์ฟรี ยูซุโรสสปาร์คกลิ้งเรียบร้อยแล้วค่ะ! มอบส่วนลดพิเศษมูลค่า 150 บาทในตะกร้าทันที');
                          playChime(659.25, 0.4);
                        } else {
                          alert('คะแนนสะสมของคุณไม่เพียงพอสำหรับการแลกคูปองนี้ค่ะ');
                        }
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-[10px] shrink-0 transition-colors"
                    >
                      แลกสิทธิ์
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 3. INTERACTIVE BILL SPLITTER MODAL ==================== */}
      {showSplitModal && (
        <div id="split_bill_modal" className="fixed inset-0 bg-slate-950/85 flex items-center justify-center p-4 z-50 backdrop-blur-xs animate-fadeIn font-sans">
          <div className="bg-[#1E293B] rounded-3xl border border-white/10 max-w-lg w-full overflow-hidden shadow-2xl animate-scaleUp">
            <div className="relative p-5 border-b border-white/5 bg-slate-900/40 flex justify-between items-center">
              <div>
                <h3 className="font-serif font-bold text-lg text-white">แยกสัดส่วนการชำระบิล (Interactive Bill Splitter)</h3>
                <p className="text-xs text-slate-400">คำนวณแยกค่าใช้จ่ายหารเท่ากัน หรือจ่ายเฉพาะเมนูที่สั่งส่วนตัวได้อย่างมีประสิทธิภาพ</p>
              </div>
              <button 
                onClick={() => setShowSplitModal(false)}
                className="bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white p-2 rounded-xl border border-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Selector split types */}
              <div className="flex bg-slate-950 p-1.5 rounded-xl border border-white/5 gap-1">
                <button
                  type="button"
                  onClick={() => setSplitType('equal')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    splitType === 'equal' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  หารยอดเท่ากัน (Split Equally)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSplitType('by-item');
                    // Initialize default item assignments to everyone if empty
                    const initial: any = {};
                    cart.forEach((_, idx) => {
                      initial[idx] = Array.from({ length: splitPeopleCount }, (_, i) => i);
                    });
                    setItemAssignments(initial);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    splitType === 'by-item' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  หารตามเมนูย่อย (Split by Item)
                </button>
              </div>

              {/* Total display bar */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">ยอดรวมอาหารปัจจุบันในตะกร้า</span>
                  <span className="text-xl font-bold font-mono text-amber-400">฿{formatPrice(cartGrandTotal)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">จำนวนเพื่อนที่หาร</span>
                  <div className="flex items-center gap-1 mt-1 justify-end">
                    <button
                      type="button"
                      onClick={() => setSplitPeopleCount(Math.max(2, splitPeopleCount - 1))}
                      className="w-6 h-6 bg-slate-950 text-slate-400 hover:text-white rounded flex items-center justify-center font-bold text-xs"
                    >
                      -
                    </button>
                    <span className="font-mono text-xs font-bold text-slate-200 px-2.5 bg-slate-950 py-0.5 rounded">{splitPeopleCount} คน</span>
                    <button
                      type="button"
                      onClick={() => setSplitPeopleCount(Math.min(5, splitPeopleCount + 1))}
                      className="w-6 h-6 bg-slate-950 text-slate-400 hover:text-white rounded flex items-center justify-center font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Conditionally Render Splits */}
              {splitType === 'equal' ? (
                <div className="space-y-4 animate-scaleUp text-center">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-white/5 space-y-2">
                    <span className="text-xs text-slate-400 block">หารจ่ายคนละเท่าๆ กัน (Per Person)</span>
                    <span className="text-3xl font-bold font-mono text-emerald-400">
                      ฿{(cartGrandTotal / splitPeopleCount).toFixed(2)}
                    </span>
                    <p className="text-[10px] text-slate-500">สามารถแชร์ QR Code ด้านล่างนี้ให้เพื่อนๆ เพื่อสแกนชำระเงินตามจำนวนยอดส่วนตัวของแต่ละคนได้เลยค่ะ</p>
                  </div>

                  {/* Real Dynamic PromptPay QR Code Generation */}
                  <div className="mx-auto w-44 h-44 bg-white p-2 rounded-2xl border border-amber-500/20 shadow-xl flex items-center justify-center relative group">
                    <img
                      src={`https://promptpay.io/${(settings.promptPayNumber || '0812345678').replace(/[^0-9]/g, '')}/${(cartGrandTotal / splitPeopleCount).toFixed(2)}.png`}
                      alt="PromptPay QR"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-slate-950/80 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity p-2 text-center">
                      <p className="text-[10px] text-amber-400 font-bold">QR ยอดคนละ ฿{(cartGrandTotal / splitPeopleCount).toFixed(2)}</p>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Real-time Promptpay QR Dynamic Generator</p>
                </div>
              ) : (
                <div className="space-y-4 animate-scaleUp">
                  {/* Item Assignments Scroll area */}
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">เลือกแตะที่ชื่อเพื่อนเพื่อจับคู่ผู้รับผิดชอบค่าใช้จ่ายของจานนั้น</span>
                    
                    {cart.map((item, itemIdx) => (
                      <div key={itemIdx} className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-white">
                          <span className="truncate flex-1 pr-2">{item.menuItem.nameTh} x{item.quantity}</span>
                          <span className="font-mono text-amber-400 shrink-0">฿{(() => {
                            let extra = 0;
                            if (item.customizations?.optionSelections) {
                              Object.values(item.customizations.optionSelections).forEach((choice: any) => {
                                extra += choice.price || 0;
                              });
                            }
                            return formatPrice((item.menuItem.price + extra) * item.quantity);
                          })()}</span>
                        </div>

                        {/* Friend selectors */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {Array.from({ length: splitPeopleCount }, (_, pIdx) => {
                            const isAssigned = (itemAssignments[itemIdx] || []).includes(pIdx);
                            return (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() => toggleItemAssignment(itemIdx, pIdx)}
                                className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all border ${
                                  isAssigned 
                                    ? 'bg-orange-500/10 border-orange-500 text-orange-400' 
                                    : 'bg-slate-950 border-white/5 text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                {splitPeopleNames[pIdx]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary split calculations */}
                  <div className="border-t border-white/5 pt-4 space-y-3">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">คลิกเพื่อแสดง QR Code ชำระเงินส่วนตัวของแต่ละคน</span>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Array.from({ length: splitPeopleCount }, (_, pIdx) => {
                        // Calculate personal total
                        let personTotal = 0;
                        cart.forEach((item, itemIdx) => {
                          const assigned = itemAssignments[itemIdx] || [];
                          if (assigned.includes(pIdx)) {
                            let extra = 0;
                            if (item.customizations?.optionSelections) {
                              Object.values(item.customizations.optionSelections).forEach((choice: any) => {
                                extra += choice.price || 0;
                              });
                            }
                            const itemPrice = (item.menuItem.price + extra) * item.quantity;
                            personTotal += itemPrice / assigned.length;
                          }
                        });

                        const isActive = activeSplitPersonIdx === pIdx;

                        return (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => {
                              setActiveSplitPersonIdx(pIdx);
                              playChime(440, 0.1);
                            }}
                            className={`p-2.5 rounded-xl border text-left space-y-1 transition-all ${
                              isActive
                                ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                                : 'bg-slate-900 border-white/5 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <span className="text-[10px] block font-semibold truncate">{splitPeopleNames[pIdx]}</span>
                            <span className="font-mono text-xs font-bold text-white block">฿{personTotal.toFixed(2)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                    {/* Personal Dynamic QR Display card */}
                    <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center space-y-3">
                      <div>
                        <span className="text-[9px] text-slate-500 block">QR สแกนจ่ายเฉพาะส่วนตัวของ</span>
                        <span className="text-xs font-bold text-amber-400">{splitPeopleNames[activeSplitPersonIdx]}</span>
                      </div>

                      <div className="w-32 h-32 bg-white p-1.5 rounded-xl shadow-lg flex items-center justify-center">
                        {(() => {
                          // Calculate personal total for QR
                          let personTotal = 0;
                          cart.forEach((item, itemIdx) => {
                            const assigned = itemAssignments[itemIdx] || [];
                            if (assigned.includes(activeSplitPersonIdx)) {
                              let extra = 0;
                              if (item.customizations?.optionSelections) {
                                Object.values(item.customizations.optionSelections).forEach((choice: any) => {
                                  extra += choice.price || 0;
                                });
                              }
                              const itemPrice = (item.menuItem.price + extra) * item.quantity;
                              personTotal += itemPrice / assigned.length;
                            }
                          });

                          return (
                            <img
                              src={`https://promptpay.io/${(settings.promptPayNumber || '0812345678').replace(/[^0-9]/g, '')}/${personTotal.toFixed(2)}.png`}
                              alt="PromptPay QR Personal"
                              className="w-full h-full object-contain"
                            />
                          );
                        })()}
                      </div>
                      <p className="text-[8px] text-slate-600">สแกนเพื่อโอนเข้าบัญชีพร้อมเพย์ของร้านโดยตรงเพื่อความสะดวกรวดเร็ว</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* ==================== 4. AI SOMMELIER DRAWER / SIDEPANEL CHAT ==================== */}
      {/* Floating AI Sommelier trigger bubble */}
      {activeTab === 'customer' && (
        <button
          id="ai_sommelier_bubble"
          onClick={() => {
            setIsSommelierOpen(!isSommelierOpen);
            playChime(587.33, 0.2); // sweet high chime
          }}
          className="fixed bottom-16 right-6 z-40 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95 border border-white/10 group font-sans font-bold text-xs"
        >
          <Bot className="w-4 h-4 text-white animate-bounce shrink-0" />
          <span>🍷 AI Sommelier แนะนำอาหาร</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </button>
      )}

      {/* Sommelier Drawer Sidebar overlay */}
      {isSommelierOpen && (
        <div id="ai_sommelier_sidebar" className="fixed inset-0 z-50 overflow-hidden font-sans">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSommelierOpen(false)}
          />

          <div className="absolute inset-y-0 right-0 max-w-md w-full bg-[#1E293B] border-l border-white/10 shadow-2xl flex flex-col justify-between animate-slideIn">
            {/* Drawer Header */}
            <div className="p-5 bg-gradient-to-r from-slate-950 to-slate-900 border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-md">
                  <Bot className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm text-white">Aura AI Wine & Dining Sommelier</h3>
                  <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold flex items-center gap-1">
                    <span className="animate-pulse">●</span> Online AI Server Grounding
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsSommelierOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white p-2 rounded-lg border border-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat message space */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {sommelierMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                  <div className={`max-w-[85%] rounded-2xl p-3.5 space-y-2 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-tr-none'
                      : 'bg-slate-900/60 border border-white/5 text-slate-200 rounded-tl-none shadow-md'
                  }`}>
                    <p className="whitespace-pre-line">{msg.text}</p>

                    {/* Scan and render matched interactive order items */}
                    {msg.sender === 'sommelier' && msg.items && msg.items.length > 0 && (
                      <div className="border-t border-white/5 pt-2.5 mt-2 space-y-1.5">
                        <span className="text-[9px] text-orange-400 font-bold block uppercase tracking-wider">🌟 แนะนำเมนูคู่ความอร่อย (สั่งทันที):</span>
                        {msg.items.map(itemId => {
                          const item = menuItems.find(m => m.id === itemId);
                          if (!item) return null;
                          return (
                            <button
                              key={itemId}
                              onClick={() => handleAddSommelierItem(itemId)}
                              className="w-full text-left p-2 bg-slate-950/80 hover:bg-slate-950 rounded-xl border border-white/5 hover:border-amber-500/40 flex justify-between items-center gap-2 transition-all group/item"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <img src={item.image} alt="" className="w-7 h-7 object-cover rounded-md border border-white/10 shrink-0" />
                                <span className="font-bold text-slate-200 truncate group-hover/item:text-amber-400">{item.nameTh}</span>
                              </div>
                              <span className="font-mono text-[11px] text-amber-400 font-bold shrink-0">฿{item.price}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isSommelierLoading && (
                <div className="flex justify-start animate-pulse">
                  <div className="bg-slate-900/60 border border-white/5 rounded-2xl rounded-tl-none p-3 max-w-[80%] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    <span className="text-[10px] text-slate-400 italic font-medium ml-1">ซอมเมอลิเยร์กำลังวิเคราะห์คู่ไวน์...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick action prompts chips */}
            <div className="p-3 bg-slate-950/40 border-t border-white/5 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none">
              <button
                onClick={() => sendSommelierMessage('แนะนำไวน์คู่กับ Australian Wagyu เสิร์ฟคู่กับกระเพราพรีเมียมให้หน่อยครับ')}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/5 text-[10px] text-slate-300 rounded-lg hover:text-white transition-all font-medium inline-block shrink-0"
              >
                🥩 คู่ Wagyu
              </button>
              <button
                onClick={() => sendSommelierMessage('ขอจับคู่เครื่องดื่มเพื่อทานคู่กับ Truffle French Fries และอาหารเรียกน้ำย่อย')}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/5 text-[10px] text-slate-300 rounded-lg hover:text-white transition-all font-medium inline-block shrink-0"
              >
                🍟 คู่ของทานเล่น
              </button>
              <button
                onClick={() => sendSommelierMessage('แนะนำของหวาน Yuzu Rose หรือมะม่วงน้ำดอกไม้ คู่กับแชมเปญสปาร์คกลิ้งหน่อยครับ')}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/5 text-[10px] text-slate-300 rounded-lg hover:text-white transition-all font-medium inline-block shrink-0"
              >
                🍨 คู่ของหวาน
              </button>
            </div>

            {/* Message input panel */}
            <div className="p-4 bg-slate-900 border-t border-white/5 flex gap-2">
              <input
                type="text"
                placeholder="สอบถามซอมเมอลิเยร์เรื่องอาหารและไวน์คู่ความอร่อย..."
                value={sommelierInput}
                onChange={(e) => setSommelierInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendSommelierMessage();
                }}
                disabled={isSommelierLoading}
                className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-white/5 focus:border-orange-500 rounded-xl text-xs text-slate-200 focus:outline-none placeholder:text-slate-500 disabled:opacity-50"
              />
              <button
                onClick={() => sendSommelierMessage()}
                disabled={isSommelierLoading || !sommelierInput.trim()}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-slate-800 text-white p-2.5 rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Footer status bar */}
      <footer id="system_footer" className="h-12 shrink-0 bg-[#1E293B] border-t border-white/5 flex items-center justify-between px-6 md:px-10 text-[10px] md:text-xs text-slate-400 uppercase tracking-wider">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Aura Server Online (Perfect State)</span>
          </div>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline">Secure SSL Endpoints Encryption</span>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <span>SYSTEM V3.5</span>
          <span className="bg-slate-900 px-2.5 py-1 rounded-md text-orange-400 font-bold">2026 UTC</span>
        </div>
      </footer>

    </div>
  );
}
