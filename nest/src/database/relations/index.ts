import { relations } from 'drizzle-orm';
import { accounts } from '../schemas/accounts.schema';
import { secretQa } from '../schemas/secret-qa.schema';
import { inviteCodes } from '../schemas/invite-codes.schema';
import { invitations } from '../schemas/invitations.schema';
import { bans } from '../schemas/bans.schema';
import { sessions } from '../schemas/sessions.schema';

// Drizzle relations — сахар для relational query API. На миграции не влияют.
// Неоднозначные связи (две FK на accounts) разведены через relationName.

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  secretQuestions: many(secretQa),
  inviteCodes: many(inviteCodes),
  sessions: many(sessions),
  invitation: one(invitations, {
    relationName: 'invitee',
    fields: [accounts.id],
    references: [invitations.accountId],
  }),
  invitesGiven: many(invitations, { relationName: 'inviter' }),
  bansGiven: many(bans, { relationName: 'banner' }),
  bansReceived: many(bans, { relationName: 'target' }),
}));

export const secretQaRelations = relations(secretQa, ({ one }) => ({
  account: one(accounts, { fields: [secretQa.accountId], references: [accounts.id] }),
}));

export const inviteCodesRelations = relations(inviteCodes, ({ one }) => ({
  inviter: one(accounts, { fields: [inviteCodes.inviterId], references: [accounts.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  invitee: one(accounts, {
    relationName: 'invitee',
    fields: [invitations.accountId],
    references: [accounts.id],
  }),
  inviter: one(accounts, {
    relationName: 'inviter',
    fields: [invitations.inviterId],
    references: [accounts.id],
  }),
}));

export const bansRelations = relations(bans, ({ one }) => ({
  banner: one(accounts, {
    relationName: 'banner',
    fields: [bans.bannerId],
    references: [accounts.id],
  }),
  target: one(accounts, {
    relationName: 'target',
    fields: [bans.targetId],
    references: [accounts.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  account: one(accounts, { fields: [sessions.accountId], references: [accounts.id] }),
}));
