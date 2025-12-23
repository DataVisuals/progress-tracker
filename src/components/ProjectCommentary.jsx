import React from 'react';
import { isRecentlyUpdated } from '../utils/dateFormatters';

/**
 * ProjectCommentary component - displays project comments with threading support and inline editing
 */
const ProjectCommentary = ({
  // Comment data
  projectComments,

  // Comment editing state
  addingComment,
  setAddingComment,
  newCommentValue,
  setNewCommentValue,
  editingCommentId,
  editCommentValue,
  setEditCommentValue,
  expandedCommentThreads,
  replyingToCommentId,

  // Handlers
  handleCancelAddComment,
  handleAddComment,
  handleCancelEditComment,
  handleSaveComment,
  handleEditComment,
  handleDeleteComment,
  handleReplyToComment,
  toggleCommentThread,
  handleCancelReply,

  // Helper functions
  canEdit,
  getGroupedComments,
}) => {
  const { rootComments, repliesMap } = getGroupedComments(projectComments);

  return (
    <div style={{ marginTop: '20px' }}>
      <div className="commentary-container" style={{
        background: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600'
          }}>
            Project Commentary
          </h3>
          {canEdit() && !addingComment && (
            <button
              onClick={() => setAddingComment(true)}
              className="btn-primary"
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                borderRadius: '6px'
              }}
            >
              + Add Comment
            </button>
          )}
        </div>

        {/* Add new comment form */}
        {addingComment && (
          <div className="commentary-item-add" style={{ marginBottom: '8px', padding: '6px' }}>
            <textarea
              value={newCommentValue}
              onChange={(e) => setNewCommentValue(e.target.value)}
              placeholder="Add your commentary here..."
              className="comment-textarea"
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: '4px',
                lineHeight: '1.4'
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelAddComment}
                className="btn-secondary"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddComment()}
                className="btn-primary"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px'
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Display comments with threading support */}
        <div className="commentary-list">
          {projectComments.length === 0 && !addingComment && (
            <div className="empty-commentary" style={{
              padding: '20px 12px',
              textAlign: 'center',
              fontSize: '12px',
              color: '#6b7280'
            }}>
              {canEdit()
                ? 'No commentary yet. Click "Add Comment" to get started.'
                : 'No commentary available.'}
            </div>
          )}
          {rootComments.map((comment, index) => {
            const replies = repliesMap[comment.id] || [];
            const isExpanded = expandedCommentThreads[comment.id];

            return (
              <div key={comment.id}>
                <div
                  className={`commentary-item ${index === 0 ? 'latest-comment' : ''} ${isRecentlyUpdated(comment.created_at) ? 'recently-changed-comment' : ''}`}
                  style={{
                    padding: '6px 8px',
                    marginBottom: '0',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                >
                  {editingCommentId === comment.id ? (
                    <div className="commentary-item-edit">
                      <textarea
                        value={editCommentValue}
                        onChange={(e) => setEditCommentValue(e.target.value)}
                        className="comment-textarea"
                        style={{
                          width: '100%',
                          minHeight: '60px',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          marginBottom: '4px',
                          lineHeight: '1.4'
                        }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={handleCancelEditComment}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveComment(comment.id)}
                          className="btn-primary"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="comment-text ql-editor" style={{
                        fontSize: '12px',
                        lineHeight: '1.4',
                        wordWrap: 'break-word',
                        padding: 0,
                        margin: 0
                      }} dangerouslySetInnerHTML={{ __html: comment.comment_text }} />
                      <div className="comment-meta" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '10px',
                        marginTop: '2px',
                        color: '#6b7280'
                      }}>
                        <div className="comment-author">
                          <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                          {comment.creator_name && <span> • {comment.creator_name}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {canEdit() && (
                            <button
                              onClick={() => handleReplyToComment(comment.id)}
                              className="reply-comment-btn"
                              title="Reply to comment"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '10px',
                                color: '#6b7280',
                                padding: '1px 4px',
                                borderRadius: '3px'
                              }}
                            >
                              Reply
                            </button>
                          )}
                          {canEdit() && (
                            <>
                              <button onClick={() => handleEditComment(comment)} className="edit-comment-btn" title="Edit comment" style={{ fontSize: '10px' }}>✏️</button>
                              <button onClick={() => handleDeleteComment(comment.id)} className="delete-comment-btn" title="Delete comment" style={{ fontSize: '10px' }}>×</button>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Show replies count and toggle */}
                {replies.length > 0 && (
                  <div style={{ paddingLeft: '8px', borderBottom: '1px solid #f0f0f0' }}>
                    <button
                      onClick={() => toggleCommentThread(comment.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '10px',
                        color: '#6b7280',
                        padding: '3px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: '8px' }}>▶</span>
                      {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                    </button>

                    {/* Collapsed replies */}
                    {isExpanded && (
                      <div style={{ marginLeft: '8px', borderLeft: '2px solid #e5e7eb' }}>
                        {replies.map((reply) => (
                          <div
                            key={reply.id}
                            className={`commentary-item reply-comment ${isRecentlyUpdated(reply.created_at) ? 'recently-changed-comment' : ''}`}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#fafafa',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px'
                            }}
                          >
                            {editingCommentId === reply.id ? (
                              <div className="commentary-item-edit">
                                <textarea
                                  value={editCommentValue}
                                  onChange={(e) => setEditCommentValue(e.target.value)}
                                  className="comment-textarea"
                                  style={{
                                    width: '100%',
                                    minHeight: '50px',
                                    padding: '6px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical',
                                    marginBottom: '4px',
                                    lineHeight: '1.4'
                                  }}
                                  autoFocus
                                />
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button onClick={handleCancelEditComment} className="btn-secondary" style={{ padding: '3px 6px', fontSize: '10px' }}>Cancel</button>
                                  <button onClick={() => handleSaveComment(reply.id)} className="btn-primary" style={{ padding: '3px 6px', fontSize: '10px' }}>Save</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="comment-text ql-editor" style={{ fontSize: '11px', lineHeight: '1.4', wordWrap: 'break-word', padding: 0, margin: 0 }} dangerouslySetInnerHTML={{ __html: reply.comment_text }} />
                                <div className="comment-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#6b7280' }}>
                                  <div className="comment-author">
                                    <span>{new Date(reply.created_at).toLocaleDateString()}</span>
                                    {reply.creator_name && <span> • {reply.creator_name}</span>}
                                  </div>
                                  {canEdit() && (
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                      <button onClick={() => handleEditComment(reply)} className="edit-comment-btn" title="Edit" style={{ fontSize: '9px' }}>✏️</button>
                                      <button onClick={() => handleDeleteComment(reply.id)} className="delete-comment-btn" title="Delete" style={{ fontSize: '9px' }}>×</button>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Reply form for this comment */}
                {replyingToCommentId === comment.id && (
                  <div style={{
                    padding: '6px',
                    paddingLeft: '12px',
                    backgroundColor: '#f9fafb',
                    borderBottom: '1px solid #f0f0f0',
                    borderLeft: '2px solid #00aeef',
                    marginLeft: '8px'
                  }}>
                    <textarea
                      value={newCommentValue}
                      onChange={(e) => setNewCommentValue(e.target.value)}
                      placeholder="Write a reply..."
                      className="comment-textarea"
                      style={{
                        width: '100%',
                        minHeight: '50px',
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        marginBottom: '4px',
                        lineHeight: '1.4'
                      }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button onClick={handleCancelReply} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>Cancel</button>
                      <button onClick={() => handleAddComment(comment.id)} className="btn-primary" style={{ padding: '4px 8px', fontSize: '11px' }}>Reply</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProjectCommentary;
