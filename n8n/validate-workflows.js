#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const workflowPath = path.join(root, "n8n-workflows.json");
const workflowDocument = JSON.parse(fs.readFileSync(workflowPath, "utf8"));

if (!Array.isArray(workflowDocument.workflows)) {
  throw new Error("O arquivo n8n-workflows.json não contém um array workflows.");
}

const routeSources = [
  fs.readFileSync(path.join(root, "server.js"), "utf8"),
  fs.readFileSync(path.join(root, "api", "server.js"), "utf8"),
  fs.readFileSync(path.join(root, "api", "n8n-routes.js"), "utf8"),
  fs.readFileSync(path.join(root, "api", "hybrid-routes.js"), "utf8")
].join("\n");

const implementedRoutes = new Set();
for (const match of routeSources.matchAll(/(?:urlPath === ['"]|app\.(?:get|post|put|delete)\(['"])([^'"?]+)/g)) {
  implementedRoutes.add(match[1]);
}

const workflowRoutes = new Set();
for (const workflow of workflowDocument.workflows) {
  for (const node of workflow.nodes || []) {
    const url = node.config && node.config.url;
    if (!url || !url.includes("$env.API_URL")) continue;
    const route = url.replace(/^.*?\}\}/, "");
    const cleanRoute = route.split("?")[0];
    if (cleanRoute.startsWith("/")) workflowRoutes.add(cleanRoute);
  }
}

const missingRoutes = [...workflowRoutes].filter((route) => {
  if (route.includes("{{")) return false;
  return !implementedRoutes.has(route);
});

console.log(`Workflows encontrados: ${workflowDocument.workflows.length}`);
for (const workflow of workflowDocument.workflows) {
  const trigger = workflow.trigger || {};
  console.log(`- ${workflow.id}: ${workflow.name} [${trigger.type}]`);
}

console.log(`Rotas HTTP descritas: ${[...workflowRoutes].sort().join(", ") || "nenhuma"}`);
console.log(`Rotas descritas e não encontradas na implementação: ${missingRoutes.sort().join(", ") || "nenhuma"}`);

if (missingRoutes.length > 0) {
  process.exitCode = 2;
}
