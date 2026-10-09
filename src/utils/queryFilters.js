export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function searchClause(search, fields) {
  if (!search) {
    return null;
  }
  const pattern = escapeRegex(search.trim());
  if (!pattern) {
    return null;
  }
  return {
    $or: fields.map((field) => ({ [field]: { $regex: pattern, $options: 'i' } })),
  };
}

export function createdAtRange(from, to) {
  if (!from && !to) {
    return null;
  }
  const range = {};
  if (from) {
    range.$gte = new Date(from);
  }
  if (to) {
    range.$lte = new Date(to);
  }
  return range;
}

export function combineFilters(...parts) {
  const filters = parts.filter(Boolean);
  if (filters.length === 0) {
    return {};
  }
  if (filters.length === 1) {
    return filters[0];
  }
  return { $and: filters };
}
