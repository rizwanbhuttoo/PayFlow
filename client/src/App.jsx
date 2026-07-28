import { Redirect, Route, Switch } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import ForgotPasswordPage from "./features/auth/ForgotPasswordPage";
import ResetPasswordPage from "./features/auth/ResetPasswordPage";
import VerifyEmailPage from "./features/auth/VerifyEmailPage";
import DashboardPage from "./features/dashboard/DashboardPage";
import StripePage from "./features/stripe/StripePage";
import PaymentLinksPage from "./features/payment-links/PaymentLinksPage";
import CreatePaymentLinkPage from "./features/payment-links/CreatePaymentLinkPage";
import PaymentLinkDetailPage from "./features/payment-links/PaymentLinkDetailPage";
import TransactionsPage from "./features/transactions/TransactionsPage";
import TransactionDetailPage from "./features/transactions/TransactionDetailPage";
import ProfilePage from "./features/profile/ProfilePage";
import SettingsPage from "./features/settings/SettingsPage";
import NotFoundPage from "./pages/NotFoundPage";
import ErrorPage from "./pages/ErrorPage";
import SubscriptionPlansPage from "./features/subscription-plans/SubscriptionPlansPage";
import CreateSubscriptionPlanPage from "./features/subscription-plans/CreateSubscriptionPlanPage";
import SubscriptionPlanDetailPage from "./features/subscription-plans/SubscriptionPlanDetailPage";
import SubscriptionsPage from "./features/subscriptions/SubscriptionsPage";
import SubscriptionDetailPage from "./features/subscriptions/SubscriptionDetailPage";
import SubscriptionInvoicesPage from "./features/subscription-invoices/SubscriptionInvoicesPage";
import SubscriptionInvoiceDetailPage from "./features/subscription-invoices/SubscriptionInvoiceDetailPage";
import SubscriptionSuccessPage from "./features/subscriptions/SubscriptionSuccessPage";
import SubscriptionCanceledPage from "./features/subscriptions/SubscriptionCanceledPage";
import ManageSubscriptionPage from "./features/subscriptions/ManageSubscriptionPage";
import CustomersPage from "./features/customers/CustomersPage";
import CustomerDetailPage from "./features/customers/CustomerDetailPage";
import NewCustomerPage from "./features/customers/NewCustomerPage";
import PaymentSuccessPage from "./features/payment-links/PaymentSuccessPage";
import PaymentCanceledPage from "./features/payment-links/PaymentCanceledPage";

function ProtectedPage({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Switch>
      <Route exact path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route exact path="/login" component={LoginPage} />
      <Route exact path="/register" component={RegisterPage} />
      <Route exact path="/forgot-password" component={ForgotPasswordPage} />
      <Route exact path="/reset-password" component={ResetPasswordPage} />
      <Route exact path="/verify-email" component={VerifyEmailPage} />
      <Route exact path="/subscription-success" component={SubscriptionSuccessPage} />
      <Route exact path="/subscription-canceled" component={SubscriptionCanceledPage} />
      <Route exact path="/manage-subscription" component={ManageSubscriptionPage} />
      <Route exact path="/payment-success" component={PaymentSuccessPage} />
      <Route exact path="/payment-canceled" component={PaymentCanceledPage} />
      <Route exact path="/dashboard">
        <ProtectedPage><DashboardPage /></ProtectedPage>
      </Route>
      <Route exact path={["/stripe", "/stripe/return", "/stripe/refresh"]}>
        <ProtectedPage><StripePage /></ProtectedPage>
      </Route>
      <Route exact path="/payment-links">
        <ProtectedPage><PaymentLinksPage /></ProtectedPage>
      </Route>
      <Route exact path="/payment-links/new">
        <ProtectedPage><CreatePaymentLinkPage /></ProtectedPage>
      </Route>
      <Route exact path="/payment-links/:id">
        <ProtectedPage><PaymentLinkDetailPage /></ProtectedPage>
      </Route>
      <Route exact path="/transactions">
        <ProtectedPage><TransactionsPage /></ProtectedPage>
      </Route>
      <Route exact path="/transactions/:id">
        <ProtectedPage><TransactionDetailPage /></ProtectedPage>
      </Route>
      <Route exact path="/customers">
        <ProtectedPage><CustomersPage /></ProtectedPage>
      </Route>
      <Route exact path="/customers/new">
        <ProtectedPage><NewCustomerPage /></ProtectedPage>
      </Route>
      <Route exact path="/customers/:id">
        <ProtectedPage><CustomerDetailPage /></ProtectedPage>
      </Route>
      <Route exact path="/subscription-plans">
        <ProtectedPage><SubscriptionPlansPage /></ProtectedPage>
      </Route>
      <Route exact path="/subscription-plans/new">
        <ProtectedPage><CreateSubscriptionPlanPage /></ProtectedPage>
      </Route>
      <Route exact path="/subscription-plans/:id">
        <ProtectedPage><SubscriptionPlanDetailPage /></ProtectedPage>
      </Route>
      <Route exact path="/subscriptions">
        <ProtectedPage><SubscriptionsPage /></ProtectedPage>
      </Route>
      <Route exact path="/subscriptions/:id">
        <ProtectedPage><SubscriptionDetailPage /></ProtectedPage>
      </Route>
      <Route exact path="/subscription-invoices">
        <ProtectedPage><SubscriptionInvoicesPage /></ProtectedPage>
      </Route>
      <Route exact path="/subscription-invoices/:id">
        <ProtectedPage><SubscriptionInvoiceDetailPage /></ProtectedPage>
      </Route>
      <Route exact path="/profile">
        <ProtectedPage><ProfilePage /></ProtectedPage>
      </Route>
      <Route exact path="/settings">
        <ProtectedPage><SettingsPage /></ProtectedPage>
      </Route>
      <Route exact path="/error">
        <ProtectedPage><ErrorPage /></ProtectedPage>
      </Route>
      <Route component={NotFoundPage} />
    </Switch>
  );
}
