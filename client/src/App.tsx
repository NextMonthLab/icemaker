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
import ForNews from "@/pages/marketing/ForNews";
import ForBusiness from "@/pages/marketing/ForBusiness";
import ForInfluencer from "@/pages/marketing/ForInfluencer";
import ForEducator from "@/pages/marketing/ForEducator";
import ForBrands from "@/pages/marketing/ForBrands";
import ForCreators from "@/pages/marketing/ForCreators";
import ForKnowledge from "@/pages/marketing/ForKnowledge";
import AIDiscoveryControl from "@/pages/marketing/AIDiscoveryControl";
import PrivacyPolicy from "@/pages/legal/PrivacyPolicy";
import TermsOfService from "@/pages/legal/TermsOfService";
import CookiePolicy from "@/pages/legal/CookiePolicy";
import Security from "@/pages/legal/Security";
import PreviewRedirect from "@/pages/PreviewRedirect";
import OrbitView from "@/pages/orbit/OrbitView";
import KioskOrbitView from "@/pages/orbit/KioskOrbitView";
import DataHub from "@/pages/orbit/DataHub";
import HeroPosts from "@/pages/orbit/HeroPosts";
import OrbitHome from "@/pages/orbit/OrbitHome";
import MyOrbits from "@/pages/orbit/MyOrbits";
import OrbitMap from "@/pages/orbit/OrbitMap";
import OrbitIntelligence from "@/pages/orbit/OrbitIntelligence";
import OrbitActions from "@/pages/orbit/OrbitActions";
import OrbitSettings from "@/pages/orbit/OrbitSettings";
import OrbitClaim from "@/pages/orbit/OrbitClaim";
import CatalogueImport from "@/pages/orbit/CatalogueImport";
import SocialProofLibrary from "@/pages/orbit/SocialProofLibrary";
import IceMakerHome from "@/pages/icemaker/IceMakerHome";
import IceMakerCreate from "@/pages/icemaker/IceMakerCreate";
import IceMakerProjects from "@/pages/icemaker/IceMakerProjects";
import IceMakerTemplates from "@/pages/icemaker/IceMakerTemplates";
import IceMakerSettings from "@/pages/icemaker/IceMakerSettings";
import Library from "@/pages/Library";
import { useSearch } from "wouter";

function OrbitRouter() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const isKiosk = params.get('kiosk') === '1';
  const isVoice = params.get('voice') === '1';
  
  if (isKiosk || isVoice) {
    return <KioskOrbitView />;
  }
  
  return <OrbitView />;
}

import Home from "@/pages/Home";
import Launchpad from "@/pages/Launchpad";
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
import IndustryOrbitAssets from "@/pages/admin/IndustryOrbitAssets";
import GuestIceBuilderPage from "@/pages/GuestIceBuilderPage";
import CaptionDemo from "@/pages/CaptionDemo";
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

const ProtectedHome = withAuth(Home);
const ProtectedLaunchpad = withAuth(Launchpad);
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
const ProtectedIndustryOrbitAssets = withAuth(IndustryOrbitAssets);
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
      <Route path="/for/brands" component={ForBrands} />
      <Route path="/for/creators" component={ForCreators} />
      <Route path="/for/knowledge" component={ForKnowledge} />
      <Route path="/ai-discovery-control" component={AIDiscoveryControl} />
      <Route path="/ai-discovery" component={AIDiscoveryControl} />
      
      <Route path="/smartglasses">{() => { window.location.href = "/orbit/smart-glasses"; return null; }}</Route>
      <Route path="/smartglasses/partners">{() => { window.location.href = "/orbit/smart-glasses"; return null; }}</Route>
      
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/cookies" component={CookiePolicy} />
      <Route path="/security" component={Security} />
      <Route path="/preview/:id" component={PreviewRedirect} />
      
      <Route path="/library" component={Library} />
      <Route path="/icemaker" component={Library} />
      <Route path="/icemaker/create" component={IceMakerCreate} />
      <Route path="/icemaker/projects" component={Library} />
      <Route path="/icemaker/templates" component={IceMakerTemplates} />
      <Route path="/icemaker/settings" component={IceMakerSettings} />
      <Route path="/icemaker/captions" component={CaptionDemo} />
      
      <Route path="/orbit" component={OrbitHome} />
      <Route path="/orbit/my" component={MyOrbits} />
      <Route path="/orbit/map" component={OrbitMap} />
      <Route path="/orbit/intelligence" component={OrbitIntelligence} />
      <Route path="/orbit/actions" component={OrbitActions} />
      <Route path="/orbit/settings" component={OrbitSettings} />
      <Route path="/orbit/claim" component={OrbitClaim} />
      
      <Route path="/o/:slug" component={OrbitRouter} />
      <Route path="/orbit/:slug" component={OrbitRouter} />
      <Route path="/orbit/:slug/claim" component={OrbitView} />
      <Route path="/orbit/:slug/hub" component={DataHub} />
      <Route path="/orbit/:slug/datahub" component={DataHub} />
      <Route path="/orbit/:slug/hero-posts" component={HeroPosts} />
      <Route path="/orbit/:slug/sources" component={OrbitSettings} />
      <Route path="/orbit/:slug/settings" component={OrbitSettings} />
      <Route path="/orbit/:slug/import" component={CatalogueImport} />
      <Route path="/orbit/:slug/proof" component={SocialProofLibrary} />
      <Route path="/ice/new" component={TransformationsPage} />
      <Route path="/try" component={GuestIceBuilderPage} />
      <Route path="/ice/preview/:id" component={GuestIceBuilderPage} />
      <Route path="/ice/preview/:id/checkout" component={IceCheckoutPage} />
      <Route path="/checkout/success" component={CheckoutSuccessPage} />
      <Route path="/checkout/cancel">{() => { window.location.href = "/icemaker"; return null; }}</Route>
      <Route path="/app" component={ProtectedLaunchpad} />
      <Route path="/launchpad" component={ProtectedLaunchpad} />
      <Route path="/stories" component={ProtectedHome} />
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
      <Route path="/admin/industry-assets" component={ProtectedIndustryOrbitAssets} />
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
