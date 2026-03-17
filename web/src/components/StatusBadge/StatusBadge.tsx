import { Timer, Send, MessageSquare, CircleCheck, CircleX, Minus } from '@/lib/lucide-react';
import type { JobStatus } from '@/domain';
import styles from './StatusBadge.module.scss';

const STATUS_ICON_MAP: Record<JobStatus, typeof Timer> = {
  pending: Timer,
  applied: Send,
  interview: MessageSquare,
  accepted: CircleCheck,
  rejected: CircleX,
  unset: Minus,
};

interface StatusBadgeProps {
  status: JobStatus;
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const Icon = STATUS_ICON_MAP[status];

  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <Icon size={14} />
      {label}
    </span>
  );
}
