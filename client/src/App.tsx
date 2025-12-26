import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppContextProvider } from "@/lib/app-context";
import NotFound from "@/pages/not-found";

import MarketingHome from "@/pages/marketing/MarketingHome";
import ForNews from "@/pages/marketing/ForNews";
import ForBusiness from "@/pages/marketing/ForBusiness";
import ForInfluencer from "@/pages/marketing/ForInfluencer";
import ForEducator from "@/pages/marketing/ForEducator";

import Home from "@/pages/Home";
import Today from "@/pages/Today";
import CatchUp from "@/pages/CatchUp";
import Chat from "@/pages/Chat";
import Admin from "@/pages/Admin";
import AdminCreate from "@/pages/AdminCreate";
import AdminImport from "@/pages/AdminImport";
import AdminCardDetail from "@/pages/AdminCardDetail";
import AdminCardEdit from "@/pages/AdminCardEdit";
import AdminAudio from "@/pages/AdminAudio";
import TransformationsPage from "@/pages/admin/TransformationsPage";
import TransformationDetailPage from "@/pages/admin/TransformationDetailPage";
import CharacterCreatorPage from "@/pages/admin/CharacterCreatorPage";
import AdminUniverseDetail from "@/pages/AdminUniverseDetail";
import VisualBible from "@/pages/VisualBible";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";
import Experience from "@/pages/Experience";
import ExportPage from "@/pages/ExportPage";
import Journal from "@/pages/Journal";
import BecomeCreator from "@/pages/BecomeCreator";
import Onboarding from "@/pages/Onboarding";
import CreatorProfile from "@/pages/CreatorProfile";
import RequireAuth from "@/components/RequireAuth";

function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedRoute(props: P) {
    return (
      <RequireAuth>
        <Component {...props} />
      </RequireAuth>
    );
  };
}

const ProtectedHome = withAuth(Home);
const ProtectedToday = withAuth(Today);
const ProtectedCatchUp = withAuth(CatchUp);
const ProtectedChat = withAuth(Chat);
const ProtectedJournal = withAuth(Journal);
const ProtectedProfile = withAuth(Profile);
const ProtectedBecomeCreator = withAuth(BecomeCreator);
const ProtectedAdmin = withAuth(Admin);
const ProtectedAdminCreate = withAuth(AdminCreate);
const ProtectedAdminImport = withAuth(AdminImport);
const ProtectedAdminAudio = withAuth(AdminAudio);
const ProtectedAdminCardDetail = withAuth(AdminCardDetail);
const ProtectedAdminCardEdit = withAuth(AdminCardEdit);
const ProtectedTransformationsPage = withAuth(TransformationsPage);
const ProtectedTransformationDetailPage = withAuth(TransformationDetailPage);
const ProtectedCharacterCreatorPage = withAuth(CharacterCreatorPage);
const ProtectedAdminUniverseDetail = withAuth(AdminUniverseDetail);
const ProtectedVisualBible = withAuth(VisualBible);
const ProtectedExportPage = withAuth(ExportPage);
const ProtectedOnboarding = withAuth(Onboarding);

function Router() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={MarketingHome} />
      <Route path="/for/news" component={ForNews} />
      <Route path="/for/business" component={ForBusiness} />
      <Route path="/for/influencer" component={ForInfluencer} />
      <Route path="/for/educator" component={ForEducator} />
      <Route path="/app" component={ProtectedHome} />
      <Route path="/onboarding" component={ProtectedOnboarding} />
      <Route path="/login" component={Login} />
      <Route path="/profile" component={ProtectedProfile} />
      <Route path="/today" component={ProtectedToday} />
      <Route path="/card/:id" component={ProtectedToday} />
      <Route path="/catch-up" component={ProtectedCatchUp} />
      <Route path="/chat" component={ProtectedChat} />
      <Route path="/journal" component={ProtectedJournal} />
      <Route path="/story/:slug" component={Experience} />
      <Route path="/creator/:slug" component={CreatorProfile} />
      <Route path="/become-creator" component={ProtectedBecomeCreator} />
      <Route path="/admin" component={ProtectedAdmin} />
      <Route path="/admin/create" component={ProtectedAdminCreate} />
      <Route path="/admin/import" component={ProtectedAdminImport} />
      <Route path="/admin/audio" component={ProtectedAdminAudio} />
      <Route path="/admin/cards/:id" component={ProtectedAdminCardDetail} />
      <Route path="/admin/cards/:id/edit" component={ProtectedAdminCardEdit} />
      <Route path="/admin/transformations" component={ProtectedTransformationsPage} />
      <Route path="/admin/transformations/:id" component={ProtectedTransformationDetailPage} />
      <Route path="/admin/characters/new" component={ProtectedCharacterCreatorPage} />
      <Route path="/admin/universes/:id" component={ProtectedAdminUniverseDetail} />
      <Route path="/admin/universes/:id/visual-bible" component={ProtectedVisualBible} />
      <Route path="/admin/universes/:id/export" component={ProtectedExportPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContextProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AppContextProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
