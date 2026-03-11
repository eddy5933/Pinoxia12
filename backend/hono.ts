import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

app.use("*", cors());

interface CloudUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
  updatedAt: string;
}

const usersStore = new Map<string, CloudUser>();

app.get("/", (c) => {
  return c.json({ status: "ok", message: "FoodSpot API is running" });
});

app.post("/users/upsert", async (c) => {
  const body = await c.req.json();
  const { id, email, name, role, avatar } = body;
  if (!id || !email || !name) {
    return c.json({ success: false, error: "Missing required fields" }, 400);
  }
  const user: CloudUser = {
    id,
    email,
    name,
    role: role || "customer",
    avatar,
    updatedAt: new Date().toISOString(),
  };
  usersStore.set(id, user);
  console.log(`[Users] Upserted: ${name} (${id}) role=${user.role}`);
  return c.json({ success: true, user });
});

app.get("/users", (c) => {
  const users = Array.from(usersStore.values());
  console.log(`[Users] Returning ${users.length} users`);
  return c.json(users);
});

app.get("/users/search", (c) => {
  const query = (c.req.query("q") || "").toLowerCase();
  const excludeId = c.req.query("excludeId") || "";
  let users = Array.from(usersStore.values());
  if (excludeId) {
    users = users.filter((u) => u.id !== excludeId);
  }
  if (query) {
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        (u.role === "owner" && "business".includes(query))
    );
  }
  console.log(`[Users] Search q="${query}" found ${users.length}`);
  return c.json(users);
});

app.get("/users/:id", (c) => {
  const id = c.req.param("id");
  const user = usersStore.get(id);
  if (!user) {
    return c.json(null, 404);
  }
  return c.json(user);
});

app.delete("/users/:id", (c) => {
  const id = c.req.param("id");
  const existed = usersStore.delete(id);
  console.log(`[Users] Deleted ${id}: ${existed}`);
  return c.json({ success: existed });
});

export default app;
