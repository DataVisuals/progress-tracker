import React from 'react';
import { MdSwapHoriz, MdShare } from 'react-icons/md';
import Select from 'react-select';
import ClarityIndicator from './ClarityIndicator';
import UserSelector from './UserSelector';
import ProjectDependencies from './ProjectDependencies';
import { formatDate, isRecentlyUpdated } from '../utils/dateFormatters';
import { selectStyles } from './SelectStyles';

// Benefits options - shared with ProjectSetup
const BENEFITS_OPTIONS = [
  { value: 'automation', label: 'Automation and Process Optimisation' },
  { value: 'capability', label: 'Capability Development' },
  { value: 'cost', label: 'Cost Optimisation' },
  { value: 'technology', label: 'Technology Modernisation' },
  { value: 'risk', label: 'Risk and Controls' }
];

// Short labels for badge display
const BENEFITS_SHORT_LABELS = {
  automation: 'Automation',
  capability: 'Capability',
  cost: 'Cost',
  technology: 'Technology',
  risk: 'Risk & Controls'
};

/**
 * ProjectHeader component - displays project title, metadata, portfolio, dates, IMs, links, and description
 * with inline editing capabilities
 */
const ProjectHeader = ({
  // Project data
  currentProject,
  projectName,
  projectDuration,
  projectData,
  projectMetrics,
  projectRecoveryPlans,
  projectLinks,

  // Editing state - Project Name
  editingProjectName,
  editProjectNameValue,
  setEditProjectNameValue,

  // Editing state - Portfolio
  editingPortfolio,
  editPortfolioValue,
  portfolios,

  // Editing state - Dates
  editingProjectDates,
  editProjectStartDate,
  editProjectEndDate,
  setEditProjectStartDate,
  setEditProjectEndDate,
  setEditingProjectDates,

  // Editing state - IMs
  editingPMs,
  editPMValue,
  editSecondaryPMValue,
  setEditPMValue,
  setEditSecondaryPMValue,
  setEditingPMs,
  users,

  // Editing state - Benefits
  editingBenefits,
  editBenefitsValue,
  setEditBenefitsValue,
  setEditingBenefits,
  handleBenefitsClick,
  handleSaveBenefits,

  // Editing state - Description
  editingProjectDesc,
  editProjectDescValue,
  setEditProjectDescValue,

  // Handlers
  handleProjectNameKeyDown,
  handleSaveProjectName,
  handleProjectNameDoubleClick,
  handlePortfolioClick,
  handlePortfolioOptionClick,
  handleSavePortfolio,
  setEditingPortfolio,
  handleSaveProjectDates,
  handlePMsClick,
  handleSavePMs,
  handleProjectDescClick,
  handleProjectDescKeyDown,
  handleSaveProjectDesc,
  handleShareLink,
  setShowProjectHealth,
  setShowLinksEditor,
  handleNavigateToProject,

  // Helper functions
  canEdit,
  calculateHealthScore,
  isProjectFieldChanged,
  hasProjectDateMoved,
  getProjectDateMoveInfo,

  // Other props
  selectedProject,
  projectsObject,
}) => {
  return (
    <div className="report-header">
      <div className="report-header-main">
        <div className="report-header-left">
          <div className="report-header-title-row">
            {editingProjectName ? (
              <input
                type="text"
                className="project-name-input"
                value={editProjectNameValue}
                onChange={(e) => setEditProjectNameValue(e.target.value)}
                onKeyDown={handleProjectNameKeyDown}
                onBlur={handleSaveProjectName}
                autoFocus
              />
            ) : (
              <h2
                className={`${projectName.length > 40 ? 'long-title' : ''} ${isProjectFieldChanged('name') ? 'recently-changed-value' : ''}`}
                onDoubleClick={canEdit() ? handleProjectNameDoubleClick : undefined}
                title={projectName.length > 40 ? projectName : (canEdit() ? "Double-click to rename" : undefined)}
                style={{ cursor: canEdit() ? 'pointer' : 'default' }}
              >
                {projectName}
              </h2>
            )}
            {(() => {
              const healthScore = calculateHealthScore(currentProject, projectData, projectMetrics, projectRecoveryPlans, projectLinks);
              const getScoreColor = (score) => {
                if (score >= 80) return '#10b981';
                if (score >= 60) return '#f59e0b';
                return '#dc2626';
              };
              return (
                <button
                  className="project-health-btn health-gauge-btn"
                  onClick={() => setShowProjectHealth(true)}
                  title="View project health"
                >
                  <svg viewBox="0 0 36 36" className="health-gauge-svg">
                    <circle
                      className="health-gauge-bg"
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      strokeWidth="3"
                    />
                    <circle
                      className="health-gauge-progress"
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      strokeWidth="3"
                      stroke={getScoreColor(healthScore)}
                      strokeDasharray={`${(healthScore / 100) * 97.4} 97.4`}
                      strokeLinecap="round"
                      transform="rotate(-90 18 18)"
                    />
                  </svg>
                  <span className="health-gauge-value" style={{ color: getScoreColor(healthScore) }}>{Math.round(healthScore)}</span>
                </button>
              );
            })()}
            {/* Portfolio badge inline with title */}
            {!editingPortfolio && currentProject?.portfolio_name && (
              <div
                className={`portfolio-display-inline ${canEdit() ? 'editable' : ''}`}
                onClick={handlePortfolioClick}
                title={canEdit() ? "Click to change portfolio" : undefined}
              >
                <span
                  className="portfolio-badge-inline"
                  style={{
                    backgroundColor: currentProject.portfolio_color || '#888',
                  }}
                >
                  {currentProject.portfolio_name}
                </span>
              </div>
            )}
            {/* No portfolio placeholder - shown inline with title */}
            {!editingPortfolio && !currentProject?.portfolio_name && canEdit() && (
              <div
                className="portfolio-display-inline editable"
                onClick={handlePortfolioClick}
                title="Click to assign portfolio"
              >
                <span className="portfolio-none-inline">+ Add Portfolio</span>
              </div>
            )}
            {editingProjectDates ? (
              <div className="date-editor">
                <input
                  type="date"
                  value={editProjectStartDate}
                  onChange={(e) => setEditProjectStartDate(e.target.value)}
                  autoFocus
                />
                <span className="date-range-separator">{'\u2192'}</span>
                <input
                  type="date"
                  value={editProjectEndDate}
                  onChange={(e) => setEditProjectEndDate(e.target.value)}
                />
                <button className="save-btn" onClick={handleSaveProjectDates}>
                  Save
                </button>
                <button className="cancel-btn" onClick={() => setEditingProjectDates(false)}>
                  Cancel
                </button>
              </div>
            ) : currentProject?.start_date && currentProject?.end_date ? (
              <div
                className={`project-timeline-display ${canEdit() ? 'editable' : ''}`}
                onClick={canEdit() ? () => {
                  setEditProjectStartDate(currentProject.start_date);
                  setEditProjectEndDate(currentProject.end_date);
                  setEditingProjectDates(true);
                } : undefined}
                title={canEdit() ? "Click to edit dates" : undefined}
              >
                <span
                  className={`project-timeline-date ${isProjectFieldChanged('start_date') ? 'recently-changed-value' : ''} ${hasProjectDateMoved('start_date') ? 'date-moved' : ''}`}
                  title={(() => {
                    const moveInfo = getProjectDateMoveInfo('start_date');
                    if (moveInfo) {
                      return `Start date moved ${moveInfo.changeCount} time${moveInfo.changeCount > 1 ? 's' : ''} (from ${moveInfo.originalValue || 'not set'})`;
                    }
                    return isProjectFieldChanged('start_date') ? 'Start date changed this week' : undefined;
                  })()}
                >
                  {hasProjectDateMoved('start_date') && <MdSwapHoriz className="date-moved-icon" />}
                  {formatDate(currentProject.start_date)}
                </span>
                <span className="project-timeline-separator">{'\u2192'}</span>
                <span
                  className={`project-timeline-date ${isProjectFieldChanged('end_date') ? 'recently-changed-value' : ''} ${hasProjectDateMoved('end_date') ? 'date-moved' : ''}`}
                  title={(() => {
                    const moveInfo = getProjectDateMoveInfo('end_date');
                    if (moveInfo) {
                      return `End date moved ${moveInfo.changeCount} time${moveInfo.changeCount > 1 ? 's' : ''} (from ${moveInfo.originalValue || 'not set'})`;
                    }
                    return isProjectFieldChanged('end_date') ? 'End date changed this week' : undefined;
                  })()}
                >
                  {hasProjectDateMoved('end_date') && <MdSwapHoriz className="date-moved-icon" />}
                  {formatDate(currentProject.end_date)}
                </span>
                {projectDuration && (
                  <>
                    <span className="project-timeline-separator">•</span>
                    <span className="project-timeline-duration">
                      {projectDuration.months >= 2
                        ? `${projectDuration.months} months`
                        : projectDuration.weeks >= 2
                        ? `${projectDuration.weeks} weeks`
                        : `${projectDuration.days} days`}
                    </span>
                  </>
                )}
              </div>
            ) : canEdit() ? (
              <button
                className="add-dates-btn"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  setEditProjectStartDate(today);
                  setEditProjectEndDate(oneYearLater);
                  setEditingProjectDates(true);
                }}
              >
                + Add dates
              </button>
            ) : null}
            {/* Benefits badges */}
            {editingBenefits ? (
              <div className="benefits-editor">
                <Select
                  isMulti
                  value={BENEFITS_OPTIONS.filter(b => editBenefitsValue.includes(b.value))}
                  onChange={(options) => setEditBenefitsValue(options ? options.map(o => o.value) : [])}
                  options={BENEFITS_OPTIONS}
                  styles={selectStyles}
                  placeholder="Select benefits..."
                  className="benefits-select"
                  menuPortalTarget={document.body}
                  autoFocus
                />
                <button className="save-btn" onClick={handleSaveBenefits}>Save</button>
                <button className="cancel-btn" onClick={() => setEditingBenefits(false)}>Cancel</button>
              </div>
            ) : (
              <div
                className={`benefits-display ${canEdit() ? 'editable' : ''}`}
                onClick={canEdit() ? handleBenefitsClick : undefined}
                title={canEdit() ? "Click to edit benefits" : undefined}
              >
                {currentProject?.benefits ? (
                  currentProject.benefits.split(',').filter(Boolean).map((benefit, idx) => (
                    <span key={benefit} className="benefit-badge">
                      {BENEFITS_SHORT_LABELS[benefit] || benefit}
                    </span>
                  ))
                ) : canEdit() ? (
                  <span className="benefit-placeholder">+ Benefits</span>
                ) : null}
              </div>
            )}
          </div>
          {/* Second row: IMs and Links combined */}
          <div className="project-meta-row">
            {/* Portfolio editor (only when editing) */}
            {editingPortfolio && (
              <div className="portfolio-editor-inline">
                <div className="portfolio-edit-dropdown">
                  <div
                    className="portfolio-option-item"
                    onClick={() => handlePortfolioOptionClick(null)}
                  >
                    <div className="option-content">
                      <span className="no-portfolio-icon">◆</span>
                      <span className="option-name">No Portfolio</span>
                      {editPortfolioValue === null && <span className="selected-check">✓</span>}
                    </div>
                  </div>
                  {portfolios.map(portfolio => (
                    <div
                      key={portfolio.id}
                      className={`portfolio-option-item ${editPortfolioValue === portfolio.id ? 'selected' : ''}`}
                      onClick={() => handlePortfolioOptionClick(portfolio.id)}
                    >
                      <div className="option-content">
                        <span
                          className="portfolio-color-dot"
                          style={{ backgroundColor: portfolio.color }}
                        />
                        <span className="option-name">{portfolio.name}</span>
                        {editPortfolioValue === portfolio.id && <span className="selected-check">✓</span>}
                      </div>
                    </div>
                  ))}
                  <div
                    className="portfolio-option-item create-new"
                    onClick={() => handlePortfolioOptionClick('__create__')}
                  >
                    <div className="option-content">
                      <span className="create-icon">+</span>
                      <span className="option-name">Create New Portfolio...</span>
                    </div>
                  </div>
                </div>
                <div className="portfolio-editor-actions">
                  <button onClick={handleSavePortfolio} className="save-btn">
                    Save
                  </button>
                  <button onClick={() => setEditingPortfolio(false)} className="cancel-btn">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* IMs and Links stacked vertically */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* IMs section */}
              {editingPMs ? (
                <div className="pm-editor">
                  <div className="pm-editor-field">
                    <label>Primary IM:</label>
                    <UserSelector
                      users={users}
                      selectedUser={editPMValue}
                      onUserChange={setEditPMValue}
                      placeholder="Select primary IM..."
                    />
                  </div>
                  <div className="pm-editor-field">
                    <label>Secondary IM:</label>
                    <UserSelector
                      users={users}
                      selectedUser={editSecondaryPMValue}
                      onUserChange={setEditSecondaryPMValue}
                      placeholder="Select secondary IM..."
                    />
                  </div>
                  <div className="pm-editor-actions">
                    <button onClick={handleSavePMs} className="save-btn">Save</button>
                    <button onClick={() => setEditingPMs(false)} className="cancel-btn">Cancel</button>
                  </div>
                </div>
              ) : (currentProject?.initiative_manager || currentProject?.secondary_pm || canEdit()) && (
                <div
                  className={`pm-display-inline ${canEdit() ? 'editable' : ''}`}
                  onClick={handlePMsClick}
                  title={canEdit() ? "Click to edit initiative managers" : undefined}
                >
                  {currentProject?.initiative_manager ? (
                    <>
                      <span className={`pm-info-inline ${isProjectFieldChanged('initiative_manager') ? 'recently-changed-value' : ''}`}>
                        {currentProject.initiative_manager}
                      </span>
                      {currentProject?.secondary_pm && (
                        <>
                          <span className="pm-separator">|</span>
                          <span className={`pm-info-inline ${isProjectFieldChanged('secondary_pm') ? 'recently-changed-value' : ''}`}>
                            {currentProject.secondary_pm}
                          </span>
                        </>
                      )}
                    </>
                  ) : canEdit() ? (
                    <span className="pm-placeholder-inline">+ Add IMs</span>
                  ) : null}
                </div>
              )}

              {/* Links and Share - under IMs */}
              <div className="project-links-inline">
                {projectLinks.map((link, index) => (
                  <React.Fragment key={link.id}>
                    {index > 0 && <span className="links-separator">|</span>}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`project-link-btn ${isRecentlyUpdated(link.created_at) ? 'recently-changed-value' : ''}`}
                    >
                      {link.label}
                    </a>
                  </React.Fragment>
                ))}
                {canEdit() && (
                  <button
                    onClick={() => setShowLinksEditor(true)}
                    className={`edit-links-btn ${projectLinks.length === 0 ? 'placeholder' : ''}`}
                    title="Edit project links"
                  >
                    {projectLinks.length === 0 ? '+ Links' : 'Edit'}
                  </button>
                )}
                <ProjectDependencies
                  projectId={selectedProject}
                  allProjects={projectsObject}
                  canEdit={canEdit()}
                  onNavigateToProject={handleNavigateToProject}
                  showSeparator={true}
                />
                <button
                  onClick={handleShareLink}
                  className="share-link-btn"
                  title="Copy link to this page"
                >
                  <MdShare />
                </button>
              </div>
            </div>

          </div>
        </div>
        {(currentProject?.description || canEdit()) && (
          <div className="report-header-right" style={{ flex: 2 }}>
            {editingProjectDesc ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <ClarityIndicator text={editProjectDescValue} size="sm" compact contentType="description" />
                <textarea
                  className="project-desc-input"
                  value={editProjectDescValue}
                  onChange={(e) => setEditProjectDescValue(e.target.value)}
                  onKeyDown={handleProjectDescKeyDown}
                  onBlur={handleSaveProjectDesc}
                  placeholder="Add a description of what the project will achieve here..."
                  rows={3}
                  autoFocus
                  style={{ textAlign: 'right', flex: 1 }}
                />
              </div>
            ) : (
              <div className="project-description-wrapper" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', textAlign: 'right' }}>
                <ClarityIndicator text={currentProject?.description} size="sm" compact contentType="description" />
                <p
                  className={`project-description ${canEdit() ? 'editable' : ''} ${currentProject?.description ? 'filled' : 'empty'}`}
                  onClick={handleProjectDescClick}
                  title={currentProject?.description ? currentProject.description : (canEdit() ? "Click to edit description" : undefined)}
                  style={{ flex: 1, margin: 0 }}
                >
                  {currentProject?.description || (canEdit() ? 'Click to add a description...' : '')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectHeader;
