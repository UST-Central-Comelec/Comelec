import Image from "next/image";
import "./comelec-loading-screen.css";

/** The shared Comelec loading screen; the caller controls how long it stays visible. */
export function ComelecLoadingScreen({ leaving = false, label = "Loading UST Central Comelec", message, progress = false, complete = false }: { leaving?: boolean; label?: string; message?: string; progress?: boolean; complete?: boolean }) {
  return (
    <div className={`site-loader${leaving ? " is-leaving" : ""}`} role="status" aria-busy="true" aria-label={label}>
      <noscript><style>{".site-loader { display: none; }"}</style></noscript>
      <div className="site-loader-mark">
        <Image src="/images/Logo-1.png" alt="" width={120} height={120} priority />
        <span>
          <strong>CENTRAL COMELEC</strong>
          <small>UST Central Commission on Elections</small>
        </span>
      </div>
      {(message || progress) && (
        <div className="site-loader-status">
          {message && <p>{message}</p>}
          {progress && <div className={`site-loader-progress${complete ? " is-complete" : ""}`} role="progressbar" aria-label={message ?? label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={complete ? 100 : undefined}><span /></div>}
        </div>
      )}
    </div>
  );
}
