const treeRowSelector = "[data-tree-row-id][data-tree-row-index]";

export type TreeRowDomData<RowType extends string = string> = {
  rowId: string;
  rowType: RowType;
  rowIndex: number;
  rect: DOMRect;
};

export function findTreeRowDataAtPoint<RowType extends string = string>(
  clientX: number,
  clientY: number,
  root?: ParentNode | null,
): TreeRowDomData<RowType> | null {
  const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(treeRowSelector);
  if (target === null || target === undefined) {
    return null;
  }
  if (root !== null && root !== undefined && !root.contains(target)) {
    return null;
  }
  const rowId = target.dataset.treeRowId;
  const rowType = target.dataset.treeRowType;
  const rowIndexText = target.dataset.treeRowIndex;
  if (rowId === undefined || rowType === undefined || rowIndexText === undefined) {
    return null;
  }
  const rowIndex = Number(rowIndexText);
  if (!Number.isFinite(rowIndex)) {
    return null;
  }
  return {
    rowId,
    rowType: rowType as RowType,
    rowIndex,
    rect: target.getBoundingClientRect(),
  };
}

export function queryTreeRowById(root: ParentNode, rowId: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-tree-row-id="${CSS.escape(rowId)}"]`);
}
