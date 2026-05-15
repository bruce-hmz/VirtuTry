#!/usr/bin/env tsx
/**
 * Seed clothing data for virtual try-on
 *
 * Usage: pnpm seed:clothing
 * Requires DATABASE_URL in .env.local
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import dotenv from "dotenv";
import { resolve } from "path";
import { pgTable, text, varchar, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

const clothing = pgTable("clothing", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  tags: text("tags").array(),
  imageUrl: text("image_url").notNull(),
  imageBase64: text("image_base64"),
  uploadedBy: text("uploaded_by"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const SEED_DATA: Array<{
  name: string;
  category: string;
  tags: string[];
  imageUrl: string;
}> = [
  // Dresses
  { name: "Summer Floral Dress", category: "dress", tags: ["casual", "summer", "floral", "colorful"], imageUrl: "/starter/demo/dress-1.jpg" },
  { name: "Little Black Dress", category: "dress", tags: ["formal", "classic", "black", "elegant"], imageUrl: "/starter/demo/dress-2.jpg" },
  { name: "Evening Gown", category: "dress", tags: ["formal", "evening", "elegant", "long"], imageUrl: "/starter/demo/dress-3.jpg" },
  { name: "Casual Sundress", category: "dress", tags: ["casual", "summer", "light", "comfortable"], imageUrl: "/starter/demo/dress-4.jpg" },
  { name: "Wrap Dress", category: "dress", tags: ["work", "versatile", "midi", "professional"], imageUrl: "/starter/demo/dress-5.jpg" },

  // Shirts
  { name: "White Cotton Shirt", category: "shirt", tags: ["formal", "classic", "white", "office"], imageUrl: "/starter/demo/shirt-1.jpg" },
  { name: "Striped Oxford Shirt", category: "shirt", tags: ["casual", "preppy", "striped", "cotton"], imageUrl: "/starter/demo/shirt-2.jpg" },
  { name: "Denim Button-Up", category: "shirt", tags: ["casual", "denim", "blue", "rugged"], imageUrl: "/starter/demo/shirt-3.jpg" },
  { name: "Linen Blouse", category: "shirt", tags: ["summer", "light", "feminine", "flowy"], imageUrl: "/starter/demo/shirt-4.jpg" },
  { name: "Silk Evening Blouse", category: "shirt", tags: ["formal", "silk", "elegant", "evening"], imageUrl: "/starter/demo/shirt-5.jpg" },

  // Coats
  { name: "Classic Trench Coat", category: "coat", tags: ["classic", "spring", "beige", "waterproof"], imageUrl: "/starter/demo/coat-1.jpg" },
  { name: "Wool Peacoat", category: "coat", tags: ["winter", "warm", "wool", "navy"], imageUrl: "/starter/demo/coat-2.jpg" },
  { name: "Leather Jacket", category: "coat", tags: ["edgy", "biker", "black", "leather"], imageUrl: "/starter/demo/coat-3.jpg" },
  { name: "Puffer Jacket", category: "coat", tags: ["winter", "warm", "casual", "outdoor"], imageUrl: "/starter/demo/coat-4.jpg" },
  { name: "Blazer", category: "coat", tags: ["formal", "work", "professional", "navy"], imageUrl: "/starter/demo/coat-5.jpg" },

  // Pants
  { name: "Tailored Trousers", category: "pants", tags: ["formal", "work", "black", "slim"], imageUrl: "/starter/demo/pants-1.jpg" },
  { name: "Blue Jeans", category: "pants", tags: ["casual", "denim", "blue", "everyday"], imageUrl: "/starter/demo/pants-2.jpg" },
  { name: "Wide-Leg Pants", category: "pants", tags: ["trendy", "comfortable", "beige", "flowy"], imageUrl: "/starter/demo/pants-3.jpg" },
  { name: "Cargo Pants", category: "pants", tags: ["casual", "utility", "green", "pockets"], imageUrl: "/starter/demo/pants-4.jpg" },
  { name: "White Linen Pants", category: "pants", tags: ["summer", "light", "casual", "beach"], imageUrl: "/starter/demo/pants-5.jpg" },

  // Skirts
  { name: "Pleated Mini Skirt", category: "skirt", tags: ["casual", "preppy", "plaid", "short"], imageUrl: "/starter/demo/skirt-1.jpg" },
  { name: "Pencil Skirt", category: "skirt", tags: ["formal", "work", "black", "slim"], imageUrl: "/starter/demo/skirt-2.jpg" },
  { name: "A-Line Midi Skirt", category: "skirt", tags: ["versatile", "feminine", "midi", "floral"], imageUrl: "/starter/demo/skirt-3.jpg" },
  { name: "Maxi Skirt", category: "skirt", tags: ["bohemian", "long", "flowy", "summer"], imageUrl: "/starter/demo/skirt-4.jpg" },

  // Tops
  { name: "Basic Crewneck Tee", category: "top", tags: ["basic", "cotton", "white", "everyday"], imageUrl: "/starter/demo/top-1.jpg" },
  { name: "Turtleneck Sweater", category: "top", tags: ["winter", "warm", "black", "classic"], imageUrl: "/starter/demo/top-2.jpg" },
  { name: "Off-Shoulder Top", category: "top", tags: ["trendy", "feminine", "summer", "date"], imageUrl: "/starter/demo/top-3.jpg" },
  { name: "Crop Top", category: "top", tags: ["casual", "summer", "trendy", "short"], imageUrl: "/starter/demo/top-4.jpg" },

  // Jackets
  { name: "Denim Jacket", category: "jacket", tags: ["casual", "denim", "blue", "classic"], imageUrl: "/starter/demo/jacket-1.jpg" },
  { name: "Bomber Jacket", category: "jacket", tags: ["casual", "sporty", "green", "zip"], imageUrl: "/starter/demo/jacket-2.jpg" },
  { name: "Cardigan", category: "jacket", tags: ["cozy", "knit", "beige", "layering"], imageUrl: "/starter/demo/jacket-3.jpg" },

  // Sweaters
  { name: "Cashmere Crewneck", category: "sweater", tags: ["luxury", "warm", "gray", "soft"], imageUrl: "/starter/demo/sweater-1.jpg" },
  { name: "Fair Isle Knit", category: "sweater", tags: ["winter", "patterned", "cozy", "festive"], imageUrl: "/starter/demo/sweater-2.jpg" },
  { name: "Oversized Sweater", category: "sweater", tags: ["cozy", "casual", "cream", "chunky"], imageUrl: "/starter/demo/sweater-3.jpg" },
];

async function seed() {
  console.log("Seeding clothing data...\n");

  const existing = await db.select({ id: clothing.id }).from(clothing).limit(1);
  if (existing.length > 0) {
    console.log("Clothing table already has data. Skipping seed.\n");
    console.log("To re-seed, truncate the clothing table first.");
    await client.end();
    return;
  }

  let count = 0;
  for (const item of SEED_DATA) {
    try {
      await db.insert(clothing).values({
        id: randomUUID(),
        name: item.name,
        category: item.category,
        tags: item.tags,
        imageUrl: item.imageUrl,
        active: true,
      });
      count++;
      console.log(`  [${count}/${SEED_DATA.length}] ${item.category}: ${item.name}`);
    } catch (err) {
      console.error(`  Failed to insert ${item.name}:`, err);
    }
  }

  console.log(`\nDone! ${count} clothing items seeded.`);
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
