// What each script can do, as plain data: the engines carry these (ScriptEngine.capabilities), and code that only
// chooses among options (evolution's operators, the editor's controls) reads them here without loading an engine.
import type { ScriptId, Style } from '../model/schema';
import type { ScriptEngine } from './types';

export type Capabilities = ScriptEngine['capabilities'];

export const CAPABILITIES: Record<ScriptId, Capabilities> = {
  kufi: { grid: true, seals: true, mazes: true },
  thuluth: { grid: false, seals: false, mazes: false, plait: false, terminals: false, strokes: false },
};

/** The capabilities of the script a style asks for (as scriptFor(style).capabilities). */
export const capabilitiesOf = (style: Pick<Style, 'script'>): Capabilities =>
  CAPABILITIES[style.script === 'thuluth' ? 'thuluth' : 'kufi'];
