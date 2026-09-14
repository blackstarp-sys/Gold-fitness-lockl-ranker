import React, { Suspense } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Reviews from './pages/Reviews.tsx';
import Posts from './pages/Posts.tsx';
import Analytics from './pages/Analytics.tsx';
import Login from './pages/Login.tsx';
import SocialConfig from './pages/SocialConfig.tsx';
import BusinessProfile from './pages/BusinessProfile.tsx';
import KeywordTracker from './pages/KeywordTracker.tsx';
import Competitors from './pages/Competitors.tsx';
import CitationManager from './pages/CitationManager.tsx';
import WebsiteAudit from './pages/WebsiteAudit.tsx';
import ReviewAutomation from './pages/ReviewAutomation.tsx';
import ReplyTemplates from './pages/ReplyTemplates.tsx';
import AIContentStudio from './pages/AIContentStudio.tsx';
import AIImageGen from './pages/AIImageGen.tsx';
import Programs from './pages/Campaigns.tsx';
import WhatsApp from './pages/WhatsApp.tsx';
import Settings from './pages/Settings.tsx';

import ProtectedRoute from './components/ProtectedRoute.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { Loader2 } from 'lucide-react';

import './lib/i18n.ts';

import ManagePlan from './pages/ManagePlan.tsx';
import Media from './pages/Media.tsx';
import LocalRank from './pages/LocalRank.tsx';
import Billing from './pages/Billing.tsx';
import UsageCredits from './pages/UsageCredits.tsx';
import Notifications from './pages/Notifications.tsx';
import Diagnostics from './pages/Diagnostics.tsx';

function AppContent() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={
          <div className="flex h-screen w-full items-center justify-center bg-[#070B16]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="manage-plan" element={<ManagePlan />} />
                
                <Route path="google-business" element={<BusinessProfile />} />
                <Route path="locations" element={<BusinessProfile />} />
                <Route path="business-profile" element={<BusinessProfile />} />
                <Route path="one-click-optimization" element={<ReviewAutomation />} />
                <Route path="google-audit" element={<WebsiteAudit />} />
                <Route path="google-posts" element={<Posts />} />
                <Route path="reviews" element={<Reviews />} />
                <Route path="reply-templates" element={<ReplyTemplates />} />
                <Route path="media" element={<Media />} />

                <Route path="ai-mode" element={<AIContentStudio />} />
                <Route path="ai-media" element={<AIImageGen />} />
                <Route path="campaigns" element={<Programs />} />
                <Route path="social-config" element={<SocialConfig />} />
                <Route path="whatsapp" element={<WhatsApp />} />

                <Route path="local-rank" element={<LocalRank />} />
                <Route path="keywords" element={<KeywordTracker />} />
                <Route path="competitors" element={<Competitors />} />
                <Route path="citations" element={<CitationManager />} />
                <Route path="reports" element={<Analytics />} />

                <Route path="billing" element={<Billing />} />
                <Route path="usage" element={<UsageCredits />} />

                <Route path="notifications" element={<Notifications />} />
                <Route path="diagnostics" element={<Diagnostics />} />
                <Route path="settings" element={<Settings />} />

                {/* Legacy paths for compatibility */}
                <Route path="business-profile" element={<Navigate to="/google-business" replace />} />
                <Route path="audit" element={<Navigate to="/google-audit" replace />} />
                <Route path="ai-studio" element={<Navigate to="/ai-mode" replace />} />
                <Route path="ai-images" element={<Navigate to="/ai-media" replace />} />
                <Route path="analytics" element={<Navigate to="/reports" replace />} />
                <Route path="review-automation" element={<Navigate to="/one-click-optimization" replace />} />
              </Route>
            </Route>
            
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
