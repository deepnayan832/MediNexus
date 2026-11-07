type ClassValue = string | false | null | undefined

/**
 * Small class-name helper for this CSS-based integration.
 * It deliberately avoids adding clsx/tailwind-merge until Tailwind is installed.
 */
export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ')
}
