import { config } from '../config';
import { getDb } from '../db';
import { NotFoundError, ForbiddenError } from '../errors';
import * as ledgerService from './ledgerService';

/**
 * Analyze budget usage for a whole management subject using DeepSeek AI.
 */
export async function analyzeBudget(
  userId: number,
  subjectId: number
): Promise<{ content: string }> {
  const summary = ledgerService.getSubjectSummary(userId, subjectId);
  const db = getDb();
  const subject = db.prepare('SELECT name FROM management_subjects WHERE id = ? AND userId = ?').get(subjectId, userId) as { name: string } | undefined;
  if (!subject) throw new NotFoundError('管理对象不存在');

  const expenses = ledgerService.listExpenses(userId, subjectId);
  const expensesByCategory = new Map<string, typeof expenses>();
  for (const entry of expenses) {
    const list = expensesByCategory.get(entry.categoryName) || [];
    list.push(entry);
    expensesByCategory.set(entry.categoryName, list);
  }

  let prompt = `管理对象：${subject.name}\n\n`;
  for (const cat of summary.categoryBreakdown) {
    prompt += `【${cat.name}】预算额度：${cat.budget} 元，已用：${cat.usedAmount} 元，剩余：${cat.remainingBudget} 元\n`;
    const entries = expensesByCategory.get(cat.name) || [];
    if (entries.length > 0) {
      for (const entry of entries) {
        prompt += `  - ${entry.date} | ${entry.description} | ${entry.amount} 元\n`;
      }
    } else {
      prompt += `  （暂无记录）\n`;
    }
    prompt += '\n';
  }
  prompt += `总预算：${summary.totalBudget} 元，总已用：${summary.usedAmount} 元，总剩余：${summary.remainingBudget} 元\n\n`;
  prompt += '请分析以上预算使用情况，包括各分类占比分析、支出趋势、预算健康度评估和优化建议。';

  const aiResponse = await callDeepSeekAPI(prompt);
  return { content: aiResponse };
}

/**
 * Analyze budget usage for a single expense category using DeepSeek AI.
 */
export async function analyzeCategoryBudget(
  userId: number,
  categoryId: number
): Promise<{ content: string }> {
  const db = getDb();

  const cat = db.prepare(`
    SELECT ec.id, ec.subjectId, ec.name, ec.budget, ms.name as subjectName, ms.userId
    FROM expense_categories ec
    JOIN management_subjects ms ON ms.id = ec.subjectId
    WHERE ec.id = ?
  `).get(categoryId) as { id: number; subjectId: number; name: string; budget: number; subjectName: string; userId: number } | undefined;

  if (!cat) throw new NotFoundError('开销分类不存在');
  if (cat.userId !== userId) throw new ForbiddenError('禁止访问');

  const entries = db.prepare(`
    SELECT ee.amount, ee.description, ee.date
    FROM expense_entries ee WHERE ee.categoryId = ?
    ORDER BY ee.date DESC
  `).all(categoryId) as Array<{ amount: number; description: string; date: string }>;

  const usedAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const remainingBudget = cat.budget - usedAmount;

  let prompt = `管理对象：${cat.subjectName}\n`;
  prompt += `分类：${cat.name}\n`;
  prompt += `预算额度：${cat.budget} 元\n`;
  prompt += `已用金额：${usedAmount} 元\n`;
  prompt += `剩余预算：${remainingBudget} 元\n\n`;

  if (entries.length > 0) {
    prompt += '开销明细：\n';
    for (const entry of entries) {
      prompt += `  - ${entry.date} | ${entry.description} | ${entry.amount} 元\n`;
    }
  } else {
    prompt += '（暂无开销记录）\n';
  }

  prompt += '\n请针对此分类的预算使用情况进行分析，包括支出趋势、预算健康度评估和优化建议。';

  const aiResponse = await callDeepSeekAPI(prompt);
  return { content: aiResponse };
}

async function callDeepSeekAPI(prompt: string): Promise<string> {
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个专业的预算分析助手，擅长分析预算使用情况并提供优化建议。' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) throw new Error('API request failed');

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    if (!data.choices || data.choices.length === 0 || !data.choices[0].message?.content) {
      throw new Error('Invalid API response');
    }

    return data.choices[0].message.content;
  } catch {
    throw new Error('分析服务暂时不可用，请稍后重试');
  }
}
