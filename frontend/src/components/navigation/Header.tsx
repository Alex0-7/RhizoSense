import React, { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Bell,
  Sprout,
  Menu,
  X,
  Wifi,
  WifiOff,
  LayoutDashboard,
  Smartphone,
  Map,
  Camera,
  FileText,
  HelpCircle,
  CheckCircle,
  CloudUpload,
} from "lucide-react";
import { useFarm } from "../../state/FarmContext";
import { EdgeStatusIndicator } from "../status/EdgeStatusIndicator";

export const Header: React.FC = () => {
  const {
    connectionStatus,
    activeNotificationsCount,
    network,
    pendingSyncCount,
    interfaceMode,
    setInterfaceMode,
  } = useFarm();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Determine current mode from path if explicit
  const isFarmerPath = location.pathname.startsWith("/farmer") || location.pathname === "/";
  const currentMode = isFarmerPath ? "farmer" : "admin";

  const farmerNavLinks = [
    { to: "/farmer", label: "Home" },
    { to: "/farmer/map", label: "5m Map" },
    { to: "/farmer/detection", label: "Disease Detection" },
    { to: "/farmer/scan", label: "Crop Scan" },
    { to: "/farmer/diagnosis", label: "Diagnosis" },
    { to: "/farmer/advisory", label: "Advisory" },
    { to: "/farmer/why", label: "Why?" },
    { to: "/farmer/offline", label: "Sync" },
  ];

  const adminNavLinks = [
    { to: "/overview", label: "Overview" },
    { to: "/fields", label: "Fields" },
    { to: "/analytics", label: "Analytics" },
    { to: "/notifications", label: "Action Queue" },
  ];

  const activeLinks = currentMode === "farmer" ? farmerNavLinks : adminNavLinks;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4">
        {/* Left: Brand & Mode Toggle */}
        <div className="flex items-center gap-3 sm:gap-6">
          <Link to="/farmer" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center transition-transform group-hover:scale-105 shadow-2xs">
              <Sprout size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none">
                RhizoSense
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 tracking-wider uppercase">
                V2 Smart Farming
              </span>
            </div>
          </Link>

          {/* Dual-Mode Interface Switcher */}
          <div className="hidden lg:flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <Link
              to="/farmer"
              onClick={() => setInterfaceMode("farmer")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                currentMode === "farmer"
                  ? "bg-white text-emerald-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Smartphone size={13} />
              Farmer App (7 Screens)
            </Link>

            <Link
              to="/overview"
              onClick={() => setInterfaceMode("admin")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                currentMode === "admin"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutDashboard size={13} />
              FPO / Admin Dashboard
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-1">
            {activeLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/farmer" || item.to === "/overview"}
                className={({ isActive }) =>
                  `px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-emerald-50 text-emerald-900 font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right: Offline Status -> Edge Status -> Mode Toggle (Mobile) -> Notification Bell */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Offline / Online Status Badge */}
          <Link
            to="/farmer/offline"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              network === "online"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-amber-100 border-amber-300 text-amber-900 animate-pulse"
            }`}
          >
            {network === "online" ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span className="hidden sm:inline">
              {network === "online" ? "Online" : "Offline Mode"}
            </span>
            {pendingSyncCount > 0 && (
              <span className="bg-amber-600 text-white rounded-full px-1.5 text-[10px] font-bold">
                {pendingSyncCount}
              </span>
            )}
          </Link>

          <EdgeStatusIndicator status={connectionStatus} className="hidden xl:inline-flex" />

          {/* Mode Switcher Shortcut for Small Screens */}
          <Link
            to={currentMode === "farmer" ? "/overview" : "/farmer"}
            className="lg:hidden p-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors text-xs font-bold"
            title="Switch Interface Mode"
          >
            {currentMode === "farmer" ? "FPO Mode" : "Farmer App"}
          </Link>

          {/* Notifications Bell */}
          <Link
            to="/notifications"
            className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label={`Notifications${
              activeNotificationsCount > 0 ? `, ${activeNotificationsCount} unread` : ""
            }`}
          >
            <Bell size={18} />
            {activeNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {activeNotificationsCount}
              </span>
            )}
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          <div className="flex gap-2 pb-2 mb-2 border-b border-slate-100">
            <Link
              to="/farmer"
              onClick={() => {
                setInterfaceMode("farmer");
                setMobileMenuOpen(false);
              }}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-lg ${
                currentMode === "farmer" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              Farmer App (7 Screens)
            </Link>
            <Link
              to="/overview"
              onClick={() => {
                setInterfaceMode("admin");
                setMobileMenuOpen(false);
              }}
              className={`flex-1 text-center py-2 text-xs font-bold rounded-lg ${
                currentMode === "admin" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              FPO / Admin Dashboard
            </Link>
          </div>

          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
            {currentMode === "farmer" ? "Farmer Workflow" : "Admin Operations"}
          </div>

          {activeLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/farmer" || item.to === "/overview"}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-xs font-semibold ${
                  isActive ? "bg-emerald-50 text-emerald-950 font-bold" : "text-slate-600"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
};
