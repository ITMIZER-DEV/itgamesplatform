export function formatSecondsToTime(totalSeconds?: number): string {
  if (totalSeconds === undefined || totalSeconds === null || isNaN(totalSeconds)) return '--:--';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const millis = Math.round((totalSeconds - Math.floor(totalSeconds)) * 10);
  
  const formattedMins = String(mins).padStart(2, '0');
  const formattedSecs = String(secs).padStart(2, '0');
  
  if (millis > 0) {
    return `${formattedMins}:${formattedSecs}.${millis}`;
  }
  return `${formattedMins}:${formattedSecs}`;
}

export function parseTimeToSeconds(timeStr?: string): number {
  if (!timeStr || !timeStr.trim()) return 0;
  const clean = timeStr.trim();
  const parts = clean.split(':');
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return hours * 3600 + mins * 60 + secs;
  }
  return parseFloat(clean) || 0;
}
