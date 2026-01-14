import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppContextProvider } from "@/lib/app-context";
import NotFound from "@/pages/not-found";

import MarketingHome from "@/pages/marketing/MarketingHome";
import CorporateTraining from "@/pages/marketing/CorporateTraining";
import MarketingAgencies from "@/pages/marketing/MarketingAgencies";
import Blog from "@/pages/marketing/Blog";
import BlogPost from "@/pages/marketing/BlogPost";
import BookDemo from "@/pages/marketing/BookDemo";
import Pricing from "@/pages/marketing/Pricing";
import CustomBranding from "@/pages/enterprise/CustomBranding";
import PrivacyPolicy from "@/pages/legal/PrivacyPolicy";
import TermsOfService from "@/pages/legal/TermsOfService";
import CookiePolicy from "@/pages/legal/CookiePolicy";
import Security from "@/pages/legal/Security";
import Support from "@/pages/Support";
import Origins from "@/pages/Origins";
import PreviewRedirect from "@/pages/PreviewRedirect";
import IceMakerCreate from "@/pages/icemaker/IceMakerCreate";
import IceMakerTemplates from "@/pages/icemaker/IceMakerTemplates";
import IceMakerSettings from "@/pages/icemaker/IceMakerSettings";
import Library from "@/pages/Library";
import Today from "@/pages/Today";
import CatchUp from "@/pages/CatchUp";
import Chat from "@/pages/Chat";
import Admin from "@/pages/Admin";
import SuperAdmin from "@/pages/SuperAdmin";
import AdminCreate from "@/pages/AdminCreate";
import AdminImport from "@/pages/AdminImport";
import AdminCpac from "@/pages/AdminCpac";
import AdminCardDetail from "@/pages/AdminCardDetail";
import AdminCardEdit from "@/pages/AdminCardEdit";
import AdminAudio from "@/pages/AdminAudio";
import TransformationsPage from "@/pages/admin/TransformationsPage";
import TransformationDetailPage from "@/pages/admin/TransformationDetailPage";
import CharacterCreatorPage from "@/pages/admin/CharacterCreatorPage";
import BlogPublisherPage from "@/pages/admin/BlogPublisherPage";
import GuestIceBuilderPage from "@/pages/GuestIceBuilderPage";
import CaptionDemo from "@/pages/CaptionDemo";
import CaptionComposerLab from "@/pages/caption-composer-lab";
import CreateIcePage from "@/pages/CreateIcePage";
import IceCheckoutPage from "@/pages/IceCheckoutPage";
import CheckoutSuccessPage from "@/pages/CheckoutSuccessPage";
import AdminUniverseDetail from "@/pages/AdminUniverseDetail";
import VisualBible from "@/pages/VisualBible";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";
import Experience from "@/pages/Experience";
import ExportPage from "@/pages/ExportPage";
import Journal from "@/pages/Journal";
import BecomeCreator from "@/pages/BecomeCreator";
import PublishedIcePage from "@/pages/PublishedIcePage";
import DiscoverPage from "@/pages/DiscoverPage";
import LeadsPage from "@/pages/LeadsPage";
import IceAnalyticsPage from "@/pages/IceAnalyticsPage";
import Onboarding from "@/pages/Onboarding";
import CreatorProfile from "@/pages/CreatorProfile";
import RequireAuth from "@/components/RequireAuth";
import { DebugPanel } from "@/components/DebugPanel";

function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedRoute(props: P) {
    return (
      <RequireAuth>
        <Component {...props} />
      </RequireAuth>
    );
  };
}

