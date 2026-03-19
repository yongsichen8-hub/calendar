import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { apiClient } from '@/api/client';
import type {
  ManagementSubjectWithSummary,
  ExpenseEntry,
  ExpenseFilters,
  CreateExpenseDTO,
  ExpenseCategoryWithSummary,
  TravelOrder,
  TravelExpenseEntry,
  TravelExpenseSubType,
  TravelPolicy,
  UpdateTravelPolicyDTO,
  TravelDestination,
  CityListData,
  OverseasCurrency,
  SubjectCurrency,
  ExpenseCurrencyType,
} from '@/types';

/* ── 常量 ── */
const CATEGORY_TABS = ['差旅', '招待', '团建'] as const;
type CategoryTab = (typeof CATEGORY_TABS)[number];
const TRAVEL_SUB_TYPES: TravelExpenseSubType[] = ['酒店', '机票', '其他', '补贴'];
const DESTINATIONS: TravelDestination[] = ['境内', '境外'];

function currencySymbol(c: OverseasCurrency | undefined): string {
  switch (c) {
    case 'EUR': return '€';
    case 'USD': return '$';
    default: return '¥';
  }
}

function subjectCurrencySymbol(c: SubjectCurrency | undefined): string {
  return c === 'EUR' ? '€' : '¥';
}

const EXPENSE_CURRENCIES: ExpenseCurrencyType[] = ['CNY', 'EUR', 'USD'];

function expenseCurrencySymbol(c: ExpenseCurrencyType | undefined): string {
  switch (c) {
    case 'EUR': return '€';
    case 'USD': return '$';
    default: return '¥';
  }
}

/* ── SubjectCard ── */
interface SubjectCardProps {
  subject: ManagementSubjectWithSummary;
  onSelect: (subject: ManagementSubjectWithSummary) => void;
  onEdit: (subject: ManagementSubjectWithSummary) => void;
  onDelete: (id: number) => void;
  onExport: (subject: ManagementSubjectWithSummary) => void;
}

