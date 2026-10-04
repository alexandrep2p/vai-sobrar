import type { Category, CategoryType } from '@prisma/client';
import type { AppContext } from '../../shared/context.js';
import type { Db } from '../../shared/db.js';
import { BusinessError } from '../../shared/errors.js';
import { isUniqueViolation } from '../../shared/prisma-errors.js';
import { generateDueOccurrences } from '../recurrences/occurrences.js';

export interface CategoryDto {
  id: string;
  name: string;
  type: CategoryType;
  active: boolean;
  in_use: boolean;
  created_at: string;
  updated_at: string;
}

const toDto = (category: Category, inUse: boolean): CategoryDto => ({
  id: category.id,
  name: category.name,
  type: category.type,
  active: category.active,
  in_use: inUse,
  created_at: category.createdAt.toISOString(),
  updated_at: category.updatedAt.toISOString(),
});

/** categories.md §4.1: uso = lançamentos (qualquer origem) ou recorrências. */
export const isCategoryInUse = async (db: Db, categoryId: string): Promise<boolean> => {
  const [transactions, recurrences] = await Promise.all([
    db.transaction.count({ where: { categoryId }, take: 1 }),
    db.recurrence.count({ where: { categoryId }, take: 1 }),
  ]);
  return transactions + recurrences > 0;
};

export const findCategoryOrThrow = async (db: Db, id: string): Promise<Category> => {
  const category = await db.category.findUnique({ where: { id } });
  if (!category) throw new BusinessError('CATEGORY_NOT_FOUND', 'Categoria não encontrada.');
  return category;
};

const assertNameAvailable = async (db: Db, name: string, ignoreId?: string): Promise<void> => {
  const clash = await db.category.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    select: { id: true },
  });
  if (clash)
    throw new BusinessError('CATEGORY_NAME_TAKEN', 'Já existe uma categoria com esse nome.');
};

export const listCategories = async ({ prisma }: AppContext): Promise<CategoryDto[]> => {
  const [categories, inTransactions, inRecurrences] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
    prisma.transaction.groupBy({ by: ['categoryId'] }),
    prisma.recurrence.groupBy({ by: ['categoryId'] }),
  ]);
  const used = new Set([...inTransactions, ...inRecurrences].map((row) => row.categoryId));
  return categories.map((c) => toDto(c, used.has(c.id)));
};

export const createCategory = async (
  { prisma }: AppContext,
  input: { name: string; type: CategoryType },
): Promise<CategoryDto> => {
  await assertNameAvailable(prisma, input.name);
  try {
    const category = await prisma.category.create({
      data: { name: input.name, type: input.type, active: true },
    });
    return toDto(category, false);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new BusinessError('CATEGORY_NAME_TAKEN', 'Já existe uma categoria com esse nome.');
    }
    throw error;
  }
};

export const updateCategory = async (
  { prisma }: AppContext,
  id: string,
  input: { name?: string | undefined; type?: CategoryType | undefined },
): Promise<CategoryDto> => {
  const current = await findCategoryOrThrow(prisma, id);
  const inUse = await isCategoryInUse(prisma, id);

  if (input.type !== undefined && input.type !== current.type && inUse) {
    throw new BusinessError(
      'CATEGORY_TYPE_LOCKED',
      'O tipo não pode ser alterado: a categoria já está em uso.',
    );
  }
  if (input.name !== undefined) await assertNameAvailable(prisma, input.name, id);

  try {
    const updated = await prisma.category.update({
      where: { id },
      data: { name: input.name, type: input.type },
    });
    return toDto(updated, inUse);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new BusinessError('CATEGORY_NAME_TAKEN', 'Já existe uma categoria com esse nome.');
    }
    throw error;
  }
};

export const setCategoryActive = async (
  ctx: AppContext,
  id: string,
  active: boolean,
): Promise<CategoryDto> => {
  const { prisma } = ctx;
  await findCategoryOrThrow(prisma, id);
  const updated = await prisma.category.update({ where: { id }, data: { active } });
  if (active) await generateDueOccurrences(ctx, { fromToday: true });
  return toDto(updated, await isCategoryInUse(prisma, id));
};
