import type { JSDOM } from 'jsdom';

export interface CaseResult {
  svg: string;
  engine: { fn: 'compose' | 'alphabet'; args: unknown[]; output: unknown } | null;
  render: { fn: 'renderSquare' | 'renderCircle' | 'renderGrid'; opt: Record<string, unknown>; margin?: number } | null;
  meta: string;
  warn: string;
}
export function loadPage(htmlPath: string): JSDOM;
export function applyUI(dom: JSDOM, ui: Record<string, unknown>): void;
export function runCase(htmlPath: string, c: { id: string; ui: Record<string, unknown> }): CaseResult;
export function serialize(value: unknown): unknown;
