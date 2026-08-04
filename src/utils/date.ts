const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Groups an activity timeline entry under a day/month/year bucket ("Aujourd'hui",
 * "Il y a 5 jours", "Il y a 3 mois", ...). `key` is stable per bucket so consecutive
 * events (the timeline is already sorted newest-first) can be merged under one header;
 * month/year buckets use calendar boundaries (not `daysAgo / 30`) so "3 months ago"
 * matches how a person would actually describe the gap.
 */
export function getActivityGroupLabel(iso: string, now: Date): { key: string; label: string } {
  const date = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / DAY_MS);

  if (diffDays <= 0) return { key: 'today', label: "Aujourd'hui" };
  if (diffDays === 1) return { key: 'yesterday', label: 'Hier' };
  if (diffDays < 30) return { key: `days-${diffDays}`, label: `Il y a ${diffDays} jours` };

  const monthDiff = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  if (monthDiff < 12) {
    const months = Math.max(monthDiff, 1);
    return { key: `months-${months}`, label: months === 1 ? 'Il y a 1 mois' : `Il y a ${months} mois` };
  }

  const years = Math.floor(monthDiff / 12);
  return { key: `years-${years}`, label: years === 1 ? 'Il y a 1 an' : `Il y a ${years} ans` };
}
