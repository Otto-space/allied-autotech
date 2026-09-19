export type PublicSeed<T> = { data: T; error?: never } | { data?: never; error: string };
