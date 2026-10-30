import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const entries = sqliteTable('entries', {id:text('id').primaryKey(), kind:text('kind').notNull(), payload:text('payload').notNull(), created:text('created').notNull()});
