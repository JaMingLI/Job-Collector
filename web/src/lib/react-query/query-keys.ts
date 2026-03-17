export const QUERY_KEYS = {
  jobs: {
    all: ['jobs'] as const,
    list: (params: Record<string, unknown>) => ['jobs', 'list', params] as const,
    detail: (id: string) => ['jobs', 'detail', id] as const,
    stats: ['jobs', 'stats'] as const,
  },
} as const;
