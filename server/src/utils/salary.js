export function formatSalary(low, high) {
  if (!low && !high) return '待遇面議';
  const fmt = (n) => n.toLocaleString('zh-TW');
  if (low && !high) return `${fmt(low)} 以上`;
  if (!low && high) return `${fmt(high)} 以下`;
  return `${fmt(low)} ~ ${fmt(high)}`;
}

export function getSalaryBucket(low, high) {
  const ref = low || high || 0;
  if (ref === 0) return 'undisclosed';
  if (ref < 40000) return 'under40k';
  if (ref < 60000) return '40k-60k';
  if (ref < 80000) return '60k-80k';
  if (ref < 100000) return '80k-100k';
  return 'above100k';
}
