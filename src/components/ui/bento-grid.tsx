import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import './bento-grid.css'

type BentoGridProps = {
  className?: string
  children?: ReactNode
}

type BentoGridItemProps = {
  className?: string
  title?: ReactNode
  description?: ReactNode
  header?: ReactNode
  icon?: ReactNode
}

/**
 * Aceternity Bento Grid API adapted to MediNexus' existing CSS setup.
 * The official registry component uses Tailwind utility classes; this version
 * keeps the same composition API without forcing a Tailwind migration.
 */
export function BentoGrid({ className, children }: BentoGridProps) {
  return <div className={cn('bento-grid', className)}>{children}</div>
}

export function BentoGridItem({
  className,
  title,
  description,
  header,
  icon,
}: BentoGridItemProps) {
  return (
    <article className={cn('bento-grid-item', className)}>
      {header && <div className="bento-grid-item__header">{header}</div>}
      <div className="bento-grid-item__body">
        {icon && <div className="bento-grid-item__icon">{icon}</div>}
        {title && <div className="bento-grid-item__title">{title}</div>}
        {description && <div className="bento-grid-item__description">{description}</div>}
      </div>
    </article>
  )
}
