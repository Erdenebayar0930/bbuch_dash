type CardProps = { title: string; value: string }

export default function DashboardCard({ title, value }: CardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h3 className="text-gray-500 dark:text-gray-400 text-sm">{title}</h3>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}
