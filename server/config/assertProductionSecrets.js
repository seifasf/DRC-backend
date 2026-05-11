/**
 * Fail fast in production when critical secrets are missing or unsafe.
 */
module.exports = function assertProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return;

  const jwt = String(process.env.JWT_SECRET || '');
  const example = 'change_me_to_a_long_random_string';
  if (jwt.length < 32 || jwt === example) {
    console.error(
      '[security] In production, set JWT_SECRET to a unique random string at least 32 characters (not the example default).'
    );
    process.exit(1);
  }
};
