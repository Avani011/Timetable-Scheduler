import express from "express";
import cors from "cors";
import { getDb } from "./db.js";

const app = express();

/* ================================
   Middleware
================================ */
app.use(cors());
app.use(express.json());

/* ================================
   Health Check
================================ */
app.get("/", (req, res) => {
  res.send("TaskAgent backend is alive ✅");
});

/* ================================
   SQLite-backed Tools
================================ */

// Create a new task
async function createTask(title) {
  const db = await getDb();
  const createdAt = new Date().toISOString();

  const result = await db.run(
    "INSERT INTO tasks (title, done, createdAt) VALUES (?, 0, ?)",
    [title.trim(), createdAt],
  );

  return {
    id: result.lastID,
    title: title.trim(),
    done: false,
    createdAt,
  };
}

// List all tasks
async function listTasks() {
  const db = await getDb();
  const rows = await db.all(
    "SELECT id, title, done, createdAt FROM tasks ORDER BY id DESC",
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    done: Boolean(row.done),
    createdAt: row.createdAt,
  }));
}

// Complete a task
async function completeTask(id) {
  const db = await getDb();

  const task = await db.get(
    "SELECT id, title, done, createdAt FROM tasks WHERE id = ?",
    [id],
  );

  if (!task) return null;

  await db.run("UPDATE tasks SET done = 1 WHERE id = ?", [id]);

  return {
    id: task.id,
    title: task.title,
    done: true,
    createdAt: task.createdAt,
  };
}

/* ================================
   Intent Router (Brain)
================================ */
function routeIntent(message) {
  const m = message.trim();

  // add task buy milk
  const addMatch = m.match(/^(add|create)\s+task\s+(.+)$/i);
  if (addMatch) {
    return { intent: "create_task", title: addMatch[2] };
  }

  // list tasks
  if (/^(list|show)\s+tasks$/i.test(m)) {
    return { intent: "list_tasks" };
  }

  // complete 1
  const completeMatch = m.match(/^(complete|done)\s+(\d+)$/i);
  if (completeMatch) {
    return { intent: "complete_task", id: Number(completeMatch[2]) };
  }

  return { intent: "unknown" };
}

/* ================================
   Helpers
================================ */
function formatTasks(tasks) {
  if (tasks.length === 0) return "No tasks yet.";

  return tasks
    .map((t) => `${t.done ? "✅" : "⬜"} [${t.id}] ${t.title}`)
    .join("\n");
}

/* ================================
   Agent API Endpoint
================================ */
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (typeof message !== "string" || message.trim() === "") {
    return res
      .status(400)
      .json({ error: "message must be a non-empty string" });
  }

  const action = routeIntent(message);

  if (action.intent === "create_task") {
    const task = await createTask(action.title);
    const tasks = await listTasks();

    return res.json({
      agent: "TaskAgent",
      intent: "create_task",
      reply: `Created task ✅: [${task.id}] ${task.title}`,
      tasks,
    });
  }

  if (action.intent === "list_tasks") {
    const tasks = await listTasks();

    return res.json({
      agent: "TaskAgent",
      intent: "list_tasks",
      reply: formatTasks(tasks),
      tasks,
    });
  }

  if (action.intent === "complete_task") {
    const task = await completeTask(action.id);

    if (!task) {
      return res.json({
        agent: "TaskAgent",
        intent: "complete_task",
        reply: `No task found with id ${action.id}`,
      });
    }

    const tasks = await listTasks();

    return res.json({
      agent: "TaskAgent",
      intent: "complete_task",
      reply: `Completed ✅: [${task.id}] ${task.title}`,
      tasks,
    });
  }

  return res.json({
    agent: "TaskAgent",
    intent: "unknown",
    reply:
      "I can help with tasks. Try:\n" +
      "- add task <title>\n" +
      "- list tasks\n" +
      "- complete <id>",
  });
});

/* ================================
   Start Server (Render-compatible)
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on ${PORT}`);
});
