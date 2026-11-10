import { useParams } from "react-router";
import { lessonIndex } from "../content/lessons";
import { Lessons } from "./Lessons";
import { LessonView } from "./LessonView";
import { NotFound } from "./NotFound";

/** Route screens that bring the bundled content files to the presentational screens. */
export function LessonsRoute() {
  return <Lessons lessons={lessonIndex.lessons} />;
}

export function LessonRoute() {
  const { id } = useParams();
  const lesson = lessonIndex.lessons.find((l) => l.id === id);
  return lesson ? <LessonView lesson={lesson} /> : <NotFound />;
}
