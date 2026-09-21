import { type PrismaClient } from '@prisma/client';
import { NotFoundError, AppError } from '../../common/errors/app-error';
import { productCache } from '../products/product.cache';
import type {
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from './category.model';

export class CategoryService {
  constructor(private readonly prisma: PrismaClient) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async listCategories() {
    const categories = await this.prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const formatted = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      image: cat.image,
      productCount: cat._count.products,
      createdAt: cat.createdAt.toISOString(),
      updatedAt: cat.updatedAt.toISOString(),
    }));

    return {
      categories: formatted,
      data: formatted,
      total: formatted.length,
    };
  }

  async getCategoryByIdOrSlug(idOrSlug: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idOrSlug
      );

    const category = await this.prisma.category.findFirst({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundError(`Category with identifier "${idOrSlug}" not found`);
    }

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image,
      productCount: category._count.products,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  async createCategory(payload: CreateCategoryPayload) {
    const slug = payload.slug || this.slugify(payload.name);

    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [{ slug }, { name: payload.name }],
      },
    });

    if (existing) {
      throw new AppError(
        `Category with name "${payload.name}" or slug "${slug}" already exists`,
        409,
        'CATEGORY_EXISTS'
      );
    }

    const category = await this.prisma.category.create({
      data: {
        name: payload.name,
        slug,
        description: payload.description,
        image: payload.image,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    productCache.invalidateCatalog();

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image,
      productCount: category._count.products,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  async updateCategory(id: string, payload: UpdateCategoryPayload) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError(`Category with ID "${id}" not found`);
    }

    const slug = payload.slug ? this.slugify(payload.slug) : undefined;

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: payload.name,
        slug,
        description: payload.description,
        image: payload.image,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    productCache.invalidateCatalog();

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      image: updated.image,
      productCount: updated._count.products,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteCategory(id: string) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError(`Category with ID "${id}" not found`);
    }

    if (existing._count.products > 0) {
      throw new AppError(
        `Cannot delete category "${existing.name}" because it contains ${existing._count.products} associated product(s). Reassign or delete products first.`,
        400,
        'CATEGORY_NOT_EMPTY'
      );
    }

    await this.prisma.category.delete({
      where: { id },
    });

    productCache.invalidateCatalog();

    return {
      success: true,
      id,
      message: 'Category deleted permanently',
    };
  }
}
