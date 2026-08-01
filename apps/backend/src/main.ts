import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
const app = await createApp();

await app.listen({ port, host });

console.log(`rent-yield backend listening on http://${host}:${port}`);
