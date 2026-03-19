import { getDb } from '../db';
import { ValidationError } from '../errors';
import type { TravelPolicy, UpdateTravelPolicyDTO } from '../types';

// ============================================================
// City Tier Lookup (国内)
// ============================================================

const TIER1_BEIJING = ['北京'];
const TIER1_OTHER = ['深圳', '广州', '上海'];
const TIER2 = [
  '武汉', '重庆', '合肥', '天津', '杭州', '南京', '成都', '西安', '哈尔滨',
  '石家庄', '长沙', '郑州', '长春', '南宁', '南昌', '福州', '济南', '海口',
  '贵阳', '乌鲁木齐', '沈阳', '太原', '兰州', '呼和浩特', '西宁', '银川',
  '苏州', '无锡', '厦门', '金华', '泉州',
];
const TIER3 = [
  '东莞', '佛山', '惠州', '茂名', '梅州', '珠海', '湛江', '宁波', '温州',
  '绍兴', '嘉兴', '台州', '常州', '连云港', '南通', '扬州', '青岛', '潍坊',
  '烟台', '保定', '沧州', '邯郸', '洛阳', '新乡', '襄阳', '宜昌', '绵阳',
  '松潘县', '毕节', '遵义', '宁德', '漯河', '大连', '祁连县', '三亚', '唐山',
];

export type CityTier = 'tier1_beijing' | 'tier1_other' | 'tier2' | 'tier3' | 'tier4';

export function getCityTier(city: string): CityTier {
  if (TIER1_BEIJING.includes(city)) return 'tier1_beijing';
  if (TIER1_OTHER.includes(city)) return 'tier1_other';
  if (TIER2.includes(city)) return 'tier2';
  if (TIER3.includes(city)) return 'tier3';
  return 'tier4';
}

/** 5-9月为旺季 */
function isPeakSeason(date: string): boolean {
  const month = new Date(date).getMonth() + 1;
  return month >= 5 && month <= 9;
}

// ============================================================
// Overseas City Tier Lookup (海外)
// ============================================================

// 住宿标准分类
const OVERSEAS_HOTEL_TIER1 = ['华盛顿', '纽约', '旧金山', '洛杉矶', '日内瓦'];
const OVERSEAS_HOTEL_TIER2 = ['圣克拉拉', '圣何塞', '伦敦', '都柏林', '瑞士', '摩纳哥'];
const OVERSEAS_HOTEL_TIER3 = ['法国', '美国', '英国', '多伦多', '温哥华', '冰岛', '雷克雅未克'];
const OVERSEAS_HOTEL_TIER4 = [
  '荷兰', '德国', '比利时', '挪威', '日本', '澳大利亚', '瑞典', '西班牙', '丹麦',
  '中国香港', '新加坡', '以色列', '意大利', '沙特阿拉伯', '新西兰', '爱尔兰',
  '加拿大', '冰岛', '卢森堡',
];
const OVERSEAS_HOTEL_TIER5 = [
  '奥地利', '阿联酋', '墨西哥', '韩国', '葡萄牙', '科威特', '卡塔尔', '巴西',
  '摩洛哥', '芬兰', '埃及', '哥斯达黎加', '伊朗', '伊拉克', '中国澳门',
];
const OVERSEAS_HOTEL_TIER6 = [
  '波兰', '匈牙利', '俄罗斯', '突尼斯', '斯洛伐克', '斯洛文尼亚', '毛里求斯',
  '阿塞拜疆', '格鲁吉亚', '阿曼', '捷克', '约旦', '克罗地亚', '黎巴嫩', '巴林',
  '罗马尼亚', '乌拉圭', '马达加斯加', '白俄罗斯', '立陶宛', '爱沙尼亚',
  '保加利亚', '拉脱维亚', '塞尔维亚', '印度', '中国台湾',
];
const OVERSEAS_HOTEL_TIER7 = [
  '印度尼西亚', '泰国', '马来西亚', '尼泊尔', '缅甸', '老挝', '土耳其', '亚美尼亚',
];

// 补贴标准分类
const OVERSEAS_ALLOWANCE_TIER1 = ['美国', '英国', '挪威', '瑞典', '丹麦', '芬兰', '爱尔兰', '瑞士', '冰岛'];
const OVERSEAS_ALLOWANCE_TIER2 = [
  '奥地利', '法国', '荷兰', '德国', '阿联酋', '比利时', '澳大利亚', '以色列',
  '意大利', '卢森堡',
];
const OVERSEAS_ALLOWANCE_TIER3 = [
  '日本', '西班牙', '中国香港', '新加坡', '葡萄牙', '卡塔尔', '巴西', '新西兰',
  '哥斯达黎加', '加拿大', '巴哈马', '智利', '多米尼加', '希腊',
];
const OVERSEAS_ALLOWANCE_TIER4 = [
  '墨西哥', '韩国', '俄罗斯', '黎巴嫩', '伊朗', '伊拉克', '乌拉圭', '中国澳门',
  '塞尔维亚',
];
const OVERSEAS_ALLOWANCE_TIER5 = [
  '沙特阿拉伯', '科威特', '摩洛哥', '波兰', '匈牙利', '埃及', '突尼斯', '毛里求斯',
  '阿曼', '捷克', '克罗地亚', '约旦', '罗马尼亚', '巴林', '马达加斯加', '立陶宛',
  '爱沙尼亚', '拉脱维亚', '中国台湾', '塞浦路斯',
];
const OVERSEAS_ALLOWANCE_TIER6 = [
  '印度尼西亚', '泰国', '马来西亚', '印度',
];
const OVERSEAS_ALLOWANCE_TIER7 = [
  '尼泊尔', '阿塞拜疆', '格鲁吉亚', '老挝', '缅甸', '土耳其', '亚美尼亚',
];

