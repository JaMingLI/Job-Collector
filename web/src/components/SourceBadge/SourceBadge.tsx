import type { JobSource } from '@/domain';
import styles from './SourceBadge.module.scss';

interface SourceBadgeProps {
  source: JobSource;
}

const SOURCE_LABELS: Record<JobSource, string> = {
  linkedin: 'LinkedIn',
  '104': '104',
  yourator: 'Yourator',
  cakeresume: 'CakeResume',
  other: 'Other',
};

export function SourceBadge({ source }: SourceBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[source === '104' ? 'source104' : source]}`}>
      {SOURCE_LABELS[source]}
    </span>
  );
}
