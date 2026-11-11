import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

export type SceneMode = 'neural' | 'cardiac' | 'dna'

interface MedicalHeroSceneProps {
  className?: string
  activeRole?: string
  onAction?: (message: string) => void
}

export function MedicalHeroScene({ className = '', activeRole = 'Admin', onAction }: MedicalHeroSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<SceneMode>('neural')
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fps, setFps] = useState(60)
  const [pulseBpm, setPulseBpm] = useState(74)
  const [webglSupported, setWebglSupported] = useState(true)

  // References to keep state across render cycles
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const animFrameId = useRef<number | null>(null)
  const activeObjectsRef = useRef<THREE.Group | null>(null)
  const modeRef = useRef<SceneMode>(mode)

  modeRef.current = mode

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    // Test WebGL support
    try {
      const testCanvas = document.createElement('canvas')
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl')
      if (!gl) {
        setWebglSupported(false)
        return
      }
    } catch {
      setWebglSupported(false)
      return
    }

    const width = container.clientWidth || 600
    const height = container.clientHeight || 420

    // Scene setup
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(0, 0, 14)
    cameraRef.current = camera

    // Renderer setup
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
    const renderer = new THREE.WebGLRenderer({ antialias: !isCoarsePointer, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarsePointer ? 1.25 : 1.5))
    renderer.setSize(width, height)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    rendererRef.current = renderer

    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0x42f5cb, 2.5)
    keyLight.position.set(5, 8, 10)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 2.0)
    fillLight.position.set(-6, -4, -6)
    scene.add(fillLight)

    const accentLight = new THREE.PointLight(0xa855f7, 3, 20)
    accentLight.position.set(0, 0, 5)
    scene.add(accentLight)

    // Main Group
    const mainGroup = new THREE.Group()
    scene.add(mainGroup)
    activeObjectsRef.current = mainGroup

    // Particle field in background
    const particleCount = 180
    const particleGeometry = new THREE.BufferGeometry()
    const particlePositions = new Float32Array(particleCount * 3)
    const particleColors = new Float32Array(particleCount * 3)

    const cyanColor = new THREE.Color(0x19e0d1)
    const violetColor = new THREE.Color(0x818cf8)

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 26
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 20
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 16 - 2

      const mixed = Math.random() > 0.5 ? cyanColor : violetColor
      particleColors[i * 3] = mixed.r
      particleColors[i * 3 + 1] = mixed.g
      particleColors[i * 3 + 2] = mixed.b
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    })
    const particleSystem = new THREE.Points(particleGeometry, particleMaterial)
    scene.add(particleSystem)

    // Build the objects for current mode
    buildSceneObjects(mainGroup, modeRef.current)

    // Interaction variables
    let mouseX = 0
    let mouseY = 0
    let targetRotationX = 0
    let targetRotationY = 0
    let isMouseDown = false
    let prevMousePos = { x: 0, y: 0 }

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      mouseX = x
      mouseY = y

      if (isMouseDown) {
        const deltaX = event.clientX - prevMousePos.x
        const deltaY = event.clientY - prevMousePos.y
        targetRotationY += deltaX * 0.008
        targetRotationX += deltaY * 0.008
        prevMousePos = { x: event.clientX, y: event.clientY }
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      isMouseDown = true
      setIsDragging(true)
      prevMousePos = { x: event.clientX, y: event.clientY }
      container.setPointerCapture(event.pointerId)
    }

    const onPointerUp = (event: PointerEvent) => {
      isMouseDown = false
      setIsDragging(false)
      if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId)
    }

    const onPointerCancel = () => {
      isMouseDown = false
      setIsDragging(false)
    }

    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointerup', onPointerUp)
    container.addEventListener('pointercancel', onPointerCancel)

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return
      const newWidth = container.clientWidth
      const newHeight = container.clientHeight
      if (newWidth > 0 && newHeight > 0) {
        camera.aspect = newWidth / newHeight
        camera.updateProjectionMatrix()
        renderer.setSize(newWidth, newHeight)
      }
    })
    resizeObserver.observe(container)

    // Animation Loop
    const animationStart = performance.now()
    let elapsedTime = 0
    let frameCount = 0
    let lastFpsUpdate = 0
    let lastFrameAt = 0
    let isInView = true

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const frameInterval = 1000 / (isCoarsePointer ? 30 : 45)

    const animate = (now: number) => {
      if (!isInView || document.hidden) {
        animFrameId.current = null
        return
      }
      animFrameId.current = requestAnimationFrame(animate)
      if (now - lastFrameAt < frameInterval) return
      const frameScale = lastFrameAt ? Math.min((now - lastFrameAt) / (1000 / 60), 2) : 1
      lastFrameAt = now

      elapsedTime = (now - animationStart) / 1000
      frameCount++

      if (elapsedTime - lastFpsUpdate >= 1) {
        setFps(Math.round(frameCount / (elapsedTime - lastFpsUpdate)))
        frameCount = 0
        lastFpsUpdate = elapsedTime
      }

      // Smooth damped rotation
      if (!prefersReducedMotion) {
        if (!isMouseDown) {
          targetRotationY += 0.003 * frameScale
        }
        const damping = 1 - Math.pow(1 - 0.06, frameScale)
        mainGroup.rotation.y += (targetRotationY + mouseX * 0.35 - mainGroup.rotation.y) * damping
        mainGroup.rotation.x += (targetRotationX - mouseY * 0.25 - mainGroup.rotation.x) * damping

        // Gentle floating
        mainGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.18
        particleSystem.rotation.y = elapsedTime * 0.02
      }

      // Dynamic animation per mode
      if (modeRef.current === 'cardiac') {
        const pulse = 1 + Math.pow(Math.sin(elapsedTime * 4.2), 6) * 0.16 + Math.pow(Math.sin(elapsedTime * 4.2 + 0.3), 10) * 0.08
        mainGroup.scale.set(pulse, pulse, pulse)
      } else if (modeRef.current === 'dna') {
        mainGroup.scale.set(1, 1, 1)
      } else {
        mainGroup.scale.set(1, 1, 1)
      }

      renderer.render(scene, camera)
    }

    const stopAnimation = () => {
      if (animFrameId.current !== null) {
        cancelAnimationFrame(animFrameId.current)
        animFrameId.current = null
      }
      lastFrameAt = 0
      frameCount = 0
      lastFpsUpdate = elapsedTime
    }

    const startAnimation = () => {
      if (animFrameId.current === null && isInView && !document.hidden) {
        animFrameId.current = requestAnimationFrame(animate)
      }
    }

    const onVisibilityChange = () => {
      if (document.hidden) stopAnimation()
      else startAnimation()
    }

    const intersectionObserver = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      isInView = entry.isIntersecting
      if (isInView) startAnimation()
      else stopAnimation()
    }, { rootMargin: '80px' })

    intersectionObserver?.observe(container)
    document.addEventListener('visibilitychange', onVisibilityChange)
    startAnimation()

    // Cleanup
    return () => {
      stopAnimation()
      intersectionObserver?.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('pointercancel', onPointerCancel)
      resizeObserver.disconnect()
      renderer.dispose()
      particleGeometry.dispose()
      particleMaterial.dispose()
      clearGroup(mainGroup)
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Re-build objects when mode changes
  useEffect(() => {
    if (activeObjectsRef.current) {
      clearGroup(activeObjectsRef.current)
      buildSceneObjects(activeObjectsRef.current, mode)
    }
    if (mode === 'cardiac') setPulseBpm(78)
    else if (mode === 'neural') setPulseBpm(72)
    else setPulseBpm(68)
  }, [mode])

  // Helper function to build 3D objects
  function buildSceneObjects(group: THREE.Group, currentMode: SceneMode) {
    if (currentMode === 'neural') {
      // 1. Hospital Care Neural Network
      // Central Hospital Node
      const centerGeo = new THREE.IcosahedronGeometry(1.4, 2)
      const centerMat = new THREE.MeshPhysicalMaterial({
        color: 0x14b8a6,
        roughness: 0.15,
        transmission: 0.65,
        thickness: 1.2,
        emissive: 0x0f766e,
        emissiveIntensity: 0.45,
        wireframe: false,
      })
      const centerMesh = new THREE.Mesh(centerGeo, centerMat)
      group.add(centerMesh)

      // Inner glowing core
      const innerGeo = new THREE.SphereGeometry(0.75, 16, 16)
      const innerMat = new THREE.MeshBasicMaterial({ color: 0x5eead4, wireframe: true })
      centerMesh.add(new THREE.Mesh(innerGeo, innerMat))

      // Orbital department nodes
      const departments = [
        { name: 'Emergency Triage', color: 0xff4d6d, pos: [3.4, 1.8, 0.8] },
        { name: 'Cardiology Center', color: 0x06b6d4, pos: [-3.2, 1.6, -1.2] },
        { name: 'Inpatient Beds', color: 0x10b981, pos: [2.8, -2.2, -1.5] },
        { name: 'Diagnostics & Labs', color: 0x8b5cf6, pos: [-2.9, -1.9, 1.4] },
        { name: 'Pharmacy Network', color: 0xf59e0b, pos: [0.2, 3.5, -1.6] },
        { name: 'Outpatient Care', color: 0x38bdf8, pos: [-0.3, -3.4, 0.9] },
      ]

      departments.forEach((dept) => {
        const nodeGeo = new THREE.SphereGeometry(0.55, 24, 24)
        const nodeMat = new THREE.MeshStandardMaterial({
          color: dept.color,
          roughness: 0.2,
          metalness: 0.4,
          emissive: dept.color,
          emissiveIntensity: 0.4,
        })
        const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat)
        nodeMesh.position.set(dept.pos[0], dept.pos[1], dept.pos[2])
        group.add(nodeMesh)

        // Pulsing orbit ring for each department
        const ringGeo = new THREE.TorusGeometry(0.85, 0.03, 8, 32)
        const ringMat = new THREE.MeshBasicMaterial({ color: dept.color, transparent: true, opacity: 0.45 })
        const ringMesh = new THREE.Mesh(ringGeo, ringMat)
        ringMesh.rotation.x = Math.PI / 2
        nodeMesh.add(ringMesh)

        // Connecting filament to center
        const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...(dept.pos as [number, number, number]))]
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
        const lineMat = new THREE.LineBasicMaterial({ color: dept.color, transparent: true, opacity: 0.55 })
        const line = new THREE.Line(lineGeo, lineMat)
        group.add(line)
      })

      // Equator telemetry rings
      const bigRingGeo = new THREE.TorusGeometry(4.6, 0.04, 12, 64)
      const bigRingMat = new THREE.MeshBasicMaterial({ color: 0x19e0d1, transparent: true, opacity: 0.35 })
      const bigRing = new THREE.Mesh(bigRingGeo, bigRingMat)
      bigRing.rotation.x = Math.PI / 3
      group.add(bigRing)

      const secondRing = new THREE.Mesh(
        new THREE.TorusGeometry(4.2, 0.03, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.28 })
      )
      secondRing.rotation.y = Math.PI / 4
      group.add(secondRing)

    } else if (currentMode === 'cardiac') {
      // 2. Biometric Cardio Pulse Core
      const coreGeo = new THREE.DodecahedronGeometry(2.0, 1)
      const coreMat = new THREE.MeshPhysicalMaterial({
        color: 0xef4444,
        roughness: 0.1,
        transmission: 0.5,
        thickness: 2.0,
        emissive: 0xd97706,
        emissiveIntensity: 0.35,
        clearcoat: 1.0,
      })
      const coreMesh = new THREE.Mesh(coreGeo, coreMat)
      group.add(coreMesh)

      // Wireframe overlay
      const wireMat = new THREE.MeshBasicMaterial({ color: 0xfca5a5, wireframe: true, transparent: true, opacity: 0.4 })
      coreMesh.add(new THREE.Mesh(new THREE.DodecahedronGeometry(2.05, 1), wireMat))

      // Concentric wave rings
      const radii = [2.9, 3.8, 4.7]
      radii.forEach((r, idx) => {
        const waveGeo = new THREE.TorusGeometry(r, 0.04, 12, 64)
        const waveMat = new THREE.MeshBasicMaterial({
          color: idx === 0 ? 0xff4d6d : idx === 1 ? 0x06b6d4 : 0x10b981,
          transparent: true,
          opacity: 0.4 - idx * 0.1,
        })
        const waveMesh = new THREE.Mesh(waveGeo, waveMat)
        waveMesh.rotation.x = Math.PI / 2 + idx * 0.25
        waveMesh.rotation.y = idx * 0.35
        group.add(waveMesh)
      })

    } else if (currentMode === 'dna') {
      // 3. Genomic & Molecular Double Helix
      const pairs = 28
      const radius = 1.9
      const heightSpan = 8.5
      const turns = 2.5

      for (let i = 0; i < pairs; i++) {
        const t = (i / pairs) * Math.PI * 2 * turns
        const y = ((i - pairs / 2) / pairs) * heightSpan

        const x1 = Math.cos(t) * radius
        const z1 = Math.sin(t) * radius
        const x2 = Math.cos(t + Math.PI) * radius
        const z2 = Math.sin(t + Math.PI) * radius

        // Base 1 sphere
        const sphereGeo = new THREE.SphereGeometry(0.24, 16, 16)
        const mat1 = new THREE.MeshStandardMaterial({
          color: 0x06b6d4,
          emissive: 0x0891b2,
          emissiveIntensity: 0.5,
          roughness: 0.2,
        })
        const s1 = new THREE.Mesh(sphereGeo, mat1)
        s1.position.set(x1, y, z1)
        group.add(s1)

        // Base 2 sphere
        const mat2 = new THREE.MeshStandardMaterial({
          color: 0xa855f7,
          emissive: 0x7c3aed,
          emissiveIntensity: 0.5,
          roughness: 0.2,
        })
        const s2 = new THREE.Mesh(sphereGeo, mat2)
        s2.position.set(x2, y, z2)
        group.add(s2)

        // Connecting rung cylinder
        const rungPoints = [new THREE.Vector3(x1, y, z1), new THREE.Vector3(x2, y, z2)]
        const rungGeo = new THREE.BufferGeometry().setFromPoints(rungPoints)
        const rungMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.45 })
        group.add(new THREE.Line(rungGeo, rungMat))
      }
    }
  }

  function clearGroup(group: THREE.Group) {
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points) {
        geometries.add(child.geometry)
        const childMaterials = Array.isArray(child.material) ? child.material : [child.material]
        childMaterials.forEach((material) => materials.add(material))
      }
    })
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
    group.clear()
  }

  return (
    <div className={`medical-hero-3d-wrap ${className}`} aria-label="Interactive 3D Hospital Telemetry Viewport">
      {/* Visual background atmospheric illumination */}
      <div className="hero-3d-glow-backdrop" aria-hidden="true" />

      {/* 3D WebGL Canvas or Fallback */}
      {webglSupported ? (
        <div
          ref={mountRef}
          className={`hero-3d-canvas-container ${isDragging ? 'is-dragging' : ''}`}
          title="Drag to rotate in 3D"
        />
      ) : (
        <div className="hero-3d-fallback" aria-hidden="true">
          <div className="fallback-orb fallback-orb--pulse" />
          <div className="fallback-ring fallback-ring--one" />
          <div className="fallback-ring fallback-ring--two" />
          <div className="fallback-node fallback-node--ed">ED</div>
          <div className="fallback-node fallback-node--cardio">Cardio</div>
          <div className="fallback-node fallback-node--beds">Beds</div>
        </div>
      )}

      {/* Interactive Controls & Telemetry HUD Overlay */}
      <div className="hero-3d-hud">
        <div className="hero-3d-hud__top">
          <div className="hero-telemetry-badge">
            <span className="telemetry-live-dot" />
            <span className="telemetry-label">3D CLINICAL TELEMETRY</span>
            <span className="telemetry-value">{fps} FPS · {pulseBpm} BPM</span>
          </div>

          <div className="hero-mode-selector" role="group" aria-label="3D Model Visualizations">
            <button
              type="button"
              className={`hero-mode-btn ${mode === 'neural' ? 'active' : ''}`}
              onClick={() => {
                setMode('neural')
                onAction?.('Switched 3D viewport to Hospital Care Neural Network')
              }}
            >
              Network
            </button>
            <button
              type="button"
              className={`hero-mode-btn ${mode === 'cardiac' ? 'active' : ''}`}
              onClick={() => {
                setMode('cardiac')
                onAction?.('Switched 3D viewport to Biometric Cardio Pulse')
              }}
            >
              Cardio
            </button>
            <button
              type="button"
              className={`hero-mode-btn ${mode === 'dna' ? 'active' : ''}`}
              onClick={() => {
                setMode('dna')
                onAction?.('Switched 3D viewport to Genomic & Molecular Helix')
              }}
            >
              Genomic
            </button>
          </div>
        </div>

        <div className="hero-3d-hud__bottom">
          <div className="hero-3d-hint">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span>Drag to rotate · Interactive 3D telemetry</span>
          </div>

          <div className="hero-3d-status-capsule">
            <span className="capsule-node">Workspace: <strong>{activeRole}</strong></span>
            <span className="capsule-divider" />
            <span className="capsule-state">Operational Matrix Online</span>
          </div>
        </div>
      </div>
    </div>
  )
}
