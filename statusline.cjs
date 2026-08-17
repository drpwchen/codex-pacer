#!/usr/bin/env node
'use strict';
// Compatibility entry point. In Codex this is a standalone status command,
// because tui.status_line accepts built-in identifiers rather than commands.
require('./scripts/pacer.cjs');
