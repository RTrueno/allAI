// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const users = sqliteTable('users', {id:text('id').primaryKey(), email:text('email').notNull().unique(), name:text('name').notNull(), password:text('password'), salt:text('salt')});
export const sessions = sqliteTable('sessions', {id:text('id').primaryKey(), userId:text('user_id').notNull().references(()=>users.id), expires:integer('expires').notNull()});
export const chats = sqliteTable('chats', {id:text('id').primaryKey(), userId:text('user_id').notNull(), title:text('title').notNull(), model:text('model').notNull(), updated:integer('updated').notNull()});
export const messages = sqliteTable('messages', {id:text('id').primaryKey(), chatId:text('chat_id').notNull().references(()=>chats.id), role:text('role').notNull(), content:text('content').notNull(), model:text('model').notNull(), created:integer('created').notNull()});
export const community = sqliteTable('community', {id:text('id').primaryKey(), userId:text('user_id').notNull(), name:text('name').notNull(), content:text('content').notNull(), created:integer('created').notNull()});
export const attempts = sqliteTable('attempts', {id:text('id').primaryKey(), count:integer('count').notNull(), reset:integer('reset').notNull()});
