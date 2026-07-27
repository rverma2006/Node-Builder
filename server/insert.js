const db   = require("./db");
const fs   = require("fs");
const path = require("path");

async function main() {
  // Change this path to wherever you saved the JSON file
  const filePath = path.join(process.env.HOME, "Desktop", "module.json");
  const data = fs.readFileSync(filePath, "utf8");

  // Change the name to whatever you want this module called
  const name = "Obs History Module";

  const [result] = await db.query(
    "INSERT INTO ritvik_modules (name, data) VALUES (?, ?)",
    [name, data]
  );

  console.log("Inserted successfully! Module ID:", result.insertId);
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});