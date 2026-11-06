import { useEffect } from "react";
import { BADGES, dayKey, liveStreak } from "../domain/journey";
import { useJourney } from "../store/journey";
import { Icon } from "./Icon";

export function StreakBadge() {
  const progress = useJourney((state) => state.progress);
  const streak = liveStreak(progress, dayKey(new Date()));
  if (streak === 0) {
    return null;
  }
  const days = `${streak} ${streak === 1 ? "día" : "días"}`;
  return (
    <span className="streak" title={`Racha: ${days} practicando`}>
      <Icon name="flame" size={18} />
      <span aria-hidden="true">{streak}</span>
      <span className="visually-hidden">Racha de {days}</span>
    </span>
  );
}

export function Achievements() {
  const progress = useJourney((state) => state.progress);
  const streak = liveStreak(progress, dayKey(new Date()));
  const earned = BADGES.filter((badge) => badge.earned(progress)).length;

  return (
    <section className="panel achievements" aria-label="Logros">
      <div className="section-head">
        <div>
          <h2>Tus logros</h2>
          <p className="hint">Se guardan solo en este navegador.</p>
        </div>
        <div className="achievement-stats">
          <span className="stat">
            <Icon name="flame" size={20} />
            <span>
              <strong>{streak}</strong> {streak === 1 ? "día seguido" : "días seguidos"}
            </span>
          </span>
          <span className="stat">
            <Icon name="star" size={20} />
            <span>
              <strong>
                {earned} de {BADGES.length}
              </strong>{" "}
              logros
            </span>
          </span>
        </div>
      </div>
      <ul className="badge-grid">
        {BADGES.map((badge) => {
          const won = badge.earned(progress);
          return (
            <li key={badge.id} className={won ? "badge is-won" : "badge"}>
              <span className="badge-icon">
                <Icon name={won ? badge.icon : "lock"} size={24} />
              </span>
              <strong>{badge.title}</strong>
              <small>{badge.text}</small>
              <span className="visually-hidden">{won ? "Conseguido" : "Por conseguir"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const TOAST_MS = 5000;

/** Celebra un logro recién ganado sin interrumpir lo que se está tocando. */
export function AchievementToast() {
  const fresh = useJourney((state) => state.fresh);
  const dismiss = useJourney((state) => state.dismissFresh);

  useEffect(() => {
    if (fresh.length === 0) {
      return;
    }
    const timer = window.setTimeout(dismiss, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [dismiss, fresh]);

  if (fresh.length === 0) {
    return null;
  }
  const latest = fresh[fresh.length - 1];
  return (
    <div className="toast" role="status">
      <span className="badge-icon">
        <Icon name={latest.icon} size={22} />
      </span>
      <div>
        <strong>¡Logro nuevo: {latest.title}!</strong>
        <small>{latest.text}</small>
      </div>
    </div>
  );
}
