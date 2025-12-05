import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load page components for code splitting
const MasterDashboard = lazy(() => import("./pages/MasterDashboard"));
const TIEBoard = lazy(() => import("./pages/TIEBoard"));
const SFDCBoard = lazy(() => import("./pages/SFDCBoard"));
const DepartmentView = lazy(() => import("./pages/DepartmentView"));
const BlockersView = lazy(() => import("./pages/BlockersView"));
const AITeammateDashboard = lazy(() => import("./pages/AITeammateDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-background p-8">
    <div className="max-w-7xl mx-auto space-y-8">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <main className="flex-1">
              <header className="h-14 flex items-center border-b border-border px-4 bg-card">
                <SidebarTrigger />
                <h2 className="ml-4 font-semibold text-foreground">Ticket Response Analytics</h2>
              </header>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<MasterDashboard />} />
                  <Route path="/tie" element={<TIEBoard />} />
                  <Route path="/sfdc" element={<SFDCBoard />} />
                  <Route path="/departments" element={<DepartmentView />} />
                  <Route path="/blockers" element={<BlockersView />} />
                  <Route path="/ai-teammates" element={<AITeammateDashboard />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </SidebarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </ErrorBoundary>
);

export default App;
