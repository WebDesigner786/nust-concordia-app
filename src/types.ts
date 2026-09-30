export type ConcordiaId = 'C1' | 'C2' | 'C3';

export type Category = 'All' | 'Fast Food' | 'Desi Meals' | 'Beverages' | 'Snacks';

export type OrderStatus = 
  | 'PENDING_ADMIN_VERIFY' 
  | 'PREPARING' 
  | 'READY_FOR_PICKUP' 
  | 'COMPLETED'
  | 'REJECTED_FRAUD';

export type UserRole = 'student' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  dept: string;
  regId: string;
  email: string;
  role: UserRole;
  emailVerified?: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'Fast Food' | 'Desi Meals' | 'Beverages' | 'Snacks';
  concordia: ConcordiaId;
  imageUrl: string;
  isAvailable: boolean;
  prepTimeMinutes?: number;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
}

export interface Order {
  id: string;
  token: string; // e.g. #C1-104
  concordia: ConcordiaId;
  userId: string;
  studentName: string;
  regId: string;
  dept: string;
  studentEmail: string;
  items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  subtotal: number;
  trxId: string;
  paymentMethod: 'EasyPaisa' | 'JazzCash';
  pickupType: 'Dine-In' | 'Takeaway Counter';
  status: OrderStatus;
  createdAt: number; // millisecond timestamp
  verifiedAt?: number;
  notes?: string;
}

export interface TransactionRecord {
  trxId: string;
  usedBy: string;
  regId: string;
  studentName: string;
  amount: number;
  concordia: ConcordiaId;
  timestamp: any;
}
