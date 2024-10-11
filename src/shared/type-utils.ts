export type NoReadonly<T> = T extends readonly (infer U)[] ? U[] : T
