import { StripeAccount } from "../models/StripeAccount.js";
import {
  createAccountLink,
  createDashboardLoginLink,
  refreshConnectAccount,
} from "../services/stripe.service.js";

export const getStatus = async (req, res) => {
  const existing = await StripeAccount.exists({ user: req.user.id });
  const account = existing
    ? await refreshConnectAccount(req.user.id)
    : null;
  res.json({ success: true, data: { account } });
};

export const startOnboarding = async (req, res) => {
  const url = await createAccountLink(req.user);
  res.json({ success: true, data: { url } });
};

export const refreshStatus = async (req, res) => {
  const account = await refreshConnectAccount(req.user.id);
  res.json({ success: true, data: { account } });
};

export const openDashboard = async (req, res) => {
  const url = await createDashboardLoginLink(req.user.id);
  res.json({ success: true, data: { url } });
};
