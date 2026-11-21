import { useParams } from "react-router";
import { lessonIndex } from "../content/lessons";
import { planFor } from "../plan/pathways";
import { usePlan } from "../plan/store";
import { Lessons } from "./Lessons";
import { LessonView } from "./LessonView";
import { NotFound } from "./NotFound";
import { NextLessonCard } from "./home/NextLessonCard";
import { YourPlan } from "./start/YourPlan";

/** Route screens that bring the bundled content files to the presentational screens. */
export function LessonsRoute() {
  return <Lessons lessons={lessonIndex.lessons} />;
}

export function LessonRoute() {
  const { id } = useParams();
  const { profile } = usePlan();
  const all = lessonIndex.lessons;
  const lesson = all.find((l) => l.id === id);
  if (!lesson) return <NotFound />;
  // "Next" follows the caregiver's plan when the lesson is in it, else the list order.
  const plan = profile ? planFor(profile, all) : [];
  const order = plan.some((l) => l.id === lesson.id) ? plan : all;
  const next = order[order.findIndex((l) => l.id === lesson.id) + 1];
  return <LessonView key={lesson.id} lesson={lesson} next={next} />;
}

export function YourPlanRoute() {
  return <YourPlan lessons={lessonIndex.lessons} />;
}

/** Home's "Your next lesson" card. Lives here so Home does not load the lesson files itself. */
export function NextLessonRoute() {
  return <NextLessonCard lessons={lessonIndex.lessons} />;
}
