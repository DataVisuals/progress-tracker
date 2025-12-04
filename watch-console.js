#!/usr/bin/env node

const CDP = require('chrome-remote-interface');

async function watchConsole() {
  let client;

  try {
    client = await CDP({ port: 9222 });
    const { Runtime, Console } = client;

    await Runtime.enable();
    await Console.enable();

    console.log('🔍 Connected to Chrome on port 9222');
    console.log('📋 Watching console logs...\n');
    console.log('─'.repeat(80));

    Runtime.consoleAPICalled((params) => {
      const { type, args, timestamp } = params;
      const time = new Date(timestamp * 1000).toLocaleTimeString();

      const messages = args.map(arg => {
        if (arg.value !== undefined) return arg.value;
        if (arg.description) return arg.description;
        return JSON.stringify(arg, null, 2);
      });

      const colors = {
        log: '\x1b[37m',
        info: '\x1b[36m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
        debug: '\x1b[35m',
      };

      const color = colors[type] || colors.log;
      const reset = '\x1b[0m';

      console.log(`${color}[${time}] [${type.toUpperCase()}]${reset} ${messages.join(' ')}`);
    });

    Runtime.exceptionThrown((params) => {
      const { exceptionDetails } = params;
      const time = new Date().toLocaleTimeString();

      console.log(`\x1b[31m[${time}] [EXCEPTION]\x1b[0m ${exceptionDetails.text}`);

      if (exceptionDetails.exception) {
        console.log(`  ${exceptionDetails.exception.description}`);
      }

      if (exceptionDetails.stackTrace) {
        exceptionDetails.stackTrace.callFrames.forEach(frame => {
          console.log(`  at ${frame.functionName || 'anonymous'} (${frame.url}:${frame.lineNumber})`);
        });
      }
    });

    process.on('SIGINT', async () => {
      console.log('\n\n👋 Disconnecting...');
      await client.close();
      process.exit(0);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('\n💡 Make sure Chrome is running with:');
    console.error('   open ~/Applications/Chrome\\ Debug.app');
    process.exit(1);
  }
}

watchConsole();
