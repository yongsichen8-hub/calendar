import { getDb } from '../db';
import { config } from '../config';
import { NotFoundError } from '../errors';
import * as workEntryService from './workEntryService';
import * as categoryService from './categoryService';
import * as okrService from './okrService';
import type { SummaryType, Summary, WorkEntry, CategoryWithCount, Objective } from '../types';

/**
 * Calculate the date range [startDate, endDate] for a given summary type and target.
 */
export function calculateDateRange(type: SummaryType, target: string): { startDate: string; endDate: string } {
  switch (type) {
    case 'daily':
      return { startDate: target, endDate: target };

    case 'weekly': {
      // target: "2025-W02"
      const [yearStr, weekStr] = target.split('-W');
      const year = parseInt(yearStr, 10);
      const week = parseInt(weekStr, 10);
      // ISO week: Jan 4 is always in week 1
      const jan4 = new Date(year, 0, 4);
      const jan4Day = jan4.getDay() || 7; // Convert Sunday=0 to 7
      // Monday of week 1
      const week1Monday = new Date(jan4);
      week1Monday.setDate(jan4.getDate() - (jan4Day - 1));
      // Monday of target week
      const monday = new Date(week1Monday);
      monday.setDate(week1Monday.getDate() + (week - 1) * 7);
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      return {
        startDate: formatDate(monday),
        endDate: formatDate(friday),
      };
    }

    case 'monthly': {
      // target: "2025-01"
      const [yearStr, monthStr] = target.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0); // last day of month
      return {
        startDate: formatDate(firstDay),
        endDate: formatDate(lastDay),
      };
    }

    case 'quarterly': {
      // target: "2025-Q1"
      const [yearStr, qStr] = target.split('-Q');
      const year = parseInt(yearStr, 10);
      const q = parseInt(qStr, 10);
      const startMonth = (q - 1) * 3; // 0-indexed: Q1=0, Q2=3, Q3=6, Q4=9
      const firstDay = new Date(year, startMonth, 1);
      const lastDay = new Date(year, startMonth + 3, 0);
      return {
        startDate: formatDate(firstDay),
        endDate: formatDate(lastDay),
      };
    }
  }
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Determine the quarter string for a given target/type.
 */
function getQuarterForTarget(type: SummaryType, target: string): string {
  switch (type) {
    case 'quarterly':
      return target; // already "2025-Q1"
    case 'monthly': {
      const [yearStr, monthStr] = target.split('-');
      const month = parseInt(monthStr, 10);
      const q = Math.ceil(month / 3);
      return `${yearStr}-Q${q}`;
    }
    case 'weekly': {
      // Use the Monday of the week to determine quarter
      const { startDate } = calculateDateRange('weekly', target);
      const [yearStr, monthStr] = startDate.split('-');
      const month = parseInt(monthStr, 10);
      const q = Math.ceil(month / 3);
      return `${yearStr}-Q${q}`;
    }
    case 'daily': {
      const [yearStr, monthStr] = target.split('-');
      const month = parseInt(monthStr, 10);
      const q = Math.ceil(month / 3);
      return `${yearStr}-Q${q}`;
    }
  }
}

export interface GroupedData {
  categoryGroups: Array<{
    categoryName: string;
    color: string;
    entries: WorkEntry[];
  }>;
  nonOkrEntries: WorkEntry[];
}

/**
 * Group work entries by category, separating "其他" (isDefault) entries.
 */
export function groupWorkEntries(
  entries: WorkEntry[],
  categories: CategoryWithCount[],
): GroupedData {
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const groups = new Map<number, WorkEntry[]>();
  const nonOkrEntries: WorkEntry[] = [];

  for (const entry of entries) {
    const cat = categoryMap.get(entry.categoryId);
    if (!cat || cat.isDefault) {
      nonOkrEntries.push(entry);
    } else {
      const list = groups.get(entry.categoryId) || [];
      list.push(entry);
      groups.set(entry.categoryId, list);
    }
  }

  const categoryGroups: GroupedData['categoryGroups'] = [];
  for (const [catId, catEntries] of groups) {
    const cat = categoryMap.get(catId)!;
    categoryGroups.push({
      categoryName: cat.name,
      color: cat.color,
      entries: catEntries,
    });
  }

  return { categoryGroups, nonOkrEntries };
}

/**
 * Match OKR objectives to work entries via categoryId.
 */
export function matchOkrToEntries(
  objectives: Objective[],
  entries: WorkEntry[],
): Array<{ objective: Objective; matchedEntries: WorkEntry[] }> {
  return objectives.map(obj => ({
    objective: obj,
    matchedEntries: entries.filter(e => e.categoryId === obj.categoryId),
  }));
}

/**
 * Build the prompt for DeepSeek API.
 */
