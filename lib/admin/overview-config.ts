/**
 * Everything on the overview page that depends on YOUR table, column and
 * route names lives in this file. If a card shows "—" with a
 * "Couldn't load" message, fix the name here and nothing else.
 */

// Where each queue page lives in your admin area (the cards link to these).
export const ADMIN_ROUTES = {
  profiles: "/admin/profiles",
  photos: "/admin/photos",
  bioEdits: "/admin/bio-edits",
  reports: "/admin/reports",
};

export const TABLES = {
  // profiles: uses the review state column `status` (default pending_review)
  profiles: { waitingStatus: "pending_review", approvedStatus: "approved" },

  // photos: anything that is not approved or rejected counts as waiting
  photos: { table: "profile_photos", doneStatuses: ["approved", "rejected"] },

  // bio edits queue
  bioEdits: {
    table: "profile_edits",
    statusColumn: "status",
    waitingStatus: "pending",
    createdColumn: "created_at",
  },

  // reports queue
  reports: {
    table: "reports",
    statusColumn: "status",
    waitingStatus: "open",
    createdColumn: "created_at",
  },

  // subscriptions: set expiresColumn (e.g. "expires_at") if you have one,
  // so expired weekly plans are not counted as active
  subscriptions: {
    table: "subscriptions",
    statusColumn: "status",
    activeStatus: "active",
    planColumn: "plan_type",
    expiresColumn: "end_date" as string | null,
  },

  // payments: every status value that means "money received"
  payments: {
    table: "payment_transactions",
    userColumn: "user_id",
    amountColumn: "amount",
    statusColumn: "status",
    dateColumn: "created_at",
    paidStatuses: ["completed"],
  },
};
