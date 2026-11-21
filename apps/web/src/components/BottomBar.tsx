import { NavLink } from "react-router";
import { en } from "../strings/en";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

const items: readonly {
  to: string;
  label: string;
  end: boolean;
  className: string;
  icon: IconName;
}[] = [
  { to: "/", label: en.nav.home, end: true, className: "bar-item", icon: "home" },
  { to: "/lessons", label: en.nav.lessons, end: false, className: "bar-item", icon: "book" },
  { to: "/log", label: en.nav.log, end: false, className: "bar-item", icon: "chart" },
  {
    to: "/when-to-call",
    label: en.nav.whenToCall,
    end: false,
    className: "bar-item bar-item--call",
    icon: "phone",
  },
];

/** Four stops, on every screen. "When to call" is always one tap away. */
export function BottomBar() {
  return (
    <nav className="bottom-bar" aria-label={en.nav.label}>
      <ul>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} className={item.className}>
              <Icon name={item.icon} />
              <span className="bar-item__label">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
