import * as React from "react";

/**
 * Client-side text search for the fully-fetched master lists.
 *
 * Each list is already loaded in full via TanStack Query and master tables are
 * small/bounded, so filtering in the browser keeps the UX instant (no extra
 * round-trips) and avoids touching every list endpoint.
 *
 * `getFields` returns the searchable strings for an item. The query is split on
 * whitespace and every term must match at least one field (AND across terms,
 * OR across fields), case-insensitively.
 *
 *   const { query, setQuery, results } = useTextSearch(staff, (s) => [
 *     s.name, s.login_email, s.department_name,
 *   ]);
 */
export function useTextSearch<T>(
  items: T[],
  getFields: (item: T) => Array<string | null | undefined>,
) {
  const [query, setQuery] = React.useState("");

  const results = React.useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return items;
    return items.filter((item) => {
      const haystack = getFields(item)
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
    // getFields is expected to be a stable/inline extractor; depending on it
    // would force callers to memoize it, so we intentionally omit it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query]);

  return { query, setQuery, results };
}
