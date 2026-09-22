import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FarmProvider } from "./state/FarmContext";
import { AppShell } from "./components/layout/AppShell";
import { OverviewPage } from "./pages/OverviewPage";
import { FieldsPage } from "./pages/FieldsPage";
import { FieldDetailPage } from "./pages/FieldDetailPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { NotificationsPage } from "./pages/NotificationsPage";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <FarmProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/fields" element={<FieldsPage />} />
            <Route path="/fields/:fieldId" element={<FieldDetailPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </AppShell>
      </FarmProvider>
    </BrowserRouter>
  );
};

export default App;