export type OverseasHotelTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type OverseasAllowanceTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type OverseasCurrency = 'EUR' | 'USD';

// ============================================================
// 城市 → 国家映射（用于补贴和货币识别）
// ============================================================
const CITY_TO_COUNTRY: ReadonlyMap<string, string> = new Map([
  // 美国城市
  ['华盛顿', '美国'], ['纽约', '美国'], ['旧金山', '美国'], ['洛杉矶', '美国'],
  ['圣克拉拉', '美国'], ['圣何塞', '美国'],
  // 瑞士城市
  ['日内瓦', '瑞士'],
  // 英国城市
  ['伦敦', '英国'],
  // 爱尔兰城市
  ['都柏林', '爱尔兰'],
  // 加拿大城市
  ['多伦多', '加拿大'], ['温哥华', '加拿大'],
  // 冰岛城市
  ['雷克雅未克', '冰岛'],
]);

/**
 * 将城市名解析为国家名。如果输入本身就是国家名或无法识别，则原样返回。
 * 支持精确匹配和包含匹配（如"美国旧金山"→"美国"）。
 */
function resolveCountry(cityOrCountry: string): string {
  // 精确匹配
  const exact = CITY_TO_COUNTRY.get(cityOrCountry);
  if (exact) return exact;
  // 包含匹配：检查输入是否包含某个已知城市名
  for (const [city, country] of CITY_TO_COUNTRY) {
    if (cityOrCountry.includes(city)) return country;
  }
  // 可能本身就是国家名，原样返回
  return cityOrCountry;
}

// 欧洲/欧元区国家 → 欧元，其他 → 美元
const EURO_ZONE = [
  '法国', '德国', '荷兰', '比利时', '奥地利', '意大利', '西班牙', '葡萄牙',
  '芬兰', '爱尔兰', '卢森堡', '希腊', '斯洛伐克', '斯洛文尼亚', '爱沙尼亚',
  '拉脱维亚', '立陶宛', '克罗地亚', '塞浦路斯', '摩纳哥', '瑞士', '日内瓦',
  '挪威', '瑞典', '丹麦', '冰岛', '雷克雅未克', '波兰', '匈牙利', '捷克',
  '罗马尼亚', '保加利亚', '塞尔维亚', '白俄罗斯', '俄罗斯', '乌克兰',
  '伦敦', '都柏林', '英国', '圣克拉拉', '圣何塞',
  // 注：圣克拉拉/圣何塞 在美国，但按图片分类在二类（含欧洲城市），实际应为美元
];

// 更精确的判断：只有真正的欧洲国家/地区才用欧元
const EUROPE_COUNTRIES = [
  '法国', '德国', '荷兰', '比利时', '奥地利', '意大利', '西班牙', '葡萄牙',
  '芬兰', '爱尔兰', '卢森堡', '希腊', '斯洛伐克', '斯洛文尼亚', '爱沙尼亚',
  '拉脱维亚', '立陶宛', '克罗地亚', '塞浦路斯', '摩纳哥', '瑞士', '日内瓦',
  '挪威', '瑞典', '丹麦', '冰岛', '雷克雅未克', '波兰', '匈牙利', '捷克',
  '罗马尼亚', '保加利亚', '塞尔维亚', '白俄罗斯', '俄罗斯',
  '英国', '伦敦', '都柏林', '阿尔巴尼亚', '马耳他',
  '斯洛文尼亚', '黑山', '北马其顿', '摩尔多瓦',
];

export function getOverseasCurrency(city: string): OverseasCurrency {
  const country = resolveCountry(city);
  if (EUROPE_COUNTRIES.some(c => country.includes(c) || city.includes(c))) return 'EUR';
  return 'USD';
}

export function getOverseasHotelTier(city: string): OverseasHotelTier {
  if (OVERSEAS_HOTEL_TIER1.some(c => city.includes(c))) return 1;
  if (OVERSEAS_HOTEL_TIER2.some(c => city.includes(c))) return 2;
  if (OVERSEAS_HOTEL_TIER3.some(c => city.includes(c))) return 3;
  if (OVERSEAS_HOTEL_TIER4.some(c => city.includes(c))) return 4;
  if (OVERSEAS_HOTEL_TIER5.some(c => city.includes(c))) return 5;
  if (OVERSEAS_HOTEL_TIER6.some(c => city.includes(c))) return 6;
  return 7;
}

