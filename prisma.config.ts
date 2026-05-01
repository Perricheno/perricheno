// No external imports — works in standalone Docker containers where
// node_modules/prisma may not be present (npx downloads to temp dir).
export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"] || "postgresql://postgres:postgres@localhost:5432/postgres",
  },
};
