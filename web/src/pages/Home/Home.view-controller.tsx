import { Briefcase, Plus, Ellipsis, ExternalLink } from '@/lib/lucide-react';
import {
  StatCard,
  StatusBadge,
  LevelBadge,
  SourceBadge,
  SkillTag,
  SearchInput,
  FilterDropdown,
  Pagination,
} from '@/components';
import type { HomeViewModel } from './Home.view-model';
import styles from './Home.module.scss';

const LEVEL_OPTIONS = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: '待處理' },
  { value: 'applied', label: '已投遞' },
  { value: 'interview', label: '面試中' },
  { value: 'accepted', label: '已錄取' },
  { value: 'rejected', label: '已拒絕' },
];

const SOURCE_OPTIONS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: '104', label: '104' },
  { value: 'yourator', label: 'Yourator' },
  { value: 'cakeresume', label: 'CakeResume' },
  { value: 'other', label: 'Other' },
];

export function HomeViewController(props: HomeViewModel) {
  const {
    stats,
    jobs,
    searchQuery,
    onSearchChange,
    levelFilter,
    statusFilter,
    sourceFilter,
    onLevelFilterChange,
    onStatusFilterChange,
    onSourceFilterChange,
    onResetFilters,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    onPageChange,
    onPageSizeChange,
    selectedJobIds,
    onToggleJobSelection,
    onToggleAllJobs,
    t,
  } = props;

  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Briefcase size={24} className={styles.headerIcon} />
          <h1 className={styles.headerTitle}>{t('app.title')}</h1>
          <span className={styles.statusDot} />
          <span className={styles.statusText}>{t('dashboard.status.connected')}</span>
        </div>
        <button className={styles.addBtn} type="button">
          <Plus size={16} />
          {t('dashboard.addJob')}
        </button>
      </header>

      {/* Stats Bar */}
      <section className={styles.statsBar}>
        <StatCard
          label={t('dashboard.stats.all')}
          count={stats.total}
          isActive
        />
        <StatCard label={t('dashboard.stats.pending')} count={stats.pending} />
        <StatCard label={t('dashboard.stats.applied')} count={stats.applied} />
        <StatCard label={t('dashboard.stats.interview')} count={stats.interview} />
        <StatCard label={t('dashboard.stats.accepted')} count={stats.accepted} />
      </section>

      {/* Toolbar */}
      <section className={styles.toolbar}>
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder={t('dashboard.toolbar.searchPlaceholder')}
        />
        <div className={styles.filters}>
          <FilterDropdown
            label={t('dashboard.toolbar.levelFilter')}
            value={levelFilter}
            options={LEVEL_OPTIONS}
            onChange={onLevelFilterChange}
          />
          <FilterDropdown
            label={t('dashboard.toolbar.statusFilter')}
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={onStatusFilterChange}
          />
          <FilterDropdown
            label={t('dashboard.toolbar.sourceFilter')}
            value={sourceFilter}
            options={SOURCE_OPTIONS}
            onChange={onSourceFilterChange}
          />
          <button className={styles.resetBtn} type="button" onClick={onResetFilters}>
            {t('dashboard.toolbar.reset')}
          </button>
        </div>
      </section>

      {/* Jobs Table */}
      <section className={styles.tableSection}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkboxCol}>
                <input
                  type="checkbox"
                  checked={jobs.length > 0 && selectedJobIds.size === jobs.length}
                  onChange={onToggleAllJobs}
                />
              </th>
              <th>{t('dashboard.table.company')}</th>
              <th>{t('dashboard.table.jobTitle')}</th>
              <th>{t('dashboard.table.level')}</th>
              <th>{t('dashboard.table.status')}</th>
              <th>{t('dashboard.table.salary')}</th>
              <th>{t('dashboard.table.skills')}</th>
              <th>{t('dashboard.table.source')}</th>
              <th>{t('dashboard.table.postedDate')}</th>
              <th className={styles.actionsCol} />
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className={styles.checkboxCol}>
                  <input
                    type="checkbox"
                    checked={selectedJobIds.has(job.id)}
                    onChange={() => onToggleJobSelection(job.id)}
                  />
                </td>
                <td>
                  <div className={styles.companyCell}>
                    <span className={styles.companyName}>{job.companyName}</span>
                    <span className={styles.industry}>{job.industry}</span>
                  </div>
                </td>
                <td>
                  <div className={styles.jobTitleCell}>
                    {job.jobTitle}
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.externalLink}
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </td>
                <td>
                  <LevelBadge level={job.level} />
                </td>
                <td>
                  <StatusBadge
                    status={job.status}
                    label={t(`dashboard.jobStatus.${job.status}`)}
                  />
                </td>
                <td className={styles.salaryCell}>{job.salary}</td>
                <td>
                  <div className={styles.skillsCell}>
                    {job.skills.map((skill) => (
                      <SkillTag key={skill} label={skill} />
                    ))}
                  </div>
                </td>
                <td>
                  <SourceBadge source={job.source} />
                </td>
                <td className={styles.dateCell}>{job.postedDate}</td>
                <td className={styles.actionsCol}>
                  <button className={styles.actionBtn} type="button">
                    <Ellipsis size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Pagination */}
      <section className={styles.paginationSection}>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          showingLabel={t('dashboard.pagination.showing', { from, to, total: totalItems })}
          perPageLabel={t('dashboard.pagination.perPage')}
        />
      </section>
    </div>
  );
}
