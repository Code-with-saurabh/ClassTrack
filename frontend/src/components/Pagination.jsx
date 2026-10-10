import { useMemo } from 'react';

// Page numbers ki list banao — beech me "..." dikhata hai zyada pages par
const buildPageItems = (totalPages, currentPage) => {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items = [];
  const left = Math.max(1, currentPage - 2);
  const right = Math.min(totalPages, currentPage + 2);

  for (let i = 1; i < left; i += 1) items.push(i);
  if (left > 2) items[items.length - 1] = '...';
  for (let i = left; i <= right; i += 1) items.push(i);
  if (right < totalPages - 1) items[items.length - 1] = '...';
  for (let i = right + 1; i <= totalPages; i += 1) items.push(i);

  return items;
};

const Pagination = ({ current = 1, total = 0, perPage = 8, onPageChange, className = '' }) => {
  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / (Number(perPage) || 8)));
  const safeCurrent = Math.min(Math.max(1, Number(current) || 1), totalPages);

  const items = useMemo(() => buildPageItems(totalPages, safeCurrent), [totalPages, safeCurrent]);

  const goTo = (page) => {
    const target = Number(page);
    const canChange = typeof onPageChange === 'function';
    const isValid = !Number.isNaN(target) && target >= 1 && target <= totalPages;

    if (canChange && isValid && target !== safeCurrent) {
      onPageChange(target);
    }
  };

  if (totalPages <= 1) return null;

  return (
    <nav className={`pagination ${className}`.trim()} aria-label="Pagination">
      <button
        type="button"
        className="page-btn"
        disabled={safeCurrent === 1}
        onClick={() => goTo(safeCurrent - 1)}
        aria-label="Previous page"
      >
        &laquo;
      </button>

      {items.map((item, index) =>
        item === '...' ? (
          <span key={`ellipsis-${index}`} className="page-ellipsis">
            &hellip;
          </span>
        ) : (
          <button
            key={`page-${item}-${index}`}
            type="button"
            className={`page-btn ${item === safeCurrent ? 'active' : ''}`}
            onClick={() => goTo(item)}
            aria-current={item === safeCurrent ? 'page' : undefined}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        className="page-btn"
        disabled={safeCurrent === totalPages}
        onClick={() => goTo(safeCurrent + 1)}
        aria-label="Next page"
      >
        &raquo;
      </button>
    </nav>
  );
};

export default Pagination;
