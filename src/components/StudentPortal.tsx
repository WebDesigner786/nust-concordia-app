import React, { useState, useMemo } from 'react';
import { 
  ConcordiaId, 
  Category, 
  MenuItem, 
  CartItem, 
  UserProfile, 
  Order 
} from '../types';
import { CONCORDIA_ACCOUNTS } from '../data/defaultMenu';
import { 
  Search, 
  Plus, 
  Minus, 
  ShoppingBag, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  QrCode, 
  Copy, 
  Check, 
  Lock, 
  Sparkles,
  ArrowRight,
  X,
  CreditCard,
  Building,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Flame,
  Utensils
} from 'lucide-react';
import { 
  db, 
  auth, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  serverTimestamp,
  sendEmailVerification
} from '../firebase';

interface StudentPortalProps {
  concordia: ConcordiaId;
  setConcordia: (c: ConcordiaId) => void;
  menuItems: MenuItem[];
  currentUser: UserProfile | null;
  onOpenAuth: (mode?: 'login' | 'signup' | 'admin') => void;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  onOrderPlaced: (order: Order) => void;
  allowSandboxVerification: boolean;
  setAllowSandboxVerification: (v: boolean) => void;
}

const CATEGORIES: Category[] = ['All', 'Fast Food', 'Desi Meals', 'Beverages', 'Snacks'];

