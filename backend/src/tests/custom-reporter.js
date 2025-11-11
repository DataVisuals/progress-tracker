/**
 * Custom Jest Reporter
 * Outputs one line per test with pass/fail status
 * Shows a summary at the end
 */

class CustomReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
    this.results = [];
  }

  onTestResult(test, testResult, aggregatedResult) {
    testResult.testResults.forEach((result) => {
      const status = result.status === 'passed' ? 'PASSED' : 'FAILED';
      const testName = `${result.ancestorTitles.join(' › ')} › ${result.title}`;

      this.results.push({
        name: testName,
        status: result.status,
        duration: result.duration,
        failureMessages: result.failureMessages
      });

      // Print immediately for real-time feedback
      if (result.status === 'passed') {
        console.log(`✓ ${testName} - ${status}`);
      } else {
        console.log(`✗ ${testName} - ${status}`);
        if (result.failureMessages && result.failureMessages.length > 0) {
          console.log(`  Error: ${result.failureMessages[0].split('\n')[0]}`);
        }
      }
    });
  }

  onRunComplete(contexts, results) {
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));

    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const total = this.results.length;

    console.log(`\nTotal Tests: ${total}`);
    console.log(`✓ Passed: ${passed}`);
    console.log(`✗ Failed: ${failed}`);

    if (failed > 0) {
      console.log('\n' + '-'.repeat(80));
      console.log('FAILED TESTS:');
      console.log('-'.repeat(80));
      this.results
        .filter(r => r.status === 'failed')
        .forEach(r => {
          console.log(`\n✗ ${r.name}`);
          if (r.failureMessages && r.failureMessages.length > 0) {
            // Only show first 3 lines of error
            const errorLines = r.failureMessages[0].split('\n').slice(0, 3);
            errorLines.forEach(line => console.log(`  ${line}`));
          }
        });
    }

    console.log('\n' + '='.repeat(80));
    console.log(failed > 0 ? '❌ TESTS FAILED' : '✅ ALL TESTS PASSED');
    console.log('='.repeat(80) + '\n');
  }
}

module.exports = CustomReporter;
