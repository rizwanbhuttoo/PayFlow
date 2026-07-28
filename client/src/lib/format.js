export const formatMoney = (amount = 0, currency = "usd") => {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
};

export const formatDate = (value, withTime = false) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(new Date(value));
};

export const humanize = (value = "") =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const formatBillingInterval = (value = "") =>
  value === "yearly" ? "Yearly" : value === "monthly" ? "Monthly" : humanize(value);
