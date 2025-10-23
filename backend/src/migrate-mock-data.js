const { dbRun, dbGet, dbAll } = require('./db');
const bcrypt = require('bcrypt');

async function migrateMockData() {
  console.log('🔄 Starting mock data migration...');

  try {
    // Ensure admin user exists
    let adminUser = await dbGet('SELECT id FROM users WHERE email = ?', ['admin@example.com']);
    if (!adminUser) {
      const hash = bcrypt.hashSync('admin123', 10);
      const result = await dbRun(
        'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)',
        ['admin@example.com', 'Admin User', hash, 'admin']
      );
      adminUser = { id: result.lastID };
      console.log('✅ Created admin user');
    }
    const ownerId = adminUser.id;

    // Create Project Alpha
    const projectAlpha = await dbRun(
      'INSERT INTO projects (name, description) VALUES (?, ?)',
      ['Project Alpha - Infrastructure Modernization', 'Infrastructure modernization initiative']
    );
    console.log(`✅ Created project: Project Alpha (ID: ${projectAlpha.lastID})`);

    // Create Project Beta
    const projectBeta = await dbRun(
      'INSERT INTO projects (name, description) VALUES (?, ?)',
      ['Project Beta - Customer Experience', 'Customer experience enhancement initiative']
    );
    console.log(`✅ Created project: Project Beta (ID: ${projectBeta.lastID})`);

    // === PROJECT ALPHA METRICS ===

    // Server Migration - periods span from past through future (today is Oct 23, 2025)
    const serverMigration = await dbRun(`
      INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectAlpha.lastID, 'Server Migration', ownerId, '2025-04-30', '2026-01-31', 'monthly', 'linear', 105]);

    // Manually insert periods with actual complete values from mock data
    const serverMigrationData = [
      { date: '2025-04-30', complete: 5, commentary: '' },
      { date: '2025-05-31', complete: 12, commentary: 'Resource constraints identified. Two senior engineers allocated to accelerate progress.' },
      { date: '2025-06-30', complete: 19, commentary: '' },
      { date: '2025-07-31', complete: 28, commentary: 'Discovery of 4 additional legacy servers requiring migration. Scope increased by 12%.' },
      { date: '2025-08-31', complete: 41, commentary: '' },
      { date: '2025-09-30', complete: 54, commentary: '' },
      { date: '2025-10-31', complete: 69, commentary: 'Parallel migration streams established. Progress accelerating as team gains experience.' },
      { date: '2025-11-30', complete: 82, commentary: '' },
      { date: '2025-12-31', complete: 94, commentary: '' },
      { date: '2026-01-31', complete: 118, commentary: 'Migration completed successfully. Final scope: 118 servers (12% increase from original 105).' },
    ];

    // Delete auto-generated periods and insert actual ones
    await dbRun('DELETE FROM metric_periods WHERE metric_id = ?', [serverMigration.lastID]);

    // Track scope changes - starts at 105, increases to 118 (12% scope creep)
    // Gradual increase: 105 -> 110 -> 118
    const scopeTargets = [105, 105, 105, 110, 110, 118, 118, 118, 118, 118];

    for (let i = 0; i < serverMigrationData.length; i++) {
      const currentTarget = scopeTargets[i];
      const expected = Math.round((currentTarget / 10) * (i + 1));
      const result = await dbRun(
        'INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete) VALUES (?, ?, ?, ?, ?)',
        [serverMigration.lastID, serverMigrationData[i].date, expected, currentTarget, serverMigrationData[i].complete]
      );

      // Add comments if commentary exists
      if (serverMigrationData[i].commentary && serverMigrationData[i].commentary.trim() !== '') {
        await dbRun(
          'INSERT INTO comments (period_id, comment_text, created_by) VALUES (?, ?, ?)',
          [result.lastID, serverMigrationData[i].commentary, ownerId]
        );
      }
    }

    // Update final metric target to reflect scope creep
    await dbRun('UPDATE metrics SET final_target = 118 WHERE id = ?', [serverMigration.lastID]);
    console.log(`✅ Created metric: Server Migration with ${serverMigrationData.length} periods (12% scope creep: 105→118)`);

    // Database Upgrades - periods span from past through future
    const dbUpgrades = await dbRun(`
      INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectAlpha.lastID, 'Database Upgrades', ownerId, '2025-05-31', '2026-01-31', 'monthly', 'linear', 84]);

    const dbUpgradesData = [
      { date: '2025-05-31', complete: 7, commentary: '' },
      { date: '2025-06-30', complete: 15, commentary: 'Vendor support delays for legacy database versions impacting upgrade timeline.' },
      { date: '2025-07-31', complete: 24, commentary: '' },
      { date: '2025-08-31', complete: 37, commentary: '' },
      { date: '2025-09-30', complete: 48, commentary: 'Performance testing showing 40% improvement. Additional 12 databases identified for upgrade. Scope increased 14%.' },
      { date: '2025-10-31', complete: 61, commentary: '' },
      { date: '2025-11-30', complete: 74, commentary: '' },
      { date: '2025-12-31', complete: 87, commentary: '' },
      { date: '2026-01-31', complete: 96, commentary: 'Completed 96 database upgrades (14% over original 84 target).' },
    ];

    await dbRun('DELETE FROM metric_periods WHERE metric_id = ?', [dbUpgrades.lastID]);

    // Track scope changes - starts at 84, increases to 96 (14% scope creep)
    // Gradual increase: 84 -> 88 -> 96
    const dbScopeTargets = [84, 84, 84, 88, 88, 96, 96, 96, 96];

    for (let i = 0; i < dbUpgradesData.length; i++) {
      const currentTarget = dbScopeTargets[i];
      const expected = Math.round((currentTarget / 9) * (i + 1));
      const result = await dbRun(
        'INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete) VALUES (?, ?, ?, ?, ?)',
        [dbUpgrades.lastID, dbUpgradesData[i].date, expected, currentTarget, dbUpgradesData[i].complete]
      );

      // Add comments if commentary exists
      if (dbUpgradesData[i].commentary && dbUpgradesData[i].commentary.trim() !== '') {
        await dbRun(
          'INSERT INTO comments (period_id, comment_text, created_by) VALUES (?, ?, ?)',
          [result.lastID, dbUpgradesData[i].commentary, ownerId]
        );
      }
    }

    // Update final metric target to reflect scope creep
    await dbRun('UPDATE metrics SET final_target = 96 WHERE id = ?', [dbUpgrades.lastID]);
    console.log(`✅ Created metric: Database Upgrades with ${dbUpgradesData.length} periods (14% scope creep: 84→96)`);

    // Security Patching - periods span from past through future
    const securityPatching = await dbRun(`
      INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectAlpha.lastID, 'Security Patching', ownerId, '2025-04-30', '2026-01-31', 'monthly', 'linear', 122]);

    const securityPatchingData = [
      { date: '2025-04-30', complete: 9, commentary: 'Initial vulnerability assessment complete. Prioritizing critical CVEs.' },
      { date: '2025-05-31', complete: 18, commentary: '' },
      { date: '2025-06-30', complete: 31, commentary: '' },
      { date: '2025-07-31', complete: 46, commentary: 'Emergency patch cycle for zero-day vulnerability consumed resources but now back on track.' },
      { date: '2025-08-31', complete: 59, commentary: '' },
      { date: '2025-09-30', complete: 73, commentary: 'Ahead of schedule. Automated patching pipeline delivering efficiency gains.' },
      { date: '2025-10-31', complete: 87, commentary: '' },
      { date: '2025-11-30', complete: 99, commentary: '' },
      { date: '2025-12-31', complete: 111, commentary: '' },
      { date: '2026-01-31', complete: 122, commentary: 'All critical and high vulnerabilities patched. Continuous monitoring in place.' },
    ];

    await dbRun('DELETE FROM metric_periods WHERE metric_id = ?', [securityPatching.lastID]);
    for (let i = 0; i < securityPatchingData.length; i++) {
      const expected = Math.round((122 / 10) * (i + 1));
      const result = await dbRun(
        'INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete) VALUES (?, ?, ?, ?, ?)',
        [securityPatching.lastID, securityPatchingData[i].date, expected, 122, securityPatchingData[i].complete]
      );

      // Add comments if commentary exists
      if (securityPatchingData[i].commentary && securityPatchingData[i].commentary.trim() !== '') {
        await dbRun(
          'INSERT INTO comments (period_id, comment_text, created_by) VALUES (?, ?, ?)',
          [result.lastID, securityPatchingData[i].commentary, ownerId]
        );
      }
    }
    console.log(`✅ Created metric: Security Patching with ${securityPatchingData.length} periods`);

    // === PROJECT BETA METRICS ===

    // UI Redesign - periods span from past through future
    const uiRedesign = await dbRun(`
      INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectBeta.lastID, 'UI Redesign', ownerId, '2025-04-30', '2026-01-31', 'monthly', 'linear', 65]);

    const uiRedesignData = [
      { date: '2025-04-30', complete: 3, commentary: '' },
      { date: '2025-05-31', complete: 7, commentary: 'Design system foundation established. Component library started.' },
      { date: '2025-06-30', complete: 13, commentary: '' },
      { date: '2025-07-31', complete: 22, commentary: '' },
      { date: '2025-08-31', complete: 34, commentary: 'User testing feedback incorporated. Additional accessibility screens added to scope.' },
      { date: '2025-09-30', complete: 47, commentary: '' },
      { date: '2025-10-31', complete: 57, commentary: 'Mobile responsive designs completed ahead of schedule.' },
      { date: '2025-11-30', complete: 63, commentary: '' },
      { date: '2025-12-31', complete: 65, commentary: 'All screens redesigned and approved. Ready for implementation phase.' },
      { date: '2026-01-31', complete: 65, commentary: '' },
    ];

    await dbRun('DELETE FROM metric_periods WHERE metric_id = ?', [uiRedesign.lastID]);

    // Track scope changes - starts at 65, increases to 72 (11% scope creep)
    // Gradual increase: 65 -> 68 -> 72
    const uiScopeTargets = [65, 65, 65, 68, 68, 72, 72, 72, 72, 72];

    for (let i = 0; i < uiRedesignData.length; i++) {
      const currentTarget = uiScopeTargets[i];
      const expected = Math.round((currentTarget / 10) * (i + 1));
      const result = await dbRun(
        'INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete) VALUES (?, ?, ?, ?, ?)',
        [uiRedesign.lastID, uiRedesignData[i].date, expected, currentTarget, uiRedesignData[i].complete]
      );

      // Add comments if commentary exists
      if (uiRedesignData[i].commentary && uiRedesignData[i].commentary.trim() !== '') {
        await dbRun(
          'INSERT INTO comments (period_id, comment_text, created_by) VALUES (?, ?, ?)',
          [result.lastID, uiRedesignData[i].commentary, ownerId]
        );
      }
    }

    // Update final metric target to reflect scope creep
    await dbRun('UPDATE metrics SET final_target = 72 WHERE id = ?', [uiRedesign.lastID]);
    console.log(`✅ Created metric: UI Redesign with ${uiRedesignData.length} periods (11% scope creep: 65→72)`);

    // Performance Optimization - periods span from past through future
    const perfOpt = await dbRun(`
      INSERT INTO metrics (project_id, name, owner_id, start_date, end_date, frequency, progression_type, final_target)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectBeta.lastID, 'Performance Optimization', ownerId, '2025-05-31', '2026-01-31', 'monthly', 'linear', 98]);

    const perfOptData = [
      { date: '2025-05-31', complete: 8, commentary: '' },
      { date: '2025-06-30', complete: 17, commentary: 'Initial profiling complete. Identified key bottlenecks in data loading.' },
      { date: '2025-07-31', complete: 28, commentary: '' },
      { date: '2025-08-31', complete: 39, commentary: '' },
      { date: '2025-09-30', complete: 53, commentary: '' },
      { date: '2025-10-31', complete: 66, commentary: 'CDN implementation delivering 60% reduction in page load times.' },
      { date: '2025-11-30', complete: 78, commentary: '' },
      { date: '2025-12-31', complete: 90, commentary: '' },
      { date: '2026-01-31', complete: 98, commentary: '' },
    ];

    await dbRun('DELETE FROM metric_periods WHERE metric_id = ?', [perfOpt.lastID]);

    // Track scope changes - starts at 98, increases to 106 (8% scope creep)
    // Gradual increase: 98 -> 102 -> 106
    const perfScopeTargets = [98, 98, 98, 102, 102, 106, 106, 106, 106];

    for (let i = 0; i < perfOptData.length; i++) {
      const currentTarget = perfScopeTargets[i];
      const expected = Math.round((currentTarget / 9) * (i + 1));
      const result = await dbRun(
        'INSERT INTO metric_periods (metric_id, reporting_date, expected, target, complete) VALUES (?, ?, ?, ?, ?)',
        [perfOpt.lastID, perfOptData[i].date, expected, currentTarget, perfOptData[i].complete]
      );

      // Add comments if commentary exists
      if (perfOptData[i].commentary && perfOptData[i].commentary.trim() !== '') {
        await dbRun(
          'INSERT INTO comments (period_id, comment_text, created_by) VALUES (?, ?, ?)',
          [result.lastID, perfOptData[i].commentary, ownerId]
        );
      }
    }

    // Update final metric target to reflect scope creep
    await dbRun('UPDATE metrics SET final_target = 106 WHERE id = ?', [perfOpt.lastID]);
    console.log(`✅ Created metric: Performance Optimization with ${perfOptData.length} periods (8% scope creep: 98→106)`);

    // === ADD CRAIDs (Risks, Issues, Dependencies) ===

    // Get some period IDs for linking
    const alphaPeriods = await dbAll('SELECT id, reporting_date FROM metric_periods WHERE metric_id IN (SELECT id FROM metrics WHERE project_id = ?) ORDER BY reporting_date', [projectAlpha.lastID]);
    const betaPeriods = await dbAll('SELECT id, reporting_date FROM metric_periods WHERE metric_id IN (SELECT id FROM metrics WHERE project_id = ?) ORDER BY reporting_date', [projectBeta.lastID]);

    // Project Alpha CRAIDs
    await dbRun(`
      INSERT INTO craids (project_id, type, title, description, status, priority, owner_id, period_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectAlpha.lastID, 'risk', 'Legacy System Compatibility', 'Risk that legacy systems may not support new infrastructure components', 'open', 'high', ownerId, alphaPeriods[3]?.id, ownerId]);

    await dbRun(`
      INSERT INTO craids (project_id, type, title, description, status, priority, owner_id, period_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectAlpha.lastID, 'issue', 'Database Vendor Support Delay', 'Vendor delayed support for legacy database versions by 3 weeks', 'in_progress', 'medium', ownerId, alphaPeriods[2]?.id, ownerId]);

    await dbRun(`
      INSERT INTO craids (project_id, type, title, description, status, priority, owner_id, period_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectAlpha.lastID, 'dependency', 'Network Team Upgrade', 'Infrastructure upgrades depend on network team completing fiber installation', 'open', 'high', ownerId, null, ownerId]);

    await dbRun(`
      INSERT INTO craids (project_id, type, title, description, status, priority, owner_id, period_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectAlpha.lastID, 'action', 'Security Audit Required', 'Complete security audit before production migration', 'open', 'critical', ownerId, null, ownerId]);

    // Project Beta CRAIDs
    await dbRun(`
      INSERT INTO craids (project_id, type, title, description, status, priority, owner_id, period_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectBeta.lastID, 'risk', 'User Adoption Risk', 'Risk that users may resist new UI design changes', 'open', 'medium', ownerId, betaPeriods[4]?.id, ownerId]);

    await dbRun(`
      INSERT INTO craids (project_id, type, title, description, status, priority, owner_id, period_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectBeta.lastID, 'dependency', 'CDN Provider Contract', 'Performance improvements depend on CDN contract approval', 'in_progress', 'high', ownerId, null, ownerId]);

    await dbRun(`
      INSERT INTO craids (project_id, type, title, description, status, priority, owner_id, period_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectBeta.lastID, 'issue', 'Mobile Responsiveness Bug', 'UI elements not rendering correctly on iOS devices', 'closed', 'high', ownerId, betaPeriods[5]?.id, ownerId]);

    console.log('✅ Created 7 CRAIDs (risks, issues, dependencies, actions)');

    console.log('\n✅ Mock data migration completed successfully!');
    console.log(`📊 Total: 2 projects, 5 metrics, 7 CRAIDs`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrateMockData();
