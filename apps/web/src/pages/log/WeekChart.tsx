import { lengthText } from "../../log/format";
import type { DayTotal } from "../../log/week";
import { fill } from "../../plan/format";
import { en, locale } from "../../strings/en";

const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: "long" });

/**
 * Minutes of tummy time for each of the last 7 days, as bars. There is no goal line on purpose:
 * how much is right comes from the care team, and the style guide says to praise effort.
 * Screen readers get the same numbers as a list.
 */
export function WeekChart({ days }: { days: DayTotal[] }) {
  const most = Math.max(60, ...days.map((d) => d.seconds));
  const total = days.reduce((sum, d) => sum + d.seconds, 0);
  return (
    <section className="week-chart soft-card" aria-labelledby="week-title">
      <div className="section-head">
        <h2 id="week-title">{en.week.title}</h2>
        <p className="section-head__meta">{fill(en.week.total, { time: lengthText(total) })}</p>
      </div>
      <ol className="week-chart__bars">
        {days.map((d, i) => {
          const pct = Math.round((d.seconds / most) * 100);
          const today = i === days.length - 1;
          return (
            <li
              key={d.key}
              className={today ? "week-chart__day week-chart__day--today" : "week-chart__day"}
            >
              <span className="visually-hidden">
                {fill(en.week.bar, {
                  day: weekdayLong.format(d.date),
                  time: d.seconds > 0 ? lengthText(d.seconds) : en.week.noTime,
                })}
              </span>
              <span className="week-chart__value" aria-hidden="true">
                {d.seconds > 0 ? String(Math.round(d.seconds / 60)) : ""}
              </span>
              <span className="week-chart__track" aria-hidden="true">
                <span
                  className="week-chart__bar"
                  style={{ blockSize: `${String(Math.max(pct, d.seconds > 0 ? 6 : 0))}%` }}
                />
              </span>
              <span className="week-chart__label" aria-hidden="true">
                {weekday.format(d.date)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
