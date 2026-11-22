/**
 * Legally required business details, shown in the footer and legal pages.
 * Only what UK law requires is included:
 *  - Companies (Trading Disclosures) Regs 2015: registered name, registered
 *    number, part of the UK it's registered in, registered office address.
 *  - E-Commerce Regs 2002 reg 6: name, geographic address (the registered
 *    office is fine), an email address for direct contact, register details.
 *  - Consumer Contracts Regs 2013: geographic address, plus phone/email
 *    "where available" — no phone listed, as none is offered to customers.
 *  - No VAT number: the company isn't VAT registered.
 *
 * Keep these exactly as they appear on Companies House.
 */
export const COMPANY = {
  registeredName: "IHDY Limited",
  registeredNumber: "1527969",
  registeredIn: "England and Wales",
  registeredOffice: "4 Ashgil Mews, Newcastle, NE5 4EW",
  email: "hello@dijiofficial.com",
  vatRegistered: false,
} as const;

export const LEGAL_LAST_UPDATED = "21 November 2026";

/** Refund window for tickets to shows we run ourselves (whole days before the show). */
export const TICKET_REFUND_DAYS = 5;
