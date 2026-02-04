import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("TaskAgent backend is alive ✅"));

// ---- In-memory "database" ----
let nextId = 1;
const tasks = []; // each: { id, title, done, createdAt }

// ---- Tools (functions the agent can call) ----
function createTask(title) {
  const task = {
    id: nextId++,
    title: title.trim(),
    done: false,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  return task;
}

function listTasks() {
  return tasks;
}

function completeTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;
  task.done = true;
  return task;
}

// ---- Intent router (turn text -> tool call) ----
function routeIntent(message) {
  const m = message.trim();

  // "add task buy milk" | "create task buy milk" | "todo buy milk"
  const addMatch =
    m.match(/^(add|create)\s+task\s+(.+)$/i) || m.match(/^todo\s+(.+)$/i);
  if (addMatch) {
    const title = addMatch[2] || addMatch[1];
    return { intent: "create_task", title };
  }

  // "list tasks" | "show tasks"
  if (/^(list|show)\s+tasks$/i.test(m)) {
    return { intent: "list_tasks" };
  }

  // "complete 2" | "done 2"
  const completeMatch = m.match(/^(complete|done)\s+(\d+)$/i);
  if (completeMatch) {
    return { intent: "complete_task", id: Number(completeMatch[2]) };
  }

  return { intent: "unknown" };
}

// ---- Helper for nice output ----
function formatTasks(tsk) {
  if (tsk.length === 0) return "No tasks yet.";
  return tsk
    .map((t) => `${t.done ? "✅" : "⬜"} [${t.id}] ${t.title}`)
    .join("\n");
}

// ---- Updated agent endpoint ----
app.post("/api/chat", (req, res) => {
  const { message } = req.body;

  if (typeof message !== "string" || message.trim().length === 0) {
    return res
      .status(400)
      .json({ error: "message must be a non-empty string" });
  }

  const action = routeIntent(message);

  if (action.intent === "create_task") {
    const task = createTask(action.title);
    return res.json({
      agent: "TaskAgent",
      intent: action.intent,
      reply: `Created task ✅: [${task.id}] ${task.title}`,
      tasks: listTasks(),
    });
  }

  if (action.intent === "list_tasks") {
    return res.json({
      agent: "TaskAgent",
      intent: action.intent,
      reply: formatTasks(listTasks()),
      tasks: listTasks(),
    });
  }

  if (action.intent === "complete_task") {
    const updated = completeTask(action.id);
    if (!updated) {
      return res.status(404).json({
        agent: "TaskAgent",
        intent: action.intent,
        reply: `No task found with id ${action.id}`,
      });
    }
    return res.json({
      agent: "TaskAgent",
      intent: action.intent,
      reply: `Completed ✅: [${updated.id}] ${updated.title}`,
      tasks: listTasks(),
    });
  }

  // Unknown intent: teach user what to do
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

const PORT = process.env.PORT || 3000;

// bind 0.0.0.0 is safe on Render
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on ${PORT}`);
});
