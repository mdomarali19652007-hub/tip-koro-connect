import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import UserProfile from "./pages/UserProfile";
import DonationPage from "./pages/DonationPage";
import ThankYou from "./pages/ThankYou";
import Dashboard from "./pages/Dashboard";
import ProfileEdit from "./pages/ProfileEdit";
import SubscriptionPage from "./pages/SubscriptionPage";
import WithdrawalsPage from "./pages/WithdrawalsPage";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile/edit" element={<ProfileEdit />} />
            <Route path="/subscription" element={<SubscriptionPage />} />
            <Route path="/withdrawals" element={<WithdrawalsPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/u/:username" element={<UserProfile />} />
            <Route path="/d/:username" element={<DonationPage />} />
            <Route path="/thankyou/:txnId" element={<ThankYou />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