const ProtectedLibrary = withAuth(Library);
const ProtectedToday = withAuth(Today);
const ProtectedCatchUp = withAuth(CatchUp);
const ProtectedChat = withAuth(Chat);
const ProtectedJournal = withAuth(Journal);
const ProtectedProfile = withAuth(Profile);
const ProtectedBecomeCreator = withAuth(BecomeCreator);
const ProtectedAdmin = withAuth(Admin);
const ProtectedSuperAdmin = withAuth(SuperAdmin);
const ProtectedAdminCreate = withAuth(AdminCreate);
const ProtectedAdminImport = withAuth(AdminImport);
const ProtectedAdminCpac = withAuth(AdminCpac);
const ProtectedAdminAudio = withAuth(AdminAudio);
const ProtectedAdminCardDetail = withAuth(AdminCardDetail);
const ProtectedAdminCardEdit = withAuth(AdminCardEdit);
const ProtectedTransformationsPage = withAuth(TransformationsPage);
const ProtectedTransformationDetailPage = withAuth(TransformationDetailPage);
const ProtectedCharacterCreatorPage = withAuth(CharacterCreatorPage);
const ProtectedBlogPublisherPage = withAuth(BlogPublisherPage);
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
      <Route path="/corporate-training" component={CorporateTraining} />
      <Route path="/marketing-agencies" component={MarketingAgencies} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/book-demo" component={BookDemo} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/enterprise/custom-branding" component={CustomBranding} />
      
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/cookies" component={CookiePolicy} />
      <Route path="/security" component={Security} />
      <Route path="/support" component={Support} />
      <Route path="/help" component={Support} />
      <Route path="/origins" component={Origins} />
      <Route path="/preview/:id" component={PreviewRedirect} />
      
      <Route path="/library" component={Library} />
      <Route path="/icemaker" component={Library} />
      <Route path="/icemaker/create" component={IceMakerCreate} />
      <Route path="/icemaker/projects" component={Library} />
      <Route path="/icemaker/templates" component={IceMakerTemplates} />
      <Route path="/icemaker/settings" component={IceMakerSettings} />
      <Route path="/icemaker/captions" component={CaptionDemo} />
      <Route path="/icemaker/composer-lab" component={CaptionComposerLab} />

      <Route path="/ice/new" component={TransformationsPage} />
      <Route path="/create" component={CreateIcePage} />
      <Route path="/try" component={GuestIceBuilderPage} />
      <Route path="/ice/preview/:id" component={GuestIceBuilderPage} />
      <Route path="/ice/preview/:id/checkout" component={IceCheckoutPage} />
      <Route path="/ice/:shareSlug" component={PublishedIcePage} />
      <Route path="/discover" component={DiscoverPage} />
      <Route path="/leads" component={LeadsPage} />
      <Route path="/analytics" component={IceAnalyticsPage} />
      <Route path="/checkout/success" component={CheckoutSuccessPage} />
      <Route path="/checkout/cancel">{() => { window.location.href = "/icemaker"; return null; }}</Route>
      <Route path="/app" component={ProtectedLibrary} />
      <Route path="/launchpad" component={ProtectedLibrary} />
      <Route path="/stories" component={ProtectedLibrary} />
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
      <Route path="/super-admin" component={ProtectedSuperAdmin} />
      <Route path="/admin/create" component={ProtectedAdminCreate} />
      <Route path="/admin/import" component={ProtectedAdminImport} />
      <Route path="/admin/cpac" component={ProtectedAdminCpac} />
      <Route path="/admin/audio" component={ProtectedAdminAudio} />
      <Route path="/admin/cards/:id" component={ProtectedAdminCardDetail} />
      <Route path="/admin/cards/:id/edit" component={ProtectedAdminCardEdit} />
      <Route path="/admin/transformations" component={ProtectedTransformationsPage} />
      <Route path="/admin/transformations/:id" component={ProtectedTransformationDetailPage} />
      <Route path="/admin/characters/new" component={ProtectedCharacterCreatorPage} />
      <Route path="/admin/blog" component={ProtectedBlogPublisherPage} />
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
      <ThemeProvider>
        <AuthProvider>
          <AppContextProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
              {import.meta.env.DEV && <DebugPanel />}
            </TooltipProvider>
          </AppContextProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