export function getOverseasAllowanceTier(city: string): OverseasAllowanceTier {
  const country = resolveCountry(city);
  // 先用国家名匹配，再用原始城市名匹配（兼容直接输入国家名的情况）
  const match = (list: string[]) => list.some(c => country.includes(c) || city.includes(c));
  if (match(OVERSEAS_ALLOWANCE_TIER1)) return 1;
  if (match(OVERSEAS_ALLOWANCE_TIER2)) return 2;
  if (match(OVERSEAS_ALLOWANCE_TIER3)) return 3;
  if (match(OVERSEAS_ALLOWANCE_TIER4)) return 4;
  if (match(OVERSEAS_ALLOWANCE_TIER5)) return 5;
  if (match(OVERSEAS_ALLOWANCE_TIER6)) return 6;
  return 7;
}

// ============================================================
// Policy CRUD
// ============================================================

export function getPolicy(userId: number): TravelPolicy {
  const db = getDb();
  let policy = db.prepare('SELECT * FROM travel_policy WHERE userId = ?').get(userId) as TravelPolicy | undefined;
  if (!policy) {
    db.prepare('INSERT INTO travel_policy (userId) VALUES (?)').run(userId);
    policy = db.prepare('SELECT * FROM travel_policy WHERE userId = ?').get(userId) as TravelPolicy;
  }
  return policy;
}

export function updatePolicy(userId: number, data: UpdateTravelPolicyDTO): TravelPolicy {
  const db = getDb();
  // Ensure policy exists
  getPolicy(userId);

  const fields = [
    'dailyAllowance', 'hotelTier1BeijingLow', 'hotelTier1BeijingHigh',
    'hotelTier1Other', 'hotelTier2Low', 'hotelTier2High', 'hotelTier3', 'hotelTier4',
    'overseasHotelTier1', 'overseasHotelTier2', 'overseasHotelTier3', 'overseasHotelTier4',
    'overseasHotelTier5', 'overseasHotelTier6', 'overseasHotelTier7',
    'overseasAllowanceTier1', 'overseasAllowanceTier2', 'overseasAllowanceTier3',
    'overseasAllowanceTier4', 'overseasAllowanceTier5', 'overseasAllowanceTier6',
    'overseasAllowanceTier7',
  ] as const;

  const updates: string[] = [];
  const params: any[] = [];

  for (const f of fields) {
    if (data[f] !== undefined) {
      if (typeof data[f] !== 'number' || data[f]! < 0) throw new ValidationError(`${f} 必须为非负数`);
      updates.push(`${f} = ?`);
      params.push(data[f]);
    }
  }

  if (updates.length > 0) {
    updates.push("updatedAt = datetime('now')");
    params.push(userId);
    db.prepare(`UPDATE travel_policy SET ${updates.join(', ')} WHERE userId = ?`).run(...params);
  }

  return getPolicy(userId);
}

// ============================================================
// Hotel Standard Lookup
// ============================================================

export function getHotelStandard(userId: number, city: string, date: string, destination: string = '境内'): number {
  const policy = getPolicy(userId);

  if (destination === '境外') {
    const tier = getOverseasHotelTier(city);
    const tierKey = `overseasHotelTier${tier}` as keyof TravelPolicy;
    return policy[tierKey] as number;
  }

  const tier = getCityTier(city);
  const peak = isPeakSeason(date);

  switch (tier) {
    case 'tier1_beijing': return peak ? policy.hotelTier1BeijingHigh : policy.hotelTier1BeijingLow;
    case 'tier1_other': return policy.hotelTier1Other;
    case 'tier2': return peak ? policy.hotelTier2High : policy.hotelTier2Low;
    case 'tier3': return policy.hotelTier3;
    case 'tier4': return policy.hotelTier4;
  }
}

// ============================================================
// Auto-allowance calculation
// ============================================================

export function calculateAllowance(userId: number, departureDate: string, returnDate: string, destination: string = '境内', destinationCity: string = ''): { days: number; amount: number; dailyRate: number } {
  const policy = getPolicy(userId);
  const dep = new Date(departureDate);
  const ret = new Date(returnDate);
  const days = Math.round((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  let dailyRate: number;
  if (destination === '境外' && destinationCity) {
    const tier = getOverseasAllowanceTier(destinationCity);
    const tierKey = `overseasAllowanceTier${tier}` as keyof TravelPolicy;
    dailyRate = policy[tierKey] as number;
  } else {
    dailyRate = policy.dailyAllowance;
  }

  return { days, amount: days * dailyRate, dailyRate };
}

// ============================================================
// City lists for frontend
// ============================================================

export interface CityListData {
  tier1: string[];
  tier2: string[];
  tier3: string[];
}

export function getCityLists(): CityListData {
  return {
    tier1: [...TIER1_BEIJING, ...TIER1_OTHER],
    tier2: [...TIER2],
    tier3: [...TIER3],
  };
}
