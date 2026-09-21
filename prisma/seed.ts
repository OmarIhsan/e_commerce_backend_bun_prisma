import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedCatalog(): Promise<{
  adminCreated: boolean;
  categoriesCount: number;
  productsCount: number;
}> {
  console.log('🌱 Starting baseline catalog seeding...');
  const startTime = performance.now();

  // 1. Seed Default Admin User
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@ecommerce.local';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'AdminPass123!';
  const hashedPassword = await Bun.password.hash(adminPassword, {
    algorithm: 'bcrypt',
    cost: 10,
  });

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  let adminCreated = false;
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashedPassword,
        name: 'System Administrator',
        role: Role.ADMIN,
      },
    });
    console.log(`   ✓ Admin user created: ${adminEmail}`);
    adminCreated = true;
  } else {
    console.log(`   ℹ Admin user already exists: ${adminEmail}`);
  }

  // 2. Seed Baseline Categories
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
      update: { name: cat.name, description: cat.description, image: cat.image },
      create: cat,
    });
    categoryMap.set(cat.slug, category.id);
  }
  console.log(`   ✓ Seeded ${categoriesData.length} baseline categories`);

  // 3. Seed Baseline Products
  const productsData = [
    {
      name: 'Titanium Wireless Headphones',
      slug: 'titanium-wireless-headphones',
      sku: 'AUDIO-TITAN-001',
      description: 'Active noise-canceling wireless headphones with 40mm beryllium drivers and 36-hour battery life.',
      price: 299.99,
      stock: 50,
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
      description: 'Hot-swappable custom mechanical keyboard with aluminum chassis and gasket-mounted dampeners.',
      price: 189.5,
      stock: 35,
      categorySlug: 'electronics',
      images: [
        {
          url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800',
          altText: 'Custom Mechanical Keyboard',
          isPrimary: true,
          sortOrder: 0,
        },
      ],
    },
    {
      name: 'Waterproof Commuter Backpack',
      slug: 'waterproof-commuter-backpack',
      sku: 'BAG-COMMUTE-003',
      description: 'Cordura weather-resistant 24L backpack with dedicated padded 16-inch laptop compartment.',
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
      description: '100% ultrafine New Zealand merino wool t-shirt with odor resistance and moisture-wicking weave.',
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
      description: 'Vegan leather desk pad with integrated magnetic cable routing and water-resistant surface.',
      price: 45.0,
      stock: 100,
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
  ];

  let seededProductsCount = 0;
  for (const prod of productsData) {
    const categoryId = categoryMap.get(prod.categorySlug);
    if (!categoryId) continue;

    const existingProduct = await prisma.product.findUnique({
      where: { sku: prod.sku },
      include: { images: true },
    });

    if (!existingProduct) {
      await prisma.product.create({
        data: {
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
  }
  console.log(`   ✓ Seeded ${seededProductsCount} new baseline products with inventory & images`);

  const elapsed = (performance.now() - startTime).toFixed(1);
  console.log(`✨ Baseline catalog seeding completed in ${elapsed}ms\n`);

  return {
    adminCreated,
    categoriesCount: categoriesData.length,
    productsCount: productsData.length,
  };
}

// Standalone execution entrypoint
if (import.meta.main) {
  seedCatalog()
    .catch((error) => {
      console.error('❌ Database seeding failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
