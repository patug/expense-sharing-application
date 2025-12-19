console.log("Starting backend...");

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

/* ---------- DATABASE CONFIG ---------- */
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "expense_db",
  password: "pass123",
  port: 5432,
});

/* ---------- TEST DB CONNECTION ---------- */
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("PostgreSQL connected successfully");
  } catch (err) {
    console.error("❌ PostgreSQL connection failed");
    console.error(err.message);
    process.exit(1);
  }
})();

/* ---------- USERS ---------- */
app.post("/users", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const result = await pool.query(
      "INSERT INTO users(name) VALUES($1) RETURNING *",
      [name]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

app.get("/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/* ---------- GROUPS ---------- */
app.post("/groups", async (req, res) => {
  try {
    const { name, members } = req.body;
    if (!name || !Array.isArray(members))
      return res.status(400).json({ error: "Invalid group data" });

    const groupResult = await pool.query(
      "INSERT INTO groups(name) VALUES($1) RETURNING *",
      [name]
    );

    const groupId = groupResult.rows[0].id;

    for (let userId of members) {
      await pool.query(
        "INSERT INTO group_members(group_id, user_id) VALUES($1,$2)",
        [groupId, userId]
      );
    }

    res.json(groupResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create group" });
  }
});

/* ---------- ADD EXPENSE (EQUAL / EXACT / PERCENT) ---------- */
app.post("/expenses", async (req, res) => {
  try {
    const { groupId, paidBy, amount, splitType, splits } = req.body;

    if (!groupId || !paidBy || !amount || !splitType || !Array.isArray(splits)) {
      return res.status(400).json({ error: "Invalid expense data" });
    }

    let calculatedSplits = [];

    if (splitType === "EQUAL") {
      const share = amount / splits.length;
      calculatedSplits = splits.map(s => ({
        userId: s.userId,
        amount: share,
      }));
    } else if (splitType === "EXACT") {
      const total = splits.reduce((sum, s) => sum + s.amount, 0);
      if (total !== amount)
        return res.status(400).json({ error: "Exact split mismatch" });
      calculatedSplits = splits;
    } else if (splitType === "PERCENT") {
      const percentTotal = splits.reduce((sum, s) => sum + s.percent, 0);
      if (percentTotal !== 100)
        return res.status(400).json({ error: "Percent must total 100" });

      calculatedSplits = splits.map(s => ({
        userId: s.userId,
        amount: (s.percent / 100) * amount,
      }));
    } else {
      return res.status(400).json({ error: "Invalid split type" });
    }

    await pool.query(
      "INSERT INTO expenses(group_id, paid_by, amount) VALUES($1,$2,$3)",
      [groupId, paidBy, amount]
    );

    for (let split of calculatedSplits) {
      if (split.userId !== paidBy) {
        await pool.query(
          "INSERT INTO balances(from_user,to_user,amount) VALUES($1,$2,$3)",
          [split.userId, paidBy, split.amount]
        );
      }
    }

    res.json({ message: "Expense added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add expense" });
  }
});

/* ---------- SIMPLIFIED BALANCES (IMPORTANT: BEFORE :userId) ---------- */
app.get("/balances/simplified", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT from_user, to_user, amount FROM balances"
    );

    const net = {};

    for (let r of result.rows) {
      net[r.from_user] = (net[r.from_user] || 0) - Number(r.amount);
      net[r.to_user] = (net[r.to_user] || 0) + Number(r.amount);
    }

    const debtors = [];
    const creditors = [];

    for (let u in net) {
      if (net[u] < 0) debtors.push({ userId: u, amount: -net[u] });
      if (net[u] > 0) creditors.push({ userId: u, amount: net[u] });
    }

    const simplified = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const settle = Math.min(debtors[i].amount, creditors[j].amount);

      simplified.push({
        from: Number(debtors[i].userId),
        to: Number(creditors[j].userId),
        amount: settle,
      });

      debtors[i].amount -= settle;
      creditors[j].amount -= settle;

      if (debtors[i].amount === 0) i++;
      if (creditors[j].amount === 0) j++;
    }

    res.json(simplified);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to simplify balances" });
  }
});

/* ---------- USER BALANCES ---------- */
app.get("/balances/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const owes = await pool.query(
      "SELECT to_user, SUM(amount) AS amount FROM balances WHERE from_user=$1 GROUP BY to_user",
      [userId]
    );

    const owed = await pool.query(
      "SELECT from_user, SUM(amount) AS amount FROM balances WHERE to_user=$1 GROUP BY from_user",
      [userId]
    );

    res.json({
      you_owe: owes.rows,
      you_are_owed: owed.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch balances" });
  }
});

/* ---------- SETTLE UP ---------- */
app.post("/settle", async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to)
      return res.status(400).json({ error: "Invalid settlement data" });

    await pool.query(
      "DELETE FROM balances WHERE from_user=$1 AND to_user=$2",
      [from, to]
    );

    res.json({ message: "Settled successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Settlement failed" });
  }
});

/* ---------- START SERVER ---------- */
app.listen(5000, () => {
  console.log("Backend running on http://localhost:5000");
});
