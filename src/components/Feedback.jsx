import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import './Feedback.css';

const Feedback = ({ currentUser }) => {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, open, resolved
  const [showForm, setShowForm] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [responseText, setResponseText] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState(null);
  const [editingResponse, setEditingResponse] = useState(null);
  const [editText, setEditText] = useState({});

  const isPMOrAbove = currentUser && (currentUser.role === 'pm' || currentUser.role === 'admin');

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      setLoading(true);
      const response = await api.get('/feedback');
      setFeedback(response.data);
    } catch (err) {
      console.error('Failed to load feedback:', err);
      setFeedback([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) {
      alert('Please provide feedback text');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/feedback', { text: feedbackText });
      setFeedbackText('');
      setShowForm(false);
      loadFeedback();
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async (feedbackId) => {
    const response = responseText[feedbackId];
    if (!response?.trim()) {
      alert('Please enter a response');
      return;
    }

    try {
      await api.put(`/feedback/${feedbackId}/respond`, { pm_response: response });
      setResponseText({ ...responseText, [feedbackId]: '' });
      loadFeedback();
    } catch (err) {
      console.error('Failed to respond to feedback:', err);
      alert('Failed to respond. Please try again.');
    }
  };

  const handleResolve = async (feedbackId, resolved) => {
    try {
      await api.put(`/feedback/${feedbackId}/resolve`, { resolved });
      loadFeedback();
    } catch (err) {
      console.error('Failed to update feedback status:', err);
      alert('Failed to update status. Please try again.');
    }
  };

  const handleEditFeedback = async (feedbackId) => {
    const text = editText[feedbackId];
    if (!text?.trim()) {
      alert('Please enter feedback text');
      return;
    }

    try {
      await api.put(`/feedback/${feedbackId}`, { text });
      setEditingFeedback(null);
      setEditText({ ...editText, [feedbackId]: '' });
      loadFeedback();
    } catch (err) {
      console.error('Failed to edit feedback:', err);
      alert('Failed to edit feedback. Please try again.');
    }
  };

  const handleEditResponse = async (feedbackId) => {
    const pm_response = editText[`response_${feedbackId}`];
    if (!pm_response?.trim()) {
      alert('Please enter a response');
      return;
    }

    try {
      await api.put(`/feedback/${feedbackId}/edit-response`, { pm_response });
      setEditingResponse(null);
      setEditText({ ...editText, [`response_${feedbackId}`]: '' });
      loadFeedback();
    } catch (err) {
      console.error('Failed to edit response:', err);
      alert('Failed to edit response. Please try again.');
    }
  };

  const filteredFeedback = feedback.filter(item => {
    if (filter === 'open') return item.status === 'open';
    if (filter === 'resolved') return item.status === 'resolved';
    return true;
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;

    return date.toLocaleDateString();
  };

  const getStatusBadge = (status) => {
    return status === 'resolved' ? 'status-resolved' : 'status-open';
  };

  return (
    <div className="feedback-container">
      <div className="feedback-header">
        <div className="feedback-filters">
          <button
            className={filter === 'all' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('all')}
          >
            All ({feedback.length})
          </button>
          <button
            className={filter === 'open' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('open')}
          >
            Open ({feedback.filter(f => f.status === 'open').length})
          </button>
          <button
            className={filter === 'resolved' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('resolved')}
          >
            Resolved ({feedback.filter(f => f.status === 'resolved').length})
          </button>
        </div>
        <button
          className="btn-add-feedback"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Add Feedback'}
        </button>
      </div>

      {showForm && (
        <form className="feedback-form" onSubmit={handleSubmit}>
          <textarea
            className="feedback-description-input"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Enter your feedback..."
            rows="3"
            required
            autoFocus
          />
          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="loading">Loading feedback...</div>
      ) : filteredFeedback.length === 0 ? (
        <div className="no-feedback">
          {filter === 'all' ? 'No feedback yet. Be the first to add feedback!' : `No ${filter} feedback`}
        </div>
      ) : (
        <div className="feedback-threads">
          {filteredFeedback.map(item => (
            <div key={item.id} className={`feedback-thread ${item.status}`}>
              <div className="thread-header">
                <div className="thread-meta">
                  <span className="thread-author">{item.user_name}</span>
                  <span className="thread-date">{formatDate(item.created_at)}</span>
                  <span className={`thread-status ${getStatusBadge(item.status)}`}>
                    {item.status}
                    {item.status === 'resolved' && item.resolved_at && (
                      <span className="status-date"> {formatDate(item.resolved_at)}</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="thread-content">
                {editingFeedback === item.id ? (
                  <div className="edit-container">
                    <textarea
                      className="response-input"
                      value={editText[item.id]}
                      onChange={(e) => setEditText({ ...editText, [item.id]: e.target.value })}
                      rows="3"
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button className="btn-respond" onClick={() => handleEditFeedback(item.id)}>
                        Save
                      </button>
                      <button className="btn-cancel" onClick={() => setEditingFeedback(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="thread-description">{item.text}</p>
                    {currentUser && currentUser.userId === item.user_id && (
                      <button
                        className="btn-edit-small"
                        onClick={() => {
                          setEditingFeedback(item.id);
                          setEditText({ ...editText, [item.id]: item.text });
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {item.pm_response && (
                <div className="thread-response">
                  <div className="response-header">
                    <span className="response-author">{item.responder_name || 'PM'}</span>
                    <span className="response-date">{formatDate(item.responded_at)}</span>
                  </div>
                  {editingResponse === item.id ? (
                    <div className="edit-container">
                      <textarea
                        className="response-input"
                        value={editText[`response_${item.id}`]}
                        onChange={(e) => setEditText({ ...editText, [`response_${item.id}`]: e.target.value })}
                        rows="2"
                        autoFocus
                      />
                      <div className="edit-actions">
                        <button className="btn-respond" onClick={() => handleEditResponse(item.id)}>
                          Save
                        </button>
                        <button className="btn-cancel" onClick={() => setEditingResponse(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="response-text">{item.pm_response}</p>
                      {isPMOrAbove && (
                        <button
                          className="btn-edit-small"
                          onClick={() => {
                            setEditingResponse(item.id);
                            setEditText({ ...editText, [`response_${item.id}`]: item.pm_response });
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isPMOrAbove && (
                <div className="thread-actions">
                  {!item.pm_response && item.status === 'open' && (
                    <div className="response-input-container">
                      <textarea
                        className="response-input"
                        placeholder="Type your response..."
                        value={responseText[item.id] || ''}
                        onChange={(e) => setResponseText({ ...responseText, [item.id]: e.target.value })}
                        rows="2"
                      />
                      <button
                        className="btn-respond"
                        onClick={() => handleRespond(item.id)}
                      >
                        Respond
                      </button>
                    </div>
                  )}

                  <div className="status-actions">
                    {item.status === 'open' ? (
                      <button
                        className="btn-resolve"
                        onClick={() => handleResolve(item.id, true)}
                      >
                        Mark as Resolved
                      </button>
                    ) : (
                      <button
                        className="btn-reopen"
                        onClick={() => handleResolve(item.id, false)}
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Feedback;
