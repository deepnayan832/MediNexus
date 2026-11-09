import { useEffect, useRef, useState } from 'react'

interface ECGWaveformProps {
  bpm?: number
  color?: string
  height?: number
  showGrid?: boolean
  className?: string
  onAction?: (message: string) => void
}

export function ECGWaveform({
  bpm = 72,
  color = '#19e0d1',
  height = 95,
  showGrid = true,
  className = '',
  onAction,
}: ECGWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentBpm, setCurrentBpm] = useState(bpm)
  const [isPlaying, setIsPlaying] = useState(true)

  useEffect(() => {
    setCurrentBpm(bpm)
  }, [bpm])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let width = (canvas.width = canvas.parentElement?.clientWidth || 400)
    canvas.height = height

    const resizeHandler = () => {
      if (!canvas || !canvas.parentElement) return
      width = canvas.width = canvas.parentElement.clientWidth
      canvas.height = height
    }
    window.addEventListener('resize', resizeHandler)

    // ECG wave generator function
    // Represents a P-Q-R-S-T wave cycle
    function getEcgY(t: number, baseline: number, amp: number): number {
      const cycle = t % 1
      if (cycle < 0.15) {
        // Flat baseline
        return baseline
      } else if (cycle >= 0.15 && cycle < 0.25) {
        // P-wave
        const pT = (cycle - 0.15) / 0.1
        return baseline - Math.sin(pT * Math.PI) * amp * 0.2
      } else if (cycle >= 0.25 && cycle < 0.32) {
        // PR interval
        return baseline
      } else if (cycle >= 0.32 && cycle < 0.35) {
        // Q dip
        return baseline + amp * 0.18
      } else if (cycle >= 0.35 && cycle < 0.42) {
        // R peak (tall spike)
        const rT = (cycle - 0.35) / 0.07
        return baseline - Math.sin(rT * Math.PI) * amp * 1.15
      } else if (cycle >= 0.42 && cycle < 0.46) {
        // S dip
        return baseline + amp * 0.32
      } else if (cycle >= 0.46 && cycle < 0.58) {
        // ST segment
        return baseline
      } else if (cycle >= 0.58 && cycle < 0.74) {
        // T-wave
        const tT = (cycle - 0.58) / 0.16
        return baseline - Math.sin(tT * Math.PI) * amp * 0.35
      } else {
        // Baseline return
        return baseline
      }
    }

    let offset = 0
    const points: { x: number; y: number }[] = []
    const maxPoints = Math.floor(width / 2)

    const baseline = height * 0.52
    const amplitude = height * 0.36

    let lastTime = performance.now()

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const render = (now: number) => {
      animId = requestAnimationFrame(render)

      const dt = (now - lastTime) / 1000
      lastTime = now

      if (!isPlaying || prefersReducedMotion) {
        // Render static wave
        ctx.clearRect(0, 0, width, height)
        drawGrid(ctx)
        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        for (let x = 0; x < width; x += 3) {
          const y = getEcgY(x / 140, baseline, amplitude)
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        return
      }

      // Cycle rate based on currentBpm
      const cycleRate = (currentBpm / 60) * 1.35
      offset += dt * cycleRate * 180

      // Add new point
      const curX = width
      const curY = getEcgY(offset / 180, baseline, amplitude)
      points.push({ x: curX, y: curY })

      // Shift existing points left
      const step = dt * cycleRate * 180
      for (let i = 0; i < points.length; i++) {
        points[i].x -= step
      }

      // Remove points that scrolled past left edge
      while (points.length > 0 && points[0].x < -10) {
        points.shift()
      }

      // Draw canvas
      ctx.clearRect(0, 0, width, height)

      if (showGrid) {
        drawGrid(ctx)
      }

      // Draw wave with glow
      if (points.length > 1) {
        ctx.save()
        ctx.shadowColor = color
        ctx.shadowBlur = 10
        ctx.strokeStyle = color
        ctx.lineWidth = 2.2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y)
        }
        ctx.stroke()

        // Phosphor sweep head
        if (points.length > 0) {
          const head = points[points.length - 1]
          ctx.beginPath()
          ctx.fillStyle = '#ffffff'
          ctx.shadowColor = '#ffffff'
          ctx.shadowBlur = 14
          ctx.arc(head.x, head.y, 3.2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
    }

    function drawGrid(context: CanvasRenderingContext2D) {
      context.save()
      context.strokeStyle = 'rgba(25, 224, 209, 0.08)'
      context.lineWidth = 0.8

      const gridGap = 18
      for (let x = 0; x < width; x += gridGap) {
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, height)
        context.stroke()
      }
      for (let y = 0; y < height; y += gridGap) {
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(width, y)
        context.stroke()
      }
      context.restore()
    }

    animId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resizeHandler)
    }
  }, [currentBpm, color, height, showGrid, isPlaying])

  return (
    <div className={`ecg-monitor-card ${className}`}>
      <div className="ecg-monitor-header">
        <div className="ecg-title-badge">
          <span className="ecg-pulse-dot" />
          <span>LEAD II · REAL-TIME ECG</span>
        </div>
        <div className="ecg-rate-badge">
          <strong>{currentBpm}</strong>
          <small>BPM</small>
        </div>
        <div className="ecg-controls">
          <button
            type="button"
            className={`ecg-btn ${currentBpm === 64 ? 'active' : ''}`}
            onClick={() => {
              setCurrentBpm(64)
              onAction?.('Telemetry rhythm set to Resting (64 BPM)')
            }}
            title="Resting rate"
          >
            Resting
          </button>
          <button
            type="button"
            className={`ecg-btn ${currentBpm === 74 ? 'active' : ''}`}
            onClick={() => {
              setCurrentBpm(74)
              onAction?.('Telemetry rhythm set to Normal (74 BPM)')
            }}
            title="Normal rate"
          >
            Nominal
          </button>
          <button
            type="button"
            className={`ecg-btn ${currentBpm === 108 ? 'active' : ''}`}
            onClick={() => {
              setCurrentBpm(108)
              onAction?.('Telemetry rhythm set to Elevated (108 BPM)')
            }}
            title="Elevated rate"
          >
            Stress
          </button>
        </div>
      </div>
      <div className="ecg-canvas-wrapper" style={{ height }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
