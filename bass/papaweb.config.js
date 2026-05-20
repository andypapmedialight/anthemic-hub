/* Overwritten in CI deploy. Local dev: point at loopback contact API or Formspree. Never put webhooks/keys here. */
globalThis.PAPAWEB_CONTACT_SECRETS = {
  CONTACT_FORM_ENDPOINT: '/bass/api/contact',
};
