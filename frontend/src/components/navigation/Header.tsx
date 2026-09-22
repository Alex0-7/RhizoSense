import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Bell, User, Sprout, Menu, X } from "lucide-react";
import { useFarm } from "../../state/FarmContext";
import { EdgeStatusIndicator } from "../status/EdgeStatusIndicator";

export const Header: React.FC = () => {
  const { connectionStatus, activeNotificationsCount } = useFarm();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { to: "/overview", label: "Overview" },
    { to: "/fields", label: "Fields" },
    { to: "/analytics", label: "Analytics" },
    { to: "/notifications", label: "Notifications" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-borderDefault">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Branding & Primary Navigation */}
        <div className="flex items-center gap-8">
          <Link to="/overview" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-btn bg-[#EBF5EE] text-[#265C39] border border-[#C2E2CC] flex items-center justify-center transition-transform group-hover:scale-105">
              <Sprout size={18} />
            </div>
            <span className="text-lg font-bold text-primaryText tracking-tight">RhizoSense</span>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-1">
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-btn text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-surface-secondary text-primaryText font-semibold"
                      : "text-secondaryText hover:text-primaryText hover:bg-surface-hover"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right: Edge Status -> Profile -> Notification Bell */}
        <div className="flex items-center gap-3 sm:gap-4">
          <EdgeStatusIndicator status={connectionStatus} className="hidden sm:inline-flex" />

          {/* Profile Button */}
          <div className="relative">
            <button
              className="p-2 rounded-full text-secondaryText hover:text-primaryText hover:bg-surface-secondary transition-colors flex items-center justify-center border border-borderDefault/70"
              aria-label="User profile settings"
            >
              <User size={17} />
            </button>
          </div>

          {/* Notification Bell */}
          <Link
            to="/notifications"
            className="relative p-2 rounded-full text-secondaryText hover:text-primaryText hover:bg-surface-secondary transition-colors"
            aria-label={`Notifications${activeNotificationsCount > 0 ? `, ${activeNotificationsCount} unread` : ""}`}
          >
            <Bell size={18} />
            {activeNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-status-critical text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {activeNotificationsCount}
              </span>
            )}
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded text-secondaryText hover:text-primaryText"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-borderDefault bg-surface px-4 py-3 space-y-1">
          <div className="pb-2 mb-2 border-b border-borderDefault sm:hidden">
            <EdgeStatusIndicator status={connectionStatus} />
          </div>
          {navLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-btn text-xs font-medium ${
                  isActive
                    ? "bg-surface-secondary text-primaryText font-semibold"
                    : "text-secondaryText hover:text-primaryText"
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
