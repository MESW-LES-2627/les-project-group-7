import { PrismaClient, PlaceCategory } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface RawPlace {
  osmId: string;
  name: string;
  description: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  openingHours: string;
  priceLevel: string;
}

async function main() {
  console.log("🌱 Starting PostgreSQL database seed...");

  // 1. Create Pilot Cities
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

  console.log(`✅ Cities created: ${porto.name}, ${lisboa.name}`);

  // 2. Create Demo Users
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@tripbook.pt" },
    update: {},
    create: {
      id: "demo-user-1",
      username: "viajante_porto",
      email: "demo@tripbook.pt",
      passwordHash: "hash_demo_12345",
      role: "USER",
    },
  });

  const demoUser2 = await prisma.user.upsert({
    where: { email: "ana@tripbook.pt" },
    update: {},
    create: {
      id: "demo-user-2",
      username: "ana_exploradora",
      email: "ana@tripbook.pt",
      passwordHash: "hash_demo_12345",
      role: "USER",
    },
  });

  console.log(`✅ Test users created: ${demoUser.username}, ${demoUser2.username}`);

  // 3. Import OpenStreetMap Places from JSON
  const jsonPath = path.join(process.cwd(), "prisma/data/porto-places.json");
  if (fs.existsSync(jsonPath)) {
    const rawData = fs.readFileSync(jsonPath, "utf-8");
    const placesData: RawPlace[] = JSON.parse(rawData);

    for (const p of placesData) {
      const placeCategory = (PlaceCategory as Record<string, PlaceCategory>)[p.category] || PlaceCategory.OTHER;

      await prisma.place.upsert({
        where: { osmId: p.osmId },
        update: {
          name: p.name,
          description: p.description,
          category: placeCategory,
          address: p.address,
          latitude: p.latitude,
          longitude: p.longitude,
          openingHours: p.openingHours,
          priceLevel: p.priceLevel,
          cityId: porto.id,
        },
        create: {
          osmId: p.osmId,
          name: p.name,
          description: p.description,
          category: placeCategory,
          address: p.address,
          latitude: p.latitude,
          longitude: p.longitude,
          openingHours: p.openingHours,
          priceLevel: p.priceLevel,
          cityId: porto.id,
          source: "IMPORTED",
        },
      });
    }

    console.log(`✅ ${placesData.length} OpenStreetMap places imported for Porto!`);
  }

  // 4. Insert Demo Reviews to compute real ratings and rankings
  const clerigos = await prisma.place.findUnique({ where: { osmId: "node/268571891" } });
  if (clerigos) {
    await prisma.review.createMany({
      data: [
        {
          userId: demoUser.id,
          placeId: clerigos.id,
          rating: 5,
          priceLevel: "€",
          text: "Climbing the 240 steps is demanding, but the 360-degree view over Porto is worth every step!",
        },
        {
          userId: demoUser2.id,
          placeId: clerigos.id,
          rating: 4,
          priceLevel: "€",
          text: "Incredible landmark, recommended to book online ahead of time to avoid long queues.",
        },
      ],
      skipDuplicates: true,
    });

    await prisma.place.update({
      where: { id: clerigos.id },
      data: { averageRating: 4.5, reviewCount: 2 },
    });
  }

  const santiago = await prisma.place.findUnique({ where: { osmId: "node/819201948" } });
  if (santiago) {
    await prisma.review.create({
      data: {
        userId: demoUser.id,
        placeId: santiago.id,
        rating: 5,
        priceLevel: "€",
        text: "The best traditional francesinha in Porto. Spicy sauce on point and homemade fries.",
      },
    });

    await prisma.place.update({
      where: { id: santiago.id },
      data: { averageRating: 5.0, reviewCount: 1 },
    });
  }

  const serralves = await prisma.place.findUnique({ where: { osmId: "node/392019482" } });
  if (serralves) {
    await prisma.review.create({
      data: {
        userId: demoUser2.id,
        placeId: serralves.id,
        rating: 5,
        priceLevel: "€€",
        text: "The park is stunning and the Treetop Walk provides a unique perspective of the tree canopy.",
      },
    });

    await prisma.place.update({
      where: { id: serralves.id },
      data: { averageRating: 5.0, reviewCount: 1 },
    });
  }

  console.log("🎉 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
