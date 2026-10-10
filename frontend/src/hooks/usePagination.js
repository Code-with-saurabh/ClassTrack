import { useState, useMemo, useEffect } from 'react';

// List ko pages me todta hai — search/filter chhota hone par page auto-reset
const usePagination = (items, perPage = 10) => {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return items.slice(start, start + perPage);
  }, [items, page, perPage]);

  return { page, setPage, total, totalPages, pageItems, perPage };
};

export default usePagination;
