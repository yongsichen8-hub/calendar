import { getDb } from '../db';
import { config } from '../config';
import * as okrService from './okrService';
import * as categoryService from './categoryService';
import type { MilestoneResult, MilestoneSuggestion, WorkEntry, Objective, KRMilestone } from '../types';

/**
 * Calculate the quarter string from a date string (e.g. "2026-03-18" → "2026-Q1").
 */
function getQuarterFromDate(date: string): string {
  const [yearStr, monthStr] = date.split('-');
  const month = parseInt(monthStr, 10);
  const q = Math.ceil(month / 3);
  return `${yearStr}-Q${q}`;
}

/**
 * Get work entries for a date range from the database.
 */
function getWorkEntriesByDateRange(userId: number, startDate: string, endDate: string): WorkEntry[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, userId, categoryId, date, timeSlot, subCategory, description, createdAt, updatedAt
    FROM work_entries
    WHERE userId = ? AND date >= ? AND date <= ?
    ORDER BY date ASC, timeSlot ASC
  `).all(userId, startDate, endDate) as WorkEntry[];
}

/**
 * Match work entries to objectives by categoryId.
 */
function matchEntriesToObjectives(
  entries: WorkEntry[],
  objectives: Objective[],
): Array<{ objective: Objective; matchedEntries: WorkEntry[] }> {
  return objectives
    .map(obj => ({
      objective: obj,
      matchedEntries: entries.filter(e => e.categoryId === obj.categoryId),
    }))
    .filter(match => match.matchedEntries.length > 0);
}

/**
 * Build the prompt for DeepSeek API to identify milestones.
 */
function buildMilestonePrompt(
  date: string,
  matches: Array<{ objective: Objective; matchedEntries: WorkEntry[] }>,
  categories: Map<number, string>,
): string {
  let prompt = `请分析以下 ${date} 的工作记录，识别其中的里程碑事项。\n\n`;

  prompt += '## 分析规则\n';
  prompt += '1. 根据工作条目的分类（categoryId）将其与对应的 Objective 关联\n';
  prompt += '2. 区分"过程性工作"（如"准备口译工作"、"学习资料整理"）和"里程碑事项"（如"完成口译工作"、"通过考试"）\n';
  prompt += '3. 里程碑事项是具有阶段性完成意义的工作，表示某项工作从"进行中"变为"阶段性完成"\n';
  prompt += '4. 仅为准备或进行中的事项属于过程性工作，不算里程碑\n';
  prompt += '5. 每条里程碑应简洁描述该阶段性成果\n\n';

  prompt += '## 工作记录与 OKR 数据\n\n';

  for (const match of matches) {
    const catName = categories.get(match.objective.categoryId) || '未知分类';
    prompt += `### Objective: ${match.objective.title}（分类: ${catName}）\n`;
    prompt += `描述: ${match.objective.description}\n\n`;

    prompt += 'Key Results:\n';
    for (const kr of match.objective.keyResults) {
      prompt += `- [ID: ${kr.id}] ${kr.description}\n`;
    }
    prompt += '\n';

    prompt += '相关工作条目:\n';
    for (const entry of match.matchedEntries) {
      prompt += `- ${entry.timeSlot}: ${entry.subCategory ? entry.subCategory + ' - ' : ''}${entry.description}\n`;
    }
    prompt += '\n';
  }

  prompt += '## 输出要求\n';
  prompt += '请以 JSON 格式返回结果，不要包含任何其他文本或 markdown 标记。\n';
  prompt += '格式如下:\n';
  prompt += '```json\n';
  prompt += '{\n';
  prompt += '  "suggestions": [\n';
  prompt += '    {\n';
  prompt += '      "objectiveTitle": "Objective 标题",\n';
  prompt += '      "keyResultId": 1,\n';
  prompt += '      "keyResultDescription": "KR 描述",\n';
  prompt += '      "milestones": ["识别出的里程碑事项1", "里程碑事项2"]\n';
  prompt += '    }\n';
  prompt += '  ]\n';
  prompt += '}\n';
  prompt += '```\n';
  prompt += '如果没有识别出任何里程碑事项，返回 {"suggestions": []}。\n';

  return prompt;
}

/**
 * Call DeepSeek API for milestone identification.
 */
async function callDeepSeekAPI(prompt: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的 OKR 分析助手，擅长从工作记录中识别里程碑事项并建议进度更新。请严格按照 JSON 格式返回结果。',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error('DeepSeek API 调用失败，请稍后重试');
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  if (!data.choices || data.choices.length === 0 || !data.choices[0].message?.content) {
    throw new Error('DeepSeek API 返回结果为空');
  }

  return data.choices[0].message.content;
}

/**
 * Parse the AI response JSON into MilestoneSuggestion array.
 */
function parseAIResponse(content: string): MilestoneSuggestion[] {
  // Strip markdown code fences if present
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(jsonStr) as { suggestions: MilestoneSuggestion[] };

  if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
    return [];
  }

  return parsed.suggestions;
}

