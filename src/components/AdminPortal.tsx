import React, { useState } from 'react';
import { 
  ConcordiaId, 
  MenuItem, 
  Order, 
  UserProfile, 
  OrderStatus 
} from '../types';
import { 
  ChefHat, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  Copy, 
  Building2, 
  Sparkles, 
  Ban,
  Filter,
  DollarSign,
  Utensils,
  Layers,
  ArrowRight
} from 'lucide-react';
import { 
  db, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  collection, 
  serverTimestamp 
} from '../firebase';
import { CONCORDIA_ACCOUNTS } from '../data/defaultMenu';

interface AdminPortalProps {
  currentUser: UserProfile | null;
  onOpenAuth: (mode?: 'login' | 'signup' | 'admin') => void;
  orders: Order[];
  menuItems: MenuItem[];
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => Promise<void>;
  onAddMenuItem: (item: Omit<MenuItem, 'id'>) => Promise<void>;
  onUpdateMenuItem: (id: string, updates: Partial<MenuItem>) => Promise<void>;
  onDeleteMenuItem: (id: string) => Promise<void>;
  onSeedDefaultMenu: () => Promise<void>;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  currentUser,
  onOpenAuth,
  orders,
  menuItems,
  onUpdateOrderStatus,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onSeedDefaultMenu
}) => {
  const [selectedConcordia, setSelectedConcordia] = useState<ConcordiaId | 'ALL'>('C1');
  const [activeTab, setActiveTab] = useState<'KDS' | 'MENU'>('KDS');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [copiedTrxId, setCopiedTrxId] = useState<string | null>(null);

  // New Menu Item Form Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState(250);
  const [newItemCategory, setNewItemCategory] = useState<'Fast Food' | 'Desi Meals' | 'Beverages' | 'Snacks'>('Fast Food');
  const [newItemConcordia, setNewItemConcordia] = useState<ConcordiaId>('C1');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemImage, setNewItemImage] = useState('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60');

  // Edit Price Inline
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);

  // SECURED ACCESS CONTROL CHECK:
  // Non-admin student users MUST be completely blocked from accessing the Admin view
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">
            Restricted Admin KDS Portal
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            This dashboard is exclusively reserved for Concordia Cafeteria Managers & NUST Directorate of Services to verify 11-digit TRX payments and oversee kitchen orders.
          </p>
          {currentUser && currentUser.role === 'student' && (
            <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs inline-block">
              Logged in as Student (<span className="font-bold">{currentUser.name} - {currentUser.dept}</span>). Students are barred from accessing kitchen control systems.
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onOpenAuth('admin')}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20"
          >
            Sign In with Admin Credentials
          </button>
        </div>
      </div>
    );
  }

  // Filter orders by concordia & status
  const filteredOrders = orders.filter(order => {
    const matchesConcordia = selectedConcordia === 'ALL' || order.concordia === selectedConcordia;
    if (!matchesConcordia) return false;

    if (statusFilter === 'ACTIVE') {
      return order.status !== 'COMPLETED' && order.status !== 'REJECTED_FRAUD';
    }
    if (statusFilter === 'PENDING') {
      return order.status === 'PENDING_ADMIN_VERIFY';
    }
    if (statusFilter === 'PREPARING') {
      return order.status === 'PREPARING';
    }
    if (statusFilter === 'READY') {
      return order.status === 'READY_FOR_PICKUP';
    }
    if (statusFilter === 'COMPLETED') {
      return order.status === 'COMPLETED';
    }
    return true;
  });

  // Filter menu items by concordia
  const filteredMenuItems = menuItems.filter(item => {
    return selectedConcordia === 'ALL' || item.concordia === selectedConcordia;
  });

  const handleCopyTrx = (trx: string) => {
    navigator.clipboard.writeText(trx);
    setCopiedTrxId(trx);
    setTimeout(() => setCopiedTrxId(null), 2000);
  };

  const handleSaveNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    await onAddMenuItem({
      name: newItemName.trim(),
      price: Number(newItemPrice),
      category: newItemCategory,
      concordia: newItemConcordia,
      description: newItemDesc.trim() || 'Prepared fresh at Concordia cafe.',
      imageUrl: newItemImage.trim(),
      isAvailable: true,
      prepTimeMinutes: 10
    });

    setIsAddModalOpen(false);
    setNewItemName('');
    setNewItemDesc('');
  };

  const pendingCount = orders.filter(o => o.status === 'PENDING_ADMIN_VERIFY').length;

  return (
    <div className="space-y-6 pb-20">
      
      {/* Admin Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold mb-2">
              <ChefHat className="w-3.5 h-3.5" />
              <span>Concordia Operations & Kitchen Control System</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              KDS Manager • {selectedConcordia === 'ALL' ? 'All Concordias' : CONCORDIA_ACCOUNTS[selectedConcordia].name}
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Cross-check 11-digit SMS receipts, approve kitchen orders, and manage live food catalog.
            </p>
          </div>

          {/* Concordia Selector */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 flex-wrap">
            {(['C1', 'C2', 'C3', 'ALL'] as (ConcordiaId | 'ALL')[]).map(cid => (
              <button
                key={cid}
                onClick={() => setSelectedConcordia(cid)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                  selectedConcordia === cid
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {cid === 'ALL' ? 'All Facilities' : cid}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('KDS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'KDS'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              <span>Kitchen Display Queue</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('MENU')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'MENU'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>Menu Management (CRUD)</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Manager: <span className="text-white font-bold">{currentUser.name}</span>
          </div>
        </div>
      </div>

      {/* TAB 1: KITCHEN DISPLAY QUEUE (KDS) */}
      {activeTab === 'KDS' && (
        <div className="space-y-4">
          
          {/* Status Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'ACTIVE', label: 'Active Pipeline' },
              { id: 'PENDING', label: 'Pending Payment Verify' },
              { id: 'PREPARING', label: 'In Kitchen (Preparing)' },
              { id: 'READY', label: 'Ready for Pickup' },
              { id: 'COMPLETED', label: 'Completed' },
              { id: 'ALL', label: 'Show All' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  statusFilter === f.id
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40 shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Orders Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOrders.map(order => {
              const isPending = order.status === 'PENDING_ADMIN_VERIFY';
              const isPreparing = order.status === 'PREPARING';
              const isReady = order.status === 'READY_FOR_PICKUP';
              const isCompleted = order.status === 'COMPLETED';
              const isFraud = order.status === 'REJECTED_FRAUD';

              return (
                <div
                  key={order.id}
                  className={`bg-slate-900 border rounded-2xl p-5 shadow-xl transition flex flex-col justify-between ${
                    isPending
                      ? 'border-amber-500/50 ring-1 ring-amber-500/30'
                      : isPreparing
                      ? 'border-cyan-500/40'
                      : isReady
                      ? 'border-emerald-500/50'
                      : 'border-slate-800 opacity-80'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Top Order Token & Status Pill */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black font-mono text-white bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
                          {order.token}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded font-black bg-slate-800 text-slate-300">
                          {order.concordia}
                        </span>
                      </div>

                      {isPending && (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                          <Clock className="w-3 h-3" />
                          PENDING VERIFY
                        </span>
                      )}
                      {isPreparing && (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                          <ChefHat className="w-3 h-3" />
                          PREPARING
                        </span>
                      )}
                      {isReady && (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          READY FOR PICKUP
                        </span>
                      )}
                      {isCompleted && (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-800 text-slate-400">
                          COMPLETED
                        </span>
                      )}
                      {isFraud && (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          REJECTED FRAUD
                        </span>
                      )}
                    </div>

                    {/* Student Info Box */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                      <div className="flex justify-between font-bold text-white">
                        <span>{order.studentName}</span>
                        <span className="text-emerald-400">{order.dept}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>CMS ID: {order.regId}</span>
                        <span>{order.pickupType}</span>
                      </div>
                    </div>

                    {/* Anti-Scam Layer 2 Cross-Check Box */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Layer 2: SMS TRX Check
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {order.paymentMethod}
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                        <span className="font-mono text-xs font-black text-amber-300 tracking-wider">
                          TRX: {order.trxId}
                        </span>
                        <button
                          onClick={() => handleCopyTrx(order.trxId)}
                          className="p-1 rounded text-slate-400 hover:text-white transition"
                          title="Copy TRX ID to search SMS"
                        >
                          {copiedTrxId === order.trxId ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Cross-check with counter phone SMS before tapping approve.
                      </p>
                    </div>

                    {/* Ordered Items List */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        Ordered Items
                      </span>
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-slate-300">
                            <span>{it.quantity}x {it.name}</span>
                            <span className="font-mono text-slate-400">Rs. {it.price * it.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Subtotal */}
                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
                      <span className="text-slate-400">Total Charged:</span>
                      <span className="text-emerald-400 font-black text-base">Rs. {order.subtotal}</span>
                    </div>
                  </div>

                  {/* KDS Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                    {isPending && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => onUpdateOrderStatus(order.id, 'PREPARING')}
                          className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-600/30 transition flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Verify</span>
                        </button>

                        <button
                          onClick={() => onUpdateOrderStatus(order.id, 'REJECTED_FRAUD')}
                          className="py-2.5 px-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Reject Fake</span>
                        </button>
                      </div>
                    )}

                    {isPreparing && (
                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'READY_FOR_PICKUP')}
                        className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs shadow-md shadow-cyan-600/30 transition flex items-center justify-center gap-2"
                      >
                        <ChefHat className="w-4 h-4" />
                        <span>Mark Ready for Pickup</span>
                      </button>
                    )}

                    {isReady && (
                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'COMPLETED')}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-600/30 transition flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Complete Order & Archive</span>
                      </button>
                    )}

                    {isCompleted && (
                      <div className="text-center py-1 text-xs text-slate-500 font-semibold flex items-center justify-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Order Fulfilled & Handed Over</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl p-8">
              <ChefHat className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No Orders in this View</h3>
              <p className="text-xs text-slate-400 mt-1">
                New student orders submitted with verified 11-digit TRX will stream in here live.
              </p>
            </div>
          )}

        </div>
      )}

      {/* TAB 2: MENU MANAGEMENT (CRUD) */}
      {activeTab === 'MENU' && (
        <div className="space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">
                Live Catalog Controls
              </h3>
              <p className="text-xs text-slate-400">
                Instantly toggle In-Stock / Out-of-Stock, adjust prices, or introduce new dishes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onSeedDefaultMenu}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
                title="Reset or seed initial items for C1, C2, and C3"
              >
                Reset Default Menus
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition shadow-lg shadow-emerald-600/30 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Menu Item</span>
              </button>
            </div>
          </div>

          {/* Menu Items Table / Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Item</th>
                    <th className="py-3 px-4">Concordia</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Price (PKR)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredMenuItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-950 shrink-0"
                          />
                          <div>
                            <span className="font-bold text-white block">{item.name}</span>
                            <span className="text-[11px] text-slate-400 truncate max-w-xs block">
                              {item.description}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded font-black text-[10px] bg-slate-950 border border-slate-800 text-white">
                          {item.concordia}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300">
                          {item.category}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {editingPriceId === item.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={tempPrice}
                              onChange={(e) => setTempPrice(Number(e.target.value))}
                              className="w-16 px-1.5 py-1 bg-slate-950 border border-emerald-500 rounded text-xs text-white"
                            />
                            <button
                              onClick={async () => {
                                await onUpdateMenuItem(item.id, { price: tempPrice });
                                setEditingPriceId(null);
                              }}
                              className="p-1 rounded bg-emerald-600 text-white"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingPriceId(null)}
                              className="p-1 rounded bg-slate-800 text-slate-400"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-400">Rs. {item.price}</span>
                            <button
                              onClick={() => {
                                setEditingPriceId(item.id);
                                setTempPrice(item.price);
                              }}
                              className="text-slate-500 hover:text-slate-300"
                              title="Edit price"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => onUpdateMenuItem(item.id, { isAvailable: !item.isAvailable })}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black transition ${
                            item.isAvailable
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80 hover:bg-emerald-900'
                              : 'bg-rose-950 text-rose-400 border border-rose-800/80 hover:bg-rose-900'
                          }`}
                        >
                          {item.isAvailable ? 'IN STOCK' : 'OUT OF STOCK'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onDeleteMenuItem(item.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Add Menu Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Add New Concordia Menu Item</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewItem} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Crispy Broast Quarter"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Concordia</label>
                  <select
                    value={newItemConcordia}
                    onChange={(e) => setNewItemConcordia(e.target.value as ConcordiaId)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  >
                    <option value="C1">Concordia 1 (C1)</option>
                    <option value="C2">Concordia 2 (C2)</option>
                    <option value="C3">Concordia 3 (C3)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Price (PKR)</label>
                  <input
                    type="number"
                    required
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                >
                  <option value="Fast Food">Fast Food</option>
                  <option value="Desi Meals">Desi Meals</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Snacks">Snacks</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="Ingredients, sides, or preparation details"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Image URL</label>
                <input
                  type="url"
                  value={newItemImage}
                  onChange={(e) => setNewItemImage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition"
              >
                Publish Item to Selected Concordia
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
