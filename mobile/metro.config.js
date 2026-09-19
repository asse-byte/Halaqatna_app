// Metro bundler configuration for the teacher client.
//
// src/i18n.js imports frontend/src/locales/{ar,en}.json so the mobile client shares the
// exact same key set as the web client and the NFR6 parity check (scripts/check_locales.js)
// covers both. Those files live outside mobile/, and Metro refuses to read outside the
// project root unless it is told to, so the repo root is added as a watch folder.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [repoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(repoRoot, "node_modules"),
];

module.exports = config;
