import { PrismaClient, Role } from '@prisma/client';

export const prisma = new PrismaClient();

export async function seedCatalog(): Promise<{
  adminCreated: boolean;
  categoriesCount: number;
  productsCount: number;
}> {
  console.log('🌱 Starting baseline catalog seeding...');
  const startTime = performance.now();

  // 1. Seed / Upsert Administrative User (Idempotent via email unique key)
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@ecommerce.local';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'AdminPass123!';
  const hashedPassword = await Bun.password.hash(adminPassword, {
    algorithm: 'bcrypt',
    cost: 10,
  });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'System Administrator',
      role: Role.ADMIN,
    },
    create: {
      email: adminEmail,
      passwordHash: hashedPassword,
      name: 'System Administrator',
      role: Role.ADMIN,
    },
  });
  console.log(`   ✓ Admin user upserted: ${admin.email}`);

  // 2. Seed / Upsert Product Taxonomy Categories (Idempotent via slug unique key)
  const categoriesData = [
    {
      name: 'Electronics & Gadgets',
      slug: 'electronics',
      description: 'Cutting-edge electronics, audio gear, and personal computing.',
      image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
    },
    {
      name: 'Apparel & Fashion',
      slug: 'apparel',
      description: 'Contemporary minimalist streetwear and performance apparel.',
      image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800',
    },
    {
      name: 'Home & Workspace',
      slug: 'home-workspace',
      description: 'Ergonomic workspace accessories, lighting, and minimal decor.',
      image: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800',
    },
    {
      name: 'Travel & EDC',
      slug: 'travel-edc',
      description: 'Durable travel essentials, modular bags, and everyday carry gear.',
      image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800',
    },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoriesData) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        image: cat.image,
      },
      create: cat,
    });
    categoryMap.set(cat.slug, category.id);
  }
  console.log(`   ✓ Seeded ${categoriesData.length} baseline categories`);

  // 3. Seed / Upsert Diverse Product Catalog (At least 8 items, varied stock & SKUs)
  const productsData = [
    {
      name: 'Titanium Wireless Headphones',
      slug: 'titanium-wireless-headphones',
      sku: 'AUDIO-TITAN-001',
      description:
        'Active noise-canceling wireless headphones with 40mm beryllium drivers and 36-hour battery life.',
      price: 299.99,
      stock: 45,
      categorySlug: 'electronics',
      images: [
        {
          url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
          altText: 'Titanium Wireless Headphones - Matte Black',
          isPrimary: true,
          sortOrder: 0,
        },
      ],
    },
    {
      name: 'Ergonomic Mechanical Keyboard',
      slug: 'ergonomic-mechanical-keyboard',
      sku: 'KEY-ERGO-002',
      description:
        'Hot-swappable custom mechanical keyboard with aluminum chassis and gasket-mounted dampeners.',
      price: 189.5,
      stock: 28,
      categorySlug: 'electronics',
      images: [
        {
          url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800',
          altText: 'Custom Mechanical Keyboard Profile',
          isPrimary: true,
          sortOrder: 0,
        },
      ],
    },
    {
      name: 'Waterproof Commuter Backpack',
      slug: 'waterproof-commuter-backpack',
      sku: 'BAG-COMMUTE-003',
      description:
        'Cordura weather-resistant 24L backpack with dedicated padded 16-inch laptop compartment.',
      price: 129.0,
      stock: 75,
      categorySlug: 'travel-edc',
      images: [
        {
          url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800',
          altText: 'Commuter Backpack Front Profile',
          isPrimary: true,
          sortOrder: 0,
        },
      ],
    },
    {
      name: 'Minimalist Merino Wool Tee',
      slug: 'minimalist-merino-wool-tee',
      sku: 'APP-MERINO-004',
      description:
        '100% ultrafine New Zealand merino wool t-shirt with odor resistance and moisture-wicking weave.',
      price: 68.0,
      stock: 120,
      categorySlug: 'apparel',
      images: [
        {
          url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800',
          altText: 'Merino Wool Tee in Slate Grey',
          isPrimary: true,
          sortOrder: 0,
        },
      ],
    },
    {
      name: 'Precision Desk Mat & Cable Organizer',
      slug: 'precision-desk-mat',
      sku: 'DESK-MAT-005',
      description:
        'Vegan leather desk pad with integrated magnetic cable routing and water-resistant surface.',
      price: 45.0,
      stock: 95,
      categorySlug: 'home-workspace',
      images: [
        {
          url: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800',
          altText: 'Minimal Workspace Desk Mat',
          isPrimary: true,
          sortOrder: 0,
        },
      ],
    },
    {
      name: 'Smart Ambient Desk Lamp',
      slug: 'smart-ambient-desk-lamp',
      sku: 'LIGHT-AMB-006',
      description:
        'Dimmable dual-source LED desk lamp with CRI 95+ color accuracy and wireless charging base.',
      price: 89.0,
      stock: 18,
      categorySlug: 'home-workspace',
      images: [
        {
          url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800',
          altText: 'Smart Ambient Desk Lamp Warm Glow',
          isPrimary: true,
          sortOrder: 0,
        },
      ],
    },
    {
      name: 'Anodized Aluminum Carry-On Suitcase',
      slug: 'anodized-aluminum-carry-on',
      sku: 'LUGG-ANOD-007',
      description:
        'Aerospace-grade aluminum hard-shell carry-on suitcase with dual TSA-approved combination locks.',
      price: 345.0,
      stock: 12,
      categorySlug: 'travel-edc',
      images: [
        {
          url: 'https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?w=800',
          altText: 'Anodized Aluminum Carry-On Luggage',
          isPrimary: true,
          sortOrder: 0,
        },
      ],
    },
    {
      name: 'Heavyweight Oversized Hoodie',
      slug: 'heavyweight-oversized-hoodie',
      sku: 'APP-HOODIE-008',
      description:
        '500 GSM French terry cotton pullover hoodie with double-needle stitching and drop shoulder cut.',
      price: 95.0,
      stock: 150,
      categorySlug: 'apparel',
      images: [
        {
          url: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800',
          altText: 'Heavyweight Oversized Hoodie in Washed Black',
          isPrimary: true,
          sortOrder: 0,
        },
      ],
    },
  ];

  let seededProductsCount = 0;
  for (const prod of productsData) {
    const categoryId = categoryMap.get(prod.categorySlug);
    if (!categoryId) continue;

    await prisma.product.upsert({
      where: { sku: prod.sku },
      update: {
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        price: prod.price,
        stock: prod.stock,
        categoryId,
        images: {
          deleteMany: {},
          create: prod.images,
        },
      },
      create: {
        name: prod.name,
        slug: prod.slug,
        sku: prod.sku,
        description: prod.description,
        price: prod.price,
        stock: prod.stock,
        categoryId,
        images: {
          create: prod.images,
        },
      },
    });
    seededProductsCount++;
  }
  console.log(`   ✓ Upserted ${seededProductsCount} baseline products with inventory & images`);

  const elapsed = (performance.now() - startTime).toFixed(1);
  console.log(`✨ Baseline catalog seeding completed in ${elapsed}ms\n`);

  return {
    adminCreated: true,
    categoriesCount: categoriesData.length,
    productsCount: productsData.length,
  };
}

export async function main() {
  return seedCatalog();
}

// Standalone execution entrypoint with required error handling & disconnection
if (import.meta.main) {
  main()
    .catch((e) => {
      console.error('❌ Database seeding failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
