// apps/backend/src/index.ts
import { Hono } from 'hono';
import items from './routes/items';

const app = new Hono().route('/items', items);

export default app;