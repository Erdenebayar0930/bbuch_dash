import Card from "@/components/ui/Card";

export default function Dashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card title="Users" value="1,248" />
      <Card title="Revenue" value="₮12.4M" />
      <Card title="Orders" value="348" />
      <Card title="Alerts" value="3" />
    </div>
  );
}
