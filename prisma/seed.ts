import { PrismaClient, PlaceCategory } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import {
  DEMO_USERS,
  demoPassword,
  type DemoUser,
} from "../src/domain/identity/demo-users";

const prisma = new PrismaClient();

/**
 * Creates the demo user, or fixes the one already in the database, and gives it a login: the
 * authentication library (ADR-009) keeps the password in `Account`, hashed with its own function.
 * The salt is new on every run, so a rerun also resets the password to the documented one.
 */
async function ensureDemoUser(user: DemoUser, password: string) {
  const saved = await prisma.user.upsert({
    where: { email: user.email },
    update: { name: user.username, displayUsername: user.username },
    create: {
      id: user.id,
      username: user.username,
      displayUsername: user.username,
      name: user.username,
      email: user.email,
      role: "USER",
    },
  });

  const hash = await hashPassword(password);
  const account = await prisma.account.findFirst({
    where: { userId: saved.id, providerId: "credential" },
  });
  if (account) {
    await prisma.account.update({
      where: { id: account.id },
      data: { password: hash },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: saved.id,
        providerId: "credential",
        userId: saved.id,
        password: hash,
      },
    });
  }
  return saved;
}

/**
 * Replaces the sample reviews that this seed wrote on one place, so running it again does not
 * duplicate them. A review is "ours" when it has the same place, a demo user and the same text.
 * Any other review stays, also one that someone wrote in the app while logged in as a demo user.
 */
