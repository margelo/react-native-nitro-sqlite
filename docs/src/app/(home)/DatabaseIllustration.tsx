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
      const x = Math.max(-1, Math.min(1, event.clientX / window.innerWidth * 2 - 1))
      const y = Math.max(-1, Math.min(1, event.clientY / window.innerHeight * 2 - 1))
      setPosition(x, y, (y + 1) / 2)
    }
    const onPointerLeave = () => { if (!mobile.matches) setPosition(0, 0, 0.35) }
    const onScroll = () => {
      if (!mobile.matches || reducedMotion.matches) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const bounds = scene.getBoundingClientRect()
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
    <div ref={sceneRef} className={styles.scene} role="img" aria-label="A React Native app queries SQLite through Nitro and receives the matching app data row">
      <div className={styles.halo} aria-hidden="true" />
      <div className={styles.visual} aria-hidden="true">
        <div className={styles.query}>
          <span className={styles.queryHeader}><span>React Native app / query</span><span>parameter [42]</span></span>
          <code><b>SELECT</b> id, message <b>FROM</b> app_data <b>WHERE</b> id = <em>?</em>;</code>
        </div>

        <div className={styles.binding}><span>Nitro binding</span><i /></div>

        <div className={styles.stack}>
          <span className={styles.storageLabel}>SQLite / app_data</span>
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
        </div>

        <div className={styles.returnPath}><i /></div>

        <div className={styles.result}>
          <span className={styles.resultLabel}>React Native app / returned row</span>
          <span className={styles.resultValues}><code>42</code><code>Works on my simulator</code></span>
        </div>
      </div>
    </div>
  )
}
