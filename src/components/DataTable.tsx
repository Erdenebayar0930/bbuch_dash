type DataTableProps = { data: { name: string; price: string }[] }

export default function DataTable({ data }: DataTableProps) {
  return (
    <table className="min-w-full bg-white dark:bg-gray-800 text-black dark:text-white">
  <thead>
    <tr>
      <th className="p-2 border-b border-gray-200 dark:border-gray-700">Name</th>
      <th className="p-2 border-b border-gray-200 dark:border-gray-700">Price</th>
    </tr>
  </thead>
  <tbody>
    {data.map((row, i) => (
      <tr key={i}>
        <td className="p-2 border-b border-gray-200 dark:border-gray-700">{row.name}</td>
        <td className="p-2 border-b border-gray-200 dark:border-gray-700">{row.price}</td>
      </tr>
    ))}
  </tbody>
</table>

  )
}
