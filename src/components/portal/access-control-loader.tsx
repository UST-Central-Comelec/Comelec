import type { CSSProperties } from "react";
import { BadgeCheck } from "lucide-react";
import styles from "./access-control-loader.module.css";

const objects = ["obj-circle", "obj-ring", "obj-bright-point", "obj-diamond", "obj-line", "obj-square", "obj-fragment"];
const cores = ["core-micro-center", "core-inner-glow", "core-thin-ring", "core-secondary-ring", "core-outer-ring", "core-halo"];

export function AccessControlLoader({ progress = 0, exiting = false }: { progress?: number; exiting?: boolean }) {
  return <div className={`${styles.screen}${exiting ? ` ${styles.exiting}` : ""}`} role="status" aria-label={`Activating Metatron, ${progress}%`}>
    <div className={styles.background} aria-hidden="true">
      {[5, 3, 4, 3].map((count, line) => <div key={line} className={styles.backgroundLine} style={{ left: `${8 + line * 28}%` }}>
        {Array.from({ length: count }, (_, dot) => <span key={dot} className={styles.backgroundDot} style={{
          "--dot-start": `${[4, 37, 13, 62, 87][dot]}%`,
          "--dot-end": `${(dot * 31 + line * 19 + 23) % 96}%`,
          animationDuration: `${2 + (dot + line) % 4}s`,
        } as CSSProperties} />)}
      </div>)}
    </div>
    <div className={styles["orbital-loader"]} aria-hidden="true">
      <div className={styles["core-system"]}>{cores.map(core => <span key={core} className={styles[core]} />)}</div>
      <div className={styles["pulse-system"]}>{[1, 2, 3].map(i => <span key={i} className={`${styles["pulse-ring"]} ${styles[`pulse-ring-${i}`]}`} />)}</div>
      {objects.map((object, i) => <div key={object} className={`${styles["orbit-system"]} ${styles[`orbit-${i + 1}`]}`}>
        <span className={styles["orbit-path"]} />
        <div className={styles["orbit-object-wrapper"]}>
          <span className={`${styles["orbit-object"]} ${styles[object]}`} />
          {i === 0 && <span className={styles["object-trail"]} />}
        </div>
      </div>)}
      <div className={styles["particle-system"]}>{Array.from({ length: 15 }, (_, i) => <span key={i} className={`${styles.particle} ${styles[`p${i + 1}`]}`} />)}</div>
      <div className={styles["energy-fragments"]}>{[1, 2, 3].map(i => <span key={i} className={`${styles["energy-fragment"]} ${styles[`ef${i}`]}`} />)}</div>
    </div>
    <p className={styles.title}><span className={styles.shinyText}>Activating Metatron</span> <BadgeCheck size={18} aria-label="Verified" /></p>
    <p className={styles.progress}>Initializing {progress}%</p>
  </div>;
}
