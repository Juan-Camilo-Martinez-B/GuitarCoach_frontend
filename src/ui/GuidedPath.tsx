import { Link } from "react-router-dom";
import { JOURNEY_STEPS, nextStep } from "../domain/journey";
import { useJourney } from "../store/journey";
import { Icon } from "./Icon";

export function GuidedPath() {
  const progress = useJourney((state) => state.progress);
  const upcoming = nextStep(progress);

  return (
    <ol className="path">
      {JOURNEY_STEPS.map((step, index) => {
        const done = progress.milestones.includes(step.id);
        const current = upcoming?.id === step.id;
        return (
          <li key={step.id} className={done ? "is-done" : current ? "is-current" : undefined}>
            <span className="path-mark">{done ? <Icon name="check" size={22} /> : index + 1}</span>
            <div className="path-copy">
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              <Link className={current ? "button" : "button button-ghost"} to={step.path}>
                {done ? "Repetir" : step.action}
                <Icon name="arrowRight" size={18} />
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
