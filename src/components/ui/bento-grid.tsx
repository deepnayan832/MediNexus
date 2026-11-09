import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Interactive3DCard } from '../3d/Interactive3DCard'
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
  tilt?: boolean
}

/**
 * Enhanced Bento Grid with 3D depth and interactive tactile surfaces.
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
  tilt = true,
}: BentoGridItemProps) {
  const content = (
    <>
      {header && <div className="bento-grid-item__header">{header}</div>}
      <div className="bento-grid-item__body">
        {icon && <div className="bento-grid-item__icon">{icon}</div>}
        {title && <div className="bento-grid-item__title">{title}</div>}
        {description && <div className="bento-grid-item__description">{description}</div>}
      </div>
    </>
  )

  if (tilt) {
    return (
      <Interactive3DCard as="article" className={cn('bento-grid-item', className)} maxTilt={6} scale={1.015}>
        {content}
      </Interactive3DCard>
    )
  }

  return (
    <article className={cn('bento-grid-item', className)}>
      {content}
    </article>
  )
}