function SubjectCard({ subject, onSelect, onEdit, onDelete, onExport }: SubjectCardProps) {
  const isOverBudget = subject.totalBudget > 0 && subject.usedAmountCNY > subject.totalBudget;
  const isEUR = subject.currency === 'EUR';
  const cs = subjectCurrencySymbol(subject.currency);
  return (
    <div className="card" style={{ cursor: 'pointer', marginBottom: '12px' }} onClick={() => onSelect(subject)}>
      <div className="card-header">
        <h3>{subject.name} {isEUR && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>💶 EUR (1€≈¥{subject.exchangeRate})</span>}</h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); onExport(subject); }} aria-label={`导出 ${subject.name}`} title="导出Excel">📥</button>
          <button className="btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(subject); }} aria-label={`编辑 ${subject.name}`} title="编辑">✏️</button>
          <button className="btn-icon btn-sm" onClick={(e) => { e.stopPropagation(); onDelete(subject.id); }} aria-label={`删除 ${subject.name}`} title="删除">🗑️</button>
        </div>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
          <span>总预算：¥{subject.totalBudget.toFixed(2)}</span>
          <span style={isOverBudget ? { color: '#d45d5d', fontWeight: 600 } : undefined}>
            已用：{isEUR ? `${cs}${subject.usedAmount.toFixed(2)} (≈¥${subject.usedAmountCNY.toFixed(2)})` : `¥${subject.usedAmountCNY.toFixed(2)}`}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
          <span style={isOverBudget ? { color: '#d45d5d', fontWeight: 600 } : undefined}>剩余：¥{subject.remainingBudget.toFixed(2)}</span>
          <span style={isOverBudget ? { color: '#d45d5d', fontWeight: 600 } : undefined}>{isOverBudget ? '超支' : `${subject.usagePercent.toFixed(1)}%`}</span>
        </div>
        <div style={{ width: '100%', height: '8px', background: '#f0ece6', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(subject.usagePercent, 100)}%`, height: '100%', background: isOverBudget ? '#d45d5d' : '#c6ddf5', borderRadius: '4px', transition: 'width 0.3s ease' }} role="progressbar" aria-valuenow={subject.usagePercent} aria-valuemin={0} aria-valuemax={100} />
        </div>
        {(subject.travelBudgetCode || subject.entertainBudgetCode || subject.costCenterCode || subject.collaborationBudgetCode) && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            {subject.travelBudgetCode && <span>差旅预算号：{subject.travelBudgetCode}</span>}
            {subject.entertainBudgetCode && <span>招待费预算号：{subject.entertainBudgetCode}</span>}
            {subject.costCenterCode && <span>成本中心：{subject.costCenterCode}</span>}
            {subject.collaborationBudgetCode && <span>横向协同费预算号：{subject.collaborationBudgetCode}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Excel Export ── */
async function exportSubjectToExcel(subject: ManagementSubjectWithSummary) {
  const wb = XLSX.utils.book_new();

  // 差旅 sheet — travel orders with expenses
  const travelOrders = await apiClient.ledger.listTravelOrders(subject.id);
  const travelRows: Record<string, unknown>[] = [];
  for (const order of travelOrders) {
    if (order.expenses.length === 0) {
      travelRows.push({ 出差单: order.title, 目的地: `${order.destinationCity}(${order.destination})`, 去程: order.departureDate, 返程: order.returnDate, 子类型: '', 日期: '', 明细: '', 金额: order.totalAmount, 状态: '' });
    } else {
      for (const e of order.expenses) {
        travelRows.push({
          出差单: order.title, 目的地: `${order.destinationCity}(${order.destination})`, 去程: order.departureDate, 返程: order.returnDate,
          子类型: e.subType,
          日期: e.subType === '酒店' && e.endDate ? `${e.date} → ${e.endDate}` : e.date,
          明细: e.description, 金额: e.amount,
          状态: e.subType === '补贴' ? (e.paid ? '已发' : '未发') : '',
        });
      }
    }
  }
  const travelWs = XLSX.utils.json_to_sheet(travelRows.length > 0 ? travelRows : [{ 出差单: '', 目的地: '', 去程: '', 返程: '', 子类型: '', 日期: '', 明细: '', 金额: '', 状态: '' }]);
  XLSX.utils.book_append_sheet(wb, travelWs, '差旅');

  // 招待 sheet
  const entertainExpenses = await apiClient.ledger.listExpenses(subject.id, { categoryName: '招待' });
  const entertainRows = entertainExpenses.map(e => ({ 日期: e.date, 明细: e.description, 金额: e.amount }));
  const entertainWs = XLSX.utils.json_to_sheet(entertainRows.length > 0 ? entertainRows : [{ 日期: '', 明细: '', 金额: '' }]);
  XLSX.utils.book_append_sheet(wb, entertainWs, '招待');

  // 团建 sheet
  const teamExpenses = await apiClient.ledger.listExpenses(subject.id, { categoryName: '团建' });
  const teamRows = teamExpenses.map(e => ({ 日期: e.date, 明细: e.description, 金额: e.amount }));
  const teamWs = XLSX.utils.json_to_sheet(teamRows.length > 0 ? teamRows : [{ 日期: '', 明细: '', 金额: '' }]);
  XLSX.utils.book_append_sheet(wb, teamWs, '团建');

  XLSX.writeFile(wb, `${subject.name}_台账.xlsx`);
}

/* ── SubjectListView ── */
interface SubjectListViewProps { subjects: ManagementSubjectWithSummary[]; onSelect: (s: ManagementSubjectWithSummary) => void; onRefresh: () => void; }

function SubjectListView({ subjects, onSelect, onRefresh }: SubjectListViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCurrency, setNewCurrency] = useState<SubjectCurrency>('CNY');
  const [newExchangeRate, setNewExchangeRate] = useState('7.8');
  const [newTravelBudgetCode, setNewTravelBudgetCode] = useState('');
  const [newEntertainBudgetCode, setNewEntertainBudgetCode] = useState('');
  const [newCostCenterCode, setNewCostCenterCode] = useState('');
  const [newCollaborationBudgetCode, setNewCollaborationBudgetCode] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editCurrency, setEditCurrency] = useState<SubjectCurrency>('CNY');
  const [editExchangeRate, setEditExchangeRate] = useState('7.8');
  const [editTravelBudgetCode, setEditTravelBudgetCode] = useState('');
  const [editEntertainBudgetCode, setEditEntertainBudgetCode] = useState('');
  const [editCostCenterCode, setEditCostCenterCode] = useState('');
  const [editCollaborationBudgetCode, setEditCollaborationBudgetCode] = useState('');

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { alert('名称不能为空'); return; }
    try {
      await apiClient.ledger.createSubject({
        name,
        currency: newCurrency,
        ...(newCurrency === 'EUR' ? { exchangeRate: parseFloat(newExchangeRate) || 7.8 } : {}),
        travelBudgetCode: newTravelBudgetCode.trim(),
        entertainBudgetCode: newEntertainBudgetCode.trim(),
        costCenterCode: newCostCenterCode.trim(),
        collaborationBudgetCode: newCollaborationBudgetCode.trim(),
      });
      setNewName(''); setNewCurrency('CNY'); setNewExchangeRate('7.8');
      setNewTravelBudgetCode(''); setNewEntertainBudgetCode(''); setNewCostCenterCode(''); setNewCollaborationBudgetCode('');
      setShowForm(false); onRefresh();
    }
    catch (err: unknown) { alert(err instanceof Error ? err.message : '创建失败'); }
  };
  const handleStartEdit = (s: ManagementSubjectWithSummary) => {
    setEditingId(s.id); setEditName(s.name); setEditCurrency(s.currency); setEditExchangeRate(String(s.exchangeRate));
    setEditTravelBudgetCode(s.travelBudgetCode || ''); setEditEntertainBudgetCode(s.entertainBudgetCode || ''); setEditCostCenterCode(s.costCenterCode || ''); setEditCollaborationBudgetCode(s.collaborationBudgetCode || '');
  };
  const handleSaveEdit = async () => {
    if (editingId === null) return;
    const name = editName.trim();
    if (!name) { alert('名称不能为空'); return; }
    try {
      await apiClient.ledger.updateSubject(editingId, {
        name,
        currency: editCurrency,
        ...(editCurrency === 'EUR' ? { exchangeRate: parseFloat(editExchangeRate) || 7.8 } : {}),
        travelBudgetCode: editTravelBudgetCode.trim(),
        entertainBudgetCode: editEntertainBudgetCode.trim(),
        costCenterCode: editCostCenterCode.trim(),
        collaborationBudgetCode: editCollaborationBudgetCode.trim(),
      });
      setEditingId(null); onRefresh();
    }
    catch (err: unknown) { alert(err instanceof Error ? err.message : '更新失败'); }
  };
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此管理对象吗？所有关联的开销记录也将被删除。')) return;
    try { await apiClient.ledger.deleteSubject(id); onRefresh(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : '删除失败'); }
  };

  const handleExport = async (s: ManagementSubjectWithSummary) => {
    try { await exportSubjectToExcel(s); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : '导出失败'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 600 }}>📒 台账管理</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ 新建管理对象</button>
      </div>
      {showForm && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-body" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="input input-sm" style={{ width: '240px' }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="管理对象名称" />
            <select className="input input-sm" style={{ width: '100px' }} value={newCurrency} onChange={(e) => setNewCurrency(e.target.value as SubjectCurrency)}>
              <option value="CNY">¥ 人民币</option>
              <option value="EUR">€ 欧元</option>
            </select>
            {newCurrency === 'EUR' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>汇率 1€=¥</span>
                <input className="input input-sm" type="number" style={{ width: '80px' }} value={newExchangeRate} onChange={(e) => setNewExchangeRate(e.target.value)} min="0" step="0.01" />
              </div>
            )}
            <input className="input input-sm" style={{ width: '180px' }} value={newTravelBudgetCode} onChange={(e) => setNewTravelBudgetCode(e.target.value)} placeholder="差旅预算号" />
            <input className="input input-sm" style={{ width: '180px' }} value={newEntertainBudgetCode} onChange={(e) => setNewEntertainBudgetCode(e.target.value)} placeholder="招待费预算号" />
            <input className="input input-sm" style={{ width: '200px' }} value={newCostCenterCode} onChange={(e) => setNewCostCenterCode(e.target.value)} placeholder="成本中心完整代码" />
            <input className="input input-sm" style={{ width: '200px' }} value={newCollaborationBudgetCode} onChange={(e) => setNewCollaborationBudgetCode(e.target.value)} placeholder="横向协同费预算号" />
            <button className="btn btn-primary btn-sm" onClick={handleCreate}>提交</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>取消</button>
          </div>
        </div>
      )}
      {subjects.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">📒</div><p>暂无管理对象，点击上方按钮新建</p></div>
      ) : subjects.map((s) =>
        editingId === s.id ? (
          <div key={s.id} className="card" style={{ marginBottom: '12px' }}>
            <div className="card-body" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="input input-sm" style={{ width: '240px' }} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="名称" />
              <select className="input input-sm" style={{ width: '100px' }} value={editCurrency} onChange={(e) => setEditCurrency(e.target.value as SubjectCurrency)}>
                <option value="CNY">¥ 人民币</option>
                <option value="EUR">€ 欧元</option>
              </select>
              {editCurrency === 'EUR' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>汇率 1€=¥</span>
                  <input className="input input-sm" type="number" style={{ width: '80px' }} value={editExchangeRate} onChange={(e) => setEditExchangeRate(e.target.value)} min="0" step="0.01" />
                </div>
              )}
              <input className="input input-sm" style={{ width: '180px' }} value={editTravelBudgetCode} onChange={(e) => setEditTravelBudgetCode(e.target.value)} placeholder="差旅预算号" />
              <input className="input input-sm" style={{ width: '180px' }} value={editEntertainBudgetCode} onChange={(e) => setEditEntertainBudgetCode(e.target.value)} placeholder="招待费预算号" />
              <input className="input input-sm" style={{ width: '200px' }} value={editCostCenterCode} onChange={(e) => setEditCostCenterCode(e.target.value)} placeholder="成本中心完整代码" />
              <input className="input input-sm" style={{ width: '200px' }} value={editCollaborationBudgetCode} onChange={(e) => setEditCollaborationBudgetCode(e.target.value)} placeholder="横向协同费预算号" />
              <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>保存</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>取消</button>
            </div>
          </div>
        ) : <SubjectCard key={s.id} subject={s} onSelect={onSelect} onEdit={handleStartEdit} onDelete={handleDelete} onExport={handleExport} />
      )}
    </div>
  );
}

/* ── CategoryBudgetCard ── */
interface CategoryBudgetCardProps { category: ExpenseCategoryWithSummary; subjectCurrency: SubjectCurrency; onBudgetSaved: () => void; }

function CategoryBudgetCard({ category, subjectCurrency, onBudgetSaved }: CategoryBudgetCardProps) {
  const [editing, setEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(category.budget));
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const isOverBudget = category.budget > 0 && category.usedAmountCNY > category.budget;
  const isEUR = subjectCurrency === 'EUR';
  const cs = subjectCurrencySymbol(subjectCurrency);

  const handleSaveBudget = async () => {
    const budget = parseFloat(budgetInput);
    if (isNaN(budget) || budget < 0) { alert('预算额度不能为负数'); return; }
    try { await apiClient.ledger.updateCategoryBudget(category.id, { budget }); setEditing(false); onBudgetSaved(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : '更新预算失败'); }
  };
  const handleAIAnalyze = async () => {
    setAiLoading(true); setAiResult(null);
    try { const r = await apiClient.ledger.analyzeCategoryBudget(category.id); setAiResult(r.content); }
    catch { setAiResult('分析服务暂时不可用，请稍后重试'); }
    finally { setAiLoading(false); }
  };

  return (
    <div className="card" style={{ marginBottom: '12px' }}>
      <div className="card-header">
        <h4 style={{ margin: 0 }}>{category.name}</h4>
        <button className="btn btn-primary btn-sm" onClick={handleAIAnalyze} disabled={aiLoading}>{aiLoading ? '分析中...' : '🤖 AI分析'}</button>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.9rem' }}>
          <span>额度：</span>
          {editing ? (<>
            <input className="input input-sm" type="number" style={{ width: '120px' }} value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} min="0" step="0.01" />
            <button className="btn btn-primary btn-sm" onClick={handleSaveBudget}>保存</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setBudgetInput(String(category.budget)); }}>取消</button>
          </>) : (<>
            <span style={{ fontWeight: 600 }}>¥{category.budget.toFixed(2)}</span>
            <button className="btn-icon btn-sm" onClick={() => { setEditing(true); setBudgetInput(String(category.budget)); }} title="编辑额度">✏️</button>
          </>)}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', fontSize: '0.9rem' }}>
          <span style={isOverBudget ? { color: '#d45d5d', fontWeight: 600 } : undefined}>
            已用：{isEUR ? `${cs}${category.usedAmount.toFixed(2)} (≈¥${category.usedAmountCNY.toFixed(2)})` : `¥${category.usedAmountCNY.toFixed(2)}`}
          </span>
          <span style={isOverBudget ? { color: '#d45d5d', fontWeight: 600 } : undefined}>剩余：¥{category.remainingBudget.toFixed(2)}</span>
          <span style={isOverBudget ? { color: '#d45d5d', fontWeight: 600 } : undefined}>{isOverBudget ? '超支' : `${category.usagePercent.toFixed(1)}%`}</span>
        </div>
        <div style={{ width: '100%', height: '6px', background: '#f0ece6', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(category.usagePercent, 100)}%`, height: '100%', background: isOverBudget ? '#d45d5d' : '#c6ddf5', borderRadius: '3px', transition: 'width 0.3s ease' }} role="progressbar" aria-valuenow={category.usagePercent} aria-valuemin={0} aria-valuemax={100} />
        </div>
        {aiLoading && <div className="loading-overlay" style={{ padding: '16px 0' }}><div className="loading-spinner" /><span>正在分析{category.name}预算数据...</span></div>}
        {aiResult && !aiLoading && <div style={{ marginTop: '12px', position: 'relative', whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-primary)', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '6px' }}><button className="btn-icon btn-sm" onClick={() => setAiResult(null)} style={{ position: 'absolute', top: '4px', right: '4px' }} title="收起">✕</button>{aiResult}</div>}
      </div>
    </div>
  );
}

/* ── TravelOrderCard ── */
interface TravelOrderCardProps {
  order: TravelOrder;
  subjectCurrency: SubjectCurrency;
  exchangeRate: number;
  onRefresh: () => void;
}

