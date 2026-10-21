import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import { previewCurriculum } from "../domain/course";
import type { Curriculum } from "../domain/types";
import { useSession } from "../store/session";
import { LessonDesk } from "../ui/LessonDesk";
import { StatusMessage } from "../ui/StatusMessage";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function LearnPage() {
  const token = useSession((state) => state.token);
  const setSong = useSession((state) => state.setSong);
  const setStudy = useSession((state) => state.setStudy);
  const setTeachingMode = useSession((state) => state.setTeachingMode);
  const navigate = useNavigate();
  const [course, setCourse] = useState<Curriculum>(previewCurriculum);
  const [openId, setOpenId] = useState<string | null>(previewCurriculum().lessons[0]?.id ?? null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setCourse(previewCurriculum());
      setState("idle");
      return;
    }
    setState("loading");
    try {
      const next = await new ApiClient(apiUrl, fetch, token).curriculum();
      setCourse(next);
      setOpenId((current) => current ?? next.lessons.find((lesson) => !lesson.locked)?.id ?? null);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo cargar el curso.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function complete(lessonId: string) {
    if (!token) {
      setState("error");
      setMessage("Inicia sesión para guardar el módulo.");
      return;
    }
    setState("loading");
    try {
      await new ApiClient(apiUrl, fetch, token).completeLesson(lessonId);
      await load();
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo guardar el módulo.");
    }
  }

  async function review() {
    if (!token) {
      return;
    }
    setState("loading");
    try {
      await new ApiClient(apiUrl, fetch, token).acknowledgeReview();
      await load();
      setMessage("Repaso listo. Puedes seguir el módulo.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo guardar el repaso.");
    }
  }

  async function practice(title: string, mode: "acordes" | "notas") {
    setState("loading");
    try {
      const client = new ApiClient(apiUrl, fetch, token);
      const songs = await client.searchSongs(title);
      const song = songs.find((item) => item.title === title) ?? songs[0];
      if (!song) {
        throw new ApiError(404, "Esa canción no está en la biblioteca.");
      }
      setSong(song);
      try {
        setStudy(await client.songStudy(song.id));
      } catch {
        setStudy(null);
      }
      setTeachingMode(mode);
      setState("idle");
      navigate("/practica");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo abrir la canción.");
    }
  }

  const lessons = course.lessons ?? [];
  const current = lessons.find((lesson) => lesson.id === openId) ?? lessons[0] ?? null;

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Curso</p>
        <h1>Aprendizaje</h1>
        <p className="lead">
          Del nombre de las cuerdas a tres canciones cortas. El avance queda guardado.
        </p>
      </header>
      {token ? null : (
        <p className="note">
          El temario se puede leer ahora. <Link to="/entrar">Inicia sesión</Link> para guardar el
          avance.
        </p>
      )}
      <StatusMessage state={state} message={message} />
      {course.needsReview ? (
        <section className="panel review-banner">
          <h2>Repaso rápido</h2>
          <p>Pasó al menos un día desde la última sesión. Recuerda esto antes de avanzar.</p>
          {(course.review ?? []).map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <ul>
                {item.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
          <button type="button" onClick={() => void review()}>
            Ya repasé, seguir
          </button>
        </section>
      ) : null}
      <ol className="lessons">
        {lessons.map((lesson, index) => (
          <li key={lesson.id}>
            <button
              type="button"
              className={lesson.id === current?.id ? "is-current" : undefined}
              disabled={lesson.locked}
              onClick={() => setOpenId(lesson.id)}
            >
              {index + 1}. {lesson.title}
              {lesson.status === "completed" ? " · listo" : ""}
              {lesson.locked ? " · bloqueado" : ""}
            </button>
          </li>
        ))}
      </ol>
      {current ? (
        <section className="panel">
          <h2>{current.title}</h2>
          <p>{current.summary}</p>
          <LessonDesk lessonId={current.id} />
          <ul>
            {(current.points ?? []).map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="actions">
            <button
              type="button"
              disabled={current.locked || current.status === "completed" || course.needsReview}
              onClick={() => void complete(current.id)}
            >
              {current.status === "completed" ? "Módulo guardado" : "Marcar como visto"}
            </button>
            {current.songTitle ? (
              <>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => void practice(current.songTitle ?? "", "acordes")}
                >
                  Practicar acordes
                </button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => void practice(current.songTitle ?? "", "notas")}
                >
                  Practicar notas
                </button>
              </>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
