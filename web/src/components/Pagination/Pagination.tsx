import { ChevronLeft, ChevronRight } from '@/lib/lucide-react';
import styles from './Pagination.module.scss';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  showingLabel: string;
  perPageLabel: string;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  showingLabel,
  perPageLabel,
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className={styles.wrapper}>
      <div className={styles.left}>
        <span className={styles.info}>{showingLabel}</span>
        <select
          className={styles.pageSizeSelect}
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label={perPageLabel}
        >
          {[10, 20, 50].map((size) => (
            <option key={size} value={size}>
              {size} / {perPageLabel}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.right}>
        <button
          className={styles.navBtn}
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map((page) => (
          <button
            key={page}
            className={`${styles.pageBtn} ${page === currentPage ? styles.activePage : ''}`}
            onClick={() => onPageChange(page)}
            type="button"
          >
            {page}
          </button>
        ))}
        <button
          className={styles.navBtn}
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
