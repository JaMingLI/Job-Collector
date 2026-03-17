import type { JobLevel } from '@/domain';
import styles from './LevelBadge.module.scss';

interface LevelBadgeProps {
  level: JobLevel;
}

const LEVEL_LABELS: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
};

export function LevelBadge({ level }: LevelBadgeProps) {
  if (!level) {
    return <span className={styles.badge}>—</span>;
  }

  return (
    <span className={`${styles.badge} ${styles[level]}`}>
      {LEVEL_LABELS[level] ?? level}
    </span>
  );
}
