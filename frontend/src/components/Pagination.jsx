import { useMemo } from 'react';

const Pagination = ({ current = 1, total = 0, perPage = 8, onPageChange, className = '' }) => {
  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / (Number(perPage) || 8)));
  const safeCurrent = Math.min(Math.max(1, Number(current) || 1), totalPages);

  const items = useMemo(() => {
    if (totalPages <= 1) return [1];
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    const left = Math.max(1, safeCurrent - 2);
    const right = Math.min(totalPages, safeCurrent + 2);
    for (let i = 1; i < left; i += 1) pages.push(i);
    if (left > 2) pages[pages.length - 1] = '...';
    for (let i = left; i <= right; i += 1) pages.push(i);
    if (right < totalPages - 1) pages[pages.length - 1] = '...';
    for (let i = right + 1; i <= totalPages; i += 1) pages.push(i);
    return pages;
  }, [totalPages, safeCurrent]);

  const goTo = (page) => {
    const p = Number(page);
    if (
      typeof onPageChange === 'function' &&
      !Number.isNaN(p) &&
      p >= 1 &&
      p <= totalPages &&
      p !== safeCurrent
    ) {
      onPageChange(p);
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
      {items.map((item, idx) =>
        item === '...' ? (
          <span key={`e${idx}`} className="page-ellipsis">
            &hellip;
          </span>
        ) : (
          <button
            key={`p${item}-${idx}`}
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
