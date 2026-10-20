import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding initial database...");

  // 1. Seed Cities
  const porto = await prisma.city.upsert({
    where: { id: "city-porto" },
    update: {},
    create: {
      id: "city-porto",
      name: "Porto",
      country: "Portugal",
      latitude: 41.1579,
      longitude: -8.6291,
    },
  });

  const lisboa = await prisma.city.upsert({
    where: { id: "city-lisboa" },
    update: {},
    create: {
      id: "city-lisboa",
      name: "Lisboa",
      country: "Portugal",
      latitude: 38.7223,
      longitude: -9.1393,
    },
  });

  console.log(`Seeded cities: ${porto.name}, ${lisboa.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
