/** 把毫秒时间格式化成界面上的短句。空值显示破折号。 */
export function formatTime(value: number | null): string {
  if (value === null) {
    return '—';
  }
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
}

/** 把毫秒时间收成日期框使用的 YYYY-MM-DD。空值给空字符串。 */
export function formatDateInput(value: number | null): string {
  if (value === null) {
    return '';
  }
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 日期框对应的当地零点。空字符串表示不限制开始时间。 */
export function startOfLocalDay(value: string): number | null {
  const parts = parseDateInput(value);
  if (parts === null) {
    return null;
  }
  return new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0).getTime();
}

/** 日期框对应的当天最后一毫秒，使这一天里的记录都被包含。 */
export function endOfLocalDay(value: string): number | null {
  const parts = parseDateInput(value);
  if (parts === null) {
    return null;
  }
  return new Date(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999).getTime();
}

function parseDateInput(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const yearText = match?.[1];
  const monthText = match?.[2];
  const dayText = match?.[3];
  if (yearText === undefined || monthText === undefined || dayText === undefined) {
    return null;
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/** 把字节数换成易读的大小。 */
export function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
