import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import * as z from "zod";

const schema = z.object({
  id: z.string(),
  title: z.string(),
});

type Todo = z.infer<typeof schema>;

const todos: Todo[] = [];

const api = new Hono()
  .post("/todo", zValidator("form", schema), (c) => {
    const todo = c.req.valid("form");
    todos.push(todo);
    return c.json({
      message: "created!",
    });
  })
  .get("/todo", (c) => {
    return c.json({
      todos,
    });
  });

export type AppType = typeof api;

const app = new Hono();
app.route("/api", api);

export default app;
