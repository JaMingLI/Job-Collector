import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { JobDto, DashboardStatsDto } from '@/domain';
import type { JobLevel, JobSource, JobStatus } from '@/domain';
import { MOCK_JOBS, MOCK_STATS } from './mock-data';

export interface HomeViewModel {
  stats: DashboardStatsDto;
  jobs: JobDto[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  levelFilter: string;
  statusFilter: string;
  sourceFilter: string;
  onLevelFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onSourceFilterChange: (value: string) => void;
  onResetFilters: () => void;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  selectedJobIds: Set<string>;
  onToggleJobSelection: (id: string) => void;
  onToggleAllJobs: () => void;
  t: TFunction;
}

export function useHomeViewModel(): HomeViewModel {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  const filteredJobs = useMemo(() => {
    return MOCK_JOBS.filter((job) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !job.companyName.toLowerCase().includes(q) &&
          !job.jobTitle.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (levelFilter && job.level !== (levelFilter as JobLevel)) return false;
      if (statusFilter && job.status !== (statusFilter as JobStatus)) return false;
      if (sourceFilter && job.source !== (sourceFilter as JobSource)) return false;
      return true;
    });
  }, [searchQuery, levelFilter, statusFilter, sourceFilter]);

  const totalItems = filteredJobs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredJobs.slice(start, start + pageSize);
  }, [filteredJobs, currentPage, pageSize]);

  const onResetFilters = () => {
    setSearchQuery('');
    setLevelFilter('');
    setStatusFilter('');
    setSourceFilter('');
    setCurrentPage(1);
  };

  const onPageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const onToggleJobSelection = (id: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const onToggleAllJobs = () => {
    setSelectedJobIds((prev) => {
      if (prev.size === paginatedJobs.length) {
        return new Set();
      }
      return new Set(paginatedJobs.map((j) => j.id));
    });
  };

  return {
    stats: MOCK_STATS,
    jobs: paginatedJobs,
    searchQuery,
    onSearchChange: setSearchQuery,
    levelFilter,
    statusFilter,
    sourceFilter,
    onLevelFilterChange: setLevelFilter,
    onStatusFilterChange: setStatusFilter,
    onSourceFilterChange: setSourceFilter,
    onResetFilters,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    onPageChange: setCurrentPage,
    onPageSizeChange,
    selectedJobIds,
    onToggleJobSelection,
    onToggleAllJobs,
    t,
  };
}
