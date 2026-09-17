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

    const setPosition = (x: number, y: number, progress: number) => {
      if (reducedMotion.matches) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        scene.style.setProperty('--scene-x', x.toFixed(3))
        scene.style.setProperty('--scene-y', y.toFixed(3))
        scene.style.setProperty('--scene-progress', progress.toFixed(3))
      })
    }

    const onPointerEnter = () => { bounds = scene.getBoundingClientRect() }
    const onPointerMove = (event: PointerEvent) => {
      if (mobile.matches) return
      const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2))
      const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2))
      setPosition(x, y, (y + 1) / 2)
    }
    const onPointerLeave = () => { if (!mobile.matches) setPosition(0, 0, 0.35) }
    const onScroll = () => {
      if (!mobile.matches || reducedMotion.matches) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const rect = scene.getBoundingClientRect()
        const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)))
        scene.style.setProperty('--scene-x', '0')
        scene.style.setProperty('--scene-y', ((progress - 0.5) * 1.3).toFixed(3))
        scene.style.setProperty('--scene-progress', progress.toFixed(3))
      })
    }
    const onResize = () => {
      bounds = scene.getBoundingClientRect()
      onScroll()
    }

    scene.addEventListener('pointerenter', onPointerEnter)
    scene.addEventListener('pointermove', onPointerMove)
    scene.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    onScroll()

    return () => {
      cancelAnimationFrame(frame)
      scene.removeEventListener('pointerenter', onPointerEnter)
      scene.removeEventListener('pointermove', onPointerMove)
      scene.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
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
