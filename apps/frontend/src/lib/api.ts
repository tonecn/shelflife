import app from '../../../backend/src/index';
import { hc } from 'hono/client';

export type AppType = typeof app;

const api = hc<AppType>('http://localhost:5173/api/')
export {
    api
}