export const StudentPortal: React.FC<StudentPortalProps> = ({
  concordia,
  setConcordia,
  menuItems,
  currentUser,
  onOpenAuth,
  cart,
  setCart,
  isCartOpen,
  setIsCartOpen,
  onOrderPlaced,
  allowSandboxVerification,
  setAllowSandboxVerification
}) => {
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Checkout Modal States
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'EasyPaisa' | 'JazzCash'>('EasyPaisa');
  const [pickupType, setPickupType] = useState<'Dine-In' | 'Takeaway Counter'>('Takeaway Counter');
  const [trxIdInput, setTrxIdInput] = useState('');
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [fraudAlert, setFraudAlert] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // Filter items for current concordia & category & search
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesConcordia = item.concordia === concordia;
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesConcordia && matchesCategory && matchesSearch;
    });
  }, [menuItems, concordia, selectedCategory, searchQuery]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.item.price * item.quantity), 0);
  }, [cart]);

  const addToCart = (item: MenuItem) => {
    if (!item.isAvailable) return;
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateCartQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(i => {
        if (i.item.id === itemId) {
          const newQty = i.quantity + delta;
          return newQty > 0 ? { ...i, quantity: newQty } : null;
        }
        return i;
      }).filter(Boolean) as CartItem[];
    });
  };

  const handleStartCheckout = () => {
    if (!currentUser) {
      onOpenAuth('login');
      return;
    }

    // Check email verification requirement
    const isVerified = currentUser.emailVerified || allowSandboxVerification;
    if (!isVerified) {
      // User must verify email
      setIsCartOpen(false);
      return;
    }

    setIsCartOpen(false);
    setIsCheckoutModalOpen(true);
    setFraudAlert(null);
  };

  const handleCopyAccount = (number: string) => {
    navigator.clipboard.writeText(number.replace(/-/g, ''));
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleResendEmail = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        setResendStatus("Verification email sent! Check your student inbox.");
      } catch (e: any) {
        setResendStatus("Email dispatched recently. Please check your junk/spam folder.");
      }
      setTimeout(() => setResendStatus(null), 4000);
    }
  };

  const handleReloadVerification = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        window.location.reload();
      } else {
        setResendStatus("Email is still not marked verified. Check link or toggle Sandbox bypass.");
        setTimeout(() => setResendStatus(null), 3000);
      }
    }
  };

  // Submit order with Layer 1 Anti-Scam Lock
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFraudAlert(null);

    const cleanTrx = trxIdInput.trim();

    // 1. Validate exactly 11 numeric digits
    if (!/^\d{11}$/.test(cleanTrx)) {
      setFraudAlert("Transaction Reference ID must contain exactly 11 numeric digits (e.g., 29485718294).");
      return;
    }

    if (!currentUser) {
      onOpenAuth('login');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      // 2. Query /transactions/{trxId} in Firestore
      let isDuplicate = false;
      const trxDocRef = doc(db, "transactions", cleanTrx);
      
      try {
        const trxDoc = await getDoc(trxDocRef);
        if (trxDoc.exists()) {
          isDuplicate = true;
        }
      } catch (err: any) {
        console.warn("Transaction check notice:", err);
        // Also check localStorage in case offline/sandbox
        const localUsedTrx = JSON.parse(localStorage.getItem('nust_concordia_used_trx') || '[]');
        if (localUsedTrx.includes(cleanTrx)) {
          isDuplicate = true;
        }
      }

      // 3. IF TRX ID exists: Block order instantly
      if (isDuplicate) {
        setFraudAlert("Fraud Alert: This Transaction Reference ID has already been used!");
        setIsSubmittingOrder(false);
        return;
      }

      // 4. IF TRX ID is unique: Write to /transactions/{trxId}
      const trxPayload = {
        trxId: cleanTrx,
        usedBy: currentUser.uid,
        regId: currentUser.regId,
        studentName: currentUser.name,
        amount: cartTotal,
        concordia,
        timestamp: serverTimestamp()
      };

      try {
        await setDoc(trxDocRef, trxPayload);
      } catch (err) {
        console.warn("Saving to firestore trxDoc notice:", err);
      }
      // Keep local lock as well
      const localUsedTrx = JSON.parse(localStorage.getItem('nust_concordia_used_trx') || '[]');
      localUsedTrx.push(cleanTrx);
      localStorage.setItem('nust_concordia_used_trx', JSON.stringify(localUsedTrx));

      // 5. Generate unique token, e.g. #C1-104
      const tokenNumber = Math.floor(100 + Math.random() * 900);
      const generatedToken = `#${concordia}-${tokenNumber}`;

      const newOrder: Order = {
        id: 'ord-' + Date.now(),
        token: generatedToken,
        concordia,
        userId: currentUser.uid,
        studentName: currentUser.name,
        regId: currentUser.regId,
        dept: currentUser.dept,
        studentEmail: currentUser.email,
        items: cart.map(c => ({
          id: c.item.id,
          name: c.item.name,
          price: c.item.price,
          quantity: c.quantity
        })),
        subtotal: cartTotal,
        trxId: cleanTrx,
        paymentMethod: selectedPaymentMethod,
        pickupType,
        status: 'PENDING_ADMIN_VERIFY',
        createdAt: Date.now()
      };

      try {
        await addDoc(collection(db, "orders"), {
          ...newOrder,
          serverCreatedTime: serverTimestamp()
        });
      } catch (err) {
        console.warn("Adding order to firestore notice:", err);
      }

      // Clear cart & trigger order placed modal
      setCart([]);
      setIsCheckoutModalOpen(false);
      setTrxIdInput('');
      onOrderPlaced(newOrder);

    } catch (err: any) {
      console.error("Order submit error:", err);
      setFraudAlert("Failed to process transaction. Please check your network connection.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const activeAccount = CONCORDIA_ACCOUNTS[concordia];
  const paymentDetails = selectedPaymentMethod === 'EasyPaisa' ? activeAccount.easypaisa : activeAccount.jazzcash;

  const isEmailVerified = currentUser?.emailVerified || allowSandboxVerification;

  return (
    <div className="space-y-6 pb-20">
      
      {/* Email Verification Banner */}
      {currentUser && !isEmailVerified && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-300">
                Action Required: Verify Your NUST Student Email
              </h4>
              <p className="text-xs text-amber-200/80">
                Order placement requires email verification sent to <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-300">{currentUser.email}</code>.
              </p>
              {resendStatus && (
                <p className="text-xs text-emerald-400 font-semibold mt-1">{resendStatus}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleResendEmail}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/40 transition flex items-center gap-1.5"
            >
              <Send className="w-3 h-3" />
              Resend Email
            </button>
            <button
              onClick={handleReloadVerification}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              Check Status
            </button>
            <button
              onClick={() => setAllowSandboxVerification(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
              title="Bypass check for sandbox demo review"
            >
              Demo Bypass Verification
            </button>
          </div>
        </div>
      )}

      {/* Hero Concordia Switcher Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-xs font-bold mb-2">
              <Building className="w-3.5 h-3.5" />
              <span>Select Active Dining Facility</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Order from {activeAccount.name}
            </h1>
            <p className="text-xs md:text-sm text-slate-400 flex items-center gap-1.5 mt-1">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{activeAccount.location}</span>
            </p>
          </div>

          {/* Concordia Toggle Buttons */}
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
            {(['C1', 'C2', 'C3'] as ConcordiaId[]).map((cid) => {
              const info = CONCORDIA_ACCOUNTS[cid];
              const isSelected = concordia === cid;
              return (
                <button
                  key={cid}
                  onClick={() => setConcordia(cid)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-gradient-to-b from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-700/30 ring-1 ring-emerald-400/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <span className="text-base font-black tracking-wider">{cid}</span>
                  <span className="text-[10px] font-medium opacity-90 truncate max-w-[80px]">
                    {cid === 'C1' ? 'Central' : cid === 'C2' ? 'Food Court' : 'Retro Cafe'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment Account Strip */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
              Direct Counter Payment:
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-emerald-400 font-semibold">
              EasyPaisa: {activeAccount.easypaisa.accountNumber}
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-950/70 border border-rose-900 text-rose-400 font-semibold">
              JazzCash: {activeAccount.jazzcash.accountNumber}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Anti-Scam 11-digit TRX Verification Active</span>
          </div>
        </div>
      </div>

      {/* Menu Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search burgers, biryani, chai..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredItems.map(item => {
          const inCart = cart.find(c => c.item.id === item.id);
          return (
            <div
              key={item.id}
              className={`group bg-slate-900 border rounded-2xl overflow-hidden shadow-lg transition-all hover:border-slate-700 flex flex-col justify-between ${
                item.isAvailable ? 'border-slate-800' : 'border-slate-800/50 opacity-75'
              }`}
            >
              <div className="relative h-44 overflow-hidden bg-slate-950">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>

                {/* Concordia Badge */}
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-700 text-[10px] font-black text-slate-200">
                  {item.concordia}
                </div>

                {/* Stock Badge */}
                {!item.isAvailable && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-lg bg-rose-900/90 text-rose-200 text-[10px] font-black border border-rose-700">
                    OUT OF STOCK
                  </div>
                )}

                {item.prepTimeMinutes && (
                  <div className="absolute bottom-2 left-3 flex items-center gap-1 text-[11px] font-semibold text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded-md backdrop-blur-sm">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>~{item.prepTimeMinutes} mins</span>
                  </div>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition">
                      {item.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {item.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Price</span>
                    <p className="text-base font-black text-emerald-400">
                      Rs. {item.price}
                    </p>
                  </div>

                  {item.isAvailable ? (
                    inCart ? (
                      <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl p-1">
                        <button
                          onClick={() => updateCartQuantity(item.id, -1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-white">
                          {inCart.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQuantity(item.id, 1)}
                          className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    )
                  ) : (
                    <button
                      disabled
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-500 font-medium text-xs cursor-not-allowed"
                    >
                      Unavailable
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl p-8">
          <Utensils className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No Menu Items Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your category filter or search query for {activeAccount.name}.
          </p>
        </div>
      )}

      {/* Floating Cart Button for Mobile */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-6 left-4 right-4 z-30 md:hidden">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-2xl shadow-emerald-600/50 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span>{cart.reduce((s, i) => s + i.quantity, 0)} Items Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Rs. {cartTotal}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm animate-fade-in flex justify-end">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
            
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Your Concordia Cart</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  {concordia}
                </span>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <ShoppingBag className="w-12 h-12 text-slate-700 mb-3" />
                  <p className="text-slate-300 font-semibold text-sm">Your cart is empty</p>
                  <p className="text-slate-500 text-xs mt-1">Select delicious meals from {activeAccount.name}</p>
                </div>
              ) : (
                cart.map(c => (
                  <div
                    key={c.item.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <img
                      src={c.item.imageUrl}
                      alt={c.item.name}
                      className="w-12 h-12 rounded-lg object-cover bg-slate-900 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{c.item.name}</h4>
                      <p className="text-xs text-emerald-400 font-bold">
                        Rs. {c.item.price * c.quantity}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1">
                      <button
                        onClick={() => updateCartQuantity(c.item.id, -1)}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-white">
                        {c.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQuantity(c.item.id, 1)}
                        className="w-6 h-6 rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="font-bold text-white">Rs. {cartTotal}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Anti-Scam Platform Fee</span>
                  <span className="text-emerald-400 font-bold">Rs. 0 (Free)</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-base">
                  <span className="font-bold text-white">Total Amount</span>
                  <span className="font-black text-emerald-400 text-lg">Rs. {cartTotal}</span>
                </div>

                {!currentUser ? (
                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      onOpenAuth('login');
                    }}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg"
                  >
                    Log In with NUST ID to Checkout
                  </button>
                ) : !isEmailVerified ? (
                  <div className="space-y-2">
                    <button
                      disabled
                      className="w-full py-3 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs cursor-not-allowed"
                    >
                      Email Verification Required to Checkout
                    </button>
                    <p className="text-[11px] text-center text-amber-400">
                      Check your student inbox or enable demo sandbox verification above.
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleStartCheckout}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                  >
                    <span>Proceed to EasyPaisa / JazzCash Payment</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Two-Layer Anti-Scam Checkout & 11-Digit TRX ID Modal */}
      {isCheckoutModalOpen && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  Step 2 • Anti-Scam Verification
                </span>
                <h3 className="text-lg font-black text-white">
                  Payment for {activeAccount.short}
                </h3>
              </div>
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              
              {/* Fraud Alert Notification */}
              {fraudAlert && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-rose-200">Verification Blocked</h5>
                    <p className="mt-0.5">{fraudAlert}</p>
                  </div>
                </div>
              )}

              {/* Payment Method Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  1. Select Payment Channel
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('EasyPaisa')}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      selectedPaymentMethod === 'EasyPaisa'
                        ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500/40'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-left">
                      <span className="text-xs font-black text-emerald-400">EasyPaisa</span>
                      <p className="text-[10px] text-slate-400">Instant counter SMS</p>
                    </div>
                    <div className="w-3.5 h-3.5 rounded-full border border-emerald-400 flex items-center justify-center">
                      {selectedPaymentMethod === 'EasyPaisa' && (
                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('JazzCash')}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      selectedPaymentMethod === 'JazzCash'
                        ? 'border-rose-500 bg-rose-950/30 ring-1 ring-rose-500/40'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-left">
                      <span className="text-xs font-black text-rose-400">JazzCash</span>
                      <p className="text-[10px] text-slate-400">Direct wallet sync</p>
                    </div>
                    <div className="w-3.5 h-3.5 rounded-full border border-rose-400 flex items-center justify-center">
                      {selectedPaymentMethod === 'JazzCash' && (
                        <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* QR Code & Account Box */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
                {/* Visual Styled QR Box */}
                <div className="w-28 h-28 bg-white p-2 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-md">
                  <div className="grid grid-cols-5 gap-0.5 w-full h-full p-1 bg-slate-100 rounded">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-xs ${
                          (i % 2 === 0 || i % 7 === 0) ? 'bg-slate-900' : 'bg-transparent'
                        }`}
                      ></div>
                    ))}
                  </div>
                  <span className="text-[9px] font-black text-slate-800 mt-1 tracking-wider uppercase">
                    Scan {selectedPaymentMethod}
                  </span>
                </div>

                <div className="flex-1 space-y-1.5 text-center sm:text-left">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    {concordia} Official Account
                  </span>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-lg font-mono font-black text-white">
                      {paymentDetails.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyAccount(paymentDetails.accountNumber)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Copy account number"
                    >
                      {copiedAccount ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    Title: <span className="font-bold text-emerald-400">{paymentDetails.accountTitle}</span>
                  </p>
                  <p className="text-xs text-amber-400 font-bold">
                    Exact Transfer Amount: Rs. {cartTotal}
                  </p>
                </div>
              </div>

              {/* Pickup Option */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  2. Dining Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Takeaway Counter', 'Dine-In'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPickupType(mode)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition ${
                        pickupType === mode
                          ? 'bg-slate-800 text-emerald-400 border border-emerald-500/50'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layer 1 Input Form */}
              <form onSubmit={handleSubmitOrder} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>3. Enter 11-Digit Transaction Reference ID (TRX ID)</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {trxIdInput.length}/11 digits
                    </span>
                  </div>

                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={trxIdInput}
                    onChange={(e) => {
                      const numeric = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setTrxIdInput(numeric);
                    }}
                    placeholder="e.g. 29485718294 (from SMS / Receipt)"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm tracking-widest focus:outline-none focus:border-emerald-500 transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Layer 1 Engine permanently locks this TRX ID. Duplicate submissions are automatically rejected.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Student: {currentUser.name} ({currentUser.dept})</span>
                    <span>CMS: {currentUser.regId}</span>
                  </div>
                  <div className="flex justify-between font-bold text-white pt-1 border-t border-slate-800">
                    <span>Subtotal to Pay</span>
                    <span className="text-emerald-400">Rs. {cartTotal}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingOrder || trxIdInput.length !== 11}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmittingOrder ? (
                    <span>Verifying Unique TRX ID & Locking...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Lock TRX ID & Submit Order to Kitchen</span>
                    </>
                  )}
                </button>
              </form>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
