const express = require("express");
const router = express.Router();
const pool = require("../db");

/* Simplified balances */
router.get("/simplified", async (req, res) => {
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

/* User balances */
router.get("/:userId", async (req, res) => {
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

module.exports = router;
