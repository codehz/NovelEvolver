export function isMenuGroupStart(
  group: string | undefined,
  previousGroup: string | undefined,
): boolean {
  return group != null && group !== previousGroup;
}
