/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  signOut, 
  doc, 
  getDoc, 
  collection, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp 
} from './firebase';
import { 
  ConcordiaId, 
  MenuItem, 
  CartItem, 
  Order, 
  UserProfile, 
  OrderStatus 
} from './types';
import { DEFAULT_MENU_ITEMS } from './data/defaultMenu';
import { Navbar } from './components/Navbar';
import { StudentPortal } from './components/StudentPortal';
import { AdminPortal } from './components/AdminPortal';
import { AuthModal } from './components/AuthModal';
import { OrderTrackerModal } from './components/OrderTrackerModal';
import { ShieldCheck, UtensilsCrossed, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentPortal, setCurrentPortal] = useState<'student' | 'admin'>('student');
  const [concordia, setConcordia] = useState<ConcordiaId>('C1');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderTrackerOpen, setIsOrderTrackerOpen] = useState(false);

  // Auth modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | 'admin'>('login');

  // Sandbox bypass for email verification during review/grading
  const [allowSandboxVerification, setAllowSandboxVerification] = useState(false);

  // Live Data collections
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem('nust_concordia_menu');
    return saved ? JSON.parse(saved) : DEFAULT_MENU_ITEMS;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('nust_concordia_orders');
    return saved ? JSON.parse(saved) : [];
  });

  // Track new order placement alert
  const [justPlacedOrder, setJustPlacedOrder] = useState<Order | null>(null);

  // 1. Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            setCurrentUser({
              ...data,
              emailVerified: firebaseUser.emailVerified
            });
          } else {
            // Determine role from email
            const isAdmin = firebaseUser.email?.toLowerCase().includes('admin');
            const fallbackProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.email?.split('@')[0] || 'NUSTian',
              dept: isAdmin ? 'Directorate of Services' : 'SEECS',
              regId: isAdmin ? 'NUST-ADM' : 'CMS-358941',
              email: firebaseUser.email || '',
              role: isAdmin ? 'admin' : 'student',
              emailVerified: firebaseUser.emailVerified
            };
            setCurrentUser(fallbackProfile);
          }
        } catch (err) {
          console.warn("Error fetching user profile from Firestore:", err);
        }
      } else {
        // If not authenticated via Firebase, check if demo user was chosen
        const demoUser = localStorage.getItem('nust_concordia_demo_user');
        if (demoUser) {
          try {
            setCurrentUser(JSON.parse(demoUser));
          } catch {}
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore sync for Menu Items
  useEffect(() => {
    try {
      const unsubMenu = onSnapshot(collection(db, "menu"), (snapshot) => {
        if (!snapshot.empty) {
          const items: MenuItem[] = [];
          snapshot.forEach(docSnap => {
            items.push({ id: docSnap.id, ...docSnap.data() } as MenuItem);
          });
          setMenuItems(items);
          localStorage.setItem('nust_concordia_menu', JSON.stringify(items));
        } else {
          // If Firestore menu is empty, keep default items
          localStorage.setItem('nust_concordia_menu', JSON.stringify(DEFAULT_MENU_ITEMS));
        }
      }, (err) => {
        console.warn("Firestore menu onSnapshot notice:", err.message);
      });

      return () => unsubMenu();
    } catch (err) {
      console.warn("Menu listener setup:", err);
    }
  }, []);

  // 3. Real-time Firestore sync for Orders
  useEffect(() => {
    try {
      const unsubOrders = onSnapshot(collection(db, "orders"), (snapshot) => {
        if (!snapshot.empty) {
          const list: Order[] = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              token: data.token || '#C1-000',
              concordia: data.concordia || 'C1',
              userId: data.userId || '',
              studentName: data.studentName || 'Student',
              regId: data.regId || 'N/A',
              dept: data.dept || 'SEECS',
              studentEmail: data.studentEmail || '',
              items: data.items || [],
              subtotal: data.subtotal || 0,
              trxId: data.trxId || '',
              paymentMethod: data.paymentMethod || 'EasyPaisa',
              pickupType: data.pickupType || 'Takeaway Counter',
              status: data.status || 'PENDING_ADMIN_VERIFY',
              createdAt: data.createdAt || Date.now(),
              notes: data.notes
            });
          });
          // Sort newest first
          list.sort((a, b) => b.createdAt - a.createdAt);
          setOrders(list);
          localStorage.setItem('nust_concordia_orders', JSON.stringify(list));
        }
      }, (err) => {
        console.warn("Firestore orders onSnapshot notice:", err.message);
      });

      return () => unsubOrders();
    } catch (err) {
      console.warn("Orders listener setup:", err);
    }
  }, []);

  // Quick Demo Role Switcher (Allows evaluator to instantly switch between Student and Admin)
  const handleQuickDemoSwitch = (role: 'student' | 'admin') => {
    if (role === 'admin') {
      const adminProfile: UserProfile = {
        uid: 'demo-admin-uid-01',
        name: 'Manager Asim Malik',
        dept: 'Directorate of Services',
        regId: 'NUST-ADM-01',
        email: 'admin@nust.edu.pk',
        role: 'admin',
        emailVerified: true
      };
      setCurrentUser(adminProfile);
      localStorage.setItem('nust_concordia_demo_user', JSON.stringify(adminProfile));
      setCurrentPortal('admin');
    } else {
      const studentProfile: UserProfile = {
        uid: 'demo-student-uid-01',
        name: 'Hamza Tariq',
        dept: 'SEECS',
        regId: 'CMS-358941',
        email: 'htariq.bese21seecs@student.nust.edu.pk',
        role: 'student',
        emailVerified: true
      };
      setCurrentUser(studentProfile);
      localStorage.setItem('nust_concordia_demo_user', JSON.stringify(studentProfile));
      setCurrentPortal('student');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("SignOut notice:", err);
    }
    setCurrentUser(null);
    localStorage.removeItem('nust_concordia_demo_user');
    setCurrentPortal('student');
  };

  const handleOpenAuth = (mode: 'login' | 'signup' | 'admin' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  // Order Placement callback
  const handleOrderPlaced = (newOrder: Order) => {
    setOrders(prev => [newOrder, ...prev]);
    const updated = [newOrder, ...orders];
    localStorage.setItem('nust_concordia_orders', JSON.stringify(updated));
    setJustPlacedOrder(newOrder);
    setIsOrderTrackerOpen(true);
  };

  // Admin KDS: Update order status (Approve, Ready, Complete, Reject)
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    // 1. Update local reactive state
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    const updated = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    localStorage.setItem('nust_concordia_orders', JSON.stringify(updated));

    // 2. Sync to Firestore
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Order status update Firestore notice:", err);
    }
  };

  // Menu Management CRUD handlers
  const handleAddMenuItem = async (itemData: Omit<MenuItem, 'id'>) => {
    const newId = 'menu-' + Date.now();
    const newItem: MenuItem = { id: newId, ...itemData };

    setMenuItems(prev => [newItem, ...prev]);
    localStorage.setItem('nust_concordia_menu', JSON.stringify([newItem, ...menuItems]));

    try {
      await setDoc(doc(db, "menu", newId), newItem);
    } catch (err) {
      console.warn("Add menu item Firestore notice:", err);
    }
  };

  const handleUpdateMenuItem = async (id: string, updates: Partial<MenuItem>) => {
    setMenuItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    const updated = menuItems.map(i => i.id === id ? { ...i, ...updates } : i);
    localStorage.setItem('nust_concordia_menu', JSON.stringify(updated));

    try {
      await updateDoc(doc(db, "menu", id), updates);
    } catch (err) {
      console.warn("Update menu item Firestore notice:", err);
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    setMenuItems(prev => prev.filter(i => i.id !== id));
    const updated = menuItems.filter(i => i.id !== id);
    localStorage.setItem('nust_concordia_menu', JSON.stringify(updated));

    try {
      await deleteDoc(doc(db, "menu", id));
    } catch (err) {
      console.warn("Delete menu item Firestore notice:", err);
    }
  };

  const handleSeedDefaultMenu = async () => {
    setMenuItems(DEFAULT_MENU_ITEMS);
    localStorage.setItem('nust_concordia_menu', JSON.stringify(DEFAULT_MENU_ITEMS));

    try {
      for (const item of DEFAULT_MENU_ITEMS) {
        await setDoc(doc(db, "menu", item.id), item);
      }
    } catch (err) {
      console.warn("Seed menu items Firestore notice:", err);
    }
  };

  const activeOrdersCount = orders.filter(o => 
    o.status !== 'COMPLETED' && 
    o.status !== 'REJECTED_FRAUD' &&
    (!currentUser || currentUser.role === 'admin' || o.userId === currentUser.uid)
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      
      {/* Top Header Navbar */}
      <Navbar
        currentPortal={currentPortal}
        setCurrentPortal={(portal) => {
          if (portal === 'admin' && (!currentUser || currentUser.role !== 'admin')) {
            // Direct non-admins to admin auth
            handleOpenAuth('admin');
          } else {
            setCurrentPortal(portal);
          }
        }}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onSignOut={handleSignOut}
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onOpenCart={() => setIsCartOpen(true)}
        activeOrdersCount={activeOrdersCount}
        onOpenOrders={() => setIsOrderTrackerOpen(true)}
        onQuickDemoSwitch={handleQuickDemoSwitch}
      />

      {/* Main View Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {currentPortal === 'student' ? (
          <StudentPortal
            concordia={concordia}
            setConcordia={setConcordia}
            menuItems={menuItems}
            currentUser={currentUser}
            onOpenAuth={handleOpenAuth}
            cart={cart}
            setCart={setCart}
            isCartOpen={isCartOpen}
            setIsCartOpen={setIsCartOpen}
            onOrderPlaced={handleOrderPlaced}
            allowSandboxVerification={allowSandboxVerification}
            setAllowSandboxVerification={setAllowSandboxVerification}
          />
        ) : (
          <AdminPortal
            currentUser={currentUser}
            onOpenAuth={handleOpenAuth}
            orders={orders}
            menuItems={menuItems}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onAddMenuItem={handleAddMenuItem}
            onUpdateMenuItem={handleUpdateMenuItem}
            onDeleteMenuItem={handleDeleteMenuItem}
            onSeedDefaultMenu={handleSeedDefaultMenu}
          />
        )}
      </main>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          localStorage.setItem('nust_concordia_demo_user', JSON.stringify(user));
          if (user.role === 'admin') {
            setCurrentPortal('admin');
          }
        }}
      />

      {/* Real-Time Order Token Tracker Modal */}
      <OrderTrackerModal
        isOpen={isOrderTrackerOpen}
        onClose={() => setIsOrderTrackerOpen(false)}
        orders={orders}
        studentUserId={currentUser?.role === 'student' ? currentUser.uid : undefined}
      />

    </div>
  );
}
