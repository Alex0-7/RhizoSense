import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FarmProvider } from "./state/FarmContext";
import { AppShell } from "./components/layout/AppShell";

// Farmer App Screens (V2)
import { FarmHomePage } from "./pages/farmer/FarmHomePage";
import { FieldMapPage } from "./pages/farmer/FieldMapPage";
import { DiseaseDetectionPage } from "./pages/farmer/DiseaseDetectionPage";
import { CropScanPage } from "./pages/farmer/CropScanPage";
import { DiagnosisPage } from "./pages/farmer/DiagnosisPage";
import { AdvisoryPage } from "./pages/farmer/AdvisoryPage";
import { WhyPage } from "./pages/farmer/WhyPage";
import { OfflineSyncPage } from "./pages/farmer/OfflineSyncPage";

// FPO / Admin Dashboard Screens (V1 Preserved & Adapted)
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
            {/* Farmer App (V2 Core Workflow) */}
            <Route path="/" element={<Navigate to="/farmer" replace />} />
            <Route path="/farmer" element={<FarmHomePage />} />
            <Route path="/farmer/map" element={<FieldMapPage />} />
            <Route path="/farmer/detection" element={<DiseaseDetectionPage />} />
            <Route path="/farmer/scan" element={<CropScanPage />} />
            <Route path="/farmer/diagnosis" element={<DiagnosisPage />} />
            <Route path="/farmer/advisory" element={<AdvisoryPage />} />
            <Route path="/farmer/why" element={<WhyPage />} />
            <Route path="/farmer/offline" element={<OfflineSyncPage />} />

            {/* FPO / Admin Dashboard */}
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/admin" element={<Navigate to="/overview" replace />} />
            <Route path="/fields" element={<FieldsPage />} />
            <Route path="/fields/:fieldId" element={<FieldDetailPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/farmer" replace />} />
          </Routes>
        </AppShell>
      </FarmProvider>
    </BrowserRouter>
  );
};

export default App;
