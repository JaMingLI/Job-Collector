import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useQuery, QUERY_KEYS } from '@/lib/react-query';
import type { JobDto, DashboardStatsDto } from '@/domain';
import { fetchJobs, fetchJobStats } from '@/domain';

export interface HomeViewModel {
  stats: DashboardStatsDto;
  jobs: JobDto[];
  isLoading: boolean;
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

const EMPTY_STATS: DashboardStatsDto = { total: 0, pending: 0, applied: 0, interview: 0, accepted: 0 };

export function useHomeViewModel(): HomeViewModel {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  const queryParams = {
    page: currentPage,
    pageSize,
    search: searchQuery || undefined,
    status: statusFilter || undefined,
    level: levelFilter || undefined,
    source: sourceFilter || undefined,
  };

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: QUERY_KEYS.jobs.list(queryParams),
    queryFn: () => fetchJobs(queryParams),
  });

  const { data: statsData } = useQuery({
    queryKey: QUERY_KEYS.jobs.stats,
    queryFn: fetchJobStats,
  });

  const jobs = jobsData?.data ?? [];
  const totalItems = jobsData?.pagination.total ?? 0;
  const totalPages = jobsData?.pagination.totalPages ?? 1;
  const stats = statsData
    ? { total: statsData.total, pending: statsData.pending, applied: statsData.applied, interview: statsData.interview, accepted: statsData.accepted }
    : EMPTY_STATS;

  const onSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const onLevelFilterChange = (value: string) => {
    setLevelFilter(value);
    setCurrentPage(1);
  };

  const onStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const onSourceFilterChange = (value: string) => {
    setSourceFilter(value);
    setCurrentPage(1);
  };

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
      if (prev.size === jobs.length) {
        return new Set();
      }
      return new Set(jobs.map((j) => j.id));
    });
  };

  return {
    stats,
    jobs,
    isLoading: jobsLoading,
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
    onPageChange: setCurrentPage,
    onPageSizeChange,
    selectedJobIds,
    onToggleJobSelection,
    onToggleAllJobs,
    t,
  };
}
