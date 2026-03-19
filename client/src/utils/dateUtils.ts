/**
 * 日期工具函数
 * 用于日历视图的周计算、导航和格式化
 */

/** 时间段常量：9:00-21:00 共 12 个时间段 */
export const TIME_SLOTS = [
  '09:00-10:00',
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '13:00-14:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
  '17:00-18:00',
  '18:00-19:00',
  '19:00-20:00',
  '20:00-21:00',
];

export interface WeekRange {
  start: string;  // Monday ISO date "YYYY-MM-DD"
  end: string;    // Sunday ISO date "YYYY-MM-DD"
  dates: string[]; // Monday through Sunday ISO dates
}

/**
 * 计算给定日期所在周的周一至周日日期范围。
 */
export function getWeekRange(date: Date): WeekRange {
  // Clone to avoid mutating input
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  let monday: Date;
  if (dayOfWeek === 0) {
    // Sunday → go back 6 days to Monday
    monday = new Date(d);
    monday.setDate(d.getDate() - 6);
  } else {
    // Weekday or Saturday → go back to Monday
    monday = new Date(d);
    monday.setDate(d.getDate() - (dayOfWeek - 1));
  }

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    dates.push(formatISODate(day));
  }

  return {
    start: dates[0],
    end: dates[6],
    dates,
  };
}

/**
 * 返回下一周的周一日期字符串。
 * @param weekStart 当前周的周一日期 "YYYY-MM-DD"
 */
export function getNextWeek(weekStart: string): string {
  const d = parseISODate(weekStart);
  d.setDate(d.getDate() + 7);
  return formatISODate(d);
}

/**
 * 返回上一周的周一日期字符串。
 * @param weekStart 当前周的周一日期 "YYYY-MM-DD"
 */
export function getPrevWeek(weekStart: string): string {
  const d = parseISODate(weekStart);
  d.setDate(d.getDate() - 7);
  return formatISODate(d);
}

/**
 * 计算日期所属季度字符串，如 "2025-Q1"。
 * Jan-Mar = Q1, Apr-Jun = Q2, Jul-Sep = Q3, Oct-Dec = Q4
 */
export function getQuarter(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const quarter = Math.floor(month / 3) + 1;
  return `${year}-Q${quarter}`;
}

/**
 * 格式化周日期范围显示文字。
 * 同年且为当前年份: "1月6日 - 1月10日"
 * 跨年或非当前年份: "2025年1月6日 - 1月10日" 或 "2024年12月30日 - 2025年1月3日"
 */
export function formatDateRange(start: string, end: string): string {
  const startDate = parseISODate(start);
  const endDate = parseISODate(end);
  const currentYear = new Date().getFullYear();

  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;
  const endMonth = endDate.getMonth() + 1;
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  const endStr = `${endMonth}月${endDay}日`;

  if (startYear === endYear && startYear === currentYear) {
    // Same year and current year: omit year
    return `${startMonth}月${startDay}日 - ${endStr}`;
  }

  if (startYear === endYear) {
    // Same year but not current year: show year once at start
    return `${startYear}年${startMonth}月${startDay}日 - ${endStr}`;
  }

  // Different years: show both years
  return `${startYear}年${startMonth}月${startDay}日 - ${endYear}年${endStr}`;
}

/** Format a Date to "YYYY-MM-DD" */
function formatISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse "YYYY-MM-DD" to a Date (local time) */
function parseISODate(str: string): Date {
  const [year, month, day] = str.split('-').map(Number);
  return new Date(year, month - 1, day);
}
