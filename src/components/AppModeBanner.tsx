import { APP_MODE, isProduction } from "@/lib/appMode";
import { FlaskConical, Eye } from "lucide-react";

const MODE_CONFIG = {
  demo: {
    label: "MODO DEMO",
    icon: Eye,
    className: "bg-amber-500/90 text-white",
  },
  test: {
    label: "MODO TESTE",
    icon: FlaskConical,
    className: "bg-orange-500/90 text-white",
  },
  production: {
    label: "",
    icon: null,
    className: "",
  },
} as const;

const AppModeBanner = () => {
  if (isProduction) return null;

  const config = MODE_CONFIG[APP_MODE];
  const Icon = config.icon!;

  return (
    <div
      className={`fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 py-1 text-xs font-bold tracking-wider ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </div>
  );
};

export default AppModeBanner;
