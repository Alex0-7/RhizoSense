import React from "react";
import { Header } from "../navigation/Header";
import { NotificationToastContainer } from "../notifications/NotificationToastContainer";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-[#C2E2CC] selection:text-[#265C39]">
      <Header />
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
      <NotificationToastContainer />
    </div>
  );
};
