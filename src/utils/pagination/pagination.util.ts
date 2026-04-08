import {
  Repository,
  FindManyOptions,
  SelectQueryBuilder,
  ObjectLiteral,
} from 'typeorm';

export async function paginateAndFormat<T extends ObjectLiteral>(
  queryOrRepo: SelectQueryBuilder<T> | Repository<T>,
  options: {
    page: number;
    pageSize: number;
    useQueryBuilder?: boolean;
    queryBuilder?: SelectQueryBuilder<T>;
    findOptions?: FindManyOptions<T>;
  },
): Promise<{
  data: T[];
  total: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}> {
  const { page, pageSize, useQueryBuilder, queryBuilder, findOptions } =
    options;

  const skip = (page - 1) * pageSize;
  const take = pageSize;

  let data: T[], total: number;

  if (useQueryBuilder && queryBuilder) {
    [data, total] = await queryBuilder.skip(skip).take(take).getManyAndCount();
  } else {
    [data, total] = await (queryOrRepo as Repository<T>).findAndCount({
      skip,
      take,
      ...findOptions,
    });
  }

  return {
    data,
    total,
    currentPage: page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
