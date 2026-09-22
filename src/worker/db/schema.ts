import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const channelsTable = sqliteTable("channels", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  suid: int().notNull(),
  created: text().notNull().unique(),
});
