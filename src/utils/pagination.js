import { ApiError } from './ApiError.js';

export function buildSort(sortBy, sortOrder, allowlist, fallback = 'createdAt') {
  if (sortBy && !allowlist.includes(sortBy)) {
    throw new ApiError(400, 'Invalid sort field');
  }
  const field = sortBy || fallback;
  const direction = sortOrder === 'asc' ? 1 : -1;
  return { [field]: direction, _id: 1 };
}

export function paginationMeta(page, limit, totalRecords) {
  const totalPages = totalRecords === 0 ? 0 : Math.ceil(totalRecords / limit);
  return { page, limit, totalRecords, totalPages };
}

export function skipFor(page, limit) {
  return (page - 1) * limit;
}
