export const COLOR_KEYS = [
  'yellow', 'red', 'green', 'blue',
  'orange', 'lightblue', 'purple', 'pink',
] as const

export type ColorKey = (typeof COLOR_KEYS)[number]
