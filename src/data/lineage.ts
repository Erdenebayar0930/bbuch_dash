/**
 * Өөрийн угсаа гарвал — дөрвөн өвөг эмээгийн угсаа гарвалаас автоматаар.
 *
 * Эхэнд нь аавын аавынх (овог залгамжлах шугам), хаалтанд бусад нь хэдэн
 * удаа давхардсанаараа буурахаар — тэнцвэл аавын ээж, ээжийн аав, ээжийн ээж
 * гэсэн дарааллаар. Эхнийхтэй ижил нь хаалтанд давтагдахгүй.
 *
 *   Халх, Буриад, Өөлд, Өөлд  →  «Халх (Өөлд, Буриад)»
 *   Халх, Халх, Халх, Халх    →  «Халх»
 *
 * Аавын аавынх хоосон бол хамгийн их давхардсан нь эхэнд орно. Сервер
 * (хадгалахдаа) ба клиент (харуулахдаа) хоёул энэ функцийг ашиглана.
 */
export function composeLineage(
  fatherFather: string,
  fatherMother: string,
  motherFather: string,
  motherMother: string
): string {
  const names = [fatherFather, fatherMother, motherFather, motherMother].map((value) =>
    value.replace(/\s+/g, " ").trim()
  );

  // Том жижиг үсгээс үл хамааран бүлэглэнэ, анх бичсэн хэлбэрээр нь харуулна
  const groups: { key: string; label: string; count: number; first: number }[] = [];
  names.forEach((name, index) => {
    if (!name) return;
    const key = name.toLowerCase();
    const group = groups.find((item) => item.key === key);
    if (group) group.count += 1;
    else groups.push({ key, label: name, count: 1, first: index });
  });

  if (groups.length === 0) return "";

  const byFrequency = [...groups].sort((a, b) => b.count - a.count || a.first - b.first);
  const primary = names[0] ? groups.find((item) => item.key === names[0].toLowerCase())! : byFrequency[0];
  const rest = byFrequency.filter((item) => item !== primary).map((item) => item.label);

  return rest.length > 0 ? `${primary.label} (${rest.join(", ")})` : primary.label;
}
