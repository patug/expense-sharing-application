# Expense Sharing Application (Splitwise-like Backend)

This project is a simplified **Expense Sharing Application** inspired by Splitwise.  
It focuses on designing a **clean backend system** that supports expense splitting,
balance tracking, simplified settlements, and clear API-driven interactions.

The goal is correctness, clarity, and explainability rather than UI or infrastructure complexity.

---

## 🚀 Features

- Create users
- Create groups with multiple members
- Add shared expenses
- Supported split types:
  - Equal split
  - Exact amount split
  - Percentage split
- Track balances:
  - How much a user owes
  - How much others owe a user
- Simplified balances (minimum number of transactions)
- Settle dues between users

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL
- **API Style:** REST
- **Tools:** Git, Postman

---

## 📁 Project Structure

backend/
├── index.js # App entry point
├── db.js # PostgreSQL connection
├── routes/
│ ├── users.js
│ ├── groups.js
│ ├── expenses.js
│ └── balances.js



## 🗄️ Database Structure

### `users`
Stores all users.

sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);
groups
Stores expense groups.

CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);
group_members
Maps users to groups (many-to-many relationship).

CREATE TABLE group_members (
  group_id INT,
  user_id INT
);
expenses
Stores high-level expense information.


CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  group_id INT,
  paid_by INT,
  amount NUMERIC
);
balances
Stores who owes whom and how much.

CREATE TABLE balances (
  from_user INT,
  to_user INT,
  amount NUMERIC
);
from_user → owes money

to_user → is owed money

🔗 API Endpoints
Users
POST /users

GET /users

Groups
POST /groups

Expenses
POST /expenses

Balances
GET /balances/:userId

GET /balances/simplified

Settlement
POST /settle

🧪 Sample API Tests (Postman)
Base URL:
http://localhost:5000
1️⃣ Create Users
POST /users
{
  "name": "Alice"
}
Response
{
  "id": 1,
  "name": "Alice"
}
Repeat for:
{ "name": "Bob" }
{ "name": "Charlie" }
2️⃣ Create Group
POST /groups
{
  "name": "Trip to Goa",
  "members": [1, 2, 3]
}
Response
{
  "id": 1,
  "name": "Trip to Goa"
}
3️⃣ Add Expense – Equal Split
Scenario:
Alice paid ₹300, split equally among Alice, Bob, and Charlie.

POST /expenses
{
  "groupId": 1,
  "paidBy": 1,
  "amount": 300,
  "splitType": "EQUAL",
  "splits": [
    { "userId": 1 },
    { "userId": 2 },
    { "userId": 3 }
  ]
}
Response
{
  "message": "Expense added successfully"
}
4️⃣ Add Expense – Exact Split
Scenario:
Bob paid ₹300
Alice ₹100, Bob ₹150, Charlie ₹50
{
  "groupId": 1,
  "paidBy": 2,
  "amount": 300,
  "splitType": "EXACT",
  "splits": [
    { "userId": 1, "amount": 100 },
    { "userId": 2, "amount": 150 },
    { "userId": 3, "amount": 50 }
  ]
}
5️⃣ Add Expense – Percentage Split
Scenario:
Charlie paid ₹500
Alice 40%, Bob 30%, Charlie 30%
{
  "groupId": 1,
  "paidBy": 3,
  "amount": 500,
  "splitType": "PERCENT",
  "splits": [
    { "userId": 1, "percent": 40 },
    { "userId": 2, "percent": 30 },
    { "userId": 3, "percent": 30 }
  ]
}
6️⃣ View User Balance
GET /balances/1

json
Copy code
{
  "you_owe": [
    { "to_user": 2, "amount": "100" }
  ],
  "you_are_owed": [
    { "from_user": 3, "amount": "200" }
  ]
}
7️⃣ View Simplified Balances (Core Requirement)
GET /balances/simplified
[
  { "from": 2, "to": 1, "amount": 100 },
  { "from": 3, "to": 1, "amount": 50 }
]
This shows net balances with minimum transactions, avoiding chained debts.

8️⃣ Settle Dues
POST /settle
{
  "from": 2,
  "to": 1
}
Response
{
  "message": "Settled successfully"
}
