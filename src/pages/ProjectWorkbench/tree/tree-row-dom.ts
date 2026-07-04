const treeRowSelector = "[data-tree-row-id]";

export type TreeRowDomData<RowType extends string = string> = {
  rowId: string;
  rowType: RowType;
};

export function findTreeRowDataAtPoint<RowType extends string = string>(
  clientX: number,
  clientY: number,
): TreeRowDomData<RowType> | null {
  const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(treeRowSelector);
  if (target === null || target === undefined) {
    return null;
  }
  const rowId = target.dataset.treeRowId;
  const rowType = target.dataset.treeRowType;
  if (rowId === undefined || rowType === undefined) {
    return null;
  }
  return {
    rowId,
    rowType: rowType as RowType,
  };
}

export function queryTreeRowById(root: ParentNode, rowId: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-tree-row-id="${CSS.escape(rowId)}"]`);
}
