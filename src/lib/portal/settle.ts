/** A load that never throws: its value, or the error message for the page to show instead. */
export async function settle<T>(load: Promise<T>): Promise<{ value: T; error: null } | { value: null; error: string }> {
  try {
    return { value: await load, error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : String(error) };
  }
}