function TravelOrderCard({ order, subjectCurrency, exchangeRate, onRefresh }: TravelOrderCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Each expense now carries its own currency — no need to infer
  const isSubjectEUR = subjectCurrency === 'EUR';

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [addSubType, setAddSubType] = useState<TravelExpenseSubType>('酒店');
  const [addAmount, setAddAmount] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addDate, setAddDate] = useState(order.departureDate);
  const [addEndDate, setAddEndDate] = useState(order.returnDate);
  const [addCurrency, setAddCurrency] = useState<ExpenseCurrencyType>(subjectCurrency === 'EUR' ? 'EUR' : 'CNY');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editCurrency, setEditCurrency] = useState<ExpenseCurrencyType>('CNY');
  const [editingOrder, setEditingOrder] = useState(false);
  const [editTitle, setEditTitle] = useState(order.title);
  const [editDeparture, setEditDeparture] = useState(order.departureDate);
  const [editReturn, setEditReturn] = useState(order.returnDate);
  const [editDestination, setEditDestination] = useState<TravelDestination>(order.destination);
  const [editCity, setEditCity] = useState(order.destinationCity);
  const [cityList, setCityList] = useState<CityListData | null>(null);

  useEffect(() => {
    if (editingOrder && !cityList) {
      apiClient.ledger.getCityList().then(setCityList).catch(() => {});
    }
  }, [editingOrder, cityList]);

  const handleAddExpense = async () => {
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) { alert('金额必须为正数'); return; }
    if (!addDesc.trim()) { alert('明细不能为空'); return; }
    if (!addDate) { alert('请选择日期'); return; }
    if (addSubType === '酒店' && (!addEndDate || addEndDate <= addDate)) { alert('酒店需要退房日期，且必须晚于入住日期'); return; }
    try {
      await apiClient.ledger.addTravelExpense(order.id, {
        subType: addSubType, amount, description: addDesc.trim(), date: addDate,
        ...(addSubType === '酒店' ? { endDate: addEndDate } : {}),
        ...(addSubType !== '补贴' ? { currency: addCurrency } : {}),
      });
      setAddAmount(''); setAddDesc(''); setShowAddExpense(false); onRefresh();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : '添加失败'); }
  };

  const handleEditExpense = async () => {
    if (editingId === null) return;
    const amount = parseFloat(editAmount);
    if (!amount || amount <= 0) { alert('金额必须为正数'); return; }
    if (!editDesc.trim()) { alert('明细不能为空'); return; }
    try {
      await apiClient.ledger.updateTravelExpense(editingId, { amount, description: editDesc.trim(), date: editDate, ...(editEndDate ? { endDate: editEndDate } : {}), currency: editCurrency });
      setEditingId(null); onRefresh();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : '更新失败'); }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('确定要删除此开销？')) return;
    try { await apiClient.ledger.deleteTravelExpense(id); onRefresh(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : '删除失败'); }
  };

  const handleUpdateOrder = async () => {
    if (!editTitle.trim()) { alert('标题不能为空'); return; }
    if (editDeparture > editReturn) { alert('去程日期不能晚于返程日期'); return; }
    if (!editCity.trim()) { alert('请选择目标城市'); return; }
    try {
      await apiClient.ledger.updateTravelOrder(order.id, { title: editTitle.trim(), destination: editDestination, destinationCity: editCity.trim(), departureDate: editDeparture, returnDate: editReturn });
      setEditingOrder(false); onRefresh();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : '更新失败'); }
  };

  const handleDeleteOrder = async () => {
    if (!confirm('确定要删除此出差单？所有关联的开销也将被删除。')) return;
    try { await apiClient.ledger.deleteTravelOrder(order.id); onRefresh(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : '删除失败'); }
  };

  const startEditExpense = (e: TravelExpenseEntry) => {
    setEditingId(e.id); setEditAmount(String(e.amount)); setEditDesc(e.description); setEditDate(e.date); setEditEndDate(e.endDate || ''); setEditCurrency(e.currency || 'CNY');
  };

  // Hotel limit currency: 境内=CNY, 境外=order.currency
  const hotelLimitCurrency = order.destination === '境内' ? 'CNY' : order.currency;

  // Convert amount between currencies for hotel excess comparison
  const toCNY = (amt: number, cur: string) => cur === 'CNY' ? amt : amt * exchangeRate;
  const fromCNY = (amt: number, cur: string) => cur === 'CNY' ? amt : amt / exchangeRate;
  const convertForCompare = (amt: number, fromCur: string, toCur: string) => {
    if (fromCur === toCur) return amt;
    return fromCNY(toCNY(amt, fromCur), toCur);
  };

  // Group expenses by subType — hotel expenses capped at standard limit (excess is self-paid)
  const grouped = TRAVEL_SUB_TYPES.map(st => ({
    subType: st,
    items: order.expenses.filter(e => e.subType === st),
    subtotal: order.expenses.filter(e => e.subType === st).reduce((s, e) => {
      if (st === '酒店' && order.hotelLimit > 0) {
        const nights = e.nights || 1;
        const maxAllowed = nights * order.hotelLimit;
        const amtInLimitCur = convertForCompare(e.amount, e.currency, hotelLimitCurrency);
        const cappedInLimitCur = Math.min(amtInLimitCur, maxAllowed);
        return s + convertForCompare(cappedInLimitCur, hotelLimitCurrency, e.currency);
      }
      return s + e.amount;
    }, 0),
  }));

  // Compute totals grouped by currency — hotel expenses capped at standard limit
  const currencyTotals = new Map<string, number>();
  for (const e of order.expenses) {
    const c = e.currency || 'CNY';
    let amt = e.amount;
    if (e.subType === '酒店' && order.hotelLimit > 0) {
      const nights = e.nights || 1;
      const maxAllowed = nights * order.hotelLimit;
      const amtInLimitCur = convertForCompare(amt, c, hotelLimitCurrency);
      const cappedInLimitCur = Math.min(amtInLimitCur, maxAllowed);
      amt = convertForCompare(cappedInLimitCur, hotelLimitCurrency, c);
    }
    currencyTotals.set(c, (currencyTotals.get(c) || 0) + amt);
  }
  const hasMixedCurrency = currencyTotals.size > 1;
  // For ≈¥ display, convert all to CNY
  let totalCNY = 0;
  for (const [c, amt] of currencyTotals) {
    if (c === 'CNY') totalCNY += amt;
    else if (c === 'EUR') totalCNY += amt * exchangeRate;
    else totalCNY += amt * exchangeRate; // USD approximation
  }

  return (
    <div className="card" style={{ marginBottom: '12px' }}>
      <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{expanded ? '▼' : '▶'}</span>
          {editingOrder ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
              <input className="input input-sm" style={{ width: '140px' }} value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="标题" />
              <select className="input input-sm" style={{ width: '80px' }} value={editDestination} onChange={e => { setEditDestination(e.target.value as TravelDestination); setEditCity(''); }}>
                {DESTINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {editDestination === '境内' && cityList ? (
                <select className="input input-sm" style={{ width: '120px' }} value={editCity} onChange={e => setEditCity(e.target.value)}>
                  <option value="">选择城市</option>
                  <optgroup label="一级城市">{cityList.tier1.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                  <optgroup label="二级城市">{cityList.tier2.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                  <optgroup label="三级城市">{cityList.tier3.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                  <optgroup label="四级城市(其他)"><option value="其他">其他</option></optgroup>
                </select>
              ) : (
                <input className="input input-sm" style={{ width: '120px' }} value={editCity} onChange={e => setEditCity(e.target.value)} placeholder="城市名称" />
              )}
              <input type="date" className="input input-sm" value={editDeparture} onChange={e => setEditDeparture(e.target.value)} />
              <span>→</span>
              <input type="date" className="input input-sm" value={editReturn} onChange={e => setEditReturn(e.target.value)} />
              <button className="btn btn-primary btn-sm" onClick={handleUpdateOrder}>保存</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingOrder(false)}>取消</button>
            </div>
          ) : (
            <div>
              <span style={{ fontWeight: 600 }}>{order.title}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                📍{order.destinationCity || '未设置'} ({order.destination}{order.destination === '境外' ? ` ${currencySymbol(order.currency)}` : ''})
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                {order.departureDate} → {order.returnDate}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            {hasMixedCurrency
              ? <>{[...currencyTotals.entries()].map(([c, amt], i) => <span key={c}>{i > 0 && ' + '}{expenseCurrencySymbol(c as ExpenseCurrencyType)}{amt.toFixed(2)}</span>)}</>
              : <>{expenseCurrencySymbol([...currencyTotals.keys()][0] as ExpenseCurrencyType || 'CNY')}{order.totalAmount.toFixed(2)}</>
            }
            {(hasMixedCurrency || isSubjectEUR) && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '2px' }}>(≈¥{totalCNY.toFixed(0)})</span>}
          </span>
          {!editingOrder && (
            <div style={{ display: 'flex', gap: '2px' }} onClick={e => e.stopPropagation()}>
              <button className="btn-icon btn-sm" onClick={() => { setEditingOrder(true); setEditTitle(order.title); setEditDeparture(order.departureDate); setEditReturn(order.returnDate); setEditDestination(order.destination); setEditCity(order.destinationCity); }} title="编辑">✏️</button>
              <button className="btn-icon btn-sm" onClick={handleDeleteOrder} title="删除">🗑️</button>
            </div>
          )}
        </div>
      </div>
      {expanded && (
        <div className="card-body">
          {/* Hotel limit info */}
          {order.hotelLimit > 0 && (
            <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', fontSize: '0.85rem' }}>
              <span>🏨 酒店标准上限：<span style={{ fontWeight: 600 }}>{currencySymbol(order.currency)}{order.hotelLimit.toFixed(0)}/间夜</span></span>
              {order.hotelExcess > 0 && (
                <span style={{ marginLeft: '16px', color: '#d45d5d', fontWeight: 600 }}>
                  ⚠️ 超标金额：¥{order.hotelExcess.toFixed(2)}（需自付）
                </span>
              )}
            </div>
          )}
          {/* Add expense */}
          <div style={{ marginBottom: '12px' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddExpense(!showAddExpense)}>+ 添加开销</button>
            {showAddExpense && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
                <select className="input input-sm" style={{ width: '90px' }} value={addSubType} onChange={e => setAddSubType(e.target.value as TravelExpenseSubType)}>
                  {TRAVEL_SUB_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
                {addSubType !== '补贴' && (
                  <select className="input input-sm" style={{ width: '70px' }} value={addCurrency} onChange={e => setAddCurrency(e.target.value as ExpenseCurrencyType)}>
                    {EXPENSE_CURRENCIES.map(c => <option key={c} value={c}>{expenseCurrencySymbol(c)} {c}</option>)}
                  </select>
                )}
                <input className="input input-sm" style={{ width: '100px' }} type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} placeholder={`金额`} min="0" step="0.01" />
                <input className="input input-sm" style={{ width: '180px' }} value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="明细" />
                {addSubType === '酒店' ? (
                  <>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>入住：</label>
                    <input type="date" className="input input-sm" style={{ width: '140px' }} value={addDate} onChange={e => setAddDate(e.target.value)} />
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>退房：</label>
                    <input type="date" className="input input-sm" style={{ width: '140px' }} value={addEndDate} onChange={e => setAddEndDate(e.target.value)} />
                  </>
                ) : (
                  <input type="date" className="input input-sm" style={{ width: '140px' }} value={addDate} onChange={e => setAddDate(e.target.value)} />
                )}
                <button className="btn btn-primary btn-sm" onClick={handleAddExpense}>提交</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowAddExpense(false)}>取消</button>
              </div>
            )}
          </div>

          {/* Grouped expenses */}
          {grouped.map(g => g.items.length > 0 && (
            <div key={g.subType} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <span>{g.subType}</span>
                <span>小计：{g.items.length > 0 ? (() => {
                  // Group subtotal by currency
                  const subTotals = new Map<string, number>();
                  for (const e of g.items) { const c = e.currency || 'CNY'; subTotals.set(c, (subTotals.get(c) || 0) + e.amount); }
                  return [...subTotals.entries()].map(([c, amt], i) => <span key={c}>{i > 0 && ' + '}{expenseCurrencySymbol(c as ExpenseCurrencyType)}{amt.toFixed(2)}</span>);
                })() : '0'}</span>
              </div>
              {g.items.map(expense => (
                editingId === expense.id ? (
                  <div key={expense.id} style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    {expense.subType === '酒店' ? (
                      <>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>入住：</label>
                        <input type="date" className="input input-sm" style={{ width: '130px' }} value={editDate} onChange={e => setEditDate(e.target.value)} />
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>退房：</label>
                        <input type="date" className="input input-sm" style={{ width: '130px' }} value={editEndDate} onChange={e => setEditEndDate(e.target.value)} />
                      </>
                    ) : (
                      <input type="date" className="input input-sm" style={{ width: '130px' }} value={editDate} onChange={e => setEditDate(e.target.value)} />
                    )}
                    <input className="input input-sm" style={{ width: '160px' }} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                    {expense.subType !== '补贴' && (
                      <select className="input input-sm" style={{ width: '65px' }} value={editCurrency} onChange={e => setEditCurrency(e.target.value as ExpenseCurrencyType)}>
                        {EXPENSE_CURRENCIES.map(c => <option key={c} value={c}>{expenseCurrencySymbol(c)}</option>)}
                      </select>
                    )}
                    <input type="number" className="input input-sm" style={{ width: '90px', textAlign: 'right' }} value={editAmount} onChange={e => setEditAmount(e.target.value)} min="0" step="0.01" />
                    <button className="btn-icon btn-sm" onClick={handleEditExpense} title="保存">✓</button>
                    <button className="btn-icon btn-sm" onClick={() => setEditingId(null)} title="取消">✕</button>
                  </div>
                ) : (
                  <div key={expense.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {expense.subType === '酒店' && expense.endDate
                          ? `${expense.date} → ${expense.endDate} (${expense.nights}晚)`
                          : expense.date}
                      </span>
                      <span>{expense.description}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {(() => {
                        const nights = expense.nights || 1;
                        const maxAllowed = nights * order.hotelLimit;
                        const amtInLimitCur = convertForCompare(expense.amount, expense.currency, hotelLimitCurrency);
                        const isExcess = g.subType === '酒店' && order.hotelLimit > 0 && amtInLimitCur > maxAllowed;
                        const excessInLimitCur = isExcess ? amtInLimitCur - maxAllowed : 0;
                        // All excess-related amounts displayed in CNY
                        const excessCNY = toCNY(excessInLimitCur, hotelLimitCurrency);
                        const paidCNY = toCNY(expense.amount, expense.currency);
                        const limitCNY = toCNY(maxAllowed, hotelLimitCurrency);
                        const ecs = expenseCurrencySymbol(expense.currency);
                        return (
                          <span style={isExcess ? { color: '#d45d5d', fontWeight: 600 } : undefined}>
                            {ecs}{expense.amount.toFixed(2)}
                            {isExcess && (
                              <span style={{ fontSize: '0.75rem', marginLeft: '4px' }}>(超¥{excessCNY.toFixed(0)}，实付¥{paidCNY.toFixed(0)} / 限额¥{limitCNY.toFixed(0)})</span>
                            )}
                          </span>
                        );
                      })()}
                      <button className="btn-icon btn-sm" onClick={() => startEditExpense(expense)} title="编辑">✏️</button>
                      <button className="btn-icon btn-sm" onClick={() => handleDeleteExpense(expense.id)} title="删除">🗑️</button>
                    </div>
                  </div>
                )
              ))}
            </div>
          ))}

          {order.expenses.length === 0 && (
            <div className="empty-state" style={{ padding: '16px' }}><p>暂无开销记录</p></div>
          )}

          {/* Total */}
          {order.expenses.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
              合计：{hasMixedCurrency
                ? <>{[...currencyTotals.entries()].map(([c, amt], i) => <span key={c}>{i > 0 && ' + '}{expenseCurrencySymbol(c as ExpenseCurrencyType)}{amt.toFixed(2)}</span>)}</>
                : <>{expenseCurrencySymbol([...currencyTotals.keys()][0] as ExpenseCurrencyType || 'CNY')}{order.totalAmount.toFixed(2)}</>
              }
              {(hasMixedCurrency || isSubjectEUR) && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '4px', fontWeight: 400 }}>(≈¥{totalCNY.toFixed(0)})</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── TravelOrderListView (差旅 tab content) ── */
interface TravelOrderListViewProps { subjectId: number; subjectCurrency: SubjectCurrency; exchangeRate: number; onDataChanged: () => void; }

function TravelOrderListView({ subjectId, subjectCurrency, exchangeRate, onDataChanged }: TravelOrderListViewProps) {
  const [orders, setOrders] = useState<TravelOrder[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDestination, setNewDestination] = useState<TravelDestination>('境内');
  const [newCity, setNewCity] = useState('');
  const [newDeparture, setNewDeparture] = useState(() => new Date().toISOString().slice(0, 10));
  const [newReturn, setNewReturn] = useState(() => new Date().toISOString().slice(0, 10));
  const [cityList, setCityList] = useState<CityListData | null>(null);

  const fetchOrders = useCallback(async () => {
    try { const data = await apiClient.ledger.listTravelOrders(subjectId); setOrders(data); }
    catch { /* ignore */ }
  }, [subjectId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (showCreateForm && !cityList) {
      apiClient.ledger.getCityList().then(setCityList).catch(() => {});
    }
  }, [showCreateForm, cityList]);

  const handleCreate = async () => {
    if (!newTitle.trim()) { alert('标题不能为空'); return; }
    if (!newCity.trim()) { alert('请选择目标城市'); return; }
    if (newDeparture > newReturn) { alert('去程日期不能晚于返程日期'); return; }
    try {
      await apiClient.ledger.createTravelOrder(subjectId, { title: newTitle.trim(), destination: newDestination, destinationCity: newCity.trim(), departureDate: newDeparture, returnDate: newReturn });
      setNewTitle(''); setNewCity(''); setShowCreateForm(false); fetchOrders(); onDataChanged();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : '创建失败'); }
  };

  const handleRefresh = () => { fetchOrders(); onDataChanged(); };

  // Calculate annual hotel excess total — separate by currency
  const currentYear = new Date().getFullYear().toString();
  const yearOrders = orders.filter(o => o.departureDate.startsWith(currentYear));
  // hotelExcess is already in CNY from backend
  const annualExcess = yearOrders.reduce((sum, o) => sum + o.hotelExcess, 0);

  return (
    <div>
      {annualExcess > 0 && (
        <div className="card" style={{ marginBottom: '12px', borderLeft: '4px solid #d45d5d' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
            <span>⚠️ {currentYear}年酒店超标总额：</span>
            <span style={{ color: '#d45d5d', fontWeight: 600, fontSize: '1rem' }}>
              ¥{annualExcess.toFixed(2)}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>（超出部分需年底自付）</span>
          </div>
        </div>
      )}
      <div style={{ marginBottom: '12px' }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreateForm(!showCreateForm)}>+ 新建出差单</button>
        {showCreateForm && (
          <div className="card" style={{ marginTop: '8px' }}>
            <div className="card-body" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="input input-sm" style={{ width: '160px' }} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="出差标题" />
              <select className="input input-sm" style={{ width: '80px' }} value={newDestination} onChange={e => { setNewDestination(e.target.value as TravelDestination); setNewCity(''); }}>
                {DESTINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {newDestination === '境内' && cityList ? (
                <select className="input input-sm" style={{ width: '120px' }} value={newCity} onChange={e => setNewCity(e.target.value)}>
                  <option value="">选择城市</option>
                  <optgroup label="一级城市">{cityList.tier1.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                  <optgroup label="二级城市">{cityList.tier2.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                  <optgroup label="三级城市">{cityList.tier3.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                  <optgroup label="四级城市(其他)"><option value="其他">其他</option></optgroup>
                </select>
              ) : (
                <input className="input input-sm" style={{ width: '120px' }} value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="城市名称" />
              )}
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>去程：</label>
              <input type="date" className="input input-sm" value={newDeparture} onChange={e => setNewDeparture(e.target.value)} />
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>返程：</label>
              <input type="date" className="input input-sm" value={newReturn} onChange={e => setNewReturn(e.target.value)} />
              <button className="btn btn-primary btn-sm" onClick={handleCreate}>提交</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateForm(false)}>取消</button>
            </div>
          </div>
        )}
      </div>
      {orders.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px' }}><p>暂无出差单</p></div>
      ) : orders.map(o => <TravelOrderCard key={o.id} order={o} subjectCurrency={subjectCurrency} exchangeRate={exchangeRate} onRefresh={handleRefresh} />)}
    </div>
  );
}

/* ── SimpleExpenseListView (招待/团建 tab content) ── */
interface SimpleExpenseListViewProps { subjectId: number; categoryName: string; subjectCurrency: SubjectCurrency; exchangeRate: number; onDataChanged: () => void; }

function SimpleExpenseListView({ subjectId, categoryName, subjectCurrency, exchangeRate, onDataChanged }: SimpleExpenseListViewProps) {
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addCurrency, setAddCurrency] = useState<ExpenseCurrencyType>(subjectCurrency === 'EUR' ? 'EUR' : 'CNY');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCurrency, setEditCurrency] = useState<ExpenseCurrencyType>('CNY');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchStartDate, setSearchStartDate] = useState('');
  const [searchEndDate, setSearchEndDate] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  const fetchExpenses = useCallback(async (filters?: ExpenseFilters) => {
    try {
      const f: ExpenseFilters = { categoryName, ...filters };
      const data = await apiClient.ledger.listExpenses(subjectId, f);
      setExpenses(data);
    } catch { alert('加载开销记录失败'); }
  }, [subjectId, categoryName]);

  useEffect(() => {
    if (isSearchActive) {
      const f: ExpenseFilters = {};
      if (searchStartDate) f.startDate = searchStartDate;
      if (searchEndDate) f.endDate = searchEndDate;
      if (searchKeyword.trim()) f.keyword = searchKeyword.trim();
      fetchExpenses(f);
    } else { fetchExpenses(); }
  }, [fetchExpenses, isSearchActive, searchStartDate, searchEndDate, searchKeyword]);

  const refreshAll = () => {
    fetchExpenses(isSearchActive ? { startDate: searchStartDate || undefined, endDate: searchEndDate || undefined, keyword: searchKeyword.trim() || undefined } : undefined);
    onDataChanged();
  };

  const handleAdd = async () => {
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) { alert('金额必须为正数'); return; }
    if (!addDesc.trim()) { alert('明细不能为空'); return; }
    if (!addDate) { alert('请选择日期'); return; }
    try {
      const data: CreateExpenseDTO = { categoryName, amount, description: addDesc.trim(), date: addDate, currency: addCurrency };
      await apiClient.ledger.createExpense(subjectId, data);
      setAddAmount(''); setAddDesc(''); setAddDate(new Date().toISOString().slice(0, 10)); setShowAddForm(false); refreshAll();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : '添加失败'); }
  };

  const handleSaveEdit = async () => {
    if (editingId === null) return;
    const amount = parseFloat(editAmount);
    if (!amount || amount <= 0) { alert('金额必须为正数'); return; }
    if (!editDesc.trim()) { alert('明细不能为空'); return; }
    try {
      await apiClient.ledger.updateExpense(editingId, { amount, description: editDesc.trim(), date: editDate, currency: editCurrency });
      setEditingId(null); refreshAll();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : '更新失败'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此开销记录吗？')) return;
    try { await apiClient.ledger.deleteExpense(id); refreshAll(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : '删除失败'); }
  };

  // Group totals by currency
  const expCurrencyTotals = new Map<string, number>();
  for (const e of expenses) { const c = e.currency || 'CNY'; expCurrencyTotals.set(c, (expCurrencyTotals.get(c) || 0) + e.amount); }
  const hasMultipleCurrencies = expCurrencyTotals.size > 1;
  let totalCNY = 0;
  for (const [c, amt] of expCurrencyTotals) {
    if (c === 'CNY') totalCNY += amt;
    else if (c === 'EUR') totalCNY += amt * exchangeRate;
    else totalCNY += amt * exchangeRate;
  }

  return (
    <div>
      {/* Search */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="card-body" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" className="input input-sm" style={{ width: '150px' }} value={searchStartDate} onChange={e => setSearchStartDate(e.target.value)} aria-label="开始日期" />
          <span style={{ color: 'var(--text-secondary)' }}>至</span>
          <input type="date" className="input input-sm" style={{ width: '150px' }} value={searchEndDate} onChange={e => setSearchEndDate(e.target.value)} aria-label="结束日期" />
          <input className="input input-sm" style={{ width: '160px' }} value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} placeholder="关键词搜索" aria-label="关键词" />
          <button className="btn btn-primary btn-sm" onClick={() => setIsSearchActive(true)}>搜索</button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearchStartDate(''); setSearchEndDate(''); setSearchKeyword(''); setIsSearchActive(false); }}>清除</button>
        </div>
      </div>
      {/* Add */}
      <div style={{ marginBottom: '12px' }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>+ 添加开销</button>
        {showAddForm && (
          <div className="card" style={{ marginTop: '8px' }}>
            <div className="card-body" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="badge badge--info">{categoryName}</span>
              <select className="input input-sm" style={{ width: '70px' }} value={addCurrency} onChange={e => setAddCurrency(e.target.value as ExpenseCurrencyType)}>
                {EXPENSE_CURRENCIES.map(c => <option key={c} value={c}>{expenseCurrencySymbol(c)} {c}</option>)}
              </select>
              <input className="input input-sm" style={{ width: '120px' }} type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} placeholder="金额" min="0" step="0.01" />
              <input className="input input-sm" style={{ width: '200px' }} value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="明细" />
              <input type="date" className="input input-sm" style={{ width: '150px' }} value={addDate} onChange={e => setAddDate(e.target.value)} />
              <button className="btn btn-primary btn-sm" onClick={handleAdd}>提交</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddForm(false)}>取消</button>
            </div>
          </div>
        )}
      </div>
      {/* Table */}
      <div className="card">
        <div className="card-body" style={{ overflowX: 'auto' }}>
          {expenses.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}><p>{isSearchActive ? '未找到匹配的记录' : '暂无记录'}</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead><tr style={{ borderBottom: '2px solid rgba(0,0,0,0.08)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>日期</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>明细</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>金额</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>操作</th>
              </tr></thead>
              <tbody>{expenses.map(expense => (
                editingId === expense.id ? (
                  <tr key={expense.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <td style={{ padding: '8px 12px' }}><input type="date" className="input input-sm" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ width: '140px' }} /></td>
                    <td style={{ padding: '8px 12px' }}><input className="input input-sm" value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ width: '180px' }} /></td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <select className="input input-sm" style={{ width: '65px' }} value={editCurrency} onChange={e => setEditCurrency(e.target.value as ExpenseCurrencyType)}>
                          {EXPENSE_CURRENCIES.map(c => <option key={c} value={c}>{expenseCurrencySymbol(c)}</option>)}
                        </select>
                        <input type="number" className="input input-sm" value={editAmount} onChange={e => setEditAmount(e.target.value)} style={{ width: '100px', textAlign: 'right' }} min="0" step="0.01" />
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}><button className="btn-icon btn-sm" onClick={handleSaveEdit} title="保存">✓</button><button className="btn-icon btn-sm" onClick={() => setEditingId(null)} title="取消">✕</button></td>
                  </tr>
                ) : (
                  <tr key={expense.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <td style={{ padding: '8px 12px' }}>{expense.date}</td>
                    <td style={{ padding: '8px 12px' }}>{expense.description}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{expenseCurrencySymbol(expense.currency)}{expense.amount.toFixed(2)}{expense.currency !== 'CNY' && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>(≈¥{(expense.amount * exchangeRate).toFixed(2)})</span>}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <button className="btn-icon btn-sm" onClick={() => { setEditingId(expense.id); setEditAmount(String(expense.amount)); setEditDesc(expense.description); setEditDate(expense.date); setEditCurrency(expense.currency || 'CNY'); }} title="编辑">✏️</button>
                      <button className="btn-icon btn-sm" onClick={() => handleDelete(expense.id)} title="删除">🗑️</button>
                    </td>
                  </tr>
                )
              ))}</tbody>
              <tfoot><tr style={{ borderTop: '2px solid rgba(0,0,0,0.08)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }} colSpan={2}>合计</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                  {[...expCurrencyTotals.entries()].map(([c, amt], i) => <span key={c}>{i > 0 && ' + '}{expenseCurrencySymbol(c as ExpenseCurrencyType)}{amt.toFixed(2)}</span>)}
                  {hasMultipleCurrencies && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>(≈¥{totalCNY.toFixed(2)})</span>}
                </td>
                <td />
              </tr></tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── TravelPolicyModal ── */
interface TravelPolicyModalProps { onClose: () => void; }

function TravelPolicyModal({ onClose }: TravelPolicyModalProps) {
  const [policy, setPolicy] = useState<TravelPolicy | null>(null);
  const [form, setForm] = useState<UpdateTravelPolicyDTO>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.ledger.getTravelPolicy().then(p => {
      setPolicy(p);
      setForm({
        dailyAllowance: p.dailyAllowance,
        hotelTier1BeijingLow: p.hotelTier1BeijingLow,
        hotelTier1BeijingHigh: p.hotelTier1BeijingHigh,
        hotelTier1Other: p.hotelTier1Other,
        hotelTier2Low: p.hotelTier2Low,
        hotelTier2High: p.hotelTier2High,
        hotelTier3: p.hotelTier3,
        hotelTier4: p.hotelTier4,
        overseasHotelTier1: p.overseasHotelTier1,
        overseasHotelTier2: p.overseasHotelTier2,
        overseasHotelTier3: p.overseasHotelTier3,
        overseasHotelTier4: p.overseasHotelTier4,
        overseasHotelTier5: p.overseasHotelTier5,
        overseasHotelTier6: p.overseasHotelTier6,
        overseasHotelTier7: p.overseasHotelTier7,
        overseasAllowanceTier1: p.overseasAllowanceTier1,
        overseasAllowanceTier2: p.overseasAllowanceTier2,
        overseasAllowanceTier3: p.overseasAllowanceTier3,
        overseasAllowanceTier4: p.overseasAllowanceTier4,
        overseasAllowanceTier5: p.overseasAllowanceTier5,
        overseasAllowanceTier6: p.overseasAllowanceTier6,
        overseasAllowanceTier7: p.overseasAllowanceTier7,
      });
    }).catch(() => alert('加载差旅政策失败'));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await apiClient.ledger.updateTravelPolicy(form);
      setPolicy(updated);
      alert('差旅政策已保存');
      onClose();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : '保存失败'); }
    finally { setSaving(false); }
  };

  const setField = (key: keyof UpdateTravelPolicyDTO, val: string) => {
    const num = parseFloat(val);
    setForm(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
  };

  if (!policy) return <div className="loading-overlay"><div className="loading-spinner" /><span>加载中...</span></div>;

  const fieldRow = (label: string, key: keyof UpdateTravelPolicyDTO, suffix = '元/间夜') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <span style={{ fontSize: '0.9rem' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input className="input input-sm" type="number" style={{ width: '100px', textAlign: 'right' }} value={form[key] ?? ''} onChange={e => setField(key, e.target.value)} min="0" step="1" />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{suffix}</span>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div className="card" style={{ width: '520px', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="card-header"><h3 style={{ margin: 0 }}>⚙️ 差旅政策设置</h3><button className="btn-icon btn-sm" onClick={onClose}>✕</button></div>
        <div className="card-body">
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>国内补贴标准</h4>
            {fieldRow('每日补贴', 'dailyAllowance', '元/天')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>一级城市 - 北京</h4>
            {fieldRow('淡季 (1-4月, 10-12月)', 'hotelTier1BeijingLow')}
            {fieldRow('旺季 (5-9月)', 'hotelTier1BeijingHigh')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>一级城市 - 深圳/广州/上海</h4>
            {fieldRow('全年', 'hotelTier1Other')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>二级城市 (省会+直辖市+高消费城市)</h4>
            {fieldRow('淡季', 'hotelTier2Low')}
            {fieldRow('旺季', 'hotelTier2High')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>三级城市 (36个)</h4>
            {fieldRow('全年', 'hotelTier3')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>四级城市 (其他)</h4>
            {fieldRow('全年', 'hotelTier4')}
          </div>

          {/* 海外住宿标准 */}
          <div style={{ borderTop: '2px solid rgba(0,0,0,0.08)', paddingTop: '16px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>🌍 海外住宿标准</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
              注：欧洲国家/地区单位为 <span style={{ fontWeight: 600 }}>€ 欧元</span>，美洲&大洋洲&亚洲&非洲国家/地区单位为 <span style={{ fontWeight: 600 }}>$ 美元</span>
            </p>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>一类 <span style={{ fontSize: '0.8rem' }}>美国(华盛顿/纽约/旧金山/洛杉矶) $、瑞士(日内瓦) €</span></h4>
            {fieldRow('住宿标准', 'overseasHotelTier1', '$/€ /天')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>二类 <span style={{ fontSize: '0.8rem' }}>美国(圣克拉拉/圣何塞) $、英国(伦敦) €、爱尔兰(都柏林) €、瑞士 €、摩纳哥 €</span></h4>
            {fieldRow('住宿标准', 'overseasHotelTier2', '$/€ /天')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>三类 <span style={{ fontSize: '0.8rem' }}>法国 €、美国(其他) $、英国(其他) €、加拿大 $、冰岛 €</span></h4>
            {fieldRow('住宿标准', 'overseasHotelTier3', '$/€ /天')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>四类 <span style={{ fontSize: '0.8rem' }}>荷兰€ 德国€ 比利时€ 挪威€ 日本$ 澳大利亚$ 瑞典€ 西班牙€ 丹麦€ 香港$ 新加坡$ 以色列$ 意大利€ 等</span></h4>
            {fieldRow('住宿标准', 'overseasHotelTier4', '$/€ /天')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>五类 <span style={{ fontSize: '0.8rem' }}>奥地利€ 阿联酋$ 墨西哥$ 韩国$ 葡萄牙€ 芬兰€ 巴西$ 等</span></h4>
            {fieldRow('住宿标准', 'overseasHotelTier5', '$/€ /天')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>六类 <span style={{ fontSize: '0.8rem' }}>波兰€ 匈牙利€ 俄罗斯€ 捷克€ 印度$ 台湾$ 等</span></h4>
            {fieldRow('住宿标准', 'overseasHotelTier6', '$/€ /天')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>七类 <span style={{ fontSize: '0.8rem' }}>印尼$ 泰国$ 马来西亚$ 缅甸$ 老挝$ 土耳其$ 等</span></h4>
            {fieldRow('住宿标准', 'overseasHotelTier7', '$/€ /天')}
          </div>

          {/* 海外补贴标准 */}
          <div style={{ borderTop: '2px solid rgba(0,0,0,0.08)', paddingTop: '16px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>🌍 海外补贴标准</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
              注：欧洲国家/地区单位为 <span style={{ fontWeight: 600 }}>€ 欧元</span>，美洲&大洋洲&亚洲&非洲国家/地区单位为 <span style={{ fontWeight: 600 }}>$ 美元</span>
            </p>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>一类 <span style={{ fontSize: '0.8rem' }}>美国$ 英国€ 挪威€ 瑞典€ 丹麦€ 芬兰€ 爱尔兰€ 瑞士€ 冰岛€</span></h4>
            {fieldRow('补贴标准', 'overseasAllowanceTier1', '$/€ /天')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>二类 <span style={{ fontSize: '0.8rem' }}>奥地利€ 法国€ 荷兰€ 德国€ 阿联酋$ 比利时€ 澳大利亚$ 以色列$ 意大利€ 卢森堡€</span></h4>
            {fieldRow('补贴标准', 'overseasAllowanceTier2', '$/€ /天')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>三类 <span style={{ fontSize: '0.8rem' }}>日本$ 西班牙€ 香港$ 新加坡$ 葡萄牙€ 巴西$ 新西兰$ 加拿大$ 等</span></h4>
            {fieldRow('补贴标准', 'overseasAllowanceTier3', '$/€ /天')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>四类 <span style={{ fontSize: '0.8rem' }}>墨西哥$ 韩国$ 俄罗斯€ 黎巴嫩$ 澳门$ 塞尔维亚€ 等</span></h4>
            {fieldRow('补贴标准', 'overseasAllowanceTier4', '$/€ /天')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>五类 <span style={{ fontSize: '0.8rem' }}>沙特$ 波兰€ 匈牙利€ 埃及$ 捷克€ 台湾$ 等</span></h4>
            {fieldRow('补贴标准', 'overseasAllowanceTier5', '$/€ /天')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>六类 <span style={{ fontSize: '0.8rem' }}>印尼$ 泰国$ 马来西亚$ 印度$</span></h4>
            {fieldRow('补贴标准', 'overseasAllowanceTier6', '$/€ /天')}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>七类 <span style={{ fontSize: '0.8rem' }}>尼泊尔$ 阿塞拜疆$ 格鲁吉亚$ 老挝$ 缅甸$ 土耳其$ 亚美尼亚$</span></h4>
            {fieldRow('补贴标准', 'overseasAllowanceTier7', '$/€ /天')}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px' }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>取消</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── SubTypeSummaryView (差旅子类型汇总) ── */
interface SubTypeSummaryViewProps { subjectId: number; subType: TravelExpenseSubType; subjectCurrency: SubjectCurrency; exchangeRate: number; }

function SubTypeSummaryView({ subjectId, subType, exchangeRate }: SubTypeSummaryViewProps) {
  const [orders, setOrders] = useState<TravelOrder[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    apiClient.ledger.listTravelOrders(subjectId).then(setOrders).catch(() => {});
  }, [subjectId]);

  // Flatten all expenses of this subType from all orders, with order title
  const items = orders.flatMap(o =>
    o.expenses
      .filter(e => e.subType === subType)
      .map(e => ({ ...e, orderTitle: o.title, departureDate: o.departureDate, returnDate: o.returnDate }))
  ).filter(e => {
    if (startDate && e.date < startDate) return false;
    if (endDate && e.date > endDate) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  // Group by currency
  const stCurrencyTotals = new Map<string, number>();
  for (const e of items) { const c = e.currency || 'CNY'; stCurrencyTotals.set(c, (stCurrencyTotals.get(c) || 0) + e.amount); }
  const stHasMultiple = stCurrencyTotals.size > 1;
  let stTotalCNY = 0;
  for (const [c, amt] of stCurrencyTotals) {
    if (c === 'CNY') stTotalCNY += amt;
    else stTotalCNY += amt * exchangeRate;
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="card-body" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" className="input input-sm" style={{ width: '150px' }} value={startDate} onChange={e => setStartDate(e.target.value)} aria-label="开始日期" />
          <span style={{ color: 'var(--text-secondary)' }}>至</span>
          <input type="date" className="input input-sm" style={{ width: '150px' }} value={endDate} onChange={e => setEndDate(e.target.value)} aria-label="结束日期" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>共 {items.length} 条，合计：</span>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>
            {[...stCurrencyTotals.entries()].map(([c, amt], i) => <span key={c}>{i > 0 && ' + '}{expenseCurrencySymbol(c as ExpenseCurrencyType)}{amt.toFixed(2)}</span>)}
            {stHasMultiple && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>(≈¥{stTotalCNY.toFixed(0)})</span>}
          </span>
        </div>
      </div>
      <div className="card">
        <div className="card-body" style={{ overflowX: 'auto' }}>
          {items.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}><p>暂无{subType}记录</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead><tr style={{ borderBottom: '2px solid rgba(0,0,0,0.08)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>日期</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>出差单</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>明细</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>金额</th>
              </tr></thead>
              <tbody>{items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    {subType === '酒店' && item.endDate
                      ? `${item.date} → ${item.endDate} (${item.nights}晚)`
                      : item.date}
                  </td>
                  <td style={{ padding: '8px 12px' }}>{item.orderTitle}</td>
                  <td style={{ padding: '8px 12px' }}>{item.description}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{expenseCurrencySymbol(item.currency)}{item.amount.toFixed(2)}</td>
                </tr>
              ))}</tbody>
              <tfoot><tr style={{ borderTop: '2px solid rgba(0,0,0,0.08)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }} colSpan={3}>合计</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                  {[...stCurrencyTotals.entries()].map(([c, amt], i) => <span key={c}>{i > 0 && ' + '}{expenseCurrencySymbol(c as ExpenseCurrencyType)}{amt.toFixed(2)}</span>)}
                </td>
              </tr></tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── AllowanceSummaryView (补贴汇总 with 已发/未发) ── */
interface AllowanceSummaryViewProps { subjectId: number; subjectCurrency: SubjectCurrency; exchangeRate: number; }

function AllowanceSummaryView({ subjectId }: AllowanceSummaryViewProps) {
  const [orders, setOrders] = useState<TravelOrder[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchOrders = useCallback(async () => {
    try { const data = await apiClient.ledger.listTravelOrders(subjectId); setOrders(data); }
    catch { /* ignore */ }
  }, [subjectId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const items = orders.flatMap(o =>
    o.expenses
      .filter(e => e.subType === '补贴')
      .map(e => ({ ...e, orderTitle: o.title, destination: o.destination, orderCurrency: o.currency }))
  ).filter(e => {
    if (startDate && e.date < startDate) return false;
    if (endDate && e.date > endDate) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  // Per-item currency: use expense.currency directly
  const itemCurrencySymbol = (item: { currency: ExpenseCurrencyType }) =>
    expenseCurrencySymbol(item.currency);

  // Separate domestic (¥) and overseas allowances for stats
  const domesticItems = items.filter(i => i.destination === '境内');
  const overseasItems = items.filter(i => i.destination === '境外');
  const domesticTotal = domesticItems.reduce((s, e) => s + e.amount, 0);
  const domesticPaid = domesticItems.filter(e => e.paid).reduce((s, e) => s + e.amount, 0);
  const domesticUnpaid = domesticItems.filter(e => !e.paid).reduce((s, e) => s + e.amount, 0);
  const overseasTotal = overseasItems.reduce((s, e) => s + e.amount, 0);
  const overseasPaid = overseasItems.filter(e => e.paid).reduce((s, e) => s + e.amount, 0);
  const overseasUnpaid = overseasItems.filter(e => !e.paid).reduce((s, e) => s + e.amount, 0);
  // Determine overseas currency symbol (may be mixed $/€ but usually one per subject)
  const overseasCurrencies = [...new Set(overseasItems.map(i => i.orderCurrency))];
  const oCS = overseasCurrencies.length === 1 ? currencySymbol(overseasCurrencies[0]) : '$';
  const hasOverseas = overseasItems.length > 0;
  const hasDomestic = domesticItems.length > 0;

  const handleTogglePaid = async (expenseId: number, currentPaid: boolean) => {
    try {
      await apiClient.ledger.updateTravelExpense(expenseId, { paid: !currentPaid });
      fetchOrders();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : '更新失败'); }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="card-body" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" className="input input-sm" style={{ width: '150px' }} value={startDate} onChange={e => setStartDate(e.target.value)} aria-label="开始日期" />
          <span style={{ color: 'var(--text-secondary)' }}>至</span>
          <input type="date" className="input input-sm" style={{ width: '150px' }} value={endDate} onChange={e => setEndDate(e.target.value)} aria-label="结束日期" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>共 {items.length} 条</span>
        </div>
      </div>
      {/* Stats cards */}
      {hasDomestic && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div className="card" style={{ flex: 1, minWidth: '140px' }}>
            <div className="card-body" style={{ textAlign: 'center', padding: '12px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>境内补贴总额</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>¥{domesticTotal.toFixed(2)}</div>
            </div>
          </div>
          <div className="card" style={{ flex: 1, minWidth: '140px' }}>
            <div className="card-body" style={{ textAlign: 'center', padding: '12px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>已发</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#5a9e6f' }}>¥{domesticPaid.toFixed(2)}</div>
            </div>
          </div>
          <div className="card" style={{ flex: 1, minWidth: '140px' }}>
            <div className="card-body" style={{ textAlign: 'center', padding: '12px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>未发</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#d4a45d' }}>¥{domesticUnpaid.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
      {hasOverseas && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div className="card" style={{ flex: 1, minWidth: '140px' }}>
            <div className="card-body" style={{ textAlign: 'center', padding: '12px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>海外补贴总额</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{oCS}{overseasTotal.toFixed(2)}</div>
            </div>
          </div>
          <div className="card" style={{ flex: 1, minWidth: '140px' }}>
            <div className="card-body" style={{ textAlign: 'center', padding: '12px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>已发</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#5a9e6f' }}>{oCS}{overseasPaid.toFixed(2)}</div>
            </div>
          </div>
          <div className="card" style={{ flex: 1, minWidth: '140px' }}>
            <div className="card-body" style={{ textAlign: 'center', padding: '12px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>未发</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#d4a45d' }}>{oCS}{overseasUnpaid.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
      {/* Table */}
      <div className="card">
        <div className="card-body" style={{ overflowX: 'auto' }}>
          {items.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}><p>暂无补贴记录</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead><tr style={{ borderBottom: '2px solid rgba(0,0,0,0.08)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>日期</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>出差单</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>明细</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>金额</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>状态</th>
              </tr></thead>
              <tbody>{items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <td style={{ padding: '8px 12px' }}>{item.date}</td>
                  <td style={{ padding: '8px 12px' }}>{item.orderTitle}</td>
                  <td style={{ padding: '8px 12px' }}>{item.description}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{itemCurrencySymbol(item)}{item.amount.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <button
                      className={`btn btn-sm ${item.paid ? 'btn-primary' : 'btn-secondary'}`}
                      style={item.paid ? { background: '#5a9e6f', borderColor: '#5a9e6f', fontSize: '0.8rem', padding: '2px 10px' } : { color: '#d4a45d', borderColor: '#d4a45d', fontSize: '0.8rem', padding: '2px 10px' }}
                      onClick={() => handleTogglePaid(item.id, item.paid)}
                    >
                      {item.paid ? '已发' : '未发'}
                    </button>
                  </td>
                </tr>
              ))}</tbody>
              <tfoot><tr style={{ borderTop: '2px solid rgba(0,0,0,0.08)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }} colSpan={3}>合计</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                  {hasDomestic && <>¥{domesticTotal.toFixed(2)}</>}
                  {hasDomestic && hasOverseas && ' + '}
                  {hasOverseas && <>{oCS}{overseasTotal.toFixed(2)}</>}
                </td>
                <td />
              </tr></tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── ExcessSummaryView (酒店超额汇总) ── */
interface ExcessSummaryViewProps { subjectId: number; subjectCurrency: SubjectCurrency; exchangeRate: number; }

function ExcessSummaryView({ subjectId, exchangeRate }: ExcessSummaryViewProps) {
  const [orders, setOrders] = useState<TravelOrder[]>([]);

  useEffect(() => {
    apiClient.ledger.listTravelOrders(subjectId).then(setOrders).catch(() => {});
  }, [subjectId]);

  const currentYear = new Date().getFullYear().toString();

  // Orders with hotel excess in current year
  const excessOrders = orders
    .filter(o => o.departureDate.startsWith(currentYear) && o.hotelExcess > 0)
    .sort((a, b) => b.departureDate.localeCompare(a.departureDate));

  // hotelExcess is already in CNY from backend — no need to separate by destination
  const totalExcess = excessOrders.reduce((sum, o) => sum + o.hotelExcess, 0);

  // Also collect individual hotel expenses that are over limit (currency-aware)
  const toCNY = (amt: number, cur: string) => cur === 'CNY' ? amt : amt * exchangeRate;
  const fromCNY = (amt: number, cur: string) => cur === 'CNY' ? amt : amt / exchangeRate;
  const convertCur = (amt: number, from: string, to: string) => {
    if (from === to) return amt;
    return fromCNY(toCNY(amt, from), to);
  };

  const excessDetails = excessOrders.flatMap(o => {
    const limitCur = o.destination === '境内' ? 'CNY' : o.currency;
    return o.expenses
      .filter(e => e.subType === '酒店')
      .map(e => {
        const nights = e.nights || 1;
        const maxAllowed = nights * o.hotelLimit;
        const amtInLimitCur = convertCur(e.amount, e.currency, limitCur);
        const excess = Math.max(0, amtInLimitCur - maxAllowed);
        return { ...e, orderTitle: o.title, destinationCity: o.destinationCity, destination: o.destination, hotelLimit: o.hotelLimit, expenseCurrency: e.currency, orderCurrency: o.currency, limitCurrency: limitCur, maxAllowed, excess };
      })
      .filter(e => e.excess > 0);
  });

  return (
    <div>
      {/* Annual total card */}
      <div className="card" style={{ marginBottom: '12px', borderLeft: '4px solid #d45d5d' }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.95rem' }}>⚠️ {currentYear}年酒店超标总额：</span>
          <span style={{ color: '#d45d5d', fontWeight: 600, fontSize: '1.2rem' }}>
            ¥{totalExcess.toFixed(2)}
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>（超出部分需年底自付）</span>
        </div>
      </div>

      {/* Per-order breakdown */}
      {excessOrders.length === 0 ? (
        <div className="card"><div className="card-body"><div className="empty-state" style={{ padding: '24px' }}><p>🎉 {currentYear}年暂无酒店超标记录</p></div></div></div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead><tr style={{ borderBottom: '2px solid rgba(0,0,0,0.08)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>出差单</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>目的地</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>日期</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>标准(元/晚)</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 500 }}>超标金额</th>
              </tr></thead>
              <tbody>
                {excessDetails.map(item => {
                  // Convert all excess-related amounts to CNY for display
                  const excessCNY = toCNY(item.excess, item.limitCurrency);
                  const paidCNY = toCNY(item.amount, item.expenseCurrency);
                  const limitCNY = toCNY(item.maxAllowed, item.limitCurrency);
                  return (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <td style={{ padding: '8px 12px' }}>{item.orderTitle}</td>
                    <td style={{ padding: '8px 12px' }}>{item.destinationCity}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {item.endDate ? `${item.date} → ${item.endDate} (${item.nights}晚)` : item.date}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>¥{toCNY(item.hotelLimit, item.limitCurrency).toFixed(0)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#d45d5d', fontWeight: 600 }}>
                      ¥{excessCNY.toFixed(2)}
                      <span style={{ fontSize: '0.75rem', fontWeight: 400, marginLeft: '4px' }}>
                        (实付¥{paidCNY.toFixed(0)} / 限额¥{limitCNY.toFixed(0)})
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot><tr style={{ borderTop: '2px solid rgba(0,0,0,0.08)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }} colSpan={4}>年度超标合计</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#d45d5d' }}>
                  ¥{totalExcess.toFixed(2)}
                </td>
              </tr></tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SubjectDetailView ── */
interface SubjectDetailViewProps { subject: ManagementSubjectWithSummary; onBack: () => void; onSubjectsChanged: () => void; }

function SubjectDetailView({ subject, onBack, onSubjectsChanged }: SubjectDetailViewProps) {
  const [activeTab, setActiveTab] = useState<CategoryTab>('差旅');
  const [categories, setCategories] = useState<ExpenseCategoryWithSummary[]>([]);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [travelSubTab, setTravelSubTab] = useState<'出差单' | TravelExpenseSubType | '超额'>('出差单');

  const fetchCategories = useCallback(async () => {
    try { const data = await apiClient.ledger.listCategories(subject.id); setCategories(data); }
    catch { /* ignore */ }
  }, [subject.id]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const refreshAll = () => { fetchCategories(); onSubjectsChanged(); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>← 返回</button>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0 }}>{subject.name} {subject.currency === 'EUR' && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 400 }}>💶 EUR (1€≈¥{subject.exchangeRate})</span>}</h2>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowPolicyModal(true)} style={{ marginLeft: 'auto' }}>⚙️ 差旅政策</button>
      </div>

      {showPolicyModal && <TravelPolicyModal onClose={() => setShowPolicyModal(false)} />}

      {/* Per-category budget cards */}
      <div style={{ marginBottom: '16px' }}>
        {categories.map(cat => <CategoryBudgetCard key={cat.id} category={cat} subjectCurrency={subject.currency} onBudgetSaved={refreshAll} />)}
      </div>

      {/* Category tabs */}
      <div className="category-filter" style={{ marginBottom: '16px' }}>
        {CATEGORY_TABS.map(tab => (
          <button key={tab} className={`category-filter__btn${activeTab === tab ? ' category-filter__btn--active' : ''}`} onClick={() => { setActiveTab(tab); if (tab === '差旅') setTravelSubTab('出差单'); }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === '差旅' ? (
        <div>
          {/* Sub-tabs for 差旅 */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {(['出差单', '酒店', '机票', '其他', '补贴', '超额'] as const).map(st => (
              <button key={st} className={`btn btn-sm ${travelSubTab === st ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTravelSubTab(st)}
                style={st === '超额' ? { borderColor: '#d45d5d', color: travelSubTab === st ? '#fff' : '#d45d5d', background: travelSubTab === st ? '#d45d5d' : 'transparent' } : undefined}>
                {st}
              </button>
            ))}
          </div>
          {travelSubTab === '出差单' ? (
            <TravelOrderListView subjectId={subject.id} subjectCurrency={subject.currency} exchangeRate={subject.exchangeRate} onDataChanged={refreshAll} />
          ) : travelSubTab === '超额' ? (
            <ExcessSummaryView subjectId={subject.id} subjectCurrency={subject.currency} exchangeRate={subject.exchangeRate} />
          ) : travelSubTab === '补贴' ? (
            <AllowanceSummaryView subjectId={subject.id} subjectCurrency={subject.currency} exchangeRate={subject.exchangeRate} />
          ) : (
            <SubTypeSummaryView subjectId={subject.id} subType={travelSubTab} subjectCurrency={subject.currency} exchangeRate={subject.exchangeRate} />
          )}
        </div>
      ) : (
        <SimpleExpenseListView subjectId={subject.id} categoryName={activeTab} subjectCurrency={subject.currency} exchangeRate={subject.exchangeRate} onDataChanged={refreshAll} />
      )}
    </div>
  );
}

/* ── Main LedgerPage ── */
function LedgerPage() {
  const [subjects, setSubjects] = useState<ManagementSubjectWithSummary[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<ManagementSubjectWithSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubjects = useCallback(async () => {
    try {
      const data = await apiClient.ledger.listSubjects();
      setSubjects(data);
      if (selectedSubject) {
        const updated = data.find(s => s.id === selectedSubject.id);
        if (updated) setSelectedSubject(updated); else setSelectedSubject(null);
      }
    } catch { alert('加载台账数据失败'); }
    finally { setLoading(false); }
  }, [selectedSubject]);

  useEffect(() => { fetchSubjects(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (loading) return (
    <div className="okr-page"><div className="loading-overlay"><div className="loading-spinner loading-spinner--lg" /><span>加载中...</span></div></div>
  );

  if (selectedSubject) return (
    <div className="okr-page"><SubjectDetailView subject={selectedSubject} onBack={() => setSelectedSubject(null)} onSubjectsChanged={fetchSubjects} /></div>
  );

  return (
    <div className="okr-page"><SubjectListView subjects={subjects} onSelect={setSelectedSubject} onRefresh={fetchSubjects} /></div>
  );
}

export default LedgerPage;
