/**
 * Normalise TypeORM QueryRunner.query() results.
 * Mutation queries (UPDATE … RETURNING) sometimes nest rows as `[rows, count]`,
 * so `result[0]` can be the row array instead of the row object.
 */
export function firstQueryRow<T extends Record<string, unknown>>(
  result: unknown,
): T | null {
  if (!Array.isArray(result) || result.length === 0) return null;
  const head = result[0];
  if (head && typeof head === "object" && !Array.isArray(head)) {
    return head as T;
  }
  if (Array.isArray(head) && head[0] && typeof head[0] === "object") {
    return head[0] as T;
  }
  return null;
}

export function queryRows<T extends Record<string, unknown>>(result: unknown): T[] {
  if (!Array.isArray(result)) return [];
  if (result.length === 0) return [];
  const head = result[0];
  if (Array.isArray(head)) {
    return head.filter((r) => r && typeof r === "object") as T[];
  }
  return result.filter((r) => r && typeof r === "object" && !Array.isArray(r)) as T[];
}
