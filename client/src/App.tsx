import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { AppContextProvider } from "@/lib/app-context";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Today from "@/pages/Today";
import CatchUp from "@/pages/CatchUp";
import Chat from "@/pages/Chat";
import Admin from "@/pages/Admin";
import AdminCreate from "@/pages/AdminCreate";
import AdminImport from "@/pages/AdminImport";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/profile" component={Profile} />
      <Route path="/today" component={Today} />
      <Route path="/catch-up" component={CatchUp} />
      <Route path="/chat" component={Chat} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/create" component={AdminCreate} />
      <Route path="/admin/import" component={AdminImport} />
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
