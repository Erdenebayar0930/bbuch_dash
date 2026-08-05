import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Хэрэглэгч. `uid` нь Firebase Auth-ийн UID — аутентикац Firebase дээр
 * үлдсэн тул энэ багана нь гадаад системтэй холбогдох түлхүүр болно.
 */
export const users = pgTable(
  "users",
  {
    uid: text("uid").primaryKey(),
    email: text("email").notNull(),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    position: text("position").notNull().default(""),
    /** URL to profile photo stored in Firebase Storage */
    photoUrl: text("photo_url").notNull().default(""),

    // --- Чуулган (зөвхөн админ оноодог) -------------------------------------
    /** Дуудлагууд — дээд тал нь 5. Хэрэглэгч өөрөө засахгүй, зөвхөн харна. */
    callings: jsonb("callings").$type<string[]>().notNull().default([]),
    /**
     * Харьяалагдах аймгууд — нэг хүн олон аймагт байж болно.
     * Мэдэгдлийг аймгаар чиглүүлэхэд containment (@>) хайлт хийнэ.
     */
    aimags: jsonb("aimags").$type<string[]>().notNull().default([]),

    // --- Хувийн ------------------------------------------------------------
    /** MBTI 16 төрлийн нэг (ISTJ гэх мэт) */
    mbti: text("mbti").notNull().default(""),
    /** Хайрын 5 хэлний нэг */
    loveLanguage: text("love_language").notNull().default(""),
    /**
     * Темперамент — олон төрөл зэрэг байж болох тул сонгосон төрөл бүрийг
     * оноотой нь хадгална: { "sanguine": 12, "choleric": 8 }.
     * Сонгоогүй төрөл огт байхгүй байна.
     */
    temperaments: jsonb("temperaments")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    occupation: text("occupation").notNull().default(""),
    hasCar: boolean("has_car").notNull().default(false),
    /** Тээврийн хэрэгслийн улсын дугаар */
    carPlate: text("car_plate").notNull().default(""),

    // --- Гэр бүл -----------------------------------------------------------
    /** Эхнэр / нөхрийн нэр */
    spouseName: text("spouse_name").notNull().default(""),
    /** YYYY-MM-DD */
    spouseBirthDate: text("spouse_birth_date").notNull().default(""),
    /** super | admin | user */
    role: text("role").notNull().default("user"),
    /** active | pending | blocked */
    status: text("status").notNull().default("pending"),
    /** Харьяа хорооны дугаар — мэдэгдлийг хороогоор чиглүүлэхэд */
    khoroo: integer("khoroo"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("users_khoroo_status_idx").on(table.khoroo, table.status),
    index("users_email_idx").on(table.email),
  ]
);

/** Орлого / зарлагын гүйлгээ */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** YYYY-MM-DD */
    date: text("date").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default(""),
    /** income | expense */
    type: text("type").notNull(),
    /** approved | pending | rejected */
    status: text("status").notNull().default("approved"),
    /** Үргэлж эерэг — тэмдгийг type тодорхойлно */
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("transactions_date_idx").on(table.date)]
);

/**
 * Хүүхдийн бүртгэл — хэрэглэгч тутамд олон мөр.
 *
 * Профайл хадгалахад бүх мөрийг солих (replace) зарчмаар бичнэ, тиймээс
 * дараалал `position`-оор тогтоно.
 */
export const children = pgTable(
  "children",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    uid: text("uid")
      .notNull()
      .references(() => users.uid, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    /** YYYY-MM-DD */
    birthDate: text("birth_date").notNull().default(""),
    /** male | female | "" */
    gender: text("gender").notNull().default(""),
    /** Маягт дээрх эрэмбэ */
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("children_uid_idx").on(table.uid, table.position)]
);

/**
 * Мэдэгдэл — хүлээн авагч тутамд НЭГ мөр (fan-out on write).
 *
 * Push нь зөвхөн мэдэгдүүлэг; жинхэнэ бүртгэл нь энэ хүснэгт. Тиймээс
 * хэрэглэгч апп нээгээгүй, зөвшөөрөл өгөөгүй байсан ч мэдэгдэл алдагдахгүй,
 * дараа нэвтрэхэд уншаагүй төлөвтэй хүлээж байна.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Хүлээн авагч */
    uid: text("uid")
      .notNull()
      .references(() => users.uid, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    /** Дарахад шилжих зам — хоосон бол шилжихгүй */
    url: text("url").notNull().default(""),
    /** Илгээсэн админы uid */
    createdBy: text("created_by"),
    /** Уншсан хугацаа — null бол уншаагүй */
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_uid_created_idx").on(table.uid, table.createdAt),
  ]
);

/** FCM token — хэрэглэгч тутамд нэг */
export const fcmTokens = pgTable("fcm_tokens", {
  uid: text("uid")
    .primaryKey()
    .references(() => users.uid, { onDelete: "cascade" }),
  token: text("token").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Бүртгэлийн лог — админ хянахад */
export const registrations = pgTable("registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  uid: text("uid").notNull(),
  email: text("email").notNull(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  role: text("role").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Системийн тохиргоо — нэг мөртэй хүснэгт (id = 'app').
 * `hasAdmin` нь анхны админ үүссэн эсэхийг тэмдэглэнэ.
 */
export const appConfig = pgTable("app_config", {
  id: text("id").primaryKey().default("app"),
  hasAdmin: boolean("has_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type ChildRow = typeof children.$inferSelect;
