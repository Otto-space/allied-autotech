export type PublicSeed<T> = { path: string } & (
  { data: T; error?: never } | { data?: never; error: string }
);
