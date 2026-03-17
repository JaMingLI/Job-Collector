import styles from './StatCard.module.scss';

interface StatCardProps {
  label: string;
  count: number;
  isActive?: boolean;
  onClick?: () => void;
}

export function StatCard({ label, count, isActive, onClick }: StatCardProps) {
  return (
    <button
      className={`${styles.card} ${isActive ? styles.active : ''}`}
      onClick={onClick}
      type="button"
    >
      <span className={styles.count}>{count}</span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
