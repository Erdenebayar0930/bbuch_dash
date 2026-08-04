export type WastePoint = {
  name: string;
  detail: string;
  schedule: string;
  zone: string;
  volume: string;
  lat: number;
  lng: number;
};

export type Khoroo = {
  id: number;
  name: string;
  /** Categorical slot for light surfaces */
  color: string;
  /** Same hue stepped for the dark surface */
  colorDark: string;
  /** Ойролцоо хилийн зураглал (албан ёсны кадастрын хил биш) */
  boundary: [number, number][];
  labelAt: [number, number];
  points: WastePoint[];
};

export const khoroos: Khoroo[] = [
  {
    id: 1,
    name: "1-р хороо",
    color: "#2a78d6",
    colorDark: "#3987e5",
    boundary: [
      [47.9285, 106.9315],
      [47.9295, 106.952],
      [47.9205, 106.956],
      [47.912, 106.948],
      [47.9125, 106.933],
      [47.92, 106.928],
    ],
    labelAt: [47.9215, 106.9425],
    points: [
      {
        name: "Сонгинохайрхан-1",
        detail: "Нэгдүгээр хогийн цэг",
        schedule: "Мягмар, Баасан / 08:00-10:00",
        zone: "А-3 бүс",
        volume: "12 тонн",
        lat: 47.918,
        lng: 106.941,
      },
    ],
  },
  {
    id: 2,
    name: "2-р хороо",
    color: "#eda100",
    colorDark: "#c98500",
    boundary: [
      [47.92, 106.9565],
      [47.9185, 106.986],
      [47.8975, 106.984],
      [47.893, 106.966],
      [47.9, 106.954],
      [47.912, 106.949],
    ],
    labelAt: [47.9075, 106.9695],
    points: [
      {
        name: "Сонгинохайрхан-2",
        detail: "Хоёрдугаар цуглуулах цэг",
        schedule: "Лхагва, Ням / 09:00-11:00",
        zone: "Б-1 бүс",
        volume: "9 тонн",
        lat: 47.905,
        lng: 106.969,
      },
    ],
  },
  {
    id: 3,
    name: "3-р хороо",
    color: "#e87ba4",
    colorDark: "#d55181",
    boundary: [
      [47.912, 106.933],
      [47.9115, 106.9485],
      [47.8995, 106.954],
      [47.887, 106.945],
      [47.8855, 106.918],
      [47.898, 106.9105],
      [47.908, 106.92],
    ],
    labelAt: [47.8985, 106.9315],
    points: [
      {
        name: "Сонгинохайрхан-3",
        detail: "Гурвандугаар хогийн цэг",
        schedule: "Даваа, Пүрэв / 07:30-09:30",
        zone: "В-2 бүс",
        volume: "15 тонн",
        lat: 47.895,
        lng: 106.928,
      },
    ],
  },
  {
    id: 4,
    name: "4-р хороо",
    color: "#008300",
    colorDark: "#008300",
    boundary: [
      [47.945, 106.895],
      [47.943, 106.921],
      [47.9285, 106.9315],
      [47.92, 106.928],
      [47.908, 106.92],
      [47.906, 106.895],
      [47.92, 106.888],
    ],
    labelAt: [47.9265, 106.906],
    points: [
      {
        name: "Сонгинохайрхан-4",
        detail: "Дөрөвдүгээр дахин боловсруулах цэг",
        schedule: "Мягмар, Бямба / 10:00-12:00",
        zone: "Г-4 бүс",
        volume: "7 тонн",
        lat: 47.93,
        lng: 106.91,
      },
    ],
  },
];

export const allWastePoints = khoroos.flatMap((khoroo) =>
  khoroo.points.map((point) => ({ ...point, khoroo })),
);

/** "12 тонн" → 12 */
export const tonnage = (khoroo: Khoroo) =>
  khoroo.points.reduce(
    (sum, point) => sum + (Number.parseFloat(point.volume) || 0),
    0,
  );

export const khorooById = (id: number | null | undefined) =>
  khoroos.find((khoroo) => khoroo.id === id) ?? null;

export const khorooLabel = (id: number | null | undefined) =>
  khorooById(id)?.name ?? "Тодорхойгүй";
