#!/usr/bin/env node
/**
 * Prints a random secret suitable for JWT_SECRET (production requires length >= 32).
 * Usage: npm run gen:jwt-secret
 */
const crypto = require('crypto');

const secret = crypto.randomBytes(32).toString('base64url');
console.log(secret);
console.error('(Copy the line above into Render → Environment → JWT_SECRET, or into .env locally.)');
