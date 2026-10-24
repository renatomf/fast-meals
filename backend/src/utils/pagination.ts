import type { Pagination } from "@fastmeals/contracts";

export type PageRequest = { page: number; limit: number };

export function pageOffset({ page, limit }: PageRequest): number {
  return (page - 1) * limit;
}

export function paginationMeta({ page, limit }: PageRequest, total: number): Pagination {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