function buildPrompt(
  type: SummaryType,
  target: string,
  grouped: GroupedData,
  okrMatches: Array<{ objective: Objective; matchedEntries: WorkEntry[] }>,
): string {
  let prompt = `请根据以下工作记录生成${typeLabel(type)}工作总结（目标：${target}）。\n\n`;

  // Work entries grouped by category
  prompt += '## 工作记录（按分类）\n\n';
  for (const group of grouped.categoryGroups) {
    prompt += `### ${group.categoryName}\n`;
    for (const entry of group.entries) {
      prompt += `- ${entry.date} ${entry.timeSlot}: ${entry.subCategory ? entry.subCategory + ' - ' : ''}${entry.description}\n`;
    }
    prompt += '\n';
  }

  // Non-OKR entries
  if (grouped.nonOkrEntries.length > 0) {
    prompt += '### 非 OKR 相关工作\n';
    for (const entry of grouped.nonOkrEntries) {
      prompt += `- ${entry.date} ${entry.timeSlot}: ${entry.subCategory ? entry.subCategory + ' - ' : ''}${entry.description}\n`;
    }
    prompt += '\n';
  }

  // OKR analysis section
  if (okrMatches.length > 0) {
    prompt += '## OKR 数据\n\n';
    for (const match of okrMatches) {
      prompt += `### Objective: ${match.objective.title}\n`;
      prompt += `描述: ${match.objective.description}\n`;
      prompt += 'Key Results:\n';
      for (const kr of match.objective.keyResults) {
        prompt += `- ${kr.description} (进度: ${kr.progress}%)\n`;
      }
      prompt += `相关工作条目数: ${match.matchedEntries.length}\n\n`;
    }
  }

  prompt += '请生成总结，包含以下章节：\n';
  prompt += '1. 工作概览（按分类归纳关键成果和时间分配）\n';
  prompt += '2. OKR 推进分析（分析每个 Objective 和 Key Result 的推进情况）\n';
  if (grouped.nonOkrEntries.length > 0) {
    prompt += '3. 非 OKR 相关工作\n';
  }

  return prompt;
}

function typeLabel(type: SummaryType): string {
  switch (type) {
    case 'daily': return '日';
    case 'weekly': return '周';
    case 'monthly': return '月';
    case 'quarterly': return '季度';
  }
}

/**
 * Call DeepSeek API to generate summary content.
 */
async function callDeepSeekAPI(prompt: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个专业的工作总结助手，擅长分析工作内容并结合 OKR 进行推进分析。' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error('AI 总结生成失败，请稍后重试');
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  if (!data.choices || data.choices.length === 0 || !data.choices[0].message?.content) {
    throw new Error('AI 总结生成失败，请稍后重试');
  }

  return data.choices[0].message.content;
}

/**
 * Generate an AI summary for the given user, type, and target.
 */
export async function generate(userId: number, type: SummaryType, target: string): Promise<Summary> {
  const { startDate, endDate } = calculateDateRange(type, target);

  // Fetch work entries and categories
  const entries = workEntryService.getByDateRange(userId, startDate, endDate);
  const categories = categoryService.list(userId);

  // Group entries
  const grouped = groupWorkEntries(entries, categories);

  // Get OKR data for the relevant quarter
  const quarter = getQuarterForTarget(type, target);
  const okrData = okrService.getByQuarter(userId, quarter);

  // Match OKR objectives to entries
  const okrMatches = matchOkrToEntries(okrData.objectives, entries);

  // Build prompt and call API
  const prompt = buildPrompt(type, target, grouped, okrMatches);

  let content: string;
  try {
    content = await callDeepSeekAPI(prompt);
  } catch {
    throw new Error('AI 总结生成失败，请稍后重试');
  }

  // Save to database
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO summaries (userId, type, target, content) VALUES (?, ?, ?, ?)'
  ).run(userId, type, target, content);

  const row = db.prepare(
    'SELECT id, userId, type, target, content, createdAt FROM summaries WHERE id = ?'
  ).get(result.lastInsertRowid) as Summary;

  return row;
}

/**
 * List all summaries for a user, ordered by createdAt DESC.
 */
export function list(userId: number): Summary[] {
  const db = getDb();
  return db.prepare(
    'SELECT id, userId, type, target, content, createdAt FROM summaries WHERE userId = ? ORDER BY createdAt DESC'
  ).all(userId) as Summary[];
}

/**
 * Get a summary by ID, verifying user ownership.
 */
export function getById(userId: number, id: number): Summary {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, userId, type, target, content, createdAt FROM summaries WHERE id = ? AND userId = ?'
  ).get(id, userId) as Summary | undefined;

  if (!row) {
    throw new NotFoundError('总结不存在');
  }

  return row;
}
