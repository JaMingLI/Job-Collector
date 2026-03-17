import styles from './SkillTag.module.scss';

interface SkillTagProps {
  label: string;
}

export function SkillTag({ label }: SkillTagProps) {
  return <span className={styles.tag}>{label}</span>;
}
