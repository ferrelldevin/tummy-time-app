import { lengthText } from "../../log/format";
import { useLogSync } from "../../log/useLogSync";
import { lastSevenDays } from "../../log/week";
import { Link } from "../../components/Link";
import { fill } from "../../plan/format";
import { en } from "../../strings/en";
import { WeekChart } from "./WeekChart";

/** Home, signed in: today's minutes and the week. Loaded with the log code. */
export function TodayCard() {
  const { state } = useLogSync();
  if (!state.ready) return null;
  const days = lastSevenDays(state.entries, new Date());
  const today = days.at(-1)?.seconds ?? 0;
  return (
    <div className="stack">
      <p className="today-line" role="status">
        {today > 0 ? fill(en.home.todayMinutes, { time: lengthText(today) }) : en.home.todayNone}
      </p>
      <WeekChart days={days} />
      <Link to="/log">{en.home.weekLink}</Link>
    </div>
  );
}
