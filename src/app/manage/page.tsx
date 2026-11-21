'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Store,
  Copy,
  Check,
  Plus,
  Package,
  ExternalLink,
  RefreshCw,
  Save,
  LogOut,
  LayoutDashboard,
  Receipt,
  Settings,
  Trash2,
  Pencil,
  Image as ImageIcon,
  PartyPopper,
  X,
  ShieldAlert,
  Download,
  Globe,
  Lock,
  Sparkles,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/logo';
import { OrderNotifications } from '@/components/order-notifications';
import { ThemePicker } from '@/components/theme-picker';
import { PromptpayQrUpload } from '@/components/promptpay-qr-upload';
import { OrderAlerts } from '@/components/order-alerts';
import { ProductImagePicker } from '@/components/product-image-picker';
import { AccountProfile, type Account as AccountInfo } from '@/components/account-profile';
import { OrderFulfillmentDialog } from '@/components/order-fulfillment';
import { ShippingSettings } from '@/components/shipping-settings';
import { BulkShipDialog } from '@/components/bulk-ship';
import { FULFILLMENT_LABEL, carrierOf, type Fulfillment } from '@/lib/order-stages';
import { PLAN_LIMITS, PLAN_NAMES, planOf } from '@/lib/plans';
import type { SlipCheck } from '@/lib/slip-check';
import { initialOf } from '@/lib/initial';

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toLocaleString('th-TH', { maximumFractionDigits: 1 })} GB`;
  return `${(bytes / 1024 ** 2).toLocaleString('th-TH', { maximumFractionDigits: 1 })} MB`;
}

type OrderStatus = 'pending' | 'paid' | 'rejected';

type Shop = {
  id: string;
  shop_name: string;
  slug: string;
  promptpay_number: string;
  bio: string | null;
  suspended_at?: string | null;
  suspended_reason?: string | null;
  plan?: string | null;
  custom_domain?: string | null;
  order_webhook_url?: string | null;
  order_webhook_secret?: string | null;
  theme?: unknown;
  plan_expires_at?: string | null;
  promptpay_qr_url?: string | null;
  shipping?: unknown;
};
type Product = { id: string; name: string; price: number; image_url?: string | null; created_at?: string };
type Order = {
  id: string;
  order_number: string;
  item_title: string;
  amount: number;
  slip_url: string | null;
  slip_hash?: string | null;
  status: OrderStatus;
  created_at?: string;
  slip_check?: SlipCheck | null;
  quantity?: number | null;
  customer_name?: string | null;
  customer_contact?: string | null;
  note?: string | null;
  fulfillment?: Fulfillment | null;
  carrier?: string | null;
  tracking_number?: string | null;
  shop_message?: string | null;
  customer_email?: string | null;
  track_token?: string | null;
  subtotal?: number | null;
  shipping_fee?: number | null;
  shipping_method?: string | null;
  shipping_pickup?: boolean | null;
  ship_phone?: string | null;
  ship_address?: string | null;
  ship_postcode?: string | null;
};
type OrderFilter = 'all' | 'toship' | OrderStatus;
// จ่ายแล้วแต่ยังไม่ได้ส่ง (ไม่รวมรับเองที่ร้าน)
const isToShip = (o: Order) =>
  o.status === 'paid' && !o.shipping_pickup && o.fulfillment !== 'shipped' && o.fulfillment !== 'delivered';
type SlipStorage = { used: number; limit: number; retentionDays: number | null };
type Account = AccountInfo;
type Tab = 'overview' | 'orders' | 'products' | 'settings';

const TABS: { key: Tab; label: string; Icon: typeof Store }[] = [
  { key: 'overview', label: 'ภาพรวม', Icon: LayoutDashboard },
  { key: 'orders', label: 'คำสั่งซื้อ', Icon: Receipt },
  { key: 'products', label: 'สินค้า', Icon: Package },
  { key: 'settings', label: 'ตั้งค่าร้าน', Icon: Settings },
];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'รอตรวจสอบ',
  paid: 'ชำระแล้ว',
  rejected: 'ปฏิเสธ',
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  paid: 'bg-brand-500/10 text-brand-400 border-brand-500/30',
  rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
};

const VERDICT: Record<SlipCheck['verdict'], { label: string; style: string }> = {
  pass: { label: 'สลิปผ่าน', style: 'text-brand-400 border-brand-500/30 bg-brand-500/10' },
  warn: { label: 'ควรตรวจซ้ำ', style: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  fail: { label: 'สลิปไม่ผ่าน', style: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  unchecked: { label: 'ตรวจยอดเอง', style: 'text-slate-400 border-slate-700 bg-slate-800' },
};

const CHECK_ICON = { pass: '✓', warn: '!', fail: '✕', skip: '–' } as const;
const CHECK_STYLE = {
  pass: 'text-brand-400',
  warn: 'text-amber-400',
  fail: 'text-rose-400',
  skip: 'text-slate-500',
} as const;

const inputClass =
  'w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-brand-500';

function formatBaht(value: number) {
  return '฿' + Number(value).toLocaleString('th-TH');
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'เกิดข้อผิดพลาด'), { status: res.status });
  return data;
}

export default function ManageShopPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [account, setAccount] = useState<Account | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [slipStorage, setSlipStorage] = useState<SlipStorage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [exportMonths, setExportMonths] = useState('1');
  const [domainInput, setDomainInput] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);
  const [appHost, setAppHost] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkShip, setBulkShip] = useState(false);
  const [fulfillOrder, setFulfillOrder] = useState<Order | null>(null);
  const [customerEmail, setCustomerEmail] = useState(false);

  const [shopForm, setShopForm] = useState({ shop_name: '', promptpay_number: '', bio: '' });
  const [savingShop, setSavingShop] = useState(false);

  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);

  const notify = useCallback((type: 'ok' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchOrders = useCallback(async () => (await api<{ orders: Order[] }>('/api/orders')).orders ?? [], []);

  const loadOrdersAndProducts = useCallback(async () => {
    const [p, o] = await Promise.all([
      api<{ products: Product[] }>('/api/products'),
      api<{ orders: Order[]; storage: SlipStorage | null; customerEmail?: boolean }>('/api/orders'),
    ]);
    setProducts(p.products ?? []);
    setOrders(o.orders ?? []);
    setSlipStorage(o.storage ?? null);
    setCustomerEmail(!!o.customerEmail);
  }, []);

  useEffect(() => {
    // ต้องล็อกอินและมีร้านค้าก่อน ถึงจะเข้าหน้าจัดการร้านได้
    (async () => {
      try {
        const me = await api<{ user: Account; shop: Shop | null }>('/api/me');
        if (!me.shop) {
          router.replace(me.user.isAdmin ? '/admin' : '/register');
          return;
        }
        setAccount(me.user);
        setShop(me.shop);
        setShopForm({
          shop_name: me.shop.shop_name,
          promptpay_number: me.shop.promptpay_number,
          bio: me.shop.bio ?? '',
        });
        setDomainInput(me.shop.custom_domain ?? '');
        setAppHost(window.location.hostname);
        await loadOrdersAndProducts();
        if (new URLSearchParams(window.location.search).get('welcome')) {
          setWelcome(true);
          window.history.replaceState(null, '', '/manage');
        }
        setLoading(false);
      } catch (err) {
        if ((err as { status?: number }).status === 401) {
          router.replace('/login');
          return;
        }
        notify('error', err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
        setLoading(false);
      }
    })();
  }, [router, loadOrdersAndProducts, notify]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadOrdersAndProducts();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyLink = () => {
    if (!shop) return;
    navigator.clipboard.writeText(`${window.location.origin}/${shop.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const handleUpdateShop = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingShop(true);
    try {
      const data = await api<{ shop: Shop }>('/api/shop', { method: 'PATCH', body: JSON.stringify(shopForm) });
      setShop(data.shop);
      notify('ok', 'บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว');
    } catch (err) {
      notify('error', 'บันทึกไม่สำเร็จ: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSavingShop(false);
    }
  };

  const handleSaveDomain = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingDomain(true);
    try {
      const data = await api<{ shop: Shop }>('/api/shop/domain', {
        method: 'PUT',
        body: JSON.stringify({ domain: domainInput }),
      });
      setShop(data.shop);
      setDomainInput(data.shop.custom_domain ?? '');
      notify('ok', data.shop.custom_domain ? 'บันทึกโดเมนแล้ว' : 'ลบโดเมนแล้ว');
    } catch (err) {
      notify('error', 'บันทึกโดเมนไม่สำเร็จ: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSavingDomain(false);
    }
  };

  const handleAddProduct = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddingProduct(true);
    try {
      const data = await api<{ product: Product }>('/api/products', {
        method: 'POST',
        body: JSON.stringify({ name: newProductName, price: Number(newProductPrice) }),
      });
      setProducts((prev) => [data.product, ...prev]);
      setNewProductName('');
      setNewProductPrice('');
      notify('ok', 'เพิ่มสินค้าแล้ว');
    } catch (err) {
      notify('error', 'เพิ่มสินค้าไม่สำเร็จ: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setAddingProduct(false);
    }
  };

  const startEditProduct = (product: Product) => {
    setEditingProduct(product.id);
    setEditName(product.name);
    setEditPrice(String(product.price));
  };

  const handleSaveProduct = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSavingProduct(true);
    try {
      const data = await api<{ product: Product }>('/api/products', {
        method: 'PATCH',
        body: JSON.stringify({ id: editingProduct, name: editName, price: Number(editPrice) }),
      });
      setProducts((prev) => prev.map((p) => (p.id === data.product.id ? data.product : p)));
      setEditingProduct(null);
      notify('ok', 'บันทึกสินค้าแล้ว');
    } catch (err) {
      notify('error', 'แก้ไขสินค้าไม่สำเร็จ: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`ลบ "${product.name}" ออกจากร้าน?`)) return;
    try {
      await api('/api/products', { method: 'DELETE', body: JSON.stringify({ id: product.id }) });
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      notify('ok', `ลบ "${product.name}" แล้ว`);
    } catch (err) {
      notify('error', 'ลบสินค้าไม่สำเร็จ: ' + (err instanceof Error ? err.message : ''));
    }
  };

  const recheckSlip = async (order: Order) => {
    setRechecking(true);
    try {
      const data = await api<{ order: Order }>('/api/orders/recheck', { method: 'POST', body: JSON.stringify({ id: order.id }) });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)));
      setPreviewOrder(data.order);
      notify('ok', 'ตรวจสลิปใหม่แล้ว');
    } catch (err) {
      notify('error', 'ตรวจสลิปไม่สำเร็จ: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setRechecking(false);
    }
  };

  const updateOrderStatus = async (order: Order, status: OrderStatus) => {
    setUpdatingId(order.id);
    try {
      const data = await api<{ order: Order }>('/api/orders', {
        method: 'PATCH',
        body: JSON.stringify({ id: order.id, status }),
      });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)));
    } catch (err) {
      notify('error', 'อัปเดตไม่สำเร็จ: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm">
        กำลังโหลดระบบจัดการร้านค้า...
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-slate-950 text-ink flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-xl font-bold mb-2">โหลดข้อมูลร้านค้าไม่สำเร็จ</h2>
        <p className="text-sm text-slate-400 mb-4">กรุณาลองใหม่อีกครั้ง</p>
        <button onClick={() => window.location.reload()} className="text-white px-4 py-2 bg-brand-500 rounded-xl font-medium text-sm">
          ลองใหม่
        </button>
      </div>
    );
  }

  const paidTotal = orders.filter((o) => o.status === 'paid').reduce((sum, o) => sum + Number(o.amount), 0);
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const toShipOrders = orders.filter(isToShip);
  const visibleOrders =
    orderFilter === 'all' ? orders : orderFilter === 'toship' ? toShipOrders : orders.filter((o) => o.status === orderFilter);
  const selectable = orderFilter === 'toship';
  const selectedOrders = visibleOrders.filter((o) => selectedIds.has(o.id));
  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const printLabels = (size: 'a4' | 'thermal') =>
    window.open(`/manage/labels?size=${size}&ids=${selectedOrders.map((o) => o.id).join(',')}`, '_blank');
  const shopUrl = `paybio.me/${shop.slug}`;
  const plan = planOf(shop);
  const limits = PLAN_LIMITS[plan];
  const exportOptions = [
    { value: '1', label: '1 เดือนล่าสุด' },
    { value: '3', label: '3 เดือนล่าสุด' },
    { value: '12', label: '12 เดือนล่าสุด' },
    { value: 'all', label: 'ทั้งหมด' },
  ].filter((o) => limits.exportMonths != null && (o.value === 'all' ? Infinity : Number(o.value)) <= limits.exportMonths);

  const stats = [
    { label: 'ยอดขายที่ชำระแล้ว', value: formatBaht(paidTotal), accent: 'text-brand-400' },
    { label: 'รอตรวจสอบสลิป', value: pendingOrders.length.toLocaleString('th-TH'), accent: 'text-amber-400' },
    { label: 'คำสั่งซื้อทั้งหมด', value: orders.length.toLocaleString('th-TH') },
    { label: 'สินค้าในร้าน', value: products.length.toLocaleString('th-TH') },
  ];

  const storagePct = slipStorage ? Math.min(100, (slipStorage.used / slipStorage.limit) * 100) : 0;
  const storageFull = !!slipStorage && slipStorage.retentionDays == null && storagePct >= 90;
  const storageCard = slipStorage && (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-slate-400">
          <ImageIcon className="w-3.5 h-3.5" /> พื้นที่เก็บรูปสลิป
        </span>
        <span className="font-mono text-slate-300">
          {formatBytes(slipStorage.used)} / {formatBytes(slipStorage.limit)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${storagePct >= 90 ? 'bg-rose-500' : storagePct >= 75 ? 'bg-amber-400' : 'bg-brand-500'}`}
          style={{ width: `${Math.max(storagePct, slipStorage.used > 0 ? 1 : 0)}%` }}
        />
      </div>
      <p className="text-[11px] text-slate-500">
        {slipStorage.retentionDays != null
          ? `เก็บสลิป ${slipStorage.retentionDays} วัน — สลิปที่เก่ากว่านี้ หรือเมื่อพื้นที่เต็ม ระบบจะลบสลิปเก่าสุดให้อัตโนมัติ (ข้อมูลออเดอร์และผลตรวจยังอยู่)`
          : storagePct >= 100
            ? 'พื้นที่เต็มแล้ว ลูกค้าจะส่งสลิปใหม่ไม่ได้จนกว่าจะอัปเกรดแพ็กเกจ'
            : 'เก็บสลิปถาวร เมื่อพื้นที่เต็มลูกค้าจะส่งสลิปใหม่ไม่ได้'}
      </p>
    </div>
  );

  const orderRow = (order: Order) => (
    <div key={order.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-800/30 transition">
      <div className="min-w-0 flex gap-3">
        {selectable && (
          <input
            type="checkbox"
            aria-label={`เลือก ${order.order_number}`}
            checked={selectedIds.has(order.id)}
            onChange={() => toggleSelected(order.id)}
            className="mt-0.5 w-4 h-4 shrink-0 accent-brand-500 cursor-pointer"
          />
        )}
        <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-semibold text-ink">{order.order_number}</span>
          <span className={`px-2 py-0.5 rounded-full border text-[10px] ${STATUS_STYLE[order.status] ?? STATUS_STYLE.pending}`}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
          {order.status === 'paid' && order.fulfillment && (
            <span className="px-2 py-0.5 rounded-full border text-[10px] border-sky-500/30 bg-sky-500/10 text-sky-300">
              {FULFILLMENT_LABEL[order.fulfillment]}
            </span>
          )}
        </div>
        {order.tracking_number && (
          <p className="text-slate-500 mt-0.5 font-mono truncate">
            📦 {carrierOf(order.carrier)?.label ?? ''} {order.tracking_number}
          </p>
        )}
        <p className="text-slate-300 mt-1 truncate">{order.item_title}</p>
        {(order.customer_name || order.customer_contact) && (
          <p className="text-slate-400 mt-0.5 truncate">
            {order.customer_name}
            {order.customer_contact && <span className="text-slate-500"> · {order.customer_contact}</span>}
          </p>
        )}
        {order.shipping_method && (
          <p className="text-slate-400 mt-0.5">
            <Truck className="w-3 h-3 inline -mt-0.5" /> {order.shipping_method}
            {Number(order.shipping_fee) > 0 && <span className="text-slate-500"> · ค่าส่ง {formatBaht(Number(order.shipping_fee))}</span>}
          </p>
        )}
        {order.ship_address && (
          <p className="text-slate-500 mt-0.5 whitespace-pre-line break-words">
            {order.ship_address} {order.ship_postcode} · โทร {order.ship_phone}
          </p>
        )}
        {order.note && <p className="text-slate-500 mt-0.5 whitespace-pre-line break-words">{order.note}</p>}
        <span className="text-[10px] text-slate-500">{formatDate(order.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap sm:justify-end">
        <span className="text-sm font-bold text-brand-400 mr-1">{formatBaht(order.amount)}</span>
        {order.slip_check && (
          <button
            onClick={() => setPreviewOrder(order)}
            title={order.slip_check.checks.map((c) => `${CHECK_ICON[c.status]} ${c.label}`).join('\n')}
            className={`px-2 py-0.5 rounded-full border text-[10px] flex items-center gap-1 cursor-pointer ${VERDICT[order.slip_check.verdict].style}`}
          >
            <ShieldCheck className="w-3 h-3" /> {VERDICT[order.slip_check.verdict].label}
          </button>
        )}
        {order.slip_url ? (
          <button
            onClick={() => setPreviewOrder(order)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 flex items-center gap-1 border border-slate-700 cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5" /> สลิป
          </button>
        ) : (
          <span className="text-slate-500" title={order.slip_hash ? 'ไฟล์สลิปถูกลบตามอายุ/พื้นที่เก็บของแพ็กเกจ' : undefined}>
            {order.slip_hash ? 'สลิปหมดอายุ' : 'ไม่มีสลิป'}
          </span>
        )}
        {order.status !== 'paid' && (
          <button
            onClick={() => updateOrderStatus(order, 'paid')}
            disabled={updatingId === order.id}
            className="text-white px-2.5 py-1 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 font-medium cursor-pointer"
          >
            อนุมัติ
          </button>
        )}
        {order.status !== 'rejected' && (
          <button
            onClick={() => updateOrderStatus(order, 'rejected')}
            disabled={updatingId === order.id}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/80 text-slate-300 hover:text-white disabled:opacity-50 cursor-pointer"
          >
            ปฏิเสธ
          </button>
        )}
        <button
          onClick={() => setFulfillOrder(order)}
          title="อัปเดตการจัดส่ง เลขพัสดุ และข้อความถึงลูกค้า"
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 cursor-pointer"
        >
          <Truck className="w-3.5 h-3.5" /> {order.status === 'paid' ? 'จัดส่ง' : 'แจ้งลูกค้า'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-ink">
      {/* แถบด้านบน */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/" aria-label="PayBio หน้าแรก">
          <Logo size="sm" />
        </Link>
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:block text-right min-w-0">
              <p className="text-xs font-medium truncate">{account?.name || account?.email}</p>
              {account?.provider && <p className="text-[10px] text-slate-500 capitalize">เชื่อมต่อผ่าน {account.provider}</p>}
            </div>
            {account?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-700" />
            ) : (
              <span className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold uppercase">
                {initialOf(account?.name, account?.email)}
              </span>
            )}
            <button
              onClick={handleLogout}
              title="ออกจากระบบ"
              className="p-2 rounded-lg text-slate-400 hover:text-ink hover:bg-slate-800 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        <OrderAlerts
          orders={orders}
          fetchOrders={fetchOrders}
          onOrders={setOrders}
          onOpen={(order) => {
            setTab('orders');
            setPreviewOrder(order);
          }}
        />
        {shop.suspended_at && (
          <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-rose-400">ร้านของคุณถูกระงับโดยผู้ดูแลระบบ</p>
              <p className="text-slate-300 text-xs mt-0.5">
                ลูกค้าจะไม่เห็นสินค้าและสั่งซื้อไม่ได้จนกว่าจะยกเลิกการระงับ
                {shop.suspended_reason && <> — เหตุผล: {shop.suspended_reason}</>}
              </p>
            </div>
          </div>
        )}

        {welcome && (
          <div className="flex items-start gap-3 bg-brand-500/10 border border-brand-500/30 rounded-2xl p-4">
            <PartyPopper className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">สร้างร้านค้าสำเร็จแล้ว!</p>
              <p className="text-slate-300 text-xs mt-0.5">
                เพิ่มสินค้าชิ้นแรก แล้วคัดลอกลิงก์ร้านไปวางใน Bio ของ Instagram, Facebook หรือ LINE ได้เลย
              </p>
            </div>
            <button onClick={() => setWelcome(false)} className="text-slate-400 hover:text-ink cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* หัวร้าน */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <div className="min-w-0">
            <span className="text-xs uppercase font-semibold text-brand-400 tracking-wider">แผงควบคุมร้านค้า</span>
            <h1 className="text-2xl font-bold mt-1 truncate">{shop.shop_name}</h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{shopUrl}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-xl border border-slate-700 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-brand-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์ Bio'}
            </button>
            <Link
              href={`/${shop.slug}`}
              target="_blank"
              className="text-white flex items-center gap-1.5 px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-xs font-semibold rounded-xl transition"
            >
              เปิดหน้าร้าน <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* แท็บ */}
        <nav className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                tab === key ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-ink hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
              {key === 'orders' && pendingOrders.length > 0 && (
                <span className={`ml-0.5 px-1.5 rounded-full text-[10px] ${tab === key ? 'bg-white/20' : 'bg-amber-500/20 text-amber-400'}`}>
                  {pendingOrders.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className={`text-xl sm:text-2xl font-bold mt-1 ${s.accent ?? ''}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {storageFull && storageCard}

            {products.length === 0 && (
              <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl p-6 text-center">
                <Package className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-medium">ร้านของคุณยังไม่มีสินค้า</p>
                <p className="text-xs text-slate-400 mt-1">เพิ่มสินค้าชิ้นแรกเพื่อให้ลูกค้าสั่งซื้อได้</p>
                <button
                  onClick={() => setTab('products')}
                  className="text-white mt-4 px-4 py-2 bg-brand-500 hover:bg-brand-600 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  เพิ่มสินค้า
                </button>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 font-semibold text-sm flex justify-between items-center">
                <span>รอตรวจสอบสลิป ({pendingOrders.length})</span>
                <button onClick={() => setTab('orders')} className="text-xs text-brand-400 hover:underline cursor-pointer">
                  ดูทั้งหมด
                </button>
              </div>
              <div className="divide-y divide-slate-800">
                {pendingOrders.length === 0 ? (
                  <p className="p-6 text-center text-slate-500 text-xs">ไม่มีคำสั่งซื้อที่รอตรวจสอบ</p>
                ) : (
                  pendingOrders.slice(0, 5).map(orderRow)
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'orders' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex flex-wrap gap-2 justify-between items-center">
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'pending', 'toship', 'paid', 'rejected'] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setOrderFilter(key);
                      setSelectedIds(new Set());
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                      orderFilter === key
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {key === 'all' ? 'ทั้งหมด' : key === 'toship' ? `รอจัดส่ง (${toShipOrders.length})` : STATUS_LABEL[key]}
                  </button>
                ))}
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition cursor-pointer disabled:opacity-50"
                title="รีเฟรชข้อมูล"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center gap-2 text-xs">
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-300 font-medium">ส่งออกรายงานยอดขาย (CSV/Excel)</span>
              {exportOptions.length ? (
                <div className="flex items-center gap-2 ml-auto">
                  <select
                    value={exportMonths}
                    onChange={(e) => setExportMonths(e.target.value)}
                    aria-label="ช่วงเวลาที่ส่งออก"
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-brand-500"
                  >
                    {exportOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <a
                    href={`/api/orders/export?months=${exportMonths}`}
                    className="text-white px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 font-semibold"
                  >
                    ดาวน์โหลด
                  </a>
                </div>
              ) : (
                <Link href="/upgrade" className="ml-auto inline-flex items-center gap-1 text-slate-400 hover:text-brand-400">
                  <Lock className="w-3 h-3" /> ใช้ได้ตั้งแต่ Pro Merchant
                </Link>
              )}
            </div>
            {selectable && visibleOrders.length > 0 && (
              <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center gap-2 text-xs bg-slate-950/40">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOrders.length === visibleOrders.length}
                    onChange={(e) => setSelectedIds(e.target.checked ? new Set(visibleOrders.map((o) => o.id)) : new Set())}
                    className="w-4 h-4 accent-brand-500"
                  />
                  เลือกทั้งหมด ({selectedOrders.length}/{visibleOrders.length})
                </label>
                <div className="flex flex-wrap gap-2 ml-auto">
                  <button
                    disabled={!selectedOrders.length}
                    onClick={() => printLabels('a4')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    พิมพ์ใบจ่าหน้า A4
                  </button>
                  <button
                    disabled={!selectedOrders.length}
                    onClick={() => printLabels('thermal')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    พิมพ์ 100×150 มม.
                  </button>
                  <button
                    disabled={!selectedOrders.length}
                    onClick={() => setBulkShip(true)}
                    className="text-white px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 font-semibold disabled:opacity-40 cursor-pointer"
                  >
                    ใส่เลขพัสดุ
                  </button>
                </div>
              </div>
            )}
            <div className="divide-y divide-slate-800">
              {visibleOrders.length === 0 ? (
                <p className="p-6 text-center text-slate-500 text-xs">
                  {orderFilter === 'toship' ? 'ไม่มีออเดอร์ที่รอจัดส่ง' : 'ยังไม่มีคำสั่งซื้อ'}
                </p>
              ) : (
                visibleOrders.map(orderRow)
              )}
            </div>
          </div>
        )}

        {tab === 'products' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 font-semibold text-sm border-b border-slate-800 pb-3">
              <Package className="w-4 h-4 text-brand-400" /> รายการสินค้า ({products.length}
              {Number.isFinite(limits.maxProducts) && `/${limits.maxProducts}`})
              {products.length >= limits.maxProducts && (
                <Link href="/upgrade" className="ml-auto text-xs font-normal text-brand-400 hover:underline">
                  ครบจำนวนของแพ็กเกจ Free · อัปเกรด
                </Link>
              )}
            </div>

            <form onSubmit={handleAddProduct} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="ชื่อสินค้า / บริการ"
                required
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className={`${inputClass} flex-1`}
              />
              <input
                type="number"
                placeholder="ราคา (฿)"
                required
                min="1"
                step="0.01"
                value={newProductPrice}
                onChange={(e) => setNewProductPrice(e.target.value)}
                className={`${inputClass} sm:w-32`}
              />
              <button
                type="submit"
                disabled={addingProduct}
                className="text-white px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> {addingProduct ? 'กำลังเพิ่ม...' : 'เพิ่มสินค้า'}
              </button>
            </form>

            <div className="divide-y divide-slate-800/60">
              {products.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">ยังไม่มีสินค้า เพิ่มชิ้นแรกด้านบนได้เลย</p>
              ) : (
                products.map((item) =>
                  editingProduct === item.id ? (
                    <form
                      key={item.id}
                      onSubmit={handleSaveProduct}
                      className="py-3 flex flex-col sm:flex-row gap-2"
                    >
                      <input
                        type="text"
                        required
                        autoFocus
                        aria-label="ชื่อสินค้า"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={`${inputClass} flex-1`}
                      />
                      <input
                        type="number"
                        required
                        min="1"
                        step="0.01"
                        aria-label="ราคา"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className={`${inputClass} sm:w-32`}
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={savingProduct}
                          className="text-white flex-1 px-3 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <Save className="w-4 h-4" /> {savingProduct ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProduct(null)}
                          className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-ink border border-slate-700 transition cursor-pointer"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </form>
                  ) : (
                  <div key={item.id} className="py-3 flex justify-between items-center gap-3 text-sm">
                    <span className="flex items-center gap-3 min-w-0">
                      <ProductImagePicker
                        product={item}
                        onChange={(next) => setProducts((prev) => prev.map((p) => (p.id === next.id ? next : p)))}
                        notify={notify}
                      />
                      <span className="font-medium text-slate-200 truncate">{item.name}</span>
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-brand-400">{formatBaht(item.price)}</span>
                      <button
                        onClick={() => startEditProduct(item)}
                        title="แก้ไขสินค้า"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-brand-400 hover:bg-brand-500/10 transition cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(item)}
                        title="ลบสินค้า"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  )
                )
              )}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-4 max-w-xl">
          {account && (
            <AccountProfile
              account={account}
              onChange={(next) => setAccount((prev) => prev && { ...prev, ...next })}
              notify={notify}
            />
          )}

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-brand-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400">แพ็กเกจปัจจุบัน</p>
              <p className="font-semibold">{PLAN_NAMES[plan]}</p>
              {plan !== 'free' && shop.plan_expires_at && (
                <p className="text-[11px] text-amber-400">
                  ใช้ได้ถึง {new Date(shop.plan_expires_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })} แล้วจะกลับเป็น Free
                </p>
              )}
            </div>
            <Link href="/upgrade" className="text-xs text-brand-400 hover:underline shrink-0">
              {plan === 'business' ? 'ดูสิทธิประโยชน์' : 'อัปเกรด'}
            </Link>
          </div>

          {slipStorage && storageCard}

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 font-semibold text-sm border-b border-slate-800 pb-3">
              <Store className="w-4 h-4 text-brand-400" /> ข้อมูลร้านค้า
            </div>
            <form onSubmit={handleUpdateShop} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">ชื่อร้านค้า</label>
                <input
                  type="text"
                  required
                  value={shopForm.shop_name}
                  onChange={(e) => setShopForm((f) => ({ ...f, shop_name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">ลิงก์ร้านค้า</label>
                <input type="text" value={shopUrl} disabled className={`${inputClass} font-mono opacity-60`} />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">พร้อมเพย์สำหรับรับเงิน</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  pattern="\d{10}|\d{13}|\d{15}"
                  value={shopForm.promptpay_number}
                  onChange={(e) => setShopForm((f) => ({ ...f, promptpay_number: e.target.value.replace(/[^\d]/g, '') }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">รายละเอียดร้าน (Bio)</label>
                <textarea
                  rows={3}
                  value={shopForm.bio}
                  onChange={(e) => setShopForm((f) => ({ ...f, bio: e.target.value }))}
                  className={`${inputClass} resize-none`}
                />
              </div>
              <button
                type="submit"
                disabled={savingShop}
                className="text-white w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> {savingShop ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
              </button>
            </form>
          </div>

          <ShippingSettings
            shop={shop}
            onShopChange={(next) => setShop((prev) => prev && { ...prev, ...next })}
            notify={notify}
          />

          <PromptpayQrUpload
            url={shop.promptpay_qr_url}
            onChange={(promptpay_qr_url) => setShop((prev) => prev && { ...prev, promptpay_qr_url })}
            notify={notify}
          />

          <ThemePicker
            shop={shop}
            level={limits.theme}
            onShopChange={(next) => setShop((prev) => prev && { ...prev, ...next })}
            notify={notify}
          />

          <OrderNotifications
            lineAllowed={limits.lineNotify}
            webhookAllowed={limits.webhook}
            shop={shop}
            onShopChange={(next) => setShop((prev) => prev && { ...prev, ...next })}
            notify={notify}
          />

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm border-b border-slate-800 pb-3">
              <Globe className="w-4 h-4 text-brand-400" /> โดเมนของตนเอง (Custom Domain)
            </div>
            {limits.customDomain ? (
              <form onSubmit={handleSaveDomain} className="space-y-3">
                <input
                  type="text"
                  placeholder="shop.example.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
                <p className="text-xs text-slate-400 leading-relaxed">
                  ที่ผู้ให้บริการโดเมน ให้เพิ่มระเบียน <span className="font-mono text-ink">CNAME</span> ของโดเมนนี้ชี้มาที่{' '}
                  <span className="font-mono text-ink">{appHost}</span> แล้วกดบันทึก
                  ระบบจะเปิดหน้าร้านเมื่อมีคนเข้าโดเมนนี้ (เว้นว่างแล้วบันทึกเพื่อลบโดเมน)
                </p>
                <button
                  type="submit"
                  disabled={savingDomain}
                  className="text-white w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  {savingDomain ? 'กำลังบันทึก...' : 'บันทึกโดเมน'}
                </button>
              </form>
            ) : (
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> ใช้ได้เฉพาะแพ็กเกจ Business Studio ·{' '}
                <Link href="/upgrade" className="text-brand-400 hover:underline">
                  ดูแพ็กเกจ
                </Link>
              </p>
            )}
          </div>
          </div>
        )}
      </main>

      {/* แจ้งเตือน */}
      {fulfillOrder && (
        <OrderFulfillmentDialog
          order={fulfillOrder}
          emailEnabled={customerEmail}
          onClose={() => setFulfillOrder(null)}
          onSaved={(saved) => setOrders((prev) => prev.map((o) => (o.id === saved.id ? saved : o)))}
          notify={notify}
        />
      )}

      {bulkShip && (
        <BulkShipDialog
          orders={selectedOrders}
          onClose={() => setBulkShip(false)}
          onSaved={(saved) => {
            const byId = new Map(saved.map((o) => [o.id, o]));
            setOrders((prev) => prev.map((o) => byId.get(o.id) ?? o));
            setSelectedIds(new Set());
          }}
          notify={notify}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-xs font-medium shadow-xl border ${
            toast.type === 'ok'
              ? 'bg-brand-500/15 border-brand-500/40 text-brand-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          } backdrop-blur`}
        >
          {toast.text}
        </div>
      )}

      {/* ดูสลิป */}
      {previewOrder?.slip_url && (
        <div
          onClick={() => setPreviewOrder(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 max-w-md w-full relative">
            <button onClick={() => setPreviewOrder(null)} className="absolute top-3 right-3 text-slate-400 hover:text-ink cursor-pointer">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-semibold mb-3">
              สลิปการโอนเงิน · <span className="font-mono">{previewOrder.order_number}</span>
            </h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/orders/slip?id=${previewOrder.id}`}
              alt="สลิปการโอนเงิน"
              className="w-full max-h-[50vh] object-contain rounded-lg bg-slate-950"
            />
            {previewOrder.slip_check ? (
              <div className="mt-3 rounded-xl border border-slate-800 p-3 text-xs space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-400" /> ผลตรวจสลิป
                  <span className={`ml-auto px-2 py-0.5 rounded-full border text-[10px] ${VERDICT[previewOrder.slip_check.verdict].style}`}>
                    {VERDICT[previewOrder.slip_check.verdict].label}
                  </span>
                </p>
                {previewOrder.slip_check.checks.map((c) => (
                  <p key={c.key} className="flex gap-2">
                    <span className={`w-3 text-center font-bold ${CHECK_STYLE[c.status]}`}>{CHECK_ICON[c.status]}</span>
                    <span className="text-slate-300">{c.label}</span>
                    {c.detail && <span className="text-slate-500 ml-auto text-right">{c.detail}</span>}
                  </p>
                ))}
                {previewOrder.slip_check.extracted && (
                  <p className="border-t border-slate-800 pt-2 mt-2 text-[10px] text-slate-500">
                    {previewOrder.slip_check.bank ? 'ข้อมูลจากธนาคาร (ผ่าน SlipOK)' : 'ข้อมูลที่ AI อ่านจากรูปสลิป'}
                  </p>
                )}
                {previewOrder.slip_check.extracted && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                    {(
                      [
                        ['ยอดเงิน', previewOrder.slip_check.extracted.amount != null ? formatBaht(previewOrder.slip_check.extracted.amount) : null],
                        ['วันเวลา', previewOrder.slip_check.extracted.datetime ? formatDate(previewOrder.slip_check.extracted.datetime) : null],
                        ['เลขอ้างอิง', previewOrder.slip_check.extracted.ref],
                        ['ธนาคารผู้โอน', previewOrder.slip_check.extracted.sender_bank],
                        ['ผู้รับ', [previewOrder.slip_check.extracted.receiver_name, previewOrder.slip_check.extracted.receiver_account].filter(Boolean).join(' · ') || null],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="contents">
                        <dt className="text-slate-500">{label}</dt>
                        <dd className="text-slate-300 text-right font-mono break-all">{value ?? '-'}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {plan !== 'business' && !previewOrder.slip_check.bank && (
                  <Link href="/upgrade" className="block text-[11px] text-brand-400 hover:underline pt-1">
                    อัปเกรดเพื่อตรวจ{plan === 'free' ? 'ยอดเงิน วันที่ และ' : ''}สลิปปลอม / สลิปซ้ำ
                  </Link>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">ยังไม่มีผลตรวจสลิป (กำลังตรวจ หรือเป็นคำสั่งซื้อก่อนเปิดระบบตรวจ)</p>
            )}
            <button
              onClick={() => recheckSlip(previewOrder)}
              disabled={rechecking}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rechecking ? 'animate-spin' : ''}`} />
              {rechecking ? 'กำลังตรวจสลิป...' : 'ตรวจสลิปใหม่'}
            </button>
            <a
              href={`/api/orders/slip?id=${previewOrder.id}`}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-xs text-brand-400 hover:text-brand-300 mt-3"
            >
              เปิดรูปเต็มในแท็บใหม่
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
