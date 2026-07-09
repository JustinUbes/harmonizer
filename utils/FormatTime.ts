export function formatTime(millis: number): string {
  const totalSec = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}