import { useEffect } from "react";
import { match, navigate, useRoute } from "./lib/router";
import { categoryService } from "./lib/categories";
import { UiHost } from "./lib/ui";
import { TabBar, isTabRoute } from "./components/TabBar";
import Home from "./views/Home";
import Bills from "./views/Bills";
import BillEdit from "./views/BillEdit";
import BillDetail from "./views/BillDetail";
import Capture from "./views/Capture";
import Processing from "./views/Processing";
import ReceiptConfirm from "./views/ReceiptConfirm";
import ProductConfirm from "./views/ProductConfirm";
import Categories from "./views/Categories";
import Journal from "./views/Journal";
import JournalBook from "./views/JournalBook";
import JournalEditor from "./views/JournalEditor";
import Mine from "./views/Mine";
import Stickers from "./views/Stickers";
import Settings from "./views/Settings";
import Privacy from "./views/Privacy";

function Routes({ path }: { path: string }) {
  if (path === "/") return <Home />;
  if (path === "/bills") return <Bills />;
  if (path === "/bills/edit") return <BillEdit />;
  if (match("/bills/edit/:id", path)) return <BillEdit />;
  if (match("/bills/:id", path)) return <BillDetail />;
  if (path === "/capture") return <Capture />;
  if (path === "/processing") return <Processing />;
  if (path === "/receipt-confirm") return <ReceiptConfirm />;
  if (path === "/product-confirm") return <ProductConfirm />;
  if (path === "/categories") return <Categories />;
  if (path === "/journal") return <Journal />;
  if (path === "/journal/editor") return <JournalEditor />;
  if (match("/journal/:bookId", path)) return <JournalBook />;
  if (path === "/mine") return <Mine />;
  if (path === "/mine/stickers") return <Stickers />;
  if (path === "/mine/settings") return <Settings />;
  if (path === "/mine/privacy") return <Privacy />;
  return <Home />;
}

export default function App() {
  const route = useRoute();

  useEffect(() => {
    categoryService.ensureSeeded();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (route.path !== "/" && !match("/bills/:id", route.path)) {
      // no-op: keeps hash routing consistent when a deep link is opened directly
    }
  }, [route.path]);

  useEffect(() => {
    const known = [
      "/",
      "/bills",
      "/bills/edit",
      "/capture",
      "/processing",
      "/receipt-confirm",
      "/product-confirm",
      "/categories",
      "/journal",
      "/journal/editor",
      "/mine",
      "/mine/stickers",
      "/mine/settings",
      "/mine/privacy",
    ];
    if (!known.includes(route.path) && !match("/bills/:id", route.path) && !match("/bills/edit/:id", route.path) && !match("/journal/:bookId", route.path)) {
      navigate("/");
    }
  }, [route.path]);

  return (
    <div className="app">
      <div className="aurora" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>
      <main className="content">
        <Routes path={route.path} />
      </main>
      {isTabRoute(route.path) && <TabBar />}
      <UiHost />
    </div>
  );
}
