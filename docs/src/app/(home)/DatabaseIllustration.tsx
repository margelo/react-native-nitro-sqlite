'use client'

import { useEffect, useRef } from 'react'
import styles from './DatabaseIllustration.module.css'

export function DatabaseIllustration() {
  const sceneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mobile = window.matchMedia('(max-width: 950px), (hover: none)')
    let frame = 0
    let bounds = scene.getBoundingClientRect()
    let pointerActive = false

    const setPosition = (x: number, y: number, progress: number) => {
      if (reducedMotion.matches) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        scene.style.setProperty('--scene-x', x.toFixed(3))
        scene.style.setProperty('--scene-y', y.toFixed(3))
        scene.style.setProperty('--scene-progress', progress.toFixed(3))
      })
    }

    const onPointerMove = (event: PointerEvent) => {
      if (mobile.matches || reducedMotion.matches) return
      const dx = event.clientX - bounds.left - bounds.width / 2
      const dy = event.clientY - bounds.top - bounds.height / 2
      const radiusX = Math.max(bounds.width * 1.7, 760)
      const radiusY = Math.max(bounds.height * 1.6, 520)
      const distance = Math.hypot(dx / radiusX, dy / radiusY)

      if (distance >= 1) {
        if (!pointerActive) return
        pointerActive = false
        setPosition(0, 0, 0.35)
        return
      }

      pointerActive = true
      const edge = Math.max(0, Math.min(1, (distance - 0.45) / 0.55))
      const falloff = 1 - edge * edge * (3 - 2 * edge)
      const x = Math.max(-1, Math.min(1, dx / (bounds.width * 0.6))) * falloff
      const y = Math.max(-1, Math.min(1, dy / (bounds.height * 0.6))) * falloff
      setPosition(x, y, 0.35 + y * 0.35)
    }
    const onPointerLeave = () => {
      if (!pointerActive) return
      pointerActive = false
      setPosition(0, 0, 0.35)
    }
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        bounds = scene.getBoundingClientRect()
        if (!mobile.matches || reducedMotion.matches) return
        const progress = Math.max(0, Math.min(1, (window.innerHeight - bounds.top) / (window.innerHeight + bounds.height)))
        scene.style.setProperty('--scene-x', '0')
        scene.style.setProperty('--scene-y', ((progress - 0.5) * 1.3).toFixed(3))
        scene.style.setProperty('--scene-progress', progress.toFixed(3))
      })
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('blur', onPointerLeave)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    onScroll()

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('blur', onPointerLeave)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div ref={sceneRef} className={styles.scene} role="img" aria-label="A SQL query travels through a stack of SQLite data pages and returns a matching row">
      <div className={styles.halo} aria-hidden="true" />
      <div className={styles.visual} aria-hidden="true">
        <div className={styles.query}>
          <span className={styles.queryLabel}>app.db / query</span>
          <code><b>SELECT</b> * <b>FROM</b> notes <b>WHERE</b> id = <em>?</em></code>
        </div>

        <div className={styles.stack}>
          <div className={`${styles.page} ${styles.pageBack}`}>
            <span className={styles.pageIndex}>03</span>
            <span className={styles.rows}><i /><i /><i /><i /></span>
          </div>
          <div className={`${styles.page} ${styles.pageMiddle}`}>
            <span className={styles.pageIndex}>02</span>
            <span className={styles.rows}><i /><i /><i /><i /></span>
          </div>
          <div className={`${styles.page} ${styles.pageFront}`}>
            <span className={styles.pageIndex}>01</span>
            <span className={styles.rows}><i /><i className={styles.match} /><i /><i /></span>
          </div>
          <div className={styles.scan}><span className={styles.scanHead} /></div>
        </div>

        <div className={styles.result}>
          <span className={styles.resultLabel}>result / row 01</span>
          <span className={styles.resultValues}><code>42</code><code>Release notes</code></span>
        </div>
        <div className={styles.axis}><span>JS</span><i /><span>SQLite</span></div>
      </div>
    </div>
  )
}