/**
 * Identify milestones from work entries for a given date range and suggest OKR progress updates.
 */
export async function identifyMilestones(userId: number, startDate: string, endDate: string): Promise<MilestoneResult> {
  // 1. Get work entries for the date range
  const entries = getWorkEntriesByDateRange(userId, startDate, endDate);

  if (entries.length === 0) {
    return { date: startDate, suggestions: [] };
  }

  // 2. Calculate the quarter and get OKR data
  const quarter = getQuarterFromDate(startDate);
  const okrData = okrService.getByQuarter(userId, quarter);

  if (okrData.objectives.length === 0) {
    return { date: startDate, suggestions: [] };
  }

  // 3. Match work entries to objectives by categoryId
  const matches = matchEntriesToObjectives(entries, okrData.objectives);

  if (matches.length === 0) {
    return { date: startDate, suggestions: [] };
  }

  // 4. Build category name map for the prompt
  const categoriesList = categoryService.list(userId);
  const categoryMap = new Map(categoriesList.map(c => [c.id, c.name]));

  // 5. Build prompt and call DeepSeek API
  const dateLabel = startDate === endDate ? startDate : `${startDate} ~ ${endDate}`;
  const prompt = buildMilestonePrompt(dateLabel, matches, categoryMap);

  let responseContent: string;
  try {
    responseContent = await callDeepSeekAPI(prompt);
  } catch {
    throw new Error('AI 里程碑识别失败，请稍后重试');
  }

  // 6. Parse the response
  let suggestions: MilestoneSuggestion[];
  try {
    suggestions = parseAIResponse(responseContent);
  } catch {
    throw new Error('AI 返回结果解析失败，请稍后重试');
  }

  return { date: startDate, suggestions };
}

/**
 * Save accepted milestones to the kr_milestones table.
 */
export function saveMilestones(
  userId: number,
  keyResultId: number,
  date: string,
  milestones: string[],
): KRMilestone[] {
  const db = getDb();

  // Verify ownership through objective
  const existing = db.prepare(`
    SELECT kr.id, o.userId
    FROM key_results kr
    JOIN objectives o ON o.id = kr.objectiveId
    WHERE kr.id = ?
  `).get(keyResultId) as { id: number; userId: number } | undefined;

  if (!existing) {
    throw new Error('Key Result 不存在');
  }
  if (existing.userId !== userId) {
    throw new Error('无权限访问该资源');
  }

  const insert = db.prepare(`
    INSERT INTO kr_milestones (keyResultId, content, date)
    VALUES (?, ?, ?)
  `);

  const saved: KRMilestone[] = [];
  const insertMany = db.transaction(() => {
    for (const content of milestones) {
      const result = insert.run(keyResultId, content, date);
      const row = db.prepare(
        'SELECT id, keyResultId, content, date, createdAt FROM kr_milestones WHERE id = ?'
      ).get(result.lastInsertRowid) as KRMilestone;
      saved.push(row);
    }
  });
  insertMany();

  return saved;
}

/**
 * Update a milestone's content and/or date.
 */
export function updateMilestone(
  userId: number,
  milestoneId: number,
  data: { content?: string; date?: string },
): KRMilestone {
  const db = getDb();

  const existing = db.prepare(`
    SELECT m.id, m.keyResultId, o.userId
    FROM kr_milestones m
    JOIN key_results kr ON kr.id = m.keyResultId
    JOIN objectives o ON o.id = kr.objectiveId
    WHERE m.id = ?
  `).get(milestoneId) as { id: number; keyResultId: number; userId: number } | undefined;

  if (!existing) {
    throw new Error('里程碑不存在');
  }
  if (existing.userId !== userId) {
    throw new Error('无权限访问该资源');
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.content !== undefined) {
    updates.push('content = ?');
    params.push(data.content);
  }
  if (data.date !== undefined) {
    updates.push('date = ?');
    params.push(data.date);
  }

  if (updates.length > 0) {
    params.push(milestoneId);
    db.prepare(`UPDATE kr_milestones SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  return db.prepare(
    'SELECT id, keyResultId, content, date, createdAt FROM kr_milestones WHERE id = ?'
  ).get(milestoneId) as KRMilestone;
}

/**
 * Delete a milestone.
 */
export function deleteMilestone(userId: number, milestoneId: number): void {
  const db = getDb();

  const existing = db.prepare(`
    SELECT m.id, o.userId
    FROM kr_milestones m
    JOIN key_results kr ON kr.id = m.keyResultId
    JOIN objectives o ON o.id = kr.objectiveId
    WHERE m.id = ?
  `).get(milestoneId) as { id: number; userId: number } | undefined;

  if (!existing) {
    throw new Error('里程碑不存在');
  }
  if (existing.userId !== userId) {
    throw new Error('无权限访问该资源');
  }

  db.prepare('DELETE FROM kr_milestones WHERE id = ?').run(milestoneId);
}
