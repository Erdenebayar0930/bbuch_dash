const stats = [
  { title: 'Total revenue', value: '$14.6k', color: 'bg-neutral-900' },
  { title: 'Total orders', value: '576', color: 'bg-orange-500' },
  { title: 'Total visits', value: '4.8k', color: 'bg-green-500' },
  { title: 'Product activity', value: '34k', color: 'bg-purple-500' },
];

export default function Stats() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((s) => (
        <div
          key={s.title}
          className={`rounded-2xl p-6 text-white ${s.color}`}
        >
          <div className="text-sm opacity-80">{s.title}</div>
          <div className="text-3xl font-bold mt-2">{s.value}</div>
        </div>
      ))}
    </div>
  );
}