async function replaceDemoReviews(
  placeId: string,
  demoUserIds: string[],
  reviews: {
    userId: string;
    rating: number;
    priceLevel: string;
    text: string;
  }[]
) {
  await prisma.review.deleteMany({
    where: {
      placeId,
      userId: { in: demoUserIds },
      text: { in: reviews.map((review) => review.text) },
    },
  });
  await prisma.review.createMany({
    data: reviews.map((review) => ({ ...review, placeId })),
  });
}

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
  console.log("Starting PostgreSQL database seed...");

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
      name: "Lisbon",
      country: "Portugal",
      latitude: 38.7223,
      longitude: -9.1393,
    },
  });

  const madrid = await prisma.city.upsert({
    where: { id: "city-madrid" },
    update: {},
    create: {
      id: "city-madrid",
      name: "Madrid",
      country: "Spain",
      latitude: 40.4168,
      longitude: -3.7038,
    },
  });

  const paris = await prisma.city.upsert({
    where: { id: "city-paris" },
    update: {},
    create: {
      id: "city-paris",
      name: "Paris",
      country: "France",
      latitude: 48.8566,
      longitude: 2.3522,
    },
  });

  const roma = await prisma.city.upsert({
    where: { id: "city-roma" },
    update: {},
    create: {
      id: "city-roma",
      name: "Rome",
      country: "Italy",
      latitude: 41.9028,
      longitude: 12.4964,
    },
  });

  const berlim = await prisma.city.upsert({
    where: { id: "city-berlim" },
    update: {},
    create: {
      id: "city-berlim",
      name: "Berlin",
      country: "Germany",
      latitude: 52.52,
      longitude: 13.405,
    },
  });

  const londres = await prisma.city.upsert({
    where: { id: "city-londres" },
    update: {},
    create: {
      id: "city-londres",
      name: "London",
      country: "United Kingdom",
      latitude: 51.5074,
      longitude: -0.1278,
    },
  });

  console.log(
    `Cities created: ${porto.name}, ${lisboa.name}, ${madrid.name}, ${paris.name}, ${roma.name}, ${berlim.name}, ${londres.name}`
  );

  // 2. Create Demo Users, with a password they can log in with (US-B2-01)
  const password = demoPassword(process.env.DEMO_PASSWORD);
  const [demoUser, demoUser2] = [
    await ensureDemoUser(DEMO_USERS[0], password),
    await ensureDemoUser(DEMO_USERS[1], password),
  ];
  const demoUserIds = [demoUser.id, demoUser2.id];

  console.log(
    `Test users created: ${demoUser.username}, ${demoUser2.username} (they log in with the demo password)`
  );

  // 3. Import OpenStreetMap Places from JSON
  const jsonPath = path.join(process.cwd(), "prisma/data/porto-places.json");
  if (fs.existsSync(jsonPath)) {
    const rawData = fs.readFileSync(jsonPath, "utf-8");
    const placesData: RawPlace[] = JSON.parse(rawData);

    for (const p of placesData) {
      const placeCategory =
        (PlaceCategory as Record<string, PlaceCategory>)[p.category] ||
        PlaceCategory.OTHER;

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

    console.log(
      `${placesData.length} OpenStreetMap places imported for Porto!`
    );
  }

  // 3b. Import European Flagship Landmarks (Lisboa, Madrid, Paris, Roma)
  const europeanPlaces = [
    // Lisbon
    {
      osmId: "node/25299496",
      name: "Torre de Belém",
      description:
        "Fortificação icónica do século XVI e Património Mundial da UNESCO na margem do Tejo.",
      category: PlaceCategory.MONUMENT,
      address: "Avenida Brasília, 1400-206 Lisboa",
      latitude: 38.6916,
      longitude: -9.216,
      openingHours: "Tu-Su 10:00-17:30",
      priceLevel: "€€",
      cityId: lisboa.id,
      rating: 5.0,
      comment:
        "A vista sobre o rio Tejo e a arquitetura manuelina são deslumbrantes.",
    },
    {
      osmId: "node/25299497",
      name: "Mosteiro dos Jerónimos",
      description:
        "Obra-prima do estilo manuelino e túmulo de Vasco da Gama e Luís de Camões.",
      category: PlaceCategory.MONUMENT,
      address: "Praça do Império, 1400-206 Lisboa",
      latitude: 38.6979,
      longitude: -9.2067,
      openingHours: "Tu-Su 10:00-17:30",
      priceLevel: "€€",
      cityId: lisboa.id,
      rating: 5.0,
      comment:
        "Claustros imperdíveis e um dos edifícios mais belos de Portugal.",
    },
    {
      osmId: "node/25299498",
      name: "Castelo de São Jorge",
      description:
        "Fortaleza histórica no topo da colina mais alta de Lisboa com vista panorâmica.",
      category: PlaceCategory.MONUMENT,
      address: "Rua de Santa Cruz do Castelo, 1100-129 Lisboa",
      latitude: 38.7139,
      longitude: -9.1335,
      openingHours: "Mo-Su 09:00-21:00",
      priceLevel: "€€",
      cityId: lisboa.id,
      rating: 4.0,
      comment:
        "Melhor pôr do sol de Lisboa, vale a subida pelas ruelas de Alfama.",
    },
    {
      osmId: "node/25299500",
      name: "Pastéis de Belém",
      description:
        "Antiga confeitaria tradicional famosa pelos originais pastéis de nata desde 1837.",
      category: PlaceCategory.CAFE,
      address: "Rua de Belém 84-92, 1300-085 Lisboa",
      latitude: 38.6975,
      longitude: -9.2032,
      openingHours: "Mo-Su 08:00-21:00",
      priceLevel: "€",
      cityId: lisboa.id,
      rating: 5.0,
      comment:
        "Servidos ainda mornos com canela e açúcar em pó. Fila anda rápido.",
    },
    // Madrid
    {
      osmId: "node/35299496",
      name: "Museo Nacional del Prado",
      description:
        "Um dos museus de arte mais prestigiados do mundo, com obras de Velázquez e Goya.",
      category: PlaceCategory.MUSEUM,
      address: "Calle de Ruiz de Alarcón 23, 28014 Madrid",
      latitude: 40.4138,
      longitude: -3.6921,
      openingHours: "Mo-Sa 10:00-20:00, Su 10:00-19:00",
      priceLevel: "€€",
      cityId: madrid.id,
      rating: 5.0,
      comment:
        "As Meninas de Velázquez ao vivo são imperdíveis. Reserve pelo menos 3 horas.",
    },
    {
      osmId: "node/35299497",
      name: "Parque de El Retiro",
      description:
        "Parque histórico de 125 hectares com o Palácio de Cristal e lago com barcos a remos.",
      category: PlaceCategory.PARK,
      address: "Plaza de la Independencia 7, 28001 Madrid",
      latitude: 40.4153,
      longitude: -3.6845,
      openingHours: "Mo-Su 06:00-22:00",
      priceLevel: "FREE",
      cityId: madrid.id,
      rating: 5.0,
      comment:
        "Oásis verde no centro de Madrid, perfeito para descansar e passear de barco.",
    },
    {
      osmId: "node/35299498",
      name: "Palacio Real de Madrid",
      description:
        "Residência oficial da família real espanhola, o maior palácio real da Europa Ocidental.",
      category: PlaceCategory.MONUMENT,
      address: "Calle de Bailén, 28071 Madrid",
      latitude: 40.418,
      longitude: -3.7143,
      openingHours: "Mo-Su 10:00-18:00",
      priceLevel: "€€",
      cityId: madrid.id,
      rating: 4.0,
      comment:
        "Salões e jardins impressionantes com vista desafogada para o rio Manzanares.",
    },
    {
      osmId: "node/35299500",
      name: "Chocolatería San Ginés",
      description:
        "Histórica casa de chocolate com churros fundada em 1894 perto da Puerta del Sol.",
      category: PlaceCategory.CAFE,
      address: "Pasadizo de San Ginés 5, 28013 Madrid",
      latitude: 40.4172,
      longitude: -3.7071,
      openingHours: "Mo-Su 24h",
      priceLevel: "€",
      cityId: madrid.id,
      rating: 5.0,
      comment: "Churros estaladiços com chocolate quente espesso tradicional.",
    },
    // Paris
    {
      osmId: "node/45299496",
      name: "Tour Eiffel",
      description:
        "O símbolo monumental de Paris e de França, construído por Gustave Eiffel em 1889.",
      category: PlaceCategory.MONUMENT,
      address: "Champ de Mars, 5 Avenue Anatole France, 75007 Paris",
      latitude: 48.8584,
      longitude: 2.2945,
      openingHours: "Mo-Su 09:30-22:45",
      priceLevel: "€€€",
      cityId: paris.id,
      rating: 5.0,
      comment:
        "Espetacular ao anoitecer quando as luzes cintilam de hora a hora.",
    },
    {
      osmId: "node/45299497",
      name: "Musée du Louvre",
      description:
        "O maior museu de arte do planeta e antigo palácio dos reis de França.",
      category: PlaceCategory.MUSEUM,
      address: "Rue de Rivoli, 75001 Paris",
      latitude: 48.8606,
      longitude: 2.3376,
      openingHours: "Mo, We, Th, Sa, Su 09:00-18:00, Fr 09:00-21:45",
      priceLevel: "€€",
      cityId: paris.id,
      rating: 5.0,
      comment:
        "A Mona Lisa, a Vénus de Milo e as galerias do palácio são incomparáveis.",
    },
    {
      osmId: "node/45299498",
      name: "Cathédrale Notre-Dame de Paris",
      description:
        "Catedral gótica medieval na Île de la Cité, obra-prima da arquitetura francesa.",
      category: PlaceCategory.MONUMENT,
      address: "6 Parvis Notre-Dame - Pl. Jean-Paul II, 75004 Paris",
      latitude: 48.853,
      longitude: 2.3499,
      openingHours: "Mo-Su 08:00-18:45",
      priceLevel: "FREE",
      cityId: paris.id,
      rating: 5.0,
      comment:
        "A fachada e os rosetões góticos continuam a impressionar séculos depois.",
    },
    {
      osmId: "node/45299500",
      name: "Jardin du Luxembourg",
      description:
        "Jardim público parisiense de 25 hectares criado em 1612 por Maria de Médici.",
      category: PlaceCategory.PARK,
      address: "Rue de Médicis - Rue de Vaugirard, 75006 Paris",
      latitude: 48.8462,
      longitude: 2.3372,
      openingHours: "Mo-Su 07:30-21:00",
      priceLevel: "FREE",
      cityId: paris.id,
      rating: 5.0,
      comment:
        "Local perfeito para descansar nas cadeiras verdes ao lado da Fonte Médici.",
    },
    // Rome
    {
      osmId: "node/55299496",
      name: "Colosseo",
      description:
        "O maior anfiteatro do Império Romano construído no século I d.C.",
      category: PlaceCategory.MONUMENT,
      address: "Piazza del Colosseo 1, 00184 Roma",
      latitude: 41.8902,
      longitude: 12.4922,
      openingHours: "Mo-Su 08:30-19:00",
      priceLevel: "€€",
      cityId: roma.id,
      rating: 5.0,
      comment:
        "A grandeza e o estado de conservação deixam qualquer um sem palavras.",
    },
    {
      osmId: "node/55299497",
      name: "Fontana di Trevi",
      description:
        "A mais célebre fonte barroca de Roma, imortalizada no cinema de Fellini.",
      category: PlaceCategory.MONUMENT,
      address: "Piazza di Trevi, 00187 Roma",
      latitude: 41.9009,
      longitude: 12.4833,
      openingHours: "Mo-Su 24h",
      priceLevel: "FREE",
      cityId: roma.id,
      rating: 5.0,
      comment:
        "Atirar uma moeda de costas para garantir o regresso à Cidade Eterna.",
    },
    {
      osmId: "node/55299498",
      name: "Pantheon",
      description:
        "Antigo templo romano consagrado com a maior cúpula de betão não armado do mundo.",
      category: PlaceCategory.MONUMENT,
      address: "Piazza della Rotonda, 00186 Roma",
      latitude: 41.8986,
      longitude: 12.4769,
      openingHours: "Mo-Su 09:00-19:00",
      priceLevel: "€",
      cityId: roma.id,
      rating: 5.0,
      comment: "O óculo no topo da cúpula com a luz natural a entrar é mágico.",
    },
    {
      osmId: "node/55299500",
      name: "Villa Borghese",
      description:
        "Vasto parque paisagístico romano com lagos, jardins e a Galleria Borghese.",
      category: PlaceCategory.PARK,
      address: "Piazzale Napoleone I, 00197 Roma",
      latitude: 41.913,
      longitude: 12.4922,
      openingHours: "Mo-Su 24h",
      priceLevel: "FREE",
      cityId: roma.id,
      rating: 5.0,
      comment:
        "Vista soberba sobre a Piazza del Popolo a partir do terraço do Pincio.",
    },
    // Berlin
    {
      osmId: "node/65299496",
      name: "Portão de Brandemburgo",
      description:
        "Monumento neoclássico do século XVIII e símbolo histórico da reunificação alemã.",
      category: PlaceCategory.MONUMENT,
      address: "Pariser Platz, 10117 Berlin",
      latitude: 52.5163,
      longitude: 13.3777,
      openingHours: "Mo-Su 24h",
      priceLevel: "FREE",
      cityId: berlim.id,
      rating: 5.0,
      comment: "A iluminação noturna com a quadriga no topo é memorável.",
    },
    {
      osmId: "node/65299497",
      name: "Edifício do Reichstag",
      description:
        "Sede do parlamento alemão Bundestag com cúpula de vidro panorâmica projetada por Norman Foster.",
      category: PlaceCategory.MONUMENT,
      address: "Platz der Republik 1, 11011 Berlin",
      latitude: 52.5186,
      longitude: 13.3762,
      openingHours: "Mo-Su 08:00-24:00",
      priceLevel: "FREE",
      cityId: berlim.id,
      rating: 5.0,
      comment:
        "A subida pela rampa espiral da cúpula de vidro oferece vistas incríveis sobre Berlim.",
    },
    {
      osmId: "node/65299498",
      name: "Ilha dos Museus",
      description:
        "Complexo com 5 museus de craveira mundial no rio Spree, Património da UNESCO.",
      category: PlaceCategory.MUSEUM,
      address: "Bodestraße 1-3, 10178 Berlin",
      latitude: 52.5169,
      longitude: 13.401,
      openingHours: "Tu-Su 10:00-18:00",
      priceLevel: "€€",
      cityId: berlim.id,
      rating: 5.0,
      comment:
        "O busto de Nefertiti no Neues Museum e o Altar de Pérgamo são imperdíveis.",
    },
    {
      osmId: "node/65299499",
      name: "Memorial do Muro de Berlim",
      description:
        "Local comemorativo histórico com a última secção preservada do Muro de Berlim e torre de vigia.",
      category: PlaceCategory.MONUMENT,
      address: "Bernauer Str. 111, 13355 Berlin",
      latitude: 52.5351,
      longitude: 13.3899,
      openingHours: "Tu-Su 10:00-18:00",
      priceLevel: "FREE",
      cityId: berlim.id,
      rating: 5.0,
      comment:
        "Uma experiência comovente que ensina em detalhe a história da Guerra Fria.",
    },
    // London
    {
      osmId: "node/75299496",
      name: "Big Ben & Palácio de Westminster",
      description:
        "A célebre torre do relógio Elizabeth Tower e sede histórica do parlamento britânico.",
      category: PlaceCategory.MONUMENT,
      address: "London SW1A 0AA, United Kingdom",
      latitude: 51.5007,
      longitude: -0.1246,
      openingHours: "Mo-Su 24h",
      priceLevel: "FREE",
      cityId: londres.id,
      rating: 5.0,
      comment:
        "A vista a partir da Westminster Bridge ao entardecer é o postal perfeito de Londres.",
    },
    {
      osmId: "node/75299497",
      name: "Tower Bridge",
      description:
        "Ponte basculante e suspensa vitoriana sobre o rio Tamisa inaugurada em 1894.",
      category: PlaceCategory.MONUMENT,
      address: "Tower Bridge Rd, London SE1 2UP",
      latitude: 51.5055,
      longitude: -0.0754,
      openingHours: "Mo-Su 09:30-18:00",
      priceLevel: "€",
      cityId: londres.id,
      rating: 5.0,
      comment:
        "O chão de vidro na passarela superior proporciona uma perspetiva vertiginosa do trânsito.",
    },
    {
      osmId: "node/75299498",
      name: "British Museum",
      description:
        "Museu público de história, arte e cultura humana com mais de 8 milhões de obras.",
      category: PlaceCategory.MUSEUM,
      address: "Great Russell St, London WC1B 3DG",
      latitude: 51.5194,
      longitude: -0.127,
      openingHours: "Mo-Su 10:00-17:00",
      priceLevel: "FREE",
      cityId: londres.id,
      rating: 5.0,
      comment:
        "A Pedra de Roseta e o teto envidraçado do Great Court de Norman Foster são espetaculares.",
    },
    {
      osmId: "node/75299499",
      name: "Hyde Park",
      description:
        "Um dos quatro Parques Reais de Londres com 142 hectares, o lago Serpentine e Speakers' Corner.",
      category: PlaceCategory.PARK,
      address: "Hyde Park, London W2 2UH",
      latitude: 51.5073,
      longitude: -0.1657,
      openingHours: "Mo-Su 05:00-24:00",
      priceLevel: "FREE",
      cityId: londres.id,
      rating: 5.0,
      comment:
        "Passeio excelente para alugar uma espreguiçadeira perto do lago e relaxar.",
    },
  ];

  for (const ep of europeanPlaces) {
    const created = await prisma.place.upsert({
      where: { osmId: ep.osmId },
      update: {
        name: ep.name,
        description: ep.description,
        category: ep.category,
        address: ep.address,
        latitude: ep.latitude,
        longitude: ep.longitude,
        openingHours: ep.openingHours,
        priceLevel: ep.priceLevel,
        cityId: ep.cityId,
      },
      create: {
        osmId: ep.osmId,
        name: ep.name,
        description: ep.description,
        category: ep.category,
        address: ep.address,
        latitude: ep.latitude,
        longitude: ep.longitude,
        openingHours: ep.openingHours,
        priceLevel: ep.priceLevel,
        cityId: ep.cityId,
        averageRating: ep.rating,
        reviewCount: 1,
        source: "IMPORTED",
      },
    });

    await replaceDemoReviews(created.id, demoUserIds, [
      {
        userId: demoUser.id,
        rating: Math.round(ep.rating),
        priceLevel: ep.priceLevel,
        text: ep.comment,
      },
    ]);
  }

  console.log(
    `${europeanPlaces.length} European flagship places imported for Lisboa, Madrid, Paris, Roma, Berlim, Londres!`
  );

  // 4. Insert Flagship Porto Places with Multiple Dummy Reviews
  const portoFlagships = [
    {
      osmId: "porto/serralves",
      name: "Parque e Museu de Serralves",
      description:
        "Parque contemporâneo deslumbrante com Treetop Walk e museu de arte moderna.",
      category: PlaceCategory.MUSEUM,
      address: "Rua Dom João de Castro 210, 4150-417 Porto",
      latitude: 41.1597,
      longitude: -8.6596,
      openingHours: "Mo-Su 10:00-19:00",
      priceLevel: "€€",
      cityId: porto.id,
      reviews: [
        {
          rating: 5,
          price: "€€",
          text: "O parque é maravilhoso e o Treetop Walk oferece uma perspetiva única sobre a copa das árvores.",
        },
        {
          rating: 5,
          price: "€€",
          text: "Arquitetura e natureza em perfeita harmonia. Exposições sempre imperdíveis.",
        },
        {
          rating: 5,
          price: "€€",
          text: "Excelente espaço para passear ao ar livre no Porto. Jardins impecavelmente cuidados.",
        },
        {
          rating: 5,
          price: "€€",
          text: "A Casa de Serralves em Art Déco é fabulosa. Vale cada minuto da visita!",
        },
        {
          rating: 5,
          price: "€€",
          text: "Espaço tranquilo para fugir à azáfama da cidade. Muito bem sinalizado.",
        },
        {
          rating: 5,
          price: "€€",
          text: "Um dos melhores museus de arte contemporânea da Europa, recomendo a todos.",
        },
        {
          rating: 5,
          price: "€€",
          text: "As esculturas espalhadas pela floresta criam uma atmosfera mágica.",
        },
        {
          rating: 5,
          price: "€€",
          text: "Excelente café e esplanada com vista relaxante para o lago.",
        },
      ],
    },
    {
      osmId: "porto/cafe-santiago",
      name: "Café Santiago",
      description:
        "A melhor e mais icónica francesinha tradicional da cidade do Porto.",
      category: PlaceCategory.RESTAURANT,
      address: "Rua de Passos Manuel 226, 4000-382 Porto",
      latitude: 41.1466,
      longitude: -8.6047,
      openingHours: "Mo-Sa 12:00-23:00",
      priceLevel: "€",
      cityId: porto.id,
      reviews: [
        {
          rating: 5,
          price: "€",
          text: "A melhor francesinha do Porto! Molho com picante no ponto e batatas caseiras.",
        },
        {
          rating: 5,
          price: "€",
          text: "Atendimento tradicional, rápido e a francesinha Santiago da praxe nunca desilude.",
        },
        {
          rating: 5,
          price: "€",
          text: "Recomendo vivamente a Santiago com ovo e batata. Cerveja bem tirada!",
        },
        {
          rating: 5,
          price: "€",
          text: "Serviço ao balcão muito rápido e funcionários muito simpáticos.",
        },
        {
          rating: 5,
          price: "€",
          text: "O queijo derretido e a qualidade dos enchidos fazem toda a diferença.",
        },
        {
          rating: 4,
          price: "€",
          text: "Costuma ter fila à porta, mas o serviço é eficiente e a qualidade é excelente.",
        },
        {
          rating: 5,
          price: "€",
          text: "A paragem obrigatória para quem visita o Porto pela primeira vez.",
        },
        {
          rating: 5,
          price: "€",
          text: "Preço justo para uma dose generosa e cheia de sabor autêntico.",
        },
        {
          rating: 4,
          price: "€",
          text: "Excelente refeição rápida e saborosa no centro da cidade.",
        },
      ],
    },
    {
      osmId: "porto/ponte-dom-luis",
      name: "Ponte Dom Luís I",
      description:
        "Ícone arquitetónico metálico desenhado por Théophile Seyrig, discípulo de Gustave Eiffel.",
      category: PlaceCategory.MONUMENT,
      address: "Ponte Luís I, 4000 Porto",
      latitude: 41.14,
      longitude: -8.6096,
      openingHours: "24/7",
      priceLevel: "FREE",
      cityId: porto.id,
      reviews: [
        {
          rating: 5,
          price: "FREE",
          text: "Atravessar o tabuleiro superior ao entardecer é a melhor experiência do Porto.",
        },
        {
          rating: 5,
          price: "FREE",
          text: "Vista deslumbrante sobre a Ribeira e as caves de Gaia.",
        },
        {
          rating: 5,
          price: "FREE",
          text: "Monumento histórico imponente e imperdível em qualquer visita à cidade.",
        },
        {
          rating: 5,
          price: "FREE",
          text: "Fotografias espetaculares tanto de dia como iluminada à noite.",
        },
        {
          rating: 5,
          price: "FREE",
          text: "O símbolo máximo da cidade Invicta. Passeio pedonal obrigatório.",
        },
        {
          rating: 5,
          price: "FREE",
          text: "Ver o metro a passar no tabuleiro superior é uma imagem icónica.",
        },
        {
          rating: 4,
          price: "FREE",
          text: "Pode estar cheia de turistas nos dias de sol, mas a vista compensa tudo.",
        },
        {
          rating: 5,
          price: "FREE",
          text: "Sensação incrível de atravessar o rio Douro a pé nas alturas.",
        },
        {
          rating: 4,
          price: "FREE",
          text: "Muito vento em dias frios, mas a perspetiva panorâmica é única.",
        },
      ],
    },
    {
      osmId: "porto/sao-bento",
      name: "Estação de São Bento",
      description:
        "Estação ferroviária com átrio monumental revestido por 20.000 azulejos históricos.",
      category: PlaceCategory.MONUMENT,
      address: "Praça de Almeida Garrett, 4000-069 Porto",
      latitude: 41.1455,
      longitude: -8.6103,
      openingHours: "05:00-01:00",
      priceLevel: "FREE",
      cityId: porto.id,
      reviews: [
        {
          rating: 5,
          price: "FREE",
          text: "Os painéis de azulejos de Jorge Colaço contam a história de Portugal de forma genial.",
        },
        {
          rating: 5,
          price: "FREE",
          text: "Uma das estações mais bonitas do mundo. Entrada gratuita e localização central.",
        },
        {
          rating: 5,
          price: "FREE",
          text: "A luz natural que entra pelas janelas sobre os azulejos azuis é fascinante.",
        },
        {
          rating: 4,
          price: "FREE",
          text: "Sempre movimentada, excelente ponto de partida para explorar o centro histórico.",
        },
        {
          rating: 5,
          price: "FREE",
          text: "Paragem rápida mas que deixa qualquer viajante impressionado.",
        },
        {
          rating: 4,
          price: "FREE",
          text: "Perto da Avenida dos Aliados e da Rua das Flores.",
        },
        {
          rating: 5,
          price: "FREE",
          text: "Património arquitetónico fabuloso e preservado com muito brio.",
        },
      ],
    },
    {
      osmId: "porto/mercado-bolhao",
      name: "Mercado do Bolhão",
      description:
        "Mercado centenário emblemático do Porto, renovado com produtos frescos e bancas tradicionais.",
      category: PlaceCategory.RESTAURANT,
      address: "Rua Formosa 322, 4000-214 Porto",
      latitude: 41.1486,
      longitude: -8.6067,
      openingHours: "Mo-Sa 08:00-20:00",
      priceLevel: "€€",
      cityId: porto.id,
      reviews: [
        {
          rating: 5,
          price: "€€",
          text: "A renovação manteve a alma das vendedeiras do Bolhão e trouxe modernidade fantástica.",
        },
        {
          rating: 5,
          price: "€€",
          text: "Excelente para petiscar presunto, queijos e vinho da região.",
        },
        {
          rating: 5,
          price: "€€",
          text: "Bancas limpas, organizadas e com produtos agrícolas de primeira qualidade.",
        },
        {
          rating: 4,
          price: "€€",
          text: "Ambiente muito vibrante no coração da cidade com gastronomia autêntica.",
        },
        {
          rating: 5,
          price: "€€",
          text: "Os restaurantes no piso superior oferecem refeições deliciosas a preços justos.",
        },
        {
          rating: 4,
          price: "€€",
          text: "Muito concorrido aos sábados de manhã, ótimo para sentir a vida do Porto.",
        },
      ],
    },
    {
      osmId: "porto/livraria-lello",
      name: "Livraria Lello",
      description:
        "Uma das livrarias mais famosas e ornamentadas do mundo, ícone neo-gótico portuense.",
      category: PlaceCategory.MONUMENT,
      address: "Rua das Carmelitas 144, 4050-161 Porto",
      latitude: 41.1468,
      longitude: -8.6148,
      openingHours: "Mo-Su 09:30-19:00",
      priceLevel: "€€",
      cityId: porto.id,
      reviews: [
        {
          rating: 5,
          price: "€€",
          text: "A escadaria carmesim e o vitral do teto são de tirar a respiração.",
        },
        {
          rating: 4,
          price: "€€",
          text: "Espetacular, embora com muitos turistas. O voucher desconta na compra de livros.",
        },
        {
          rating: 4,
          price: "€€",
          text: "Recomendo marcar horário pela manhã para evitar o pico de visitantes.",
        },
        {
          rating: 4,
          price: "€€",
          text: "Vale a visita pela arquitetura única no mundo.",
        },
        {
          rating: 5,
          price: "€€",
          text: "Edição de clássicos da literatura com capas deslumbrantes.",
        },
        {
          rating: 4,
          price: "€€",
          text: "Um pedaço vivo da história literária de Portugal.",
        },
        {
          rating: 4,
          price: "€€",
          text: "Experiência marcante para qualquer amante de livros e arte.",
        },
      ],
    },
    {
      osmId: "porto/torre-clerigos",
      name: "Torre dos Clérigos",
      description:
        "Torre barroca de Nicolau Nasoni com 75 metros de altura e vista panorâmica de 360 graus.",
      category: PlaceCategory.MONUMENT,
      address: "Rua de São Filipe de Nery, 4050-546 Porto",
      latitude: 41.1458,
      longitude: -8.6143,
      openingHours: "Mo-Su 09:00-19:00",
      priceLevel: "€",
      cityId: porto.id,
      reviews: [
        {
          rating: 4,
          price: "€",
          text: "Subida exigente de 240 degraus, mas a panorâmica sobre a Foz e o Douro compensa.",
        },
        {
          rating: 4,
          price: "€",
          text: "Marco inconfundível na linha do horizonte da cidade.",
        },
        {
          rating: 4,
          price: "€",
          text: "Museu interessante na base da igreja. Recomendo comprar bilhete online.",
        },
        {
          rating: 4,
          price: "€",
          text: "Campanário histórico com um carrilhão fabuloso.",
        },
        {
          rating: 4,
          price: "€",
          text: "A melhor vista aérea do centro da cidade.",
        },
        {
          rating: 4,
          price: "€",
          text: "Visita guiada informativa sobre o barroco portuense.",
        },
      ],
    },
    {
      osmId: "porto/cafe-majestic",
      name: "Café Majestic",
      description:
        "Café histórico Belle Époque na Rua Santa Catarina com espelhos flamengos e tertúlias históricas.",
      category: PlaceCategory.CAFE,
      address: "Rua Santa Catarina 112, 4000-442 Porto",
      latitude: 41.1472,
      longitude: -8.6066,
      openingHours: "Mo-Sa 09:00-23:00",
      priceLevel: "€€€",
      cityId: porto.id,
      reviews: [
        {
          rating: 4,
          price: "€€€",
          text: "Ambiente histórico fascinante dos anos 20 com música de piano ao vivo.",
        },
        {
          rating: 4,
          price: "€€€",
          text: "Café e rabanada tradicional de excelente sabor num cenário clássico.",
        },
        {
          rating: 3,
          price: "€€€",
          text: "Preços elevados e fila comum, mas é uma paragem clássica na cidade.",
        },
        {
          rating: 4,
          price: "€€€",
          text: "Decoração Art Nouveau esplêndida, serviço clássico atencioso.",
        },
        {
          rating: 3,
          price: "€€€",
          text: "Vale mais pelo interior e fotografias do que pela refeição em si.",
        },
        {
          rating: 4,
          price: "€€€",
          text: "Experiência nostálgica no coração pedonal de Santa Catarina.",
        },
      ],
    },
    {
      osmId: "porto/jardim-morro",
      name: "Jardim do Morro",
      description:
        "O melhor miradouro para o pôr do sol no Grande Porto com vista panorâmica para a Ribeira.",
      category: PlaceCategory.PARK,
      address: "Avenida da República, 4430-148 Vila Nova de Gaia",
      latitude: 41.1369,
      longitude: -8.6095,
      openingHours: "24/7",
      priceLevel: "FREE",
      cityId: porto.id,
      reviews: [
        {
          rating: 5,
          price: "FREE",
          text: "O melhor pôr do sol do norte do país! Música ambiente e ambiente jovem.",
        },
        {
          rating: 5,
          price: "FREE",
          text: "A vista da Ribeira iluminada ao cair da noite é verdadeiramente mágica.",
        },
        {
          rating: 5,
          price: "FREE",
          text: "Fácil acesso pelo metro da Linha Amarela e espaço relvado convidativo.",
        },
        {
          rating: 4,
          price: "FREE",
          text: "Excelente spot para beber um copo e relaxar ao fim da tarde.",
        },
        {
          rating: 5,
          price: "FREE",
          text: "Ponto de encontro vibrante de locais e viajantes de todo o mundo.",
        },
        {
          rating: 4,
          price: "FREE",
          text: "Pode ficar com bastante gente ao pôr do sol, chegue 30 minutos antes.",
        },
      ],
    },
    {
      osmId: "porto/catraio-beer",
      name: "Catraio Craft Beer Shop",
      description:
        "Pioneiro da cerveja artesanal no Porto com esplanada no quintal e seleção internacional de topo.",
      category: PlaceCategory.BAR,
      address: "Rua de Cedofeita 256, 4050-174 Porto",
      latitude: 41.1517,
      longitude: -8.6174,
      openingHours: "Tu-Sa 16:00-02:00",
      priceLevel: "€€",
      cityId: porto.id,
      reviews: [
        {
          rating: 5,
          price: "€€",
          text: "A melhor seleção de cervejas artesanais portuguesas. O pátio interior é excelente.",
        },
        {
          rating: 5,
          price: "€€",
          text: "Staff conhecedor e torneiras com novidades todas as semanas.",
        },
        {
          rating: 5,
          price: "€€",
          text: "Ambiente descontraído na Rua de Cedofeita, ótimo para conversar com amigos.",
        },
        {
          rating: 5,
          price: "€€",
          text: "Petiscos saborosos e grande variedade de IPAs e Sours em garrafa e lata.",
        },
        {
          rating: 5,
          price: "€€",
          text: "Ponto de paragem imperdível para qualquer apreciador de craft beer.",
        },
      ],
    },
  ];

  for (const pf of portoFlagships) {
    const sum = pf.reviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = Number((sum / pf.reviews.length).toFixed(1));
    const count = pf.reviews.length;

    const place = await prisma.place.upsert({
      where: { osmId: pf.osmId },
      update: {
        name: pf.name,
        description: pf.description,
        category: pf.category,
        address: pf.address,
        latitude: pf.latitude,
        longitude: pf.longitude,
        openingHours: pf.openingHours,
        priceLevel: pf.priceLevel,
        cityId: pf.cityId,
      },
      create: {
        osmId: pf.osmId,
        name: pf.name,
        description: pf.description,
        category: pf.category,
        address: pf.address,
        latitude: pf.latitude,
        longitude: pf.longitude,
        openingHours: pf.openingHours,
        priceLevel: pf.priceLevel,
        cityId: pf.cityId,
        averageRating: avg,
        reviewCount: count,
        source: "IMPORTED",
      },
    });

    await replaceDemoReviews(
      place.id,
      demoUserIds,
      pf.reviews.map((r, i) => ({
        userId: i % 2 === 0 ? demoUser.id : demoUser2.id,
        rating: r.rating,
        priceLevel: r.price,
        text: r.text,
      }))
    );
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
