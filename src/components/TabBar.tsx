import { navigate, useRoute } from "../lib/router";
import { BillsIcon, HomeIcon, JournalIcon, MineIcon } from "./icons";

const TABS = [
  { to: "/", icon: <HomeIcon />, label: "首页" },
  { to: "/bills", icon: <BillsIcon />, label: "账单" },
  { to: "/journal", icon: <JournalIcon />, label: "手账" },
  { to: "/mine", icon: <MineIcon />, label: "我的" },
];

export function TabBar() {
  const route = useRoute();
  const active = (to: string) =>
    to === "/" ? route.path === "/" : route.path === to || route.path.startsWith(to + "/");
  return (
    <nav className="tabbar glass">
      {TABS.map((tab) => (
        <button
          key={tab.to}
          className={active(tab.to) ? "tab active" : "tab"}
          onClick={() => navigate(tab.to)}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

const TAB_ROUTES = ["/", "/bills", "/journal", "/mine"];

export function isTabRoute(path: string): boolean {
  return TAB_ROUTES.some((p) => p === path);
}
