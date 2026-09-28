import { TabBlock, TabColumn, LineSet } from '../models/tab.model';
import { newId } from '../../shared/utils/array.util';

function cloneColumn(column: TabColumn): TabColumn {
  const copy = structuredClone(column) as TabColumn;
  copy.id = newId('col');
  return copy;
}

export function cloneLineSet(set: LineSet, order: number): LineSet {
  const copy = structuredClone(set) as LineSet;
  copy.id = newId('line-set');
  copy.order = order;
  copy.columns = copy.columns.map(cloneColumn);
  return copy;
}

export function cloneBlock(block: TabBlock, blockOrder: number): TabBlock {
  const copy = structuredClone(block) as TabBlock;
  copy.id = newId('block');
  copy.blockOrder = blockOrder;
  copy.lineSets = copy.lineSets.map((set, i) => cloneLineSet(set, i));
  return copy;
}