const menu = [
  { label: "Dashboard", path: "/" },
  { label: "Users", path: "/users", role: "admin" },
];

export default function Sidebar() {
  return (
    <aside>
      {menu.map(m => (
        <a key={m.path} href={m.path}>{m.label}</a>
      ))}
    </aside>
  );
}
