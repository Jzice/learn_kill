// 本文件由 scripts/extract-bank.mjs 生成，请勿手改
import type { Question } from '../../core/types';

/** 内置题库年级清单（含题数，供大厅渲染，无需加载题目本身） */
export interface GradeBankMeta {
  grade: string;
  count: number;
}

export const GRADE_BANK_META: GradeBankMeta[] = [
  { grade: '初一上', count: 18 },
  { grade: '初一下', count: 18 },
  { grade: '初二上', count: 18 },
  { grade: '初二下', count: 18 },
  { grade: '初三上', count: 18 },
  { grade: '初三下', count: 18 },
  { grade: '高一上', count: 18 },
  { grade: '高一下', count: 18 },
  { grade: '高二上', count: 18 },
  { grade: '高二下', count: 18 },
  { grade: '高三上', count: 18 },
  { grade: '高三下', count: 18 },
];

/**
 * 年级 → 动态加载器。使用静态可分析的 import() 映射，
 * 使打包器能按年级代码分割；运行时仅在需要该年级题目时才真正加载解析。
 */
export const GRADE_LOADERS: Record<string, () => Promise<{ default: Question[] }>> = {
  '初一上': () => import('./g01'),
  '初一下': () => import('./g02'),
  '初二上': () => import('./g03'),
  '初二下': () => import('./g04'),
  '初三上': () => import('./g05'),
  '初三下': () => import('./g06'),
  '高一上': () => import('./g07'),
  '高一下': () => import('./g08'),
  '高二上': () => import('./g09'),
  '高二下': () => import('./g10'),
  '高三上': () => import('./g11'),
  '高三下': () => import('./g12'),
};
