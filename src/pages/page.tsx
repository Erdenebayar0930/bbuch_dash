'use client';

import DashboardCard from '@/components/DashboardCard';
import DataTable from '@/components/DataTable';
import Chart from '@/components/Chart';

export default function DashboardPage() {
  const tableData = [
    { name: 'Product A', price: '$100' },
    { name: 'Product B', price: '$200' },
  ];

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardCard title="Revenue" value="$1200" />
        <DashboardCard title="Orders" value="30" />
        <DashboardCard title="Customers" value="15" />
      </div>

      {/* Chart */}
      <Chart />

      {/* Data Table */}
      <DataTable data={tableData} />
    </div>
  );
}
