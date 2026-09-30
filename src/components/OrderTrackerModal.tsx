import React from 'react';
import { Order, OrderStatus } from '../types';
import { 
  X, 
  Clock, 
  ChefHat, 
  CheckCircle2, 
  ShieldCheck, 
  MapPin, 
  AlertCircle,
  Receipt,
  ExternalLink
} from 'lucide-react';
import { CONCORDIA_ACCOUNTS } from '../data/defaultMenu';

interface OrderTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  studentUserId?: string;
}

const STAGES: { status: OrderStatus; label: string; sub: string }[] = [
  { 
    status: 'PENDING_ADMIN_VERIFY', 
    label: 'Payment Verification', 
    sub: 'Counter phone SMS cross-check' 
  },
  { 
    status: 'PREPARING', 
    label: 'In Kitchen', 
    sub: 'Chef is cooking your meal' 
  },
  { 
    status: 'READY_FOR_PICKUP', 
    label: 'Ready for Pickup', 
    sub: 'Collect at Concordia counter' 
  },
  { 
    status: 'COMPLETED', 
    label: 'Completed', 
    sub: 'Handed over to student' 
  }
];

export const OrderTrackerModal: React.FC<OrderTrackerModalProps> = ({
  isOpen,
  onClose,
  orders,
  studentUserId
}) => {
  if (!isOpen) return null;

  // Filter orders belonging to this student if provided, or show all placed orders
  const studentOrders = studentUserId 
    ? orders.filter(o => o.userId === studentUserId)
    : orders;

  const getStageIndex = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING_ADMIN_VERIFY': return 0;
      case 'PREPARING': return 1;
      case 'READY_FOR_PICKUP': return 2;
      case 'COMPLETED': return 3;
      default: return -1;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-black text-white text-base">Real-Time Token Tracker</h3>
              <p className="text-xs text-slate-400">Live order pipeline synced with Concordia KDS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Orders Feed */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {studentOrders.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-white">No Orders Placed Yet</h4>
              <p className="text-xs text-slate-400 mt-1">
                Your order tokens and real-time preparation tracker will show up here.
              </p>
            </div>
          ) : (
            studentOrders.map(order => {
              const currentStage = getStageIndex(order.status);
              const isFraud = order.status === 'REJECTED_FRAUD';
              const concordiaInfo = CONCORDIA_ACCOUNTS[order.concordia];

              return (
                <div
                  key={order.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4"
                >
                  {/* Top Bar: Token & Concordia */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-mono font-black text-white bg-slate-900 px-3 py-1 rounded-xl border border-slate-700">
                        {order.token}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-emerald-400 block">
                          {concordiaInfo.short}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {order.pickupType} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Locked TRX ID
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-300">
                        {order.trxId}
                      </span>
                    </div>
                  </div>

                  {/* 4-Stage Stepper */}
                  {!isFraud ? (
                    <div className="pt-2">
                      <div className="grid grid-cols-4 gap-2 relative">
                        {STAGES.map((st, idx) => {
                          const isDone = currentStage > idx;
                          const isCurrent = currentStage === idx;
                          return (
                            <div key={st.status} className="flex flex-col items-center text-center">
                              {/* Circle icon */}
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all mb-2 ${
                                  isDone
                                    ? 'bg-emerald-600 text-white'
                                    : isCurrent
                                    ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20 animate-pulse'
                                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                                }`}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  idx + 1
                                )}
                              </div>
                              <span className={`text-[11px] font-bold ${
                                isCurrent ? 'text-amber-400' : isDone ? 'text-white' : 'text-slate-500'
                              }`}>
                                {st.label}
                              </span>
                              <span className="text-[9px] text-slate-500 leading-tight hidden sm:block mt-0.5">
                                {st.sub}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Progress Line */}
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
                          style={{
                            width: `${((currentStage + 1) / 4) * 100}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>Order rejected: Invalid or duplicate transaction reference ID reported by counter.</span>
                    </div>
                  )}

                  {/* Summary of Items */}
                  <div className="pt-2 border-t border-slate-900 text-xs text-slate-400 flex flex-wrap justify-between items-center gap-2">
                    <div>
                      {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                    </div>
                    <div className="font-bold text-white">
                      Paid: <span className="text-emerald-400">Rs. {order.subtotal}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
          >
            Close Tracker
          </button>
        </div>

      </div>
    </div>
  );
};
