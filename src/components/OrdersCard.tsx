export function OrdersCard() {
  return (
    <div className="bg-white rounded-2xl p-6 border">
      <div className="flex justify-between mb-4">
        <h3 className="font-semibold">Orders</h3>
        <select className="text-sm bg-gray-100 px-2 py-1 rounded">
          <option>Last hour</option>
        </select>
      </div>

      <div className="space-y-4 text-sm">
        <div className="flex justify-between">
          <span>Sunset stickers</span>
          <span>$121</span>
          <span className="text-orange-500 bg-orange-100 px-2 rounded-full">
            Processing
          </span>
        </div>

        <div className="flex justify-between">
          <span>City illustration set</span>
          <span>$121</span>
          <span className="text-green-600 bg-green-100 px-2 rounded-full">
            Completed
          </span>
        </div>
      </div>
    </div>
  );
}
