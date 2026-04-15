export interface AcademyVideo {
  id: string;
  title: string;
  description: string;
  url: string;
  duration?: string;
  addedAt: string;
}

export const academyVideos: AcademyVideo[] = [
  {
    id: 'getting-started',
    title: 'Getting Started Guide',
    description: 'A quick overview of AutoListing — what it does and how to set it up.',
    url: 'https://youtu.be/RQhOENCec8o',
    addedAt: '2026-04-11',
  },
];

const WATCHED_STORAGE_KEY = 'autolisting_academy_watched';

export function getWatchedVideoIds(): string[] {
  try {
    const raw = localStorage.getItem(WATCHED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function markVideoWatched(id: string): string[] {
  const current = getWatchedVideoIds();
  if (current.includes(id)) return current;
  const next = [...current, id];
  try {
    localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}
