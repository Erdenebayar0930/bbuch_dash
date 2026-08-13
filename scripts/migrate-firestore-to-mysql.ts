/**
 * Firestore → MySQL нэг удаагийн шилжүүлэлт.
 *
 * Ажиллуулах:
 *   npm run db:push                 # эхлээд хүснэгтүүдийг үүсгэнэ
 *   npm run migrate:firestore       # дараа нь өгөгдлийг зөөнө
 *
 * Шаардлагатай env (.env.local):
 *   DATABASE_URL, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *
 * Скрипт нь давтан ажиллуулахад аюулгүй (upsert) — тасарвал дахин эхлүүлж болно.
 * Firestore дэх өгөгдлийг УСТГАХГҮЙ; шалгаад л гараар устгана уу.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import {
  appConfig,
  fcmTokens,
  registrations,
  transactions,
  users,
} from "../src/lib/db/schema";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} тохируулаагүй байна.`);
  return value;
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: requireEnv("FIREBASE_PROJECT_ID"),
      clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
      privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

const firestore = getFirestore();
const pool = mysql.createPool({
  uri: requireEnv("DATABASE_URL"),
  timezone: "Z",
  decimalNumbers: false,
});
const db = drizzle(pool, { mode: "default" });

/** Firestore Timestamp | ISO текст → Date */
function toDate(value: unknown): Date {
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

const str = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

async function migrateUsers() {
  const snapshot = await firestore.collection("users").get();
  let count = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    await db
      .insert(users)
      .values({
        uid: doc.id,
        email: str(data.email).toLowerCase(),
        firstName: str(data.first_name),
        lastName: str(data.last_name),
        phone: str(data.phone),
        position: str(data.position),
        role: str(data.role, "user"),
        status: str(data.status, "active"),
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt ?? data.createdAt),
      })
      .onDuplicateKeyUpdate({ set: {
          email: str(data.email).toLowerCase(),
          firstName: str(data.first_name),
          lastName: str(data.last_name),
          phone: str(data.phone),
          position: str(data.position),
          role: str(data.role, "user"),
          status: str(data.status, "active"),
          },
      });

    count += 1;
  }

  return count;
}

async function migrateTransactions() {
  const snapshot = await firestore.collection("transactions").get();
  const rows = snapshot.docs.map((doc) => {
    const data = doc.data();
    const amount = typeof data.amount === "number" ? Math.abs(data.amount) : 0;

    return {
      date: str(data.date),
      description: str(data.description),
      category: str(data.category),
      type: data.type === "income" ? "income" : "expense",
      status:
        data.status === "pending" || data.status === "rejected"
          ? data.status
          : "approved",
      amount: amount.toFixed(2),
      createdBy: typeof data.createdBy === "string" ? data.createdBy : null,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt ?? data.createdAt),
    };
  });

  if (rows.length === 0) return 0;

  // Гүйлгээний id нь шинээр үүсэх тул давтан ажиллуулбал
  // давхардана — эхлээд хүснэгтийг хоослоно.
  await db.delete(transactions);

  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(transactions).values(rows.slice(i, i + 500));
  }

  return rows.length;
}

async function migrateFcmTokens() {
  const snapshot = await firestore.collection("userFCMTokens").get();
  const existing = await db.select({ uid: users.uid }).from(users);
  const knownUids = new Set(existing.map((row) => row.uid));

  let count = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const token = doc.data().token;
    if (typeof token !== "string" || token.length === 0) continue;

    // fcm_tokens.uid нь users.uid руу заадаг тул эзэнгүй token-ыг алгасна
    if (!knownUids.has(doc.id)) {
      skipped += 1;
      continue;
    }

    await db
      .insert(fcmTokens)
      .values({ uid: doc.id, token, updatedAt: toDate(doc.data().updatedAt) })
      .onDuplicateKeyUpdate({ set: { token } });

    count += 1;
  }

  if (skipped > 0) {
    console.log(`  (эзэнгүй ${skipped} token алгаслаа)`);
  }

  return count;
}

async function migrateRegistrations() {
  const snapshot = await firestore.collection("registrations").get();
  const rows = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      uid: str(data.uid),
      email: str(data.email).toLowerCase(),
      firstName: str(data.first_name),
      lastName: str(data.last_name),
      phone: str(data.phone),
      role: str(data.role, "user"),
      status: str(data.status, "pending"),
      createdAt: toDate(data.createdAt),
    };
  });

  if (rows.length === 0) return 0;

  await db.delete(registrations);
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(registrations).values(rows.slice(i, i + 500));
  }

  return rows.length;
}

async function migrateConfig() {
  const doc = await firestore.collection("config").doc("app").get();
  const hasAdmin = doc.exists ? doc.data()?.hasAdmin === true : false;

  await db
    .insert(appConfig)
    .values({ id: "app", hasAdmin })
    .onDuplicateKeyUpdate({ set: { hasAdmin } });

  return hasAdmin;
}

async function main() {
  console.log("Firestore → Postgres шилжүүлэлт эхэллээ\n");

  console.log("users...");
  console.log(`  ${await migrateUsers()} хэрэглэгч`);

  console.log("transactions...");
  console.log(`  ${await migrateTransactions()} гүйлгээ`);

  console.log("userFCMTokens → fcm_tokens...");
  console.log(`  ${await migrateFcmTokens()} token`);

  console.log("registrations...");
  console.log(`  ${await migrateRegistrations()} бүртгэл`);

  console.log("config/app...");
  console.log(`  hasAdmin = ${await migrateConfig()}`);

  console.log("\nДууслаа.");
}

main()
  .catch((error) => {
    console.error("\nШилжүүлэлт амжилтгүй боллоо:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
