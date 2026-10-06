import sqlite from "@prisma/orm-sqlite/runtime";
import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };

export const db = sqlite<Contract>({
  contractJson,
  path: "./app.db",
});
