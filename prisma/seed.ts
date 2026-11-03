import { PrismaClient, PlaceCategory } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { calculateAverageRating } from "../src/domain/reviews/rating";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

interface DemoUser {
  id: string;
  username: string;
  email: string;
}

/** The demo users (US-B2-01) live in prisma/data/demo-users.json: this is fake data, not app code. */
const DEMO_USERS: DemoUser[] = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "prisma/data/demo-users.json"),
    "utf-8"
  )
);

/** Documented in the README. Set DEMO_PASSWORD to use another one (for example on prod). */
const DEFAULT_DEMO_PASSWORD = "tripbook-demo";

function demoPassword() {
  const password = process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD;
  if (password.length < 8 || password.length > 128) {
    throw new Error("DEMO_PASSWORD must have 8 to 128 characters");
  }
  return password;
}

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
 *
 * Every review goes to a different demo user (nobody reviews a place twice, US-C1-01). A user who
 * already has another review on the place is skipped, and `offset` varies who writes first.
 */
async function replaceDemoReviews(
  placeId: string,
  demoUserIds: string[],
  reviews: { rating: number; priceLevel: string; text: string }[],
  offset: number
) {
  await prisma.review.deleteMany({
    where: {
      placeId,
      userId: { in: demoUserIds },
      text: { in: reviews.map((review) => review.text) },
    },
  });

  const taken = new Set(
    (
      await prisma.review.findMany({
        where: { placeId },
        select: { userId: true },
      })
    ).map((review) => review.userId)
  );
  const free = demoUserIds.filter((id) => !taken.has(id));
  if (reviews.length > free.length) {
    throw new Error(
      `A place needs ${reviews.length} reviewers but only ${free.length} demo users can still review it: add users to prisma/data/demo-users.json`
    );
  }
  const start = offset % free.length;
  const reviewers = [...free.slice(start), ...free.slice(0, start)];

  await prisma.review.createMany({
    data: reviews.map((review, i) => ({
      ...review,
      userId: reviewers[i],
      placeId,
    })),
  });
}

/**
 * Recomputes the stored rating and review count of every place that has reviews, from its
 * reviews and with the same function the app uses when a review is posted, so the ratings always
 * match the sample reviews (US-B2-01).
 */
async function recalculateRatings() {
  const places = await prisma.place.findMany({
    where: { reviews: { some: {} } },
    select: { id: true },
  });

  for (const { id } of places) {
    const reviews = await prisma.review.findMany({
      where: { placeId: id },
      select: { rating: true },
    });
    await prisma.place.update({
      where: { id },
      data: {
        averageRating: calculateAverageRating(reviews.map((r) => r.rating)),
        reviewCount: reviews.length,
      },
    });
  }
  return places.length;
}

interface RawPlace {
  osmId: string;
  name: string;
  description: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  openingHours: string | null;
  priceLevel: string | null;
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

  console.log(`Cities created: ${porto.name}, ${paris.name}, ${berlim.name}`);

  // 2. Create Demo Users, with a password they can log in with (US-B2-01)
  const password = demoPassword();
  const demoUserIds: string[] = [];
  for (const user of DEMO_USERS) {
    demoUserIds.push((await ensureDemoUser(user, password)).id);
  }

  console.log(
    `${DEMO_USERS.length} demo users created (they log in with the demo password)`
  );

  // 3. Import OpenStreetMap Places from JSON
  const jsonPath = path.join(process.cwd(), "prisma/data/porto-places.json");
  if (fs.existsSync(jsonPath)) {
    const rawData = fs.readFileSync(jsonPath, "utf-8");
    const placesData: RawPlace[] = JSON.parse(rawData);

    // The price level of a place with reviews comes from its reviews: the snapshot does not touch it
    const reviewed = new Set(
      (
        await prisma.place.findMany({
          where: {
            osmId: { in: placesData.map((p) => p.osmId) },
            reviews: { some: {} },
          },
          select: { osmId: true },
        })
      ).map((place) => place.osmId)
    );

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
          ...(reviewed.has(p.osmId) ? {} : { priceLevel: p.priceLevel }),
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

  // 3b. Import flagship landmarks of Paris and Berlin
  const europeanPlaces = [
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
  ];

  for (const [placeIndex, ep] of europeanPlaces.entries()) {
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

    await replaceDemoReviews(
      created.id,
      demoUserIds,
      [
        {
          rating: Math.round(ep.rating),
          priceLevel: ep.priceLevel,
          text: ep.comment,
        },
      ],
      placeIndex
    );
  }

  console.log(
    `${europeanPlaces.length} flagship places imported for Paris and Berlin!`
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

  for (const [placeIndex, pf] of portoFlagships.entries()) {
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
      pf.reviews.map((r) => ({
        rating: r.rating,
        priceLevel: r.price,
        text: r.text,
      })),
      placeIndex
    );
  }

  // 5. The stored ratings must match the reviews
  const rated = await recalculateRatings();
  console.log(`Ratings recalculated for ${rated} places with reviews.`);

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
