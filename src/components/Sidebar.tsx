import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react';

const items = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Package, label: 'Products' },
  { icon: ShoppingCart, label: 'Orders', badge: 2 },
  { icon: Users, label: 'Customers' },
  { icon: Wallet, label: 'Payouts' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r px-4 py-6">
      <div className="font-bold text-xl mb-8">📦</div>

      <nav className="space-y-1">
        {items.map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
              ${item.active ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
          >
            <item.icon size={18} />
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="text-xs bg-red-500 text-white px-2 rounded-full">
                {item.badge}
              </span>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
