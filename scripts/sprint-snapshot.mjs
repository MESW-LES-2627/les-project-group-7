#!/usr/bin/env node

/**
 * Sprint Snapshot Generator for LES (Group 7)
 *
 * Usage:
 *   node scripts/sprint-snapshot.mjs                     # Current live state
 *   node scripts/sprint-snapshot.mjs 2026-10-30T23:00:00Z # Reconstruct at date
 */

import { execFileSync } from "node:child_process";

const OWNER = "MESW-LES-2627";
const REPO = "les-project-group-7";
const PROJECT_NUMBER = "20";
// SPRINT=2 node scripts/sprint-snapshot.mjs  (default: 1)
const SPRINT = process.env.SPRINT ?? "1";
const ITERATION_FILTER = `Iteration ${SPRINT}`;
const PERIODS = {
  1: "23 de Outubro de 2026 — 06 de Novembro de 2026",
  2: "06 de Novembro de 2026 — 20 de Novembro de 2026",
};

const dateArg = process.argv[2];
const snapshotTime = dateArg ? new Date(dateArg) : new Date();

function gh(args) {
  try {
    const stdout = execFileSync("gh", args, { maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(stdout.toString());
  } catch (err) {
    console.error(`Erro ao executar gh ${args.join(" ")}:`, err.message);
    process.exit(1);
  }
}

console.error("A obter itens do GitHub Project #20...");
const projectData = gh([
  "project",
  "item-list",
  PROJECT_NUMBER,
  "--owner",
  OWNER,
  "--format",
  "json",
  "--limit",
  "1000",
]);

const sprintItems = projectData.items.filter(
  (it) =>
    it.iteration?.title === ITERATION_FILTER && it.content?.type === "Issue"
);

console.error(
  `Encontrados ${sprintItems.length} itens para ${ITERATION_FILTER}.`
);

const TIMELINE_QUERY = `query($n:Int!){
  repository(owner:"${OWNER}",name:"${REPO}"){
    issue(number:$n){
      createdAt
      closedAt
      state
      timelineItems(first:50,itemTypes:[ADDED_TO_PROJECT_V2_EVENT,PROJECT_V2_ITEM_STATUS_CHANGED_EVENT]){
        nodes {
          __typename
          ... on AddedToProjectV2Event { createdAt }
          ... on ProjectV2ItemStatusChangedEvent {
            createdAt
            previousStatus
            status
          }
        }
      }
    }
  }
}`;

const rows = [];

for (const it of sprintItems) {
  const num = it.content.number;
  const title = it.content.title;
  const assignees = (it.assignees || []).join(", ") || "-";
  const estimate = it.estimate != null ? it.estimate : "-";
  const isEpic =
    (it.content.body || "").includes("user story") ||
    (title.includes("[US-") &&
      !title.includes("API") &&
      !title.includes("page") &&
      !title.includes("tests") &&
      !title.includes("guard"));

  let status = it.status || "Sem status";
  let isClosed = it.content.state === "CLOSED";

  if (dateArg) {
    const gql = gh([
      "api",
      "graphql",
      "-f",
      `query=${TIMELINE_QUERY}`,
      "-F",
      `n=${num}`,
    ]);
    const issueData = gql.data?.repository?.issue;
    if (issueData) {
      const events = (issueData.timelineItems?.nodes || []).filter(
        (e) => e.__typename === "ProjectV2ItemStatusChangedEvent"
      );

      // Encontrar o último evento antes da data alvo
      const eventBefore = events
        .filter((e) => new Date(e.createdAt) <= snapshotTime)
        .at(-1);

      if (eventBefore) {
        status = eventBefore.status;
      } else if (events.length > 0) {
        // Se a data for antes da primeira mudança, usar o primeiro previousStatus ou primeiro status
        status = events[0].previousStatus || events[0].status || "Backlog";
      }

      isClosed =
        !!issueData.closedAt && new Date(issueData.closedAt) <= snapshotTime;
    }
  }

  rows.push({
    num,
    title,
    assignees,
    estimate,
    status,
    isClosed,
  });
}

// Ordenação: por status lógico, depois por número
const statusOrder = {
  Backlog: 1,
  Ready: 2,
  "In progress": 3,
  "In review": 4,
  Done: 5,
};
rows.sort(
  (a, b) =>
    (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99) ||
    a.num - b.num
);

// Estatísticas
const counts = rows.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] || 0) + 1;
  return acc;
}, {});

// Geração de Markdown
console.log(`# Snapshot do Sprint ${SPRINT} (${ITERATION_FILTER})`);
console.log(`\n**Data do Snapshot:** ${snapshotTime.toISOString()}`);
if (dateArg) {
  console.log(
    `**Tipo:** Reconstruído retroativamente a partir do histórico de eventos do GitHub GraphQL (Board #20).`
  );
} else {
  console.log(`**Tipo:** Snapshot em tempo real.`);
}
console.log(`**Período da Iteração:** ${PERIODS[SPRINT] ?? "-"}`);
console.log(`**Total de Itens:** ${rows.length}\n`);

console.log(`## Resumo por Estado\n`);
console.log(`| Estado | Quantidade |`);
console.log(`|---|---|`);
for (const [st, cnt] of Object.entries(counts)) {
  console.log(`| **${st}** | ${cnt} |`);
}
console.log(`\n---\n`);

console.log(`## Sprint Backlog\n`);
console.log(
  `| # | Título | Estimativa | Responsável | Estado no Snapshot | Fechada |`
);
console.log(`|---|---|---|---|---|---|`);
for (const r of rows) {
  const safeTitle = r.title.replaceAll("|", "\\|");
  console.log(
    `| [#${r.num}](https://github.com/${OWNER}/${REPO}/issues/${r.num}) | ${safeTitle} | ${r.estimate} | ${r.assignees} | \`${r.status}\` | ${r.isClosed ? "Sim" : "Não"} |`
  );
}
