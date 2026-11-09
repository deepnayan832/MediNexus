import { useState, useRef, type ReactNode, type MouseEvent } from 'react'

interface Interactive3DCardProps {
  children: ReactNode
  className?: string
  maxTilt?: number
  glare?: boolean
  scale?: number
  as?: 'div' | 'article' | 'section'
}

export function Interactive3DCard({
  children,
  className = '',
  maxTilt = 8,
  glare = true,
  scale = 1.02,
  as: Component = 'div',
}: Interactive3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [transformStyle, setTransformStyle] = useState<string>('')
  const [glareStyle, setGlareStyle] = useState<{ x: number; y: number; opacity: number }>({ x: 50, y: 50, opacity: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const normX = (x / rect.width) * 2 - 1
    const normY = (y / rect.height) * 2 - 1

    const rotX = -normY * maxTilt
    const rotY = normX * maxTilt

    setTransformStyle(`perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`)

    if (glare) {
      setGlareStyle({
        x: (x / rect.width) * 100,
        y: (y / rect.height) * 100,
        opacity: 0.15,
      })
    }
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setTransformStyle('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)')
    setGlareStyle((prev) => ({ ...prev, opacity: 0 }))
  }

  return (
    <Component
      ref={cardRef as any}
      className={`interactive-3d-card ${isHovered ? 'is-card-hovered' : ''} ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: transformStyle || undefined,
        transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
    >
      {children}
      {glare && (
        <span
          className="interactive-3d-glare"
          aria-hidden="true"
          style={{
            background: `radial-gradient(circle at ${glareStyle.x}% ${glareStyle.y}%, rgba(255, 255, 255, 0.22), transparent 70%)`,
            opacity: glareStyle.opacity,
            transition: isHovered ? 'opacity 0.2s ease' : 'opacity 0.4s ease',
          }}
        />
      )}
    </Component>
  )
}
