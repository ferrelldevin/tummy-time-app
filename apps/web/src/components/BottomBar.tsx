import { NavLink } from "react-router";
import { en } from "../strings/en";

const items = [
  { to: "/", label: en.nav.home, end: true, className: "bar-item" },
  { to: "/lessons", label: en.nav.lessons, end: false, className: "bar-item" },
  { to: "/log", label: en.nav.log, end: false, className: "bar-item" },
  {
    to: "/when-to-call",
    label: en.nav.whenToCall,
    end: false,
    className: "bar-item bar-item--call",
  },
] as const;

/** Four stops, on every screen. "When to call" is always one tap away. */
export function BottomBar() {
  return (
    <nav className="bottom-bar" aria-label={en.nav.label}>
      <ul>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} className={item.className}>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
