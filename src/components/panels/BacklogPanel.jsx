import React, { useState, useEffect, useMemo } from 'react';
import { MdPendingActions, MdAdd, MdEdit, MdDelete } from 'react-icons/md';
import { api } from '../../api/client';
import './BacklogPanel.css';

const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981'
};

const BacklogPanel = ({
  panelId,
  index,
  forDock,
  selectedSpace,
  spaces,
  portfolios,
  onAddBacklogItem,
  onEditBacklogItem,
  onPromoteBacklogItem
}) => {
  const [backlogItems, setBacklogItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadBacklogItems();
  }, [selectedSpace]);

  const loadBacklogItems = async () => {
    try {
      setLoading(true);
      const spaceId = selectedSpace === 'all' ? null : selectedSpace;
      const response = await api.getBacklog(spaceId);
      setBacklogItems(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load backlog:', err);
      setError('Failed to load backlog items');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}" from backlog?`)) return;

    try {
      await api.deleteBacklogItem(id);
      setBacklogItems(items => items.filter(item => item.id !== id));
    } catch (err) {
      console.error('Failed to delete backlog item:', err);
      alert('Failed to delete backlog item');
    }
  };

  // Group items by space (when unfiltered) or portfolio (when filtered to a space)
  const groupedItems = useMemo(() => {
    const groups = {};
    const groupBySpace = selectedSpace === 'all';

    backlogItems.forEach(item => {
      if (groupBySpace) {
        // Group by space (derived from portfolio)
        const spaceKey = item.space_id || 'none';
        if (!groups[spaceKey]) {
          groups[spaceKey] = {
            groupId: item.space_id,
            groupName: item.space_name || 'No Space',
            groupColor: null,
            items: []
          };
        }
        groups[spaceKey].items.push(item);
      } else {
        // Group by portfolio
        const portfolioKey = item.portfolio_id || 'none';
        if (!groups[portfolioKey]) {
          groups[portfolioKey] = {
            groupId: item.portfolio_id,
            groupName: item.portfolio_name || 'No Portfolio',
            groupColor: item.portfolio_color,
            items: []
          };
        }
        groups[portfolioKey].items.push(item);
      }
    });

    // Sort items within each group by start_date (earliest first, null dates last)
    Object.values(groups).forEach(group => {
      group.items.sort((a, b) => {
        if (!a.start_date && !b.start_date) return 0;
        if (!a.start_date) return 1;
        if (!b.start_date) return -1;
        return new Date(a.start_date) - new Date(b.start_date);
      });
    });

    // Sort groups: named groups first alphabetically, then "No Space/Portfolio"
    return Object.values(groups).sort((a, b) => {
      if (!a.groupId) return 1;
      if (!b.groupId) return -1;
      return a.groupName.localeCompare(b.groupName);
    });
  }, [backlogItems, selectedSpace, spaces]);

  // Get current space name for display
  const currentSpaceName = selectedSpace === 'all'
    ? 'All Spaces'
    : spaces.find(s => s.id === Number(selectedSpace))?.name || 'Unknown Space';

  const renderBacklogItem = (item) => (
    <div key={item.id} className="backlog-item">
      <div className="backlog-item-left">
        <span
          className="backlog-priority-dot"
          style={{ backgroundColor: PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium }}
          title={`${item.priority} priority`}
        />
        <div className="backlog-item-info">
          <span className="backlog-item-name">{item.name}</span>
          {item.description && (
            <span className="backlog-item-description">{item.description}</span>
          )}
          <div className="backlog-item-meta">
            {item.initiative_manager && (
              <span className="backlog-item-manager">{item.initiative_manager}</span>
            )}
            {(item.start_date || item.end_date) && (
              <span className="backlog-item-dates">
                {item.start_date && new Date(item.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {item.start_date && item.end_date && ' → '}
                {item.end_date && new Date(item.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="backlog-item-actions">
        <button
          className="backlog-action-btn edit"
          onClick={(e) => {
            e.stopPropagation();
            onEditBacklogItem && onEditBacklogItem(item);
          }}
          title="Edit"
        >
          <MdEdit />
        </button>
        <button
          className="backlog-promote-btn"
          onClick={(e) => {
            e.stopPropagation();
            onPromoteBacklogItem && onPromoteBacklogItem(item);
          }}
        >
          Promote to Project
        </button>
        <button
          className="backlog-action-btn delete"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(item.id, item.name);
          }}
          title="Delete"
        >
          <MdDelete />
        </button>
      </div>
    </div>
  );

  // Fullscreen view for dock
  if (forDock) {
    return (
      <div key={panelId} className={`home-quadrant backlog-quadrant fullscreen-backlog panel-${index + 1}`}>
        <div className="quadrant-header">
          <MdPendingActions className="quadrant-icon" />
          <h2>Project Backlog</h2>
          <span className="backlog-count">{backlogItems.length} items</span>
          {onAddBacklogItem && (
            <button className="add-backlog-btn" onClick={onAddBacklogItem}>
              <MdAdd /> Add Item
            </button>
          )}
        </div>
        <div className="quadrant-content">
          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : error ? (
            <div className="error-state">{error}</div>
          ) : backlogItems.length === 0 ? (
            <div className="empty-state">
              <MdPendingActions className="empty-icon" />
              <p>No backlog items</p>
              <span>No backlog items for {currentSpaceName}</span>
              {onAddBacklogItem && (
                <button className="empty-add-btn" onClick={onAddBacklogItem}>
                  <MdAdd /> Add First Item
                </button>
              )}
            </div>
          ) : (
            <div className="backlog-list">
              {groupedItems.map(group => (
                <div key={group.groupId || 'none'} className="backlog-group">
                  <div className="backlog-group-header">
                    {group.groupColor && (
                      <span
                        className="group-color-dot"
                        style={{ backgroundColor: group.groupColor }}
                      />
                    )}
                    <span className="group-name">{group.groupName}</span>
                    <span className="item-count">({group.items.length})</span>
                  </div>
                  {group.items.map(item => renderBacklogItem(item))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Regular panel view
  return (
    <div key={panelId} className={`home-quadrant backlog-quadrant panel-${index + 1}`}>
      <div className="quadrant-header">
        <MdPendingActions className="quadrant-icon" />
        <h2>Backlog</h2>
        <span className="backlog-count">{backlogItems.length}</span>
        {onAddBacklogItem && (
          <button className="add-backlog-btn compact" onClick={onAddBacklogItem} title="Add Item">
            <MdAdd />
          </button>
        )}
      </div>
      <div className="quadrant-content">
        {loading ? (
          <div className="loading-state">Loading...</div>
        ) : error ? (
          <div className="error-state">{error}</div>
        ) : backlogItems.length === 0 ? (
          <div className="empty-state">
            <MdPendingActions className="empty-icon" />
            <p>No backlog items</p>
            <span>No backlog items for {currentSpaceName}</span>
          </div>
        ) : (
          <div className="backlog-list">
            {groupedItems.map(group => (
              <div key={group.groupId || 'none'} className="backlog-group">
                <div className="backlog-group-header">
                  {group.groupColor && (
                    <span
                      className="group-color-dot"
                      style={{ backgroundColor: group.groupColor }}
                    />
                  )}
                  <span className="group-name">{group.groupName}</span>
                </div>
                {group.items.map(item => renderBacklogItem(item))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BacklogPanel;